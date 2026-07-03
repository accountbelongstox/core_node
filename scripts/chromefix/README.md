# chromefix — Chrome hijack / crash response

Toolkit for diagnosing and fixing a hijacked or crashing Google Chrome on
Windows. Built for the case where Chrome shows **"settings were changed from
outside of Chrome … Pinned tabs"** and/or crashes on launch with
**`STATUS_STACK_BUFFER_OVERRUN` (0xC0000409)**.

## Scripts

| Script | Purpose |
|--------|---------|
| `fix-chrome-compat-shim.ps1` | **The actual fix for the `0xC0000409` crash on this machine.** Finds and (with `-Apply`) removes legacy "compatibility mode" AppCompat shims (e.g. `~ VISTARTM`) on chrome.exe that break CET. Dry-run by default. |
| `capture-chrome-tamper.ps1` | Reproduces the crash under three live instruments (Process Monitor trace + file-system 4663 auditing + loaded-module snapshots) to catch any external config-writer or injected DLL. Elevated. Writes `capture.csv`. |
| `analyze-procmon-csv.py` | Parses the ProcMon `capture.csv`: non-Chrome processes writing Chrome config, foreign DLLs loaded into chrome, and the process-create chain. |
| `diagnose-chrome-hijack.ps1` | Read-only forensic sweep (17 sections): shortcuts, Chrome policies, force-installed extensions, Secure Preferences, Run keys, IFEO debugger, AppInit_DLLs, proxy/PAC, scheduled tasks, services, running processes, binary signatures, hosts, Defender detections, recently-modified files. Changes nothing. |
| `clean-chrome-hijack.ps1` | Removes malware archives + extracted temp payloads and backs up (renames, never deletes) the corrupted Chrome session/preference files. **Dry-run by default**; `-Apply` to act, `-Scan` to also start a Defender full scan. |
| `compare_chrome.py` | Compares two Chrome installs: chrome.exe hash + Authenticode signature, plus full per-file MD5 of both Application directories. |

## Confirmed root cause on this machine (2026-06-28)

`D:\applications\Chrome\Chrome\Application\chrome.exe` crashed with
`STATUS_STACK_BUFFER_OVERRUN` right after a page rendered; the
`C:\Program Files\…` copy did not. Live instrumentation **ruled out** malware as the
crash cause: a 739k-event Process Monitor trace showed **no external process writing
Chrome's config and no DLL injected into any chrome.exe** (file-system 4663 auditing
agreed — only chrome.exe wrote its own config).

The real cause: an **AppCompat "Windows Vista compatibility mode" shim** was set on the
D-path only — `HKLM\…\AppCompatFlags\Layers` → `D:\…\chrome.exe = ~ VISTARTM`. The
legacy compat engine is incompatible with **Intel CET / Hardware-enforced Stack
Protection**: the renderer hit a *shadow-stack return-address mismatch*
(`Microsoft-Windows-Security-Mitigations/KernelMode` Event ID 26) and Windows killed it
with `0xC0000409`. Controlled A/B proof: **with the shim 6/6 launches crashed; after
removing it, 0/6**. Fix = `fix-chrome-compat-shim.ps1 -Apply`.

> Separately, Defender had quarantined a real HackTool (`HackTool:Win32/Malgent!MSR`
> from `一加全能工具箱21.2.exe`) earlier the same day — genuine, but **not** the cause of
> this crash. The two findings are independent.

Run the project Python via `D:\.dev_win10\python311\python.exe` (not the PATH `python`).

## How the two symptoms work

- **"Changed from outside of Chrome / Pinned tabs"** — Chrome signs security-sensitive
  prefs (homepage, startup URLs, default search, extension list, **pinned tabs**) with a
  per-value **HMAC-SHA256** stored in `protection.macs` of `Secure Preferences`, plus a
  roll-up `super_mac`. On launch it recomputes them; if a value changed without a matching
  MAC (i.e. edited by a non-Chrome process), Chrome resets that setting and shows the toast.
  The reset is a *symptom* — the cause is an external writer (hijacker/PUP) or a tool that
  edited the profile out-of-band.
