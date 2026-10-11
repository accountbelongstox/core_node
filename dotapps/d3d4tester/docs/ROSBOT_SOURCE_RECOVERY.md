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

## Recovery principles and technical procedure

DNGuard HVM separates the on-disk guard body from the IL supplied to the runtime compiler. Preparing a public method can compile only its throwing placeholder. A runtime invocation may compile an internal proxy with useful IL and virtual operands instead. Neither a successful invocation nor a saved assembly proves recovery.

The reconstruction pipeline is:

1. Hash the original EXE and protector DLLs; inventory exact method tokens, names, declaring types and body states. Copy the complete target directory into a version-specific workspace.
2. Validate the protector structure and key before decompressing method, index and locals/EH buffers. Keep unresolved ciphertext as research data, not source.
3. Record a controlled copied process with Microsoft TTD. The collector's named initialization event synchronizes recording with the selected trigger. This event is unrelated to the external physical permission-confirmation button.
4. Capture `clrjit!CILJit::compileMethod` entries: call index, module, method identity, IL bytes, maximum stack and exception-handler count. Preserve unidentified IL and raw method-descriptor bytes separately when SOS cannot resolve a method identity.
5. Capture HVM token-helper calls and their runtime-resolved type, method and field handles. Associate each operand resolution with its enclosing JIT call and return address; never combine different captures of the same method indiscriminately.
6. Resolve handles to module-qualified metadata identities. Tagged array descriptors require element-type reconstruction rather than a direct type-definition lookup. Runtime addresses are trace-specific and cannot be transferred between processes.
7. Reconstruct CIL operands and available local signatures. Reject missing operands, invalid branches, stack inconsistencies and missing exception tables. An unrecognized identity remains diagnostic data and is not assigned to a guessed method token.
8. Merge accepted bodies into a fresh copy of the original assembly. Preserve unresolved placeholders and metadata identities. Compare before/after inventories, counting business methods separately from protector helpers.
9. Export the resulting assembly with ILSpy. Structural validation and source export are not proof of runtime equivalence. Original comments, source layout and local variable names generally cannot be recovered from the binary.

Reuse the existing CLI stages: `--analyze-jit-ttd`, `--analyze-hvm-ttd`, `--build-hvm-context`, `--analyze-hvm-metadata`, `--analyze-hvm-locals`, then collector `--resolve-hvm-operands` and `--merge-hvm`. Use new output names for every pass. Index a trace once before running additional analyses against it; concurrent initial indexing previously caused an extraction failure.

Collector `--prepare-many-event <target> <event> <tokens...>` prepares methods without invoking their bodies. `--invoke-static-many-event-warmup <target> <event> <warmup-tokens,...> <tokens...>` invokes explicitly selected warmup methods before waiting for the recorder, then invokes selected static methods. Warmup can reduce repeated initialization work but does not guarantee that all selected methods fit inside the trace size limit. Do not use casting or attack operations as generic warmup methods.

