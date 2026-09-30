#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Audio-orchestration generation monitor (read-only).

Reads the task records, manifests and output files that pycore writes under
``<data dir>/audio_orchestration`` (it never talks to or changes the running
pycore) and reports what is really produced: task states and progress, output
file health, timeline sanity, sentence quality (fragments, code-like text) and
the video of a task (size, duration, extracted frames to look at).

  python audio_orch_monitor.py                     one snapshot of the latest tasks
  python audio_orch_monitor.py --watch             refresh every 5 s (Ctrl+C stops)
  python audio_orch_monitor.py --inspect orch_x    deep check of one task
  python audio_orch_monitor.py --inspect latest --frames 4 --out D:/tmp/frames
  python audio_orch_monitor.py --report            statistics + failure causes of every task
  python audio_orch_monitor.py --json              machine-readable output of any mode
  python audio_orch_monitor.py --rpc ""            files only (do not ask the running pycore)

The running pycore is asked for the in-memory queue state of every task
(queued / waiting / running), so a task waiting behind another run is not
reported as STUCK.

Anomaly codes: FILE_MISSING DURATION_MISMATCH TIMELINE_EMPTY TIMELINE_ORDER
TIMELINE_OVERRUN ITEMS_TIMELINE_MISMATCH FRAGMENT_SENTENCE CODE_LIKE_SENTENCE
LONG_SENTENCE MISSING_RESOURCES FAILED_SEGMENT STUCK VIDEO_MISSING VIDEO_FORMAT.
"""

import argparse
import json
import re
import subprocess
import sys
import time
import urllib.request
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional

RPC_URL = "http://127.0.0.1:59000/api/ui/audio_orch/tasks/list"
RPC_TIMEOUT_SECONDS = 60
RPC_PAGE_SIZE = 20
QUEUE_HOLDING_STATES = ("queued", "waiting", "running")
PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyfoundations.system_paths import get_app_data_dir  # noqa: E402
from pycore.pyutils.common.ffmpeg.ffmpeg_binary import ffmpeg_binary_resolver  # noqa: E402

SOURCE_BOOK = "vocab_book"
DEFAULT_INTERVAL_SECONDS = 5
RECENT_TASKS = 12
STUCK_SECONDS = 180
DURATION_TOLERANCE_SECONDS = 1.0
TIMELINE_OVERRUN_SECONDS = 0.3
MIN_LETTERS = 3
LONG_SENTENCE_CHARS = 300
CODE_SYMBOL_RATIO = 0.3
VIDEO_SIZE = (1280, 720)
RUNNING_STATUSES = ("generating",)


def base_directory() -> Path:
    return get_app_data_dir() / "audio_orchestration"


def read_json(path: Path) -> Optional[Any]:
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def load_tasks() -> List[Dict[str, Any]]:
    tasks = []
    for path in (base_directory() / "tasks").glob("*.json"):
        record = read_json(path)
        if isinstance(record, dict) and record.get("task_id"):
            tasks.append(record)
    tasks.sort(key=lambda task: int(task.get("updated_at") or 0), reverse=True)
    return tasks


class LiveStates(dict):
    """task_id -> queue state of the running pycore; `problem` says why it is
    incomplete ("offline" = nothing listens, "busy" = it did not answer in time)."""

    problem = ""


def live_queue_states(url: str, wanted: int = RPC_PAGE_SIZE) -> LiveStates:
    """Queue states (in memory in the RUNNING pycore) of the newest `wanted` tasks.
    The task files alone cannot tell "stuck" from "queued behind another run"."""
    states = LiveStates()
    page = 1
    while len(states) < wanted:
        request = urllib.request.Request(
            url, data=json.dumps({"page": page, "page_size": RPC_PAGE_SIZE}).encode("utf-8"),
            headers={"Content-Type": "application/json"}, method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=RPC_TIMEOUT_SECONDS) as response:
                body = json.loads(response.read().decode("utf-8"))
        except OSError as error:
            refused = isinstance(error, ConnectionRefusedError) or isinstance(getattr(error, "reason", None), ConnectionRefusedError)
            states.problem = "offline" if refused else "busy"
            return states
        for task in body.get("tasks") or []:
            states[str(task["task_id"])] = {"queue": task.get("queue") or {}, "running": bool(task.get("running"))}
        if page * RPC_PAGE_SIZE >= int(body.get("total") or 0):
            break
        page += 1
    return states


def load_manifest(task_id: str) -> Dict[str, Any]:
    return read_json(base_directory() / "manifests" / f"{task_id}.json") or {}


def probe(path: Path) -> Dict[str, Any]:
    """ffprobe summary of one media file ({} when unreadable)."""
    binaries = ffmpeg_binary_resolver.resolve()
    if binaries.ffprobe is None or not path.is_file():
        return {}
    completed = subprocess.run(
        [str(binaries.ffprobe), "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    return json.loads(completed.stdout) if completed.returncode == 0 and completed.stdout else {}


def duration_of(info: Dict[str, Any]) -> float:
    return float((info.get("format") or {}).get("duration") or 0.0)


def video_stream(info: Dict[str, Any]) -> Dict[str, Any]:
    return next((s for s in info.get("streams") or [] if s.get("codec_type") == "video"), {})


# --------------------------------------------------------------------------- #
# checks                                                                       #
# --------------------------------------------------------------------------- #
def sentence_findings(text: str) -> List[str]:
    """Quality findings of one sentence that will be spoken."""
    findings = []
    letters = len(re.findall(r"[^\W\d_]", text))
    if letters < MIN_LETTERS:
        findings.append("FRAGMENT_SENTENCE")
    elif re.match(r"^[\W\w]{0,12}$", text) and re.search(r"(?:^|\s)[a-z]{1,3}[`'\"]?\.$", text) and letters < 6:
        findings.append("FRAGMENT_SENTENCE")
    symbols = len(re.findall(r"[`<>{}|=@#$^*~\\/_]", text))
    if text and symbols / len(text) >= CODE_SYMBOL_RATIO:
        findings.append("CODE_LIKE_SENTENCE")
    if len(text) > LONG_SENTENCE_CHARS:
        findings.append("LONG_SENTENCE")
    return findings


def check_segment(segment: Dict[str, Any], items: List[Dict[str, Any]], task: Dict[str, Any]) -> Dict[str, Any]:
    problems: List[str] = []
    detail: Dict[str, Any] = {"index": segment.get("index"), "status": segment.get("status")}
    if segment.get("status") == "failed":
        problems.append("FAILED_SEGMENT")
        detail["error"] = segment.get("error")
    output = Path(str(segment.get("output") or ""))
    if segment.get("status") == "done":
        info = probe(output)
        actual = duration_of(info)
        detail["audio_seconds"] = round(actual, 2)
        if not output.is_file():
            problems.append("FILE_MISSING")
        elif segment.get("duration_ms") and abs(actual - segment["duration_ms"] / 1000.0) > DURATION_TOLERANCE_SECONDS:
            problems.append("DURATION_MISMATCH")
        timeline = segment.get("timeline") or []
        detail["clips"] = len(timeline)
        if not timeline:
            problems.append("TIMELINE_EMPTY")
        else:
            if any(a["end_ms"] <= a["start_ms"] for a in timeline) or any(
                b["start_ms"] < a["end_ms"] for a, b in zip(timeline, timeline[1:])
            ):
                problems.append("TIMELINE_ORDER")
            if actual and timeline[-1]["end_ms"] / 1000.0 > actual + TIMELINE_OVERRUN_SECONDS:
                problems.append("TIMELINE_OVERRUN")
            if items and len(items) != len(timeline):
                problems.append("ITEMS_TIMELINE_MISMATCH")
        if str(task.get("output_mode") or "") == "video":
            video = Path(str(segment.get("video_output") or output.with_suffix(".mp4")))
            detail["video_status"] = segment.get("video_status")
            if segment.get("video_status") == "done" and not video.is_file():
                problems.append("VIDEO_MISSING")
            elif video.is_file():
                info_v = probe(video)
                stream = video_stream(info_v)
                detail["video"] = {
                    "size": f"{stream.get('width')}x{stream.get('height')}",
                    "codec": stream.get("codec_name"),
                    "seconds": round(duration_of(info_v), 2),
                    "bytes": video.stat().st_size,
                }
                if (stream.get("width"), stream.get("height")) != VIDEO_SIZE:
                    problems.append("VIDEO_FORMAT")
    for item in items:
        for finding in sentence_findings(str(item.get("text") or "")) if item.get("kind") == "sentence" else []:
            problems.append(finding)
    detail["problems"] = sorted(set(problems))
    detail["problem_counts"] = dict(Counter(problems))
    return detail


def inspect_task(task: Dict[str, Any], live: Optional[Dict[str, Dict[str, Any]]] = None) -> Dict[str, Any]:
    manifest = load_manifest(str(task["task_id"]))
    segment_items = manifest.get("segment_items") if isinstance(manifest.get("segment_items"), list) else []
    resolved = manifest.get("resolved") or {}
    meta = manifest.get("resource_meta") if isinstance(manifest.get("resource_meta"), dict) else {}
    segments = task.get("segments") or []
    checked = []
    for position, segment in enumerate(segments):
        items = segment_items[position] if position < len(segment_items) else []
        result = check_segment(segment, items, task)
        unresolved = sum(1 for item in items if item.get("resource_id") not in resolved)
        if unresolved:
            result["problems"] = sorted({*result["problems"], "MISSING_RESOURCES"})
            result["missing_resources"] = unresolved
            causes = Counter(
                str((meta.get(item.get("resource_id")) or {}).get("error") or "(no error recorded)")
                for item in items if item.get("resource_id") not in resolved
            )
            result["missing_causes"] = dict(causes.most_common(3))
        checked.append(result)
    problems = sorted({p for c in checked for p in c["problems"]})
    updated = int(task.get("updated_at") or 0)
    state = (live or {}).get(str(task["task_id"])) or {}
    queue = state.get("queue") or {}
    holding = bool(state.get("running")) or queue.get("state") in QUEUE_HOLDING_STATES
    if task.get("status") in RUNNING_STATUSES and time.time() - updated > STUCK_SECONDS and not holding:
        problems.append("STUCK")
    sentences = [s.get("text") for s in (task.get("sentences") or [])]
    return {
        "task_id": task["task_id"],
        "name": task.get("name"),
        "source": task.get("source") or SOURCE_BOOK,
        "status": task.get("status"),
        "output_mode": task.get("output_mode") or "(legacy)",
        "age_seconds": int(time.time() - updated),
        "queue": queue.get("state") or (f"(pycore {live.problem})" if live is not None and live.problem else "-"),
        "queue_waiting": queue.get("waiting") or [],
        "phase": (task.get("progress") or {}).get("phase"),
        "message": (task.get("progress") or {}).get("message"),
        "sentences": len(sentences),
        "segments": checked,
        "problems": sorted(set(problems)),
    }


# --------------------------------------------------------------------------- #
# output                                                                       #
# --------------------------------------------------------------------------- #
def one_line(result: Dict[str, Any]) -> str:
    segments = result["segments"]
    done = sum(1 for s in segments if s["status"] == "done")
    audio = sum(float(s.get("audio_seconds") or 0.0) for s in segments)
    videos = sum(1 for s in segments if (s.get("video") or {}).get("size"))
    flags = ",".join(result["problems"]) or "ok"
    return (
        f"{result['task_id']:<18} {result['source'][:8]:<8} {str(result['status']):<10} "
        f"{str(result['output_mode']):<8} seg {done}/{len(segments)} audio {audio:6.1f}s video {videos} "
        f"age {result['age_seconds']:>5}s phase={result['phase']} queue={result['queue']} | {flags}"
    )


def print_task_detail(result: Dict[str, Any]) -> None:
    print(one_line(result))
    print(f"  name: {result['name']}")
    print(f"  progress: {result['message']}")
    for segment in result["segments"]:
        print(f"  segment {segment['index']}: {segment['status']} audio={segment.get('audio_seconds')}s "
              f"clips={segment.get('clips')} video={segment.get('video') or segment.get('video_status')} "
              f"problems={segment['problems'] or 'none'}")
        if segment.get("error"):
            print(f"    error: {segment['error']}")
        for cause, count in (segment.get("missing_causes") or {}).items():
            print(f"    missing x{count}: {cause}")


def extract_frames(task: Dict[str, Any], count: int, out: Path) -> List[str]:
    binaries = ffmpeg_binary_resolver.resolve()
    out.mkdir(parents=True, exist_ok=True)
    written = []
    for segment in task.get("segments") or []:
        video = Path(str(segment.get("video_output") or ""))
        seconds = duration_of(probe(video))
        if not video.is_file() or seconds <= 0:
            continue
        for number in range(count):
            at = seconds * (number + 0.5) / count
            target = out / f"{task['task_id']}_seg{segment.get('index')}_{number + 1}.png"
            subprocess.run([str(binaries.ffmpeg), "-y", "-v", "error", "-ss", f"{at:.2f}", "-i", str(video), "-frames:v", "1", str(target)])
            if target.is_file():
                written.append(str(target))
    return written


def report(tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
    status_counts = Counter((task.get("source") or SOURCE_BOOK, task.get("status")) for task in tasks)
    causes: Counter = Counter()
    fragments = 0
    sentences = 0
    for task in tasks:
        for sentence in task.get("sentences") or []:
            sentences += 1
            fragments += 1 if "FRAGMENT_SENTENCE" in sentence_findings(str(sentence.get("text") or "")) else 0
        if task.get("status") == "failed":
            segment = next((s for s in task.get("segments") or [] if s.get("status") == "failed"), {})
            causes[str(segment.get("error") or (task.get("progress") or {}).get("message_code") or "unknown")] += 1
    return {
        "tasks": len(tasks),
        "by_source_status": {f"{k[0]}:{k[1]}": v for k, v in sorted(status_counts.items(), key=lambda kv: str(kv[0]))},
        "failure_causes": dict(causes.most_common()),
        "sentences": sentences,
        "fragment_sentences": fragments,
    }


def snapshot(count: int, as_json: bool, rpc: str = RPC_URL) -> List[Dict[str, Any]]:
    live = live_queue_states(rpc, count) if rpc else None
    results = [inspect_task(task, live) for task in load_tasks()[:count]]
    if as_json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        print(time.strftime("%Y-%m-%d %H:%M:%S"), f"latest {len(results)} tasks")
        for result in results:
            print(one_line(result))
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only monitor of the audio-orchestration output.")
    parser.add_argument("--watch", action="store_true", help="refresh continuously")
    parser.add_argument("--interval", type=int, default=DEFAULT_INTERVAL_SECONDS)
    parser.add_argument("--count", type=int, default=RECENT_TASKS, help="tasks per snapshot")
    parser.add_argument("--inspect", metavar="TASK_ID|latest", help="deep check of one task")
    parser.add_argument("--frames", type=int, default=0, help="video frames to extract with --inspect")
    parser.add_argument("--out", default="", help="folder for extracted frames")
    parser.add_argument("--report", action="store_true", help="statistics and failure causes of every task")
    parser.add_argument("--json", action="store_true", help="JSON output")
    parser.add_argument("--rpc", default=RPC_URL, help="pycore task list route ('' = files only)")
    args = parser.parse_args()

    if args.report:
        result = report(load_tasks())
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    if args.inspect:
        tasks = load_tasks()
        task = tasks[0] if args.inspect == "latest" and tasks else next((t for t in tasks if t["task_id"] == args.inspect), None)
        if task is None:
            print("task not found")
            return 1
        result = inspect_task(task, live_queue_states(args.rpc) if args.rpc else None)
        if args.json:
            print(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            print_task_detail(result)
        if args.frames:
            frames = extract_frames(task, args.frames, Path(args.out or (base_directory() / "monitor_frames")))
            print("frames:", *frames, sep="\n  ")
        return 0
    if not args.watch:
        snapshot(args.count, args.json, args.rpc)
        return 0
    while True:
        snapshot(args.count, args.json, args.rpc)
        print()
        time.sleep(max(1, args.interval))


if __name__ == "__main__":
    sys.exit(main())
