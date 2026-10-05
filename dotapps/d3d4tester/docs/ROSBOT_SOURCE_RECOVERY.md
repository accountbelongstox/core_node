# ROSBOT source recovery

## Run from the application

1. Build/start `scripts/start.ps1`; open the Decompile tab.
2. Set the ROSBOT directory on the Rosbot tab, or use the existing scan feature.
3. Install/repair the tools from the Decompile tab.
4. Click **Export available sources and attempt DNGuard recovery**.
5. Open the output directory. Each run has its own `decompiled/recovery/<run-id>` directory.
6. Inspect `recovery_report.json`, `recovery.log`, and the method inventories. A partial result is not full source recovery.

The application data root is `Environment.SpecialFolder.UserProfile/.core_node/.d3check`, shared with the existing app. Generated sources and binary research artifacts belong there, not in the repository. When static recovery is incomplete and the runtime collector is installed, the workflow starts a copied target under the JIT capture hook; it never overwrites the original executable.

## Command-line run

Run these PowerShell commands from the repository root. Variables are declared before commands; change the ROSBOT path if necessary.

```powershell
$repository = (Resolve-Path -LiteralPath '.').Path
$project = Join-Path $repository 'dotapps/d3d4tester/tools/decompile/dnguard-static/compatibility/RosbotRecovery.csproj'
$artifacts = Join-Path $repository '.cache/decompile-recovery-build'
$cli = Join-Path $artifacts 'bin/RosbotRecovery/debug/RosbotRecovery.dll'
$rosbot = 'E:\applications\GamesTools\ros-bot36\ros-bot\RoS-BoT.exe'
$data = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.core_node/.d3check'
$tools = Join-Path $data 'tools'
dotnet build $project --artifacts-path $artifacts
dotnet $cli $rosbot $data $tools
```

The CLI installs missing tools if ILSpy is absent. A pre-installed tool root can be passed as the third argument. Exit codes: `0` verified complete recovery, `3` incomplete/partial recovery with a report, `1` execution failure, `2` usage or prerequisite failure. Never interpret the presence of an output EXE as recovery success.

Build the WPF app using:

```powershell
$buildScript = Join-Path $repository 'dotapps/d3d4tester/scripts/start.ps1'
& $buildScript -BuildOnly
```

For an isolated unpacker experiment, use a COPY of the executable and both protector runtime DLLs in the same directory:

```powershell
$copy = Join-Path $data 'decompiled/recovery/<run-id>/dnguard-attempt/RoS-BoT.exe'
dotnet $cli --unpack $copy --noninteractive --methods-only
```

These switches automate only the third-party tool's own console input. The external physical permission-confirmation feature is unchanged.

## Recorded experimental sequence

1. ILSpy/de4dot exported ROSBOT type definitions, settings, and plugin APIs, but retained protected method placeholders. Renaming symbols did not decrypt method bodies.
2. The original method inventory counted 1,900 static IL methods, 41,646 DNGuard placeholder methods and 612 methods without bodies. Lexical counts in exported C# differed; use metadata inventories for comparisons.
3. The pathfinding companion `DXPRecastPathFinding2.dll` yielded real `Path`, `Raycast`, obstacle and navigation-query implementations. This does not recover the main program's `CoreMoveTo` implementation. C++/CLI/native parts may remain non-decompilable even when ILSpy emits files.
4. The downloaded `DNGuard Static Unpacker.rar` was copied to `tools/decompile/dnguard-static`. SHA-256: `B11027E05407DF09C08459217B581CB07141535BC922B45A028D2AA0A2349DBE`. It contained the unpacker, dnlib and supporting files. The original files remain unchanged.
5. Running the tool against an EXE copy without `ucrtbase2.dll`/`ucrtbasex.dll` produced zero-valued structure fields and a misleading saved EXE. This was not successful recovery.
6. Including both runtime DLLs exposed their file version `4.5.1.0`; the tool recognized Enterprise/HVM protection, a 124-byte structure and 44,158 method-table entries, but failed key verification.
7. ILSpy decompiled the unpacker itself. Its readable source enabled compatibility experiments. The source in `compatibility/DNGuard_Unpacker` includes the original implementation and local changes; it is not a newly authored replacement or a claim of redistribution rights.
8. Structure offset `0x28`, rather than the preset `0x10`, supplied the encoded key RVA. XOR with the encryption word yielded RVA `0x00074394`, file offset `0x00072594`. The original Adler/MD5-derived key check passed without bypassing validation.
9. The alternate index-table start was located 232 bytes after the structure's base pointer. Decompression yielded 2,234,720 bytes of method data and 694,212 bytes of locals/EH/token data. The index table occupies 176,632 bytes. These buffers still contain encrypted per-method instructions; they are NOT recovered source.
10. Table decoding without the preset first-20-byte self-XOR produced legal method-header pointers for 719 of the first 1,000 entries. This is a diagnostic sample, not a method-recovery count. Sentinel `0xAFAFAFAF` preserves an existing body rather than treating it as an RVA.
11. The layout uses a 24-bit payload address in relevant table entries and a single HVM-index word after the method header. The legacy parser read ciphertext as a second index word. Locals/EH and HVM table fields were adjusted for the observed layout.
12. The public `FindPaths`/movement methods use protected proxy entries. Existing proxy-decryption algorithms and bounded transformation trials have not yet yielded a verified proxy destination. A `GetAttribute<T>` experiment parsed its header but did not yield valid restored IL.
13. The original tool's invalid-method cleanup removed unresolved placeholder bodies. A resulting EXE had no additional static IL bodies and thousands of empty methods. It was rejected and renamed as unverified. The compatibility tool now fails if zero bodies were restored and skips that cleanup in methods-only mode.

