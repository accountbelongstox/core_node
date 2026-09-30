# TEST: pycore clip transfer on desktop-1l9k06n (`/pycore-api`)

Status: open. The client side and the new pycore routes are implemented; LAN transfer is slow
because of server-side word lookup latency on this machine (section 3).
Design: docs_fix/REQUIREMENTS_20260930_WORDNEW_CLIENT_ORCHESTRATION.md sections 4.6-4.8.
Target: `https://desktop-1l9k06n.thresher-python.ts.net/pycore-api/` (Windows, FrankenPHP/Caddy
reverse proxy of loopback pycore `127.0.0.1:59000`; contract `access.tailnet.pycore_path`).

## 1. Scope for the next developer

- Work only on pycore (and its Caddy mount) on desktop-1l9k06n. Follow `development-guides/PYTHON_PYCORE.md`
  (no try/except in new code, THREAD_BUS owners, one-way layering, English, i18n).
- The wire format is fixed by `config/audio_orchestration_contract.json` `transfer`. Change it only
  together with `core/integrations/pycore/PycoreApiOrchestrationResources.ts` (`parseOrchResourceBundle`).
- The wordnew client already uses the routes below. A pycore without `resource/bundle` falls back to
  `resource/lookup` + `resource/chunk`.

## 2. Routes under test

All paths are relative to `B=https://desktop-1l9k06n.thresher-python.ts.net/pycore-api/api`.
Send header `X-Pycore-Client-ID: probe` (any value). The Caddy mount makes callers loopback, so K7
admits them.

| Route | Method | Body / query | Answer |
|---|---|---|---|
| `status` | GET | - | JSON, `is_http_service: true` |
| `ui/audio_orch/resource/lookup` | POST | `{items:[{kind,language,text}]}` (<=500) | JSON `{success, items:[{key,hit,bytes,path,meaning}]}` in order |
| `ui/audio_orch/resource/bundle` | POST | same items (<=64) | `application/x-core-node-clip-bundle`: per item `u32 BE header length` + JSON `{index,key,hit,bytes,sent,meaning}` + `bytes` of mp3 when `sent`; the first hit is always sent, hits past 8 MB are `sent:false` |
| `ui/audio_orch/resource/file` | GET | `?kind=&language=&text=` | raw `audio/mpeg` (200), 404 on a miss, ETag / 304 |
| `ui/audio_orch/resource/chunk` | POST | `{kind,language,text,offset}` | legacy JSON base64 chunk (1 MB) |

`kind` is `word` or `sentence`. Keys and ids: `resource_id = sha256("kind:language:normalized text")`,
matching the client (`shared/orchestration`) and Laravel.

## 3. Findings (2026-10-01, measured from debian-cpu on the same LAN)

- Tailscale is already direct on the LAN: `tailscale status` shows
  `desktop-1l9k06n active; direct 192.168.1.234:41641` and the phone `oneplus-13r direct
  192.168.1.185`. `tailscale ping` takes 11 ms. The tailnet domain is not the bottleneck, and a
  plain LAN IP would not be faster (pycore K7 also refuses unsigned LAN callers:
  docs_fix/TODO_20261001_PYCORE_LAN_PHONE_ACCESS.md).
- `GET status` takes 40 ms; a sentence lookup 45-50 ms; a miss (`file?text=banana`) 42 ms.
- **Word hits are slow and erratic:** `file` for `hello` took 10.5 s, `world` 4.7 s, `apple`
  0.06 s. `lookup` for 1 word took 0.57-0.63 s; `bundle` for 1 word 0.84-2.0 s; 4 items 6.8 s for
  38 KB.
- So the per-request cost is server-side, in the word path.