Reference mechanisms: [DNGuard HVM](https://www.dnguard.net/productmore.php), [JitDumper](https://github.com/Anonym0ose/JitDumper), [Microsoft TTD recording](https://learn.microsoft.com/en-us/windows-hardware/drivers/debuggercmds/time-travel-debugging-ttd-exe-command-line-util), and [CLR method descriptors](https://github.com/dotnet/runtime/blob/main/src/coreclr/vm/method.hpp). CLR token encoding varies by runtime layout; raw descriptor low bits alone are not a verified method identity.

## CN_36.10031 experimental sequence and checkpoint

The following records the October 10-11, 2026 experiments; earlier sections describe the older target and remain historical checkpoints.

1. Compared original targets. The older EXE SHA-256 is `EB9194F167716A6A6A178C5385C1BEF720E7BF223DE809FB5B0A066E8F42D899`; CN_36.10031 is `AAF7BB4FD02248449AFAB4559E54CD2893B1793F8EE667126CEC879710EF3D1C`. Both protector DLL hashes and version `4.5.1.0` matched. This is no evidence of an upgraded protection engine, not proof that every protected payload is identical.
2. The newer baseline contains 44,150 methods: 1,891 static IL, 41,642 placeholders and 617 without bodies. The older baseline contains 44,158 methods. The decompressed method payload increased from 2,234,720 to 2,244,520 bytes, and parsed records from 2,758 to 2,981. The older v11 HVM result recovered 122 methods relative to its own baseline; do not mix that count with the newer baseline.
3. Distance invocation captured 67 target JIT calls covering 46 tokens. HVM context matching reconstructed 21 accepted methods, including 20 business methods and one helper.
4. Event-synchronized distance recording captured 204 target JIT calls covering 118 tokens; operand context matching associated 440 calls with 86 methods. The resolver recovered 86 bodies. This pass includes the preceding distance result, so the counts are not additive.
5. Raycast recording recovered one additional private forwarding method. Merging the accepted distance and raycast results produced `RoS-BoT-HvmResolved-v4.exe`: 87 transitions, 86 business methods and one helper, with zero merge failures.
6. The first state-getter trace produced 191 identity-extraction failures. Retrying SOS at JIT-call return and at trace end did not resolve the affected descriptors. The upgraded extractor retained 190 unidentified IL calls covering 106 handles. These are not recovered methods. Reading selected descriptors at JIT entry found nonzero data; at trace end some regions were zero. This observation does not establish the cause of protection or recording behavior.
7. Added explicit pre-recording warmup using the previously exercised distance proxy. A 128 MB recording filled during initialization; a 768 MB retry recorded `get_IsInGame` successfully. It captured 69 target JIT calls covering 43 tokens, with six failures, and 305 HVM helper calls covering 61 virtual tokens.
8. Warm-state reconstruction accepted 20 business methods and 123 operands. Two additional entries were rejected: an unresolved type token and a missing exception-handler table. Merging accepted bodies into the original baseline produced `RoS-BoT-HvmResolved-v5.exe` with 107 transitions, 106 business methods and one helper; the merge reported zero failures.
9. The v5 inventory contains 1,998 static IL methods, 41,535 placeholders and 617 without bodies. Its C# export completed as `decompiled-hvm-resolved-v5/RoS-BoT-HvmResolved-v5.decompiled.cs`. Full recovery remains incomplete.
10. Located casting implementation type `0x02000832`: `Cast` = `0x06003AE5`, `CastEx` = `0x06003AE3`, `CanCast` = `0x06003ADD`, `PowerCooldown` = `0x06003ADE`. Combat routine type `0x020000AB`: `DoAttack` = `0x060004DB`. A synchronized preparation-only trace captured all five, but each remained an 11-byte placeholder. No casting or attack body was executed in this experiment, and no implementation was recovered.
11. A subsequent warmed read-only batch exercised nine player getters: seven returned successfully and two reported null references. The trace is being analyzed; successful triggering alone is not an accepted recovery count.

Artifacts for this target are under `C:\Users\accou\.core_node\.d3check\decompiled\cn-3610031-runtime-20261010`. The accepted v5 comparison is `hvm-resolved-v5-validation.json`; per-method inventories, rejected-entry logs, original copies and traces are retained there. Keep traces local because they include process memory. The next work is to reconstruct the player-batch operands, validate method-descriptor identity recovery against this actual CLR version, and acquire the still-missing casting/combat implementation paths without inventing bodies or changing authorization logic.

## Strict local-signature audit and corrected checkpoint

The earlier CN_36.10031 counts of 107, 138 and 143 describe transitions accepted by a weaker validator, not fully valid recovered implementations. A later audit found that implicit local instructions such as `stloc_0` could survive stack validation without a corresponding local declaration. Such candidates can produce ILSpy out-of-bounds-local warnings and must not be treated as recovered source.

The resolver now checks implicit and explicit local indices, associates local reconstruction with the exact accepted JIT call, and rolls back the original body when local restoration fails. Reprocessing the distance, event-distance, raycast, warm-state and player-batch traces, together with five local-free skill forwarding methods, produced `RoS-BoT-HvmResolved-Strict-v1.exe`: 83 business-method transitions, no protector helpers and zero merge failures. `strict-v1-validation.json` records the comparison. This supersedes the weaker acceptance checkpoint above; it still does not prove runtime equivalence or complete source recovery. Earlier artifacts remain available as diagnostics.

The full skill-readiness local replay failed inside the recorded trace and produced no locals output. A narrowed replay for six private casting-class methods completed, but returned zero matching local types. A second pass recorded differing signature pointers and contents; none passed byte-exact matching. These mismatches do not establish either a signature alias or upgraded protection. Additional signature-data and JIT-interface diagnostics are being collected without guessing local types or merging rejected bodies. Public `CastEx`, `Cast`, `CanCast` and combat `DoAttack` implementations remain unrecovered.

## Caster-readiness continuation

The extended local-signature diagnostics recovered usable primitive locals for four private casting-class methods. Resolving only `0x06003E0A` (`_02.32`), `0x06003E33` (`_02.5B`), `0x06003E34` (`_02.5C`) and `0x06003E40` (`_02.68`) decoded four methods, 18 metadata operands and eight locals without unresolved operands, rejected methods or resolver failures. Merging them with the strict v1 checkpoint produced `RoS-BoT-HvmResolved-Strict-v4.exe`: 87 business-method transitions, no protector helpers and zero merge failures. `strict-v4-validation.json` records the comparison, and `decompiled-caster-strict-v4` contains the casting-type C# export. Its selected methods have no ILSpy warning markers, and normalized PEVerify `/IL` output is identical to strict v1.

`RoS-BoT-HvmResolved-Strict-v2.exe` is rejected as a checkpoint. Its additional `0x06003DBF` (`_01.E6`) body bound `System.Func<int, float>.Invoke` to a different constructed `Func` member reference, producing two new verifier errors and an ILSpy type-stack warning. The operand resolver now retains the runtime method name, includes it in its resolution cache identity, and matches constructed generic declaring-type arguments before accepting an imported member reference. An unmatched generic instance is rejected instead of selecting the first reference that shares a generic method definition.

This checkpoint improves private caster-readiness coverage only. Public `CastEx`, `Cast`, `CanCast`, `PowerCooldown` and combat `DoAttack` remain protected placeholders, so full casting and attack source recovery is still incomplete.

## Player-batch local-signature continuation

Replaying the 1 GB player-batch trace exposed overlapping JIT ranges: a long selected compilation could contain nested non-selected compilations, causing local-signature calls to be assigned to the wrong method. The local-type extractor now builds ranges for every JIT compilation and associates each helper call with the innermost range before applying the selected-call filter. Raw signatures beginning with the local-signature marker `0x07` are retained as diagnostics but are not accepted without the existing byte-exact signature match, because the trace demonstrated that such calls can belong to an inlinee.

The corrected range analysis isolated one additional recoverable body, `0x06002158`, the `YLI!(fB-M&DNPQQH/Nl{;6k~&::.ctor(System.TimeSpan)` constructor. Its seven virtual metadata operands resolved without failure. The initially observed `System.Diagnostics.Stopwatch` local belonged to an inlinee and was rejected after PEVerify reported two new type-stack errors. The constructor's actual numeric local was restored as `int32`, matching its `xor`, `rem.un` and `mul` instruction chain. ILSpy then emitted `.locals init ([0] int32)` for the accepted body without a local or stack-analysis warning.

Merging this single body with strict v4, using the original target as the merge base, produced `RoS-BoT-HvmResolved-Strict-v5d.exe`: 88 business-method transitions, no protector helpers and zero merge failures. The v4/v5d catalogs contain 44,150 methods each and differ in protection state only for `0x06002158`; protected placeholders decreased from 41,555 to 41,554. Both PEVerify `/IL` logs contain the same 72 pre-existing dependency errors, and their normalized error sets are identical. The accepted file is 11,416,064 bytes with SHA-256 `FE061C6E6D8AA0E2D49CF28394A0466BC2C4187019F44A53743FA35A9FBF4325`. Full recovery remains incomplete, and the public casting and combat entry points listed above remain protected.

## Kimi continuation workspace

To avoid sharing the working directory with the previous agent, a dedicated copy was created at `C:\\Users\\accou\\.core_node\\.d3check\\decompiled\\cn-3610031-runtime-20261010-kimi`. It contains the strict v5d base assembly, the target directory copy, verification logs, the method catalog and reference C# exports. Kimi is continuing recovery from this workspace; new traces and merged checkpoints will be written there. The still-protected casting and combat entry points listed above are the immediate targets.

## Public skill entry-point continuation

Five local-free static forwarding bodies recovered by the skill-readiness trace call public `LocalPlayer` entry points with matching names and signatures. The alias mapper validates the protected target, recovered source, exact source/target signature and the forwarded call name and signature before cloning a body. It also rebuilds from the preserved CN_36.10031 original target while merging the accepted checkpoint in memory, because a rewritten checkpoint cannot safely serve as the resource-writing base.

Using strict v5d as the recovered source produced `RoS-BoT-HvmResolved-Strict-v6c.exe`: 88 accepted bodies were replayed from v5d and five aliases were mapped without failure. The recovered public entries are `0x06003951` `PowerCooldown` from `0x06003F4E`, `0x06003952` `PowerCooldownLeft` from `0x06003F30`, `0x06003953` `HasEnoughCharges` from `0x06003F88`, `0x06003954` `ChargeCount` from `0x06003F25`, and `0x06003955` `HasEnoughResource` from `0x06003F33`.

The v5d/v6c catalogs contain 44,150 methods each and differ in protection state only for those five tokens; protected placeholders decreased from 41,554 to 41,549, giving 93 accepted business-method transitions. ILSpy emits all five public forwarding bodies without warning markers. PEVerify `/IL` emits the same 72 normalized error lines for v5d and v6c, with the verifier summary reporting the same 76 pre-existing errors. The accepted file is 11,416,064 bytes with SHA-256 `FE64708E2EC61D5FE9A8C2D833632104E3F8919C8A044D1AEB76CED5C1A2B1EA`. Full recovery remains incomplete; public `CastEx`, `Cast`, `CanCast`, `IsCastChannel` and combat `DoAttack` remain protected.
