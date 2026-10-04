// PY-REF: none (DOT-only)
using DotApps.d3d4tester.Services;
using DotCore.Decompile;
using System.Globalization;

namespace DotApps.d3d4tester.Tools;

internal static class RecoveryCli
{
    public static async Task<int> Main(string[] args)
    {
        string dataRoot;
        string toolsRoot;
        string rosbotPath;
        string toolPath = typeof(RecoveryCli).Assembly.Location;
        string toolDirectory = Path.GetDirectoryName(toolPath)!;
        string toolRoot = Path.GetDirectoryName(toolDirectory)!;
        string dynamicCollector = Path.Combine(toolRoot, "dynamic", RosbotSourceRecovery.DynamicCollectorFileName);
        bool singleFile;
        int offset;
        ulong helperAddress;
        ulong resolveTokenReturnAddress;
        HvmTokenContextBuildReport contextReport;
        TtdHvmMetadataAnalysisReport metadataReport;
        TtdJitTraceAnalysisReport jitTraceReport;
        TtdHvmLocalAnalysisReport localReport;
        try
        {
            if (args.Length == 5 && args[0] == "--analyze-jit-ttd")
            {
                jitTraceReport = await TtdJitTraceAnalyzer.AnalyzeAsync(args[1], args[2], args[3], args[4],
                    Console.WriteLine);
                Console.WriteLine($"JIT TTD calls={jitTraceReport.CapturedCalls} methods={jitTraceReport.UniqueMethodTokens} failures={jitTraceReport.FailureCount}");
                return jitTraceReport.ExitCode == 0 && jitTraceReport.CapturedCalls > 0 ? 0 : 3;
            }
            if (args.Length == 8 && args[0] == "--analyze-hvm-locals")
            {
                helperAddress = ulong.Parse(args[3].Replace("0x", string.Empty), NumberStyles.HexNumber,
                    CultureInfo.InvariantCulture);
                resolveTokenReturnAddress = ulong.Parse(args[4].Replace("0x", string.Empty), NumberStyles.HexNumber,
                    CultureInfo.InvariantCulture);
                localReport = await TtdHvmLocalAnalyzer.AnalyzeAsync(args[1], args[2], helperAddress,
                    resolveTokenReturnAddress, args[5], args[6], args[7], Console.WriteLine);
                Console.WriteLine($"HVM locals calls={localReport.CapturedLocals} methods={localReport.Methods} failures={localReport.Failures}");
                return localReport.ExitCode == 0 && localReport.CapturedLocals > 0 ? 0 : 3;
            }
            if (args.Length == 5 && args[0] == "--analyze-hvm-ttd")
            {
                helperAddress = ulong.Parse(args[3].Replace("0x", string.Empty), NumberStyles.HexNumber,
                    CultureInfo.InvariantCulture);
                TtdHvmTokenAnalysisReport hvmReport = await TtdHvmTokenAnalyzer.AnalyzeAsync(args[1], args[2],
                    helperAddress, args[4], Console.WriteLine);
                Console.WriteLine($"HVM TTD calls={hvmReport.CapturedCalls} tokens={hvmReport.UniqueVirtualTokens} failures={hvmReport.FailureCount}");
                return hvmReport.ExitCode == 0 && hvmReport.CapturedCalls > 0 ? 0 : 3;
            }
            if (args.Length == 5 && args[0] == "--build-hvm-context")
            {
                resolveTokenReturnAddress = ulong.Parse(args[3].Replace("0x", string.Empty),
                    NumberStyles.HexNumber, CultureInfo.InvariantCulture);
                contextReport = await HvmTokenContextBuilder.BuildAsync(args[1], args[2],
                    resolveTokenReturnAddress, args[4]);
                Console.WriteLine($"HVM context calls={contextReport.ContextualCalls}/{contextReport.ResolveCalls} methods={contextReport.Methods} unmatched={contextReport.UnmatchedCalls}");
                return contextReport.ContextualCalls > 0 ? 0 : 3;
            }
            if (args.Length == 5 && args[0] == "--analyze-hvm-metadata")
            {
                metadataReport = await TtdHvmMetadataAnalyzer.AnalyzeAsync(args[1], args[2], args[3], args[4],
                    Console.WriteLine);
                Console.WriteLine($"HVM metadata methods={metadataReport.ResolvedMethods}/{metadataReport.MethodHandles} modules={metadataReport.Modules}");
                return metadataReport.ExitCode == 0 && metadataReport.ResolvedMethods > 0 ? 0 : 3;
            }
            if (args.Length > 0 && args[0] == "--unpack")
            {
                DNGuard_Unpacker.Program.Run(args.Skip(1).ToArray());
                return 0;
            }
            if (args.Length < 1)
            {
                Console.Error.WriteLine("Usage: RosbotRecovery <RoS-BoT.exe> [data-root] [tools-root] | --analyze-jit-ttd <cdb> <trace> <target-module> <output> | --analyze-hvm-ttd <cdb> <trace> <helper-address> <output> | --analyze-hvm-locals <cdb> <trace> <get-arg-type-address> <get-arg-class-address> <helper-report> <context-report> <output> | --build-hvm-context <helper-report> <jit-report> <resolve-return-address> <output> | --analyze-hvm-metadata <cdb> <trace> <helper-report> <output>");
                return 2;
            }
            singleFile = args[0] == "--file";
            offset = singleFile ? 1 : 0;
            if (args.Length <= offset) return 2;
            rosbotPath = Path.GetFullPath(args[offset]);
            dataRoot = args.Length > offset + 1 ? Path.GetFullPath(args[offset + 1]) : Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".core_node", ".d3check");
            toolsRoot = args.Length > offset + 2 ? Path.GetFullPath(args[offset + 2]) : Path.Combine(dataRoot, "tools");
            var tools = new DecompileTools(toolsRoot);
            if (!tools.HasIlSpy && !await tools.InstallAllAsync(Console.WriteLine)) return 2;
            if (singleFile)
            {
                var result = await new DecompileRunner(tools).DecompileAsync(rosbotPath,
                    Path.Combine(dataRoot, "decompiled", "files", Path.GetFileNameWithoutExtension(rosbotPath)), Console.WriteLine);
                Console.WriteLine("OUTPUT " + result.OutputDir);
                return result.Ok ? result.Partial ? 3 : 0 : 1;
            }
            var report = await RosbotSourceRecovery.RunAsync(rosbotPath, Path.Combine(dataRoot, "decompiled"),
                tools, toolPath, dynamicCollector, Console.WriteLine);
            Console.WriteLine("REPORT " + Path.Combine(report.OutputDirectory, RosbotSourceRecovery.ReportName));
            return report.AllProtectedBodiesRecovered ? 0 : 3;
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine(exception.ToString());
            return 1;
        }
    }
}
