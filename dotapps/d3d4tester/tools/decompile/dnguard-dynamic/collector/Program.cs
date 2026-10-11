// PY-REF: none (DOT-only)
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Web.Script.Serialization;
using DotCore.Decompile.Dynamic;

namespace DotApps.d3d4tester.Tools.DnGuardDynamicCollector;

internal static class Program
{
    public static int Main(string[] args)
    {
        string targetPath;
        string sourcePath;
        string outputPath;
        string tokenText = string.Empty;
        int? methodToken = null;
        bool prepareMethod = false;
        TimeSpan compilationDelay = TimeSpan.Zero;
        IReadOnlyCollection<int>? selectedTokens = null;
        bool delayedInvocation;
        bool eventInvocation;
        bool warmupInvocation;
        IReadOnlyList<int>? warmupTokens = null;
        string initializationEvent = string.Empty;
        int tokenOffset;
        DynamicMethodAcquisitionReport report;
        DynamicMethodAcquisitionOptions options;
        NativeHvmAnalysisReport hvmReport;
        DynamicMethodAssemblyMergeReport mergeReport;
        HvmMethodAliasReport aliasReport;
        HvmOperandResolutionReport resolutionReport;
        DynamicMethodPreparationReport preparationReport;
        DynamicMethodInvocationReport invocationReport;
        IReadOnlyList<DynamicMethodInvocationReport> invocationReports;
        IReadOnlyList<int> methodTokens;
        IReadOnlyList<HvmMethodAliasMapping> aliasMappings;
        ISet<uint> selectedMethodTokens;
        HvmContextDocument contextDocument;
        HvmMethodMetadataDocument metadataDocument;
        HvmJitCaptureDocument captureDocument;
        HvmLocalTypeDocument localTypeDocument;
        IReadOnlyList<NativeHvmInstruction> instructions;
        IReadOnlyList<NativeHvmRuntimeSnapshot> snapshots;
        JavaScriptSerializer serializer;
        try
        {
            if (args.Length >= 4 && args[0] == "--prepare-many-event")
            {
                methodTokens = args.Skip(3).Select(value => int.Parse(value.Replace("0x", string.Empty),
                    NumberStyles.HexNumber, CultureInfo.InvariantCulture)).ToArray();
                foreach (DynamicMethodPreparationReport item in new DynamicMethodPreparer().PrepareMany(args[1], methodTokens,
                    initialized: () =>
                    {
                        using var gate = new System.Threading.EventWaitHandle(false,
                            System.Threading.EventResetMode.AutoReset, args[2]);
                        Console.WriteLine($"Preparation ready: process={System.Diagnostics.Process.GetCurrentProcess().Id}, selected={methodTokens.Count}.");
                        if (!gate.WaitOne(TimeSpan.FromMinutes(1)))
                            throw new TimeoutException("The recorder initialization event was not signaled.");
                    }))
                    Console.WriteLine($"HVM PREPARED token=0x{item.MethodToken:X8} method={item.MethodName}");
                return 0;
            }
            if (args.Length == 3 && args[0] == "--catalog")
            {
                serializer = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
                outputPath = Path.GetFullPath(args[2]);
                Directory.CreateDirectory(Path.GetDirectoryName(outputPath));
                File.WriteAllText(outputPath, serializer.Serialize(ManagedMethodCatalog.Inspect(args[1])),
                    new UTF8Encoding(false));
                return 0;
            }
            if (args.Length >= 4 && (args[0] == "--invoke-static-many"
                || args[0] == "--invoke-static-many-delayed"
                || args[0] == "--invoke-static-many-event"
                || args[0] == "--invoke-static-many-event-warmup"))
            {
                targetPath = Path.GetFullPath(args[1]);
                delayedInvocation = args[0] == "--invoke-static-many-delayed";
                warmupInvocation = args[0] == "--invoke-static-many-event-warmup";
                eventInvocation = args[0] == "--invoke-static-many-event" || warmupInvocation;
                tokenOffset = warmupInvocation ? 4 : delayedInvocation || eventInvocation ? 3 : 2;
                if (warmupInvocation)
                    warmupTokens = args[3].Split(',').Select(value => int.Parse(value.Replace("0x", string.Empty),
                        NumberStyles.HexNumber, CultureInfo.InvariantCulture)).ToArray();
                if (eventInvocation)
                    initializationEvent = args[2];
                if (delayedInvocation)
                {
                    compilationDelay = TimeSpan.FromSeconds(double.Parse(args[2], CultureInfo.InvariantCulture));
                    if (compilationDelay < TimeSpan.Zero || compilationDelay > TimeSpan.FromMinutes(1))
                        throw new ArgumentOutOfRangeException(nameof(compilationDelay));
                }
                methodTokens = args.Skip(tokenOffset).Select(value => int.Parse(value.Replace("0x", string.Empty),
                    NumberStyles.HexNumber, CultureInfo.InvariantCulture)).ToArray();
                invocationReports = new DynamicMethodInvoker().InvokeStatics(targetPath, methodTokens,
                    methodTimeout: eventInvocation ? TimeSpan.FromMinutes(5) : null,
                    initialized: () =>
                    {
                        using var gate = eventInvocation ? new System.Threading.EventWaitHandle(false,
                            System.Threading.EventResetMode.AutoReset, initializationEvent) : null;
                        Console.WriteLine($"Invocation ready: process={System.Diagnostics.Process.GetCurrentProcess().Id}, selected={methodTokens.Count}.");
                        if (gate != null && !gate.WaitOne(TimeSpan.FromMinutes(1)))
                            throw new TimeoutException("The recorder initialization event was not signaled.");
                        if (compilationDelay > TimeSpan.Zero)
                            System.Threading.Thread.Sleep(compilationDelay);
                    }, warmupTokens: warmupTokens,
                    warmupCompleted: item => Console.WriteLine($"HVM WARMUP token=0x{item.MethodToken:X8} completed={item.InvocationCompleted}"));
                foreach (DynamicMethodInvocationReport item in invocationReports)
                {
                    Console.WriteLine($"HVM INVOKED token=0x{item.MethodToken:X8} completed={item.InvocationCompleted} timedOut={item.TimedOut} method={item.MethodName}");
                    if (!item.InvocationCompleted)
                        Console.WriteLine($"HVM INVOCATION EXCEPTION type={item.ExceptionType} message={item.ExceptionMessage}");
                }
                return 0;
            }
            if (args.Length == 3 && args[0] == "--invoke-static")
            {
                targetPath = Path.GetFullPath(args[1]);
                tokenText = args[2].Replace("0x", string.Empty);
                methodToken = int.Parse(tokenText, NumberStyles.HexNumber, CultureInfo.InvariantCulture);
                invocationReport = new DynamicMethodInvoker().InvokeStatic(targetPath, methodToken.Value);
                Console.WriteLine($"HVM INVOKED token=0x{invocationReport.MethodToken:X8} completed={invocationReport.InvocationCompleted} timedOut={invocationReport.TimedOut} method={invocationReport.MethodName}");
                if (!invocationReport.InvocationCompleted)
                    Console.WriteLine($"HVM INVOCATION EXCEPTION type={invocationReport.ExceptionType} message={invocationReport.ExceptionMessage}");
                return 0;
            }
            if (args.Length == 3 && args[0] == "--prepare-only")
            {
                targetPath = Path.GetFullPath(args[1]);
                tokenText = args[2].Replace("0x", string.Empty);
                methodToken = int.Parse(tokenText, NumberStyles.HexNumber, CultureInfo.InvariantCulture);
                preparationReport = new DynamicMethodPreparer().Prepare(targetPath, methodToken.Value);
                Console.WriteLine($"HVM PREPARED token=0x{preparationReport.MethodToken:X8} method={preparationReport.MethodName}");
                return 0;
            }
            if (args.Length >= 7 && args[0] == "--resolve-hvm-operands")
            {
                targetPath = Path.GetFullPath(args[1]);
                outputPath = Path.GetFullPath(args[6]);
                serializer = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
                contextDocument = serializer.Deserialize<HvmContextDocument>(File.ReadAllText(args[2]));
                metadataDocument = serializer.Deserialize<HvmMethodMetadataDocument>(File.ReadAllText(args[3]));
                captureDocument = serializer.Deserialize<HvmJitCaptureDocument>(File.ReadAllText(args[4]));
                localTypeDocument = serializer.Deserialize<HvmLocalTypeDocument>(File.ReadAllText(args[5]));
                selectedMethodTokens = args.Skip(7).Select(value => uint.Parse(value.Replace("0x", string.Empty),
                    NumberStyles.HexNumber, CultureInfo.InvariantCulture)).ToHashSet();
                resolutionReport = new HvmVirtualOperandResolver().Resolve(targetPath, contextDocument.Operands,
                    metadataDocument.Methods, captureDocument.ModulesInfo.SelectMany(module => module.MethodsInfo),
                    localTypeDocument, outputPath, Console.WriteLine,
                    selectedMethodTokens.Count == 0 ? null : selectedMethodTokens);
                foreach (string failure in resolutionReport.Failures)
                    Console.WriteLine("HVM OPERAND FAILURE " + failure);
                Console.WriteLine($"HVM OPERANDS decoded={resolutionReport.DecodedMethods} mapped={resolutionReport.MappedOperands} unresolved={resolutionReport.UnresolvedOperands} locals={resolutionReport.ResolvedLocals} rejected={resolutionReport.RejectedMethods} rejectedOperands={resolutionReport.RejectedOperands} failures={resolutionReport.Failures.Count}");
                return resolutionReport.MappedOperands > 0 && resolutionReport.UnresolvedOperands == 0
                    && resolutionReport.Failures.Count == 0 ? 0 : 3;
            }
            if (args.Length >= 4 && args[0] == "--merge-hvm")
            {
                targetPath = Path.GetFullPath(args[1]);
                outputPath = Path.GetFullPath(args[2]);
                mergeReport = new DynamicMethodAssemblyMerger().Merge(targetPath, args.Skip(3), outputPath,
                    Console.WriteLine);
                Console.WriteLine($"HVM MERGE candidates={mergeReport.CandidateCount} merged={mergeReport.MergedMethodCount} failures={mergeReport.Failures.Count}");
                return mergeReport.MergedMethodCount > 0 && mergeReport.Failures.Count == 0 ? 0 : 3;
            }
            if (args.Length >= 5 && args[0] == "--map-hvm-aliases")
            {
                targetPath = Path.GetFullPath(args[1]);
                sourcePath = Path.GetFullPath(args[2]);
                outputPath = Path.GetFullPath(args[3]);
                aliasMappings = args.Skip(4).Select(ParseAliasMapping).ToArray();
                aliasReport = new HvmMethodAliasMapper().Map(targetPath, sourcePath, aliasMappings, outputPath,
                    Console.WriteLine);
                foreach (DynamicMethodFailure failure in aliasReport.Failures)
                    Console.WriteLine($"HVM ALIAS FAILURE {failure.Token}: {failure.Message}");
                Console.WriteLine($"HVM ALIASES recovered={aliasReport.RecoveredMethodCount} requested={aliasReport.RequestedCount} mapped={aliasReport.MappedCount} failures={aliasReport.Failures.Count}");
                return aliasReport.MappedCount == aliasReport.RequestedCount && aliasReport.Failures.Count == 0
                    ? 0 : 3;
            }
            if (args.Length == 5 && args[0] == "--disassemble-hvm")
            {
                targetPath = Path.GetFullPath(args[1]);
                tokenText = args[2].Replace("0x", string.Empty);
                ulong address = ulong.Parse(tokenText, NumberStyles.HexNumber, CultureInfo.InvariantCulture);
                int instructionCount = int.Parse(args[3], CultureInfo.InvariantCulture);
                outputPath = Path.GetFullPath(args[4]);
                instructions = new NativeHvmAnalyzer().Disassemble(targetPath, address, instructionCount);
                serializer = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
                Directory.CreateDirectory(Path.GetDirectoryName(outputPath));
                File.WriteAllText(outputPath, serializer.Serialize(instructions), new UTF8Encoding(false));
                Console.WriteLine($"HVM DISASSEMBLY address=0x{address:X} instructions={instructions.Count}");
                return 0;
            }
            if (args.Length == 3 && args[0] == "--snapshot-hvm")
            {
                targetPath = Path.GetFullPath(args[1]);
                outputPath = Path.GetFullPath(args[2]);
                snapshots = new NativeHvmRuntimeSnapshotter().Capture(targetPath, outputPath, Console.WriteLine);
                serializer = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
                foreach (NativeHvmRuntimeSnapshot snapshot in snapshots)
                {
                    hvmReport = new NativeHvmAnalyzer().AnalyzeMappedImage(snapshot.MappedImagePath);
                    File.WriteAllText(Path.Combine(outputPath,
                        Path.GetFileNameWithoutExtension(snapshot.ModuleName) + "-mapped-hvm.json"),
                        serializer.Serialize(hvmReport), new UTF8Encoding(false));
                }
                File.WriteAllText(Path.Combine(outputPath, "runtime-snapshots.json"),
                    serializer.Serialize(snapshots), new UTF8Encoding(false));
                Console.WriteLine($"HVM SNAPSHOT modules={snapshots.Count}");
                return snapshots.Count > 0 ? 0 : 3;
            }
            if (args.Length == 3 && args[0] == "--analyze-hvm")
            {
                targetPath = Path.GetFullPath(args[1]);
                outputPath = Path.GetFullPath(args[2]);
                hvmReport = new NativeHvmAnalyzer().Analyze(targetPath);
                serializer = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
                Directory.CreateDirectory(Path.GetDirectoryName(outputPath));
                File.WriteAllText(outputPath, serializer.Serialize(hvmReport), new UTF8Encoding(false));
                Console.WriteLine($"HVM ANALYSIS candidateTables={hvmReport.CandidatePointerTables.Count} indirectBranches={hvmReport.IndirectBranches.Count} markers={hvmReport.Markers.Count}");
                return 0;
            }
            if (args.Length < 2)
            {
                Console.Error.WriteLine("Usage: DnGuardDynamicCollector <target> <output> [--prepare] [--token <hex-token>] [--tokens <hex-token,...>] [--delay <seconds>] | --catalog <target> <output> | --prepare-only <target> <hex-token> | --invoke-static <target> <hex-token> | --invoke-static-many <target> <hex-token>... | --invoke-static-many-delayed <target> <seconds> <hex-token>... | --invoke-static-many-event <target> <event-name> <hex-token>... | --merge-hvm <base> <output> <candidates...> | --map-hvm-aliases <base> <recovered> <output> <target=source...> | --resolve-hvm-operands <assembly> <context> <metadata> <jit-report> <locals-report> <output> [hex-token...] | --analyze-hvm <runtime> <report> | --snapshot-hvm <target> <directory> | --disassemble-hvm <runtime> <address> <count> <report>");
                return 2;
            }

            targetPath = Path.GetFullPath(args[0]);
            outputPath = Path.GetFullPath(args[1]);
            for (int index = 2; index < args.Length; index++)
            {
                if (args[index] == "--prepare")
                {
                    prepareMethod = true;
                    continue;
                }
                if (args[index] == "--token" && index + 1 < args.Length)
                {
                    tokenText = args[++index].Replace("0x", string.Empty);
                    methodToken = int.Parse(tokenText, NumberStyles.HexNumber, CultureInfo.InvariantCulture);
                    continue;
                }
                if (args[index] == "--tokens" && index + 1 < args.Length)
                {
                    selectedTokens = args[++index].Split(',').Select(value => int.Parse(
                        value.Replace("0x", string.Empty), NumberStyles.HexNumber,
                        CultureInfo.InvariantCulture)).ToArray();
                    continue;
                }
                if (args[index] == "--delay" && index + 1 < args.Length)
                {
                    compilationDelay = TimeSpan.FromSeconds(double.Parse(args[++index], CultureInfo.InvariantCulture));
                    continue;
                }
                Console.Error.WriteLine("Unknown or incomplete argument: " + args[index]);
                return 2;
            }

            options = new DynamicMethodAcquisitionOptions
            {
                CompilationMode = prepareMethod ? DynamicCompilationMode.PrepareMethod : DynamicCompilationMode.ForceJit,
                MethodToken = methodToken,
                MethodTokens = selectedTokens,
                CompilationDelay = compilationDelay,
                OutputPath = outputPath
            };
            report = new DynamicMethodAcquirer().Acquire(targetPath, options, Console.WriteLine);
            Console.WriteLine($"RESULT selected={report.SelectedMethodCount} captured={report.CapturedMethodCount} failures={report.Failures.Count}");
            return report.CapturedMethodCount > 0 && File.Exists(outputPath) ? 0 : 3;
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine(exception);
            return 1;
        }
    }

    private static HvmMethodAliasMapping ParseAliasMapping(string value)
    {
        string[] parts = value.Split('=');
        int targetToken;
        int sourceToken;

        if (parts.Length != 2)
            throw new FormatException($"Invalid HVM alias mapping: {value}");
        targetToken = int.Parse(parts[0].Replace("0x", string.Empty), NumberStyles.HexNumber,
            CultureInfo.InvariantCulture);
        sourceToken = int.Parse(parts[1].Replace("0x", string.Empty), NumberStyles.HexNumber,
            CultureInfo.InvariantCulture);
        return new HvmMethodAliasMapping(targetToken, sourceToken);
    }
}