Suspects, to verify on the desktop (profile, don't guess):
1. The `tts.word_audio_cache_index` serialized owner (`pyutils/tts/word_audio_cache.py`,
   `_lookup` / `note_stored` are `@serialized_method`). Calls queue behind a busy owner thread (TTS
   generation storing words, `load_all` still running after a restart). While a language is not
   loaded, `find_cached_many` does a full `os.scandir` of `word_audio/<lang>`.
2. `validate_mp3` on each hit (`pyutils/tts/audio_validation.py`): a file read and parse per clip.
3. `dictionary_service.translate` for the meaning of English words (only in lookup and bundle, but
   `file` is also slow, so this is not the only cause).
4. `await_bus_task` per sync route (`pyutils/rpc_v2/execution.py` `_invoke_sync_handler`): thread
   start / bus contention while the orchestration queue or TTS lanes run.

## 4. Test procedure

Run from any tailnet machine (bash or PowerShell; use `curl.exe` on Windows).

```bash
B=https://desktop-1l9k06n.thresher-python.ts.net/pycore-api/api
H=(-H "Content-Type: application/json" -H "X-Pycore-Client-ID: probe")

# T1 reachability and mount
curl -s -o /dev/null -w "status %{http_code} %{time_total}s\n" $B/status

# T2 per-kind latency (repeat 5x; record min / max)
for w in hello world apple; do
  curl -s -o /dev/null -w "file $w %{http_code} %{time_total}s %{size_download}B\n" \
    "$B/ui/audio_orch/resource/file?kind=word&language=en&text=$w" -H "X-Pycore-Client-ID: probe"
done
curl -s "${H[@]}" -X POST -o /dev/null -w "lookup %{time_total}s\n" \
  -d '{"items":[{"kind":"word","language":"en","text":"hello"}]}' $B/ui/audio_orch/resource/lookup

# T3 bundle throughput: 64 real items of a book (take texts from a wordnew task or pycore's cache)
curl -s "${H[@]}" -X POST --data @items64.json -o bundle.bin \
  -w "bundle %{http_code} %{size_download}B %{time_total}s %{speed_download}B/s\n" \
  $B/ui/audio_orch/resource/bundle

# T4 frame check (python): every header parses, sent payload length == bytes, index order == request order
python - <<'EOF'
import json, struct
b = open("bundle.bin", "rb").read(); o = 0
while o < len(b):
    n = struct.unpack(">I", b[o:o+4])[0]; h = json.loads(b[o+4:o+4+n]); o += 4 + n
    o += h["bytes"] if h["sent"] else 0
    print(h["index"], h["hit"], h["sent"], h["bytes"], h["meaning"])
assert o == len(b)
EOF

# T5 cache headers: second request with If-None-Match answers 304
E=$(curl -sI "$B/ui/audio_orch/resource/file?kind=word&language=en&text=apple" -H "X-Pycore-Client-ID: probe" | tr -d '\r' | awk -F': ' 'tolower($1)=="etag"{print $2}')
curl -s -o /dev/null -w "304? %{http_code}\n" -H "If-None-Match: $E" -H "X-Pycore-Client-ID: probe" \
  "$B/ui/audio_orch/resource/file?kind=word&language=en&text=apple"

# T6 invalid bundle (65 items) answers JSON {success:false, error:"ORCH_RESOURCE_BUNDLE_INVALID"}
```

On the desktop, also time the pieces in-process (outside HTTP) to separate handler cost from
queueing:
`orch_service.resource_lookup`, `word_audio_cache.find_cached_many`, `validate_mp3`,
`dictionary_service.translate`, and `word_audio_cache_index._lookup` while TTS generation is running and
while it is idle.

## 5. Acceptance criteria

| # | Criterion |
|---|---|
| A1 | T2: word `file` / `lookup` for a cached word <= 100 ms (p95 over 20 calls), with TTS lanes idle and busy |
| A2 | T3: a 64-item bundle of cached clips <= 1.5 s, throughput >= 5 MB/s on the LAN |
| A3 | T4 passes (frames exact, order kept, `sent:false` only past the 8 MB budget) |
| A4 | T5 answers 304; T6 answers the JSON error |
| A5 | No change to the frame format or route names without updating the contract and the TS parser |
| A6 | wordnew on the phone (API center: pycore = `https://desktop-1l9k06n.thresher-python.ts.net/pycore-api`): the resolve-progress panel shows the pycore chip with that URL, and the live rate (`↓ …/s`) of a book task well above the pre-fix level |

## 6. Client-side reference (do not change for this task)

- Bundle client: `core/integrations/pycore/PycoreApiOrchestrationResources.ts` (`orchResourceBundle`,
  `orchResourceFile`, `parseOrchResourceBundle`); `PycoreClient.postBinary`.
- Source chain: `shared/orchestration/orchPycoreClipSource.ts` (bundles of 64, deferred hits re-asked, fallback
  lookup + chunk); wordnew `apps/wordnew/services/orchestration/WordNewOrchClipSources.ts`.
- APIs in use: `session.endpoints` -> `apps/wordnew/components/orch-compose/WordNewOrchApiEndpoints.tsx`.
