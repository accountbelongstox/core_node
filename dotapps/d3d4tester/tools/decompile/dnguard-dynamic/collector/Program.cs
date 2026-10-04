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
        string outputPath;
        string tokenText = string.Empty;
        int? methodToken = null;
        bool prepareMethod = false;
        DynamicMethodAcquisitionReport report;
        DynamicMethodAcquisitionOptions options;
        NativeHvmAnalysisReport hvmReport;
        DynamicMethodAssemblyMergeReport mergeReport;
        HvmOperandResolutionReport resolutionReport;
        DynamicMethodPreparationReport preparationReport;
        DynamicMethodInvocationReport invocationReport;
        IReadOnlyList<DynamicMethodInvocationReport> invocationReports;
        IReadOnlyList<int> methodTokens;
        HvmContextDocument contextDocument;
        HvmMethodMetadataDocument metadataDocument;
        HvmJitCaptureDocument captureDocument;
        HvmLocalTypeDocument localTypeDocument;
        IReadOnlyList<NativeHvmInstruction> instructions;
        IReadOnlyList<NativeHvmRuntimeSnapshot> snapshots;
        JavaScriptSerializer serializer;
        try
        {
            if (args.Length >= 4 && args[0] == "--invoke-static-many")
            {
                targetPath = Path.GetFullPath(args[1]);
                methodTokens = args.Skip(2).Select(value => int.Parse(value.Replace("0x", string.Empty),
                    NumberStyles.HexNumber, CultureInfo.InvariantCulture)).ToArray();
                invocationReports = new DynamicMethodInvoker().InvokeStatics(targetPath, methodTokens);
                foreach (DynamicMethodInvocationReport item in invocationReports)
                {
                    Console.WriteLine($"HVM INVOKED token=0x{item.MethodToken:X8} completed={item.InvocationCompleted} method={item.MethodName}");
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
                Console.WriteLine($"HVM INVOKED token=0x{invocationReport.MethodToken:X8} completed={invocationReport.InvocationCompleted} method={invocationReport.MethodName}");
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
            if (args.Length == 7 && args[0] == "--resolve-hvm-operands")
            {
                targetPath = Path.GetFullPath(args[1]);
                outputPath = Path.GetFullPath(args[6]);
                serializer = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
                contextDocument = serializer.Deserialize<HvmContextDocument>(File.ReadAllText(args[2]));
                metadataDocument = serializer.Deserialize<HvmMethodMetadataDocument>(File.ReadAllText(args[3]));
                captureDocument = serializer.Deserialize<HvmJitCaptureDocument>(File.ReadAllText(args[4]));
                localTypeDocument = serializer.Deserialize<HvmLocalTypeDocument>(File.ReadAllText(args[5]));
                resolutionReport = new HvmVirtualOperandResolver().Resolve(targetPath, contextDocument.Operands,
                    metadataDocument.Methods, captureDocument.ModulesInfo.SelectMany(module => module.MethodsInfo),
                    localTypeDocument, outputPath, Console.WriteLine);
                foreach (string failure in resolutionReport.Failures)
                    Console.WriteLine("HVM OPERAND FAILURE " + failure);
                Console.WriteLine($"HVM OPERANDS decoded={resolutionReport.DecodedMethods} mapped={resolutionReport.MappedOperands} unresolved={resolutionReport.UnresolvedOperands} locals={resolutionReport.ResolvedLocals} failures={resolutionReport.Failures.Count}");
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
                Console.Error.WriteLine("Usage: DnGuardDynamicCollector <target> <output> [--prepare] [--token <hex-token>] | --prepare-only <target> <hex-token> | --invoke-static <target> <hex-token> | --invoke-static-many <target> <hex-token>... | --merge-hvm <base> <output> <candidates...> | --resolve-hvm-operands <assembly> <context> <metadata> <jit-report> <locals-report> <output> | --analyze-hvm <runtime> <report> | --snapshot-hvm <target> <directory> | --disassemble-hvm <runtime> <address> <count> <report>");
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
                Console.Error.WriteLine("Unknown or incomplete argument: " + args[index]);
                return 2;
            }

            options = new DynamicMethodAcquisitionOptions
            {
                CompilationMode = prepareMethod ? DynamicCompilationMode.PrepareMethod : DynamicCompilationMode.ForceJit,
                MethodToken = methodToken,
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
}