- **`0xC0000409` in `chrome.dll` at launch** — a `__fastfail` (stack-cookie / CHECK).
  Usual causes: a foreign DLL injected into the process (search-order hijack / global hook),
  or **corrupted profile data** (poisoned session/pinned-tab/preferences) that fails an
  internal CHECK on load. Decisive test: launch with a throwaway profile
  (`chrome.exe --user-data-dir="%TEMP%\probe"`). Works clean ⇒ profile is the cause;
  still crashes ⇒ environmental (injection/hook) — go to ProcMon/Process Explorer.

## Manual deep-dive: Process Monitor + Autoruns

Find the external process rewriting Chrome config:
1. Run **ProcMon** elevated. Filter (Ctrl+L), Include `Path contains` each of
   `Secure Preferences`, `Preferences`, `Local State`, and `Policies\Google\Chrome`.
   Include `Operation is` `WriteFile` / `CreateFile` / `SetRenameInformationFile` /
   `RegSetValue`. Then **Exclude** `Process Name is chrome.exe`.
2. Restart Chrome with capture on. Any surviving row is the external writer — read its
   **Process Name**, **Process Tree** (Ctrl+T) and event **Stack** for the image path.
3. Use **Enable Boot Logging** to catch writers that fire at/ before logon.

Map persistence:
- Run **Autoruns** elevated → Options: *Hide Microsoft/Windows entries*, *Verify Code
  Signatures*, *Check VirusTotal.com*. Sweep **Logon, Scheduled Tasks, Services, Drivers,
  Image Hijacks (IFEO), AppInit, Winlogon, Explorer**. Right-click → *Jump to Image* /
  *Jump to Entry* to clean the file + registry key.
- Audit `chrome://policy` and `chrome://extensions` for force-installed extensions /
  "Managed by your organization" on a personal PC; remove the keys under
  `HKLM|HKCU\SOFTWARE\Policies\Google\Chrome` (`ExtensionInstallForcelist`, …) and
  `…\SOFTWARE\Google\Chrome\Extensions`.

## Recommended tools — download ONLY from these official URLs

> Avoid fake "PC cleaners", "registry optimizers", "driver updaters" — many are themselves
> PUPs. Third-party download portals often wrap installers with bundled offers.

**Diagnostics (Microsoft Sysinternals):**
- Process Monitor — https://learn.microsoft.com/en-us/sysinternals/downloads/procmon
- Autoruns — https://learn.microsoft.com/en-us/sysinternals/downloads/autoruns
- Process Explorer — https://learn.microsoft.com/en-us/sysinternals/downloads/process-explorer

**Cleanup / second-opinion scanners (free, on-demand, run beside Defender):**
- Malwarebytes AdwCleaner (browser-hijacker/PUP specialist, use first) — https://www.malwarebytes.com/adwcleaner
- Malwarebytes Free — https://www.malwarebytes.com/mwb-download
- ESET Online Scanner — https://www.eset.com/us/online-scanner/
- Kaspersky Virus Removal Tool (KVRT) — https://www.kaspersky.com/downloads/free-virus-removal-tool
- Sophos Scan & Clean / HitmanPro — https://www.sophos.com/en-us/free-tools
- RogueKiller (Adlice) — https://www.adlice.com/roguekiller/

**Built-in Microsoft (no download):**
- Microsoft Defender Offline scan (rootkit-class, pre-boot) — Windows Security → Virus & threat protection → Scan options
- Microsoft Safety Scanner (MSERT) — https://learn.microsoft.com/en-us/defender-endpoint/safety-scanner-download

## Hardening

Install extensions only from the Web Store; scrutinize bundled/cracked freeware (the main
PUP vector); keep Chrome + Windows updated; prefer running as a standard (non-admin) user so
HKLM policy/IFEO writes are blocked; keep exactly one real-time AV (Defender is enough).
