"""Analyze a Process Monitor CSV export for Chrome tampering / injection.

Answers five questions:

  1. WRITER:     Which non-Chrome process wrote Chrome's config files?
  2. INJECTION:  Which foreign DLL was loaded into chrome.exe?
  3. LAUNCH:     Process Create chain around Chrome launch.
  4. PCA-WRITER: Which process wrote to AppCompatFlags\\Compatibility Assistant\\Store?
  5. SVC-START:  Which process wrote to \\Services\\PcaSvc (changing start type)
                 or triggered services.exe to create a new svchost.exe (=PcaSvc start)?

Usage:
    python analyze-procmon-csv.py <capture.csv> [SUSPECT_CHROME_EXE]
"""

import csv
import os
import sys

# --- Module-level configuration (declared at top) ---------------------------
CONFIG_MARKERS  = ("Secure Preferences", "Preferences", "Local State")
WRITE_OPS       = ("WriteFile", "SetRenameInformationFile", "SetDispositionInformationFile")
REG_WRITE_OPS   = ("RegSetValue", "RegCreateKey", "RegDeleteValue")
CHROME_ROOTS    = (
    r"c:\program files\google\chrome",
    r"c:\program files (x86)\google\chrome",
    r"d:\applications\chrome",
    r"d:\applications\chrome beta",
)
WINDOWS_ROOT    = r"c:\windows"
PCA_STORE_FRAG  = r"compatibility assistant\store"
PCA_SVC_FRAG    = r"\services\pcasvc"
PCASVC_DLL_FRAG = r"pcasvc.dll"
MAX_ROWS        = 60


def is_chrome_path(path):
    p = path.lower()
    return any(p.startswith(r) for r in CHROME_ROOTS)


def is_foreign_module(path):
    p = path.lower()
    if p.startswith(WINDOWS_ROOT):
        return False
    if is_chrome_path(p):
        return False
    return p.endswith(".dll") or p.endswith(".exe")