## Output and acceptance rules

- `main-static`: statically available main-program C#; protected placeholders remain clearly reported.
- `libraries`: managed DLL/plugin exports, each with `method_inventory.json`.
- `dnguard-attempt`: EXE/runtime copies, before/after inventories, and extracted research buffers when available.
- `main-recovered`: created only when the unpacker exits successfully AND original protected method tokens become static IL bodies with matching type/name identities.
- `recovery_report.json`: authoritative status, protected-method recovery count, source-export results and tool exit code.
- `recovery.log`: full tool output for the run.

IL validity, metadata references and control flow still need checking before treating a recovered body as trustworthy. Static IL classification is a minimum structural gate, not proof of semantic equivalence. Source exports may contain ILSpy warnings, native-method stubs or unresolved dependency expressions. Full recovery remains unachieved; no license checks or authorization logic were patched. Dynamic runs used copied targets and injected only the method-capture hook.

## Remaining recovery work

The full-method diagnostic pass parsed 2,758 method records and recorded 11,114 decode failures. The legacy reader reported 734 reconstructed methods, but sampled bodies contained `UNKNOWN1`, null branch targets and invalid stack behavior, including the `MoveTo` callback. These 734 results were rejected, not counted as recovered source. The compatibility code now validates opcode legality, operands, branch membership, stack underflow/merges and terminal flow, and restores the original placeholder on validation failure. Re-running the same scan with these checks accepted zero methods. Diagnostic candidate assemblies are explicitly named `-Candidate`, never accepted as verified recovery and must not be executed.

After a failed normal unpacking attempt, the integrated workflow runs a complete diagnostic scan and writes `method_decode_failures.json` and `candidate_methods.json`. The report separately records `DiagnosticScanExitCode` and `StructurallyValidCandidateMethods`; neither indicates full recovery. A diagnostic run intentionally returns failure after saving its artifacts.

The RBAssist extraction run wrote `script.au3` and `lang_cn.ini` to `C:\Users\accou\.core_node\.d3check\decompiled\files\RBAssistCN1.5.22.8.7\299abc87d4544a8994c6ecb3d02b547c`.

The unpacker author's [support list](https://forum.exetools.com/printthread.php?t=21087) lists later versions primarily as Trial support and Enterprise examples in the 3.9.x family. A runtime file version of `4.5.1.0` alone is not evidence that this target's Enterprise cipher is supported.

The integrated export run `1cb862b55bf747e68821388d12409e04` produced 5,919 C# files from 35 assemblies in `C:\Users\accou\.core_node\.d3check\decompiled\recovery`. Main-program C# still contains 41,463 lexical placeholders. `SharpDX.Direct3D11.dll` additionally contains 201 lexical placeholders; it is partial, not a fully recovered dependency. The direct unpacker experiment on that DLL reached a validated alternate key but failed method-buffer alignment. Alignment probing now searches for a matching decompressed-size header rather than applying the main EXE's 232-byte gap to every assembly.

For RBAssist or another individual file, reuse the same CLI:

```powershell
$assist = 'E:\applications\GamesTools\ros-bot36\RBAssist\RBAssistCN1.5.22.8.7.exe'
dotnet $cli --file $assist $data $tools
```

Continue with proxy-cipher/key-schedule compatibility, then HVM operand reconstruction, strings, exception handlers and per-method validation. Run against copies and retain original inventories. Do not bypass key/header validation just to create an EXE, and do not count deleted/no-body methods as restored methods.

## Local dynamic acquisition

