"""Print one JSON line describing this interpreter's YOLO training stack (read by DotCore.YoloTrain.YoloEnvironmentProbe)."""
import json
import os
import shutil
import sys
import sysconfig

MARKER = "@@YOLO_ENV@@"

report = {"python": sys.executable, "version": sys.version.split()[0]}

try:
    import torch

    report["torch"] = torch.__version__
    report["cuda"] = bool(torch.cuda.is_available())
    report["cuda_version"] = torch.version.cuda
    report["devices"] = [torch.cuda.get_device_name(i) for i in range(torch.cuda.device_count())] if report["cuda"] else []
    mps = getattr(torch.backends, "mps", None)
    report["mps"] = bool(mps is not None and mps.is_available())
except Exception as exc:  # report, never fail the probe
    report["torch_error"] = str(exc)

try:
    import ultralytics

    report["ultralytics"] = ultralytics.__version__
except Exception as exc:
    report["ultralytics_error"] = str(exc)

scripts_dir = sysconfig.get_path("scripts") or ""
cli = None
for name in ("yolo.exe", "yolo"):
    candidate = os.path.join(scripts_dir, name)
    if os.path.isfile(candidate):
        cli = candidate
        break
report["yolo_cli"] = cli or shutil.which("yolo")

print(MARKER + json.dumps(report))