def main(argv):
    if len(argv) < 2:
        print("usage: python analyze-procmon-csv.py <capture.csv> [SUSPECT_CHROME_EXE]")
        return 2
    csv_path = argv[1]
    if not os.path.isfile(csv_path):
        print(f"ERROR: not found: {csv_path}")
        return 2

    config_writers      = []   # (time, proc, pid, op, path)
    chrome_config_writes = 0
    injected            = {}   # module_path -> set(loader "proc(pid)")
    config_dir_touchers = {}   # non-chrome proc -> count
    proc_creates        = []   # (time, parent, ppid, created)
    pca_store_writers   = []   # (time, proc, pid, op, path, value)
    pcasvc_reg_writes   = []   # (time, proc, pid, op, path, value)
    svchost_creates     = []   # (time, parent, ppid, cmd)  services.exe -> svchost
    rundll_pcasvc       = []   # (time, proc, pid, op, path)  rundll32 loading pcasvc.dll
    total               = 0

    with open(csv_path, "r", encoding="utf-8", errors="replace", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            total += 1
            proc   = (row.get("Process Name") or "").strip()
            pid    = (row.get("PID") or "").strip()
            op     = (row.get("Operation") or "").strip()
            path   = (row.get("Path") or "").strip()
            detail = (row.get("Detail") or "").strip()
            time   = (row.get("Time of Day") or "").strip()
            low_proc = proc.lower()
            low_path = path.lower()
            low_op   = op.lower()

            # 1) Config file writes
            if op in WRITE_OPS and any(m in path for m in CONFIG_MARKERS) and "User Data" in path:
                if low_proc == "chrome.exe":
                    chrome_config_writes += 1
                else:
                    config_writers.append((time, proc, pid, op, path))
            if op in WRITE_OPS and "Google\\Chrome\\User Data" in path and low_proc != "chrome.exe":
                config_dir_touchers[proc] = config_dir_touchers.get(proc, 0) + 1

            # 2) Injected modules
            if op == "Load Image" and is_foreign_module(path):
                injected.setdefault(path, set()).add(f"{proc}({pid})")

            # 3) Process creation
            if op == "Process Create":
                created = path or detail
                proc_creates.append((time, proc, pid, created))
                if low_proc == "services.exe" and "svchost" in (created or "").lower():
                    svchost_creates.append((time, proc, pid, (created or "").strip()))

            # 4) PCA Store registry writes
            if op in REG_WRITE_OPS and PCA_STORE_FRAG in low_path:
                value = detail if "RegSetValue" in op else ""
                pca_store_writers.append((time, proc, pid, op, path, value))

            # 5a) PcaSvc service key registry writes (someone changing start type)
            if op in REG_WRITE_OPS and PCA_SVC_FRAG in low_path:
                pcasvc_reg_writes.append((time, proc, pid, op, path, detail))

            # 5b) rundll32 loading PcaSvc.dll (scheduled tasks re-activating PCA)
            if PCASVC_DLL_FRAG in low_path or (
                low_proc == "rundll32.exe" and PCASVC_DLL_FRAG in low_path
            ):
                if op in ("Load Image", "Process Start", "Process Create") or "pcasvc" in low_path:
                    rundll_pcasvc.append((time, proc, pid, op, path))

    print("=" * 78)
    print(f"Analyzed {total} events from {csv_path}")
    print("=" * 78)

    # --- Section 1 ---
    print("\n## 1. CONFIG HIJACKER — non-Chrome writes to Chrome config files")
    print(f"   (baseline: chrome.exe wrote its own config {chrome_config_writes} times)")
    if not config_writers:
        print("   none")
    else:
        for t, proc, pid, op, path in config_writers[:MAX_ROWS]:
            print(f"   {t}  {proc}({pid})  {op}\n        -> {path}")

    print("\n## 1b. Non-Chrome writes under Chrome User Data")
    if not config_dir_touchers:
        print("   none")
    else:
        for proc, n in sorted(config_dir_touchers.items(), key=lambda kv: -kv[1]):
            print(f"   {proc}: {n} write ops")

    # --- Section 2 ---
    print("\n## 2. INJECTION — foreign DLLs loaded into chrome.exe")
    chrome_injected = {p: who for p, who in injected.items()
                       if any("chrome.exe" in w for w in who)}
    if not chrome_injected:
        print("   none")
    else:
        for path, who in sorted(chrome_injected.items()):
            loaders = ", ".join(sorted(w for w in who if "chrome.exe" in w))
            print(f"   {path}\n        loaded by: {loaders}")
    other = {p: who for p, who in injected.items() if p not in chrome_injected}
    if other:
        print("   -- other foreign modules (non-chrome loaders) --")
        for path, who in sorted(other.items())[:MAX_ROWS]:
            print(f"   {path}  <- {', '.join(sorted(who))}")

    # --- Section 3 ---
    print("\n## 3. PROCESS CREATE chain (watcher / spawned helpers)")
    if not proc_creates:
        print("   (Process Create events not in capture)")
    else:
        interesting = [pc for pc in proc_creates
                       if "chrome" not in pc[1].lower() or "chrome" not in (pc[3] or "").lower()]
        for t, parent, ppid, created in interesting[:MAX_ROWS]:
            print(f"   {t}  {parent}({ppid})  created  {created}")
        print(f"   ... total Process Create events: {len(proc_creates)}")

    # --- Section 4 (NEW) ---
    print("\n## 4. PCA STORE WRITER — who wrote to AppCompatFlags\\Compatibility Assistant\\Store")
    print("   ROOT CAUSE: the process listed here is what keeps adding chrome.exe to PCA Store.")
    if not pca_store_writers:
        print("   none captured (SACL may not have fired, or capture window was too short)")
    else:
        for t, proc, pid, op, path, value in pca_store_writers[:MAX_ROWS]:
            print(f"   {t}  WRITER={proc}({pid})  op={op}")
            print(f"        key=  {path}")
            if value:
                print(f"        value={value}")

    # --- Section 5 (NEW) ---
    print("\n## 5. PCASVC SERVICE RESTARTER — who starts PcaSvc after it is disabled")

    print("\n   5a. Registry writes to \\Services\\PcaSvc (start-type changes)")
    if not pcasvc_reg_writes:
        print("   none")
    else:
        for t, proc, pid, op, path, detail in pcasvc_reg_writes[:MAX_ROWS]:
            print(f"   {t}  {proc}({pid})  {op}  {path}  detail={detail}")

    print("\n   5b. services.exe creating svchost.exe (= a service was started)")
    if not svchost_creates:
        print("   none (correlate timestamps with PcaSvc restart log)")
    else:
        for t, parent, ppid, cmd in svchost_creates[:MAX_ROWS]:
            print(f"   {t}  {parent}({ppid})  -> {cmd}")

    print("\n   5c. rundll32.exe or any process loading/referencing PcaSvc.dll")
    print("   (PcaPatchDbTask and PcaWallpaperAppDetect use rundll32 PcaSvc.dll,*)")
    if not rundll_pcasvc:
        print("   none")
    else:
        for t, proc, pid, op, path in rundll_pcasvc[:MAX_ROWS]:
            print(f"   {t}  {proc}({pid})  {op}  {path}")

    print("\n" + "=" * 78)
    print("VERDICT GUIDE:")
    print("  Section 4 shows the writer of PCA Store entries.")
    print("  Section 5a shows who changed PcaSvc start type back to enabled.")
    print("  Section 5b svchost create timestamps correlate with PcaSvc restart time.")
    print("  Section 5c shows scheduled task invocations that activate PcaSvc.dll.")
    print("  If 5c entries exist near a 4/5b event -> PcaPatchDbTask is the restarter.")
    print("  Run fix-chrome-compat-shim.ps1 (disables those tasks) to fix permanently.")

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