On 2026-10-04, the user identified the host as a dedicated test environment and approved direct local acquisition. The target was always copied to a run-specific directory before execution. The original executable and authorization logic were not modified.

Dynamic acquisition is implemented in reusable class libraries rather than in the application UI:

- `dotcore/DotCore.Decompile.Dynamic` owns managed JIT-hook capture, forced preparation, captured-body validation and assembly emission.
- `dotcore/DotCore.Decompile/RuntimeMethodAcquisitionRunner.cs` runs the collector and accepts only exact token/type/name transitions from placeholders to static IL.
- `dotcore/DotCore.Decompile/TtdJitTraceAnalyzer.cs` and the embedded `Ttd/JitExtractorX64.js` own x64 TTD trace analysis.
- `tools/decompile/dnguard-dynamic/collector` is a thin .NET Framework 4.8 executable that loads the reusable acquisition library in the protected runtime.

The collector requires an x64 `jit_hook.dll` at runtime. Set `JitHookPath` when building the application so the native dependency is copied beside the collector. A smoke run against `INIFileParser.dll` captured and emitted all 212 selected methods with no failures.

The formal collector run selected 43,546 methods and observed 18,937 JIT callbacks. It changed 6,515 exact-identity method records from placeholder to static IL, but every accepted transition belonged to `ZYXDNGuarder` proxy/string helpers. The main inventory moved from 1,900 static IL and 41,646 placeholders to 8,415 static IL and 35,131 placeholders. One malformed captured body was rejected for stack imbalance. No application business method was counted as recovered.

Microsoft TTD EULA acceptance was performed interactively by the user. The first managed trace recorded 222 `CILJit::compileMethod` calls; analysis extracted 198 calls covering 168 unique tokens. Of those tokens, 153 were protected entries, but their compiled IL was still the original guard/proxy body. A direct 80-second trace of the identical random-named second-stage executable recorded 1,700 compile calls. SOS inspection reported `FindPaths`, `CanWalk`, `CanRayCast`, `RealDistance`, both `CoreMoveTo` overloads, `MoveTo` and `Interact` as `Not JITTED yet`. These methods therefore cannot be recovered from either trace.

The accepted artifacts are under `C:\Users\accou\.core_node\.d3check\decompiled\dynamic-acquisition\20261004-034641`. The main managed trace is in `ttd-trace-managed`, the direct second-stage trace is in `ttd-trace-child-direct`, and the class-library collector result is in `library-collector`. TTD traces can contain process memory and personally identifiable or security-sensitive data; keep them local.

Dynamic capture can recover only methods that the process actually compiles. Further progress on the movement methods requires a controlled run that exercises those application paths; merely extending idle trace duration will not load them. Diagnostic candidate assemblies remain non-executable and are never accepted as recovered output.

Status: baseline local acquisition is complete. The existing traces, inventories and rejected candidates are retained pending a user-controlled test that exercises the required application paths.

## HVM operand reconstruction checkpoint

The local TTD invocation trace captured 210 target JIT calls covering 124 unique methods and 649 HVM token-helper calls. Context matching associated all 440 relevant token resolutions with 86 HVM methods. The reusable resolver reconstructed raw CIL, metadata operands and local signatures transactionally; a method is restored to its original placeholder if any referenced operand remains unresolved.

The first validated passes recovered 116 HVM methods. One additional constructor was initially rejected because DNGuard returned a tagged `SZARRAY` type handle rather than a direct type definition. The token extractor now records the descriptor kind, element module and element type token, and the resolver emits the corresponding `TypeSpec`. Replaying the existing trace then decoded all 85 methods in that pass, resolved 422 operands and 86 local variables, and rejected no methods. The cumulative inventory is 2,017 static IL methods, 41,529 protected placeholders and 612 methods without bodies: 117 HVM methods have been recovered relative to the original 1,900-static-IL baseline.

The accepted assembly is `C:\Users\accou\.core_node\.d3check\decompiled\dynamic-acquisition\20261004-034641\hvm-analysis\RoS-BoT-HvmResolved-v6.exe`. Its inventory and full C# export are in `inventory-resolved-v6` and `decompiled-resolved-v6`. The v6 export introduced no additional ILSpy warning locations compared with v5. The newly recovered constructor initializes four array fields and its `Me` field instead of throwing the DNGuard runtime placeholder exception.

Full source recovery is still incomplete. In particular, the public `CanWalk`, `CanRayCast`, `RealDistance`, `CoreMoveTo`, `MoveTo` and `Interact` entry points remain protected placeholders. Additional progress requires controlled execution that reaches new application paths, followed by the same capture, operand reconstruction and validation pipeline.
