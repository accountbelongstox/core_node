// PY-REF: none (DOT-only)
using System.Globalization;
using System.Text.Json;

namespace DotCore.Decompile;

public sealed record HvmResolvedOperand(uint MethodToken, string MethodName, int JitCallIndex,
    uint VirtualToken, string Kind, uint DefinitionToken, string ModuleHandle, string TypeHandle,
    int TypeDescriptorKind, string TypeModuleHandle, uint ResolvedTypeDefinitionToken,
    string MethodHandle, string FieldHandle);

public sealed record HvmTokenContextBuildReport(string OutputPath, int ResolveCalls,
    int ContextualCalls, int Methods, int UnmatchedCalls);

public static class HvmTokenContextBuilder
{
    public static async Task<HvmTokenContextBuildReport> BuildAsync(string helperReportPath,
        string jitCapturePath, ulong resolveTokenReturnAddress, string outputPath,
        CancellationToken token = default)
    {
        string fullHelperReportPath = Path.GetFullPath(helperReportPath);
        string fullJitCapturePath = Path.GetFullPath(jitCapturePath);
        string fullOutputPath = Path.GetFullPath(outputPath);
        string resolveAddress = $"0x{resolveTokenReturnAddress:x}";
        List<JitRange> jitRanges;
        Dictionary<int, CapturedMethod> methods;
        List<HvmResolvedOperand> operands = new();
        int resolveCalls = 0;
        int unmatchedCalls = 0;

        if (!File.Exists(fullHelperReportPath))
            throw new FileNotFoundException("The HVM helper report was not found.", fullHelperReportPath);
        if (!File.Exists(fullJitCapturePath))
            throw new FileNotFoundException("The JIT capture report was not found.", fullJitCapturePath);
        if (File.Exists(fullOutputPath))
            throw new IOException("The HVM token context output already exists.");

        using JsonDocument helperReport = JsonDocument.Parse(
            await File.ReadAllTextAsync(fullHelperReportPath, token).ConfigureAwait(false));
        using JsonDocument jitCapture = JsonDocument.Parse(
            await File.ReadAllTextAsync(fullJitCapturePath, token).ConfigureAwait(false));
        jitRanges = ReadJitRanges(helperReport.RootElement);
        methods = ReadCapturedMethods(jitCapture.RootElement);

        foreach (JsonElement call in helperReport.RootElement.GetProperty("Calls").EnumerateArray())
        {
            int jitCallIndex;
            CapturedMethod method;
            string kind;
            uint definitionToken;
            if (!string.Equals(call.GetProperty("ReturnAddress").GetString(), resolveAddress,
                    StringComparison.OrdinalIgnoreCase))
                continue;
            resolveCalls++;
            jitCallIndex = FindJitCall(jitRanges, TtdPosition.Parse(call.GetProperty("StartPosition").GetString()!));
            if (jitCallIndex < 0 || !methods.TryGetValue(jitCallIndex, out method))
            {
                unmatchedCalls++;
                continue;
            }
            (kind, definitionToken) = ReadResolvedDefinition(call);
            operands.Add(new HvmResolvedOperand(method.MethodToken, method.MethodName, jitCallIndex,
                call.GetProperty("VirtualToken").GetUInt32(), kind, definitionToken,
                call.GetProperty("ModuleHandle").GetString()!, call.GetProperty("TypeHandle").GetString()!,
                ReadOptionalInt32(call, "TypeDescriptorKind"), ReadOptionalString(call, "TypeModuleHandle"),
                ReadOptionalUInt32(call, "ResolvedTypeDefinitionToken"),
                call.GetProperty("MethodHandle").GetString()!, call.GetProperty("FieldHandle").GetString()!));
        }

        Directory.CreateDirectory(Path.GetDirectoryName(fullOutputPath)!);
        await File.WriteAllTextAsync(fullOutputPath, JsonSerializer.Serialize(new
        {
            ResolveCalls = resolveCalls,
            ContextualCalls = operands.Count,
            UnmatchedCalls = unmatchedCalls,
            Methods = operands.Select(operand => operand.MethodToken).Distinct().Count(),
            Operands = operands
        }, new JsonSerializerOptions { WriteIndented = true }), token).ConfigureAwait(false);
        return new HvmTokenContextBuildReport(fullOutputPath, resolveCalls, operands.Count,
            operands.Select(operand => operand.MethodToken).Distinct().Count(), unmatchedCalls);
    }

    private static List<JitRange> ReadJitRanges(JsonElement root)
    {
        List<JitRange> result = new();
        foreach (JsonElement call in root.GetProperty("JitCalls").EnumerateArray())
            result.Add(new JitRange(call.GetProperty("Index").GetInt32(),
                TtdPosition.Parse(call.GetProperty("StartPosition").GetString()!),
                TtdPosition.Parse(call.GetProperty("EndPosition").GetString()!)));
        return result;
    }

    private static Dictionary<int, CapturedMethod> ReadCapturedMethods(JsonElement root)
    {
        Dictionary<int, CapturedMethod> result = new();
        foreach (JsonElement module in root.GetProperty("ModulesInfo").EnumerateArray())
        foreach (JsonElement method in module.GetProperty("MethodsInfo").EnumerateArray())
            result[method.GetProperty("CallIndex").GetInt32()] = new CapturedMethod(
                method.GetProperty("MethodToken").GetUInt32(), method.GetProperty("MethodName").GetString()!);
        return result;
    }

    private static int FindJitCall(IReadOnlyList<JitRange> ranges, TtdPosition position)
    {
        JitRange? best = null;
        foreach (JitRange range in ranges)
            if (range.Start.CompareTo(position) <= 0 && range.End.CompareTo(position) >= 0)
                if (best is null || range.Start.CompareTo(best.Value.Start) > 0)
                    best = range;
        return best?.Index ?? -1;
    }

    private static (string Kind, uint Token) ReadResolvedDefinition(JsonElement call)
    {
        uint token = call.GetProperty("FieldDefinitionToken").GetUInt32();
        if (token != 0) return ("Field", 0x04000000u | (token & 0x0003ffffu));
        token = call.GetProperty("MethodDefinitionToken").GetUInt32();
        if (token != 0) return ("Method", token);
        token = call.GetProperty("TypeDefinitionToken").GetUInt32();
        return token == 0 ? ("Unknown", 0) : ("Type", token);
    }

    private static int ReadOptionalInt32(JsonElement element, string propertyName)
    {
        return element.TryGetProperty(propertyName, out JsonElement value) ? value.GetInt32() : 0;
    }

    private static uint ReadOptionalUInt32(JsonElement element, string propertyName)
    {
        return element.TryGetProperty(propertyName, out JsonElement value) ? value.GetUInt32() : 0;
    }

    private static string ReadOptionalString(JsonElement element, string propertyName)
    {
        return element.TryGetProperty(propertyName, out JsonElement value) ? value.GetString() ?? "0x0" : "0x0";
    }

    private readonly record struct CapturedMethod(uint MethodToken, string MethodName);
    private readonly record struct JitRange(int Index, TtdPosition Start, TtdPosition End);

    private readonly record struct TtdPosition(ulong Sequence, ulong Step) : IComparable<TtdPosition>
    {
        public static TtdPosition Parse(string value)
        {
            string[] parts = value.Split(':', 2);
            if (string.Equals(value, "Min Position", StringComparison.Ordinal))
                return new TtdPosition(0, 0);
            if (string.Equals(value, "Max Position", StringComparison.Ordinal))
                return new TtdPosition(ulong.MaxValue, ulong.MaxValue);
            if (parts.Length != 2) throw new FormatException($"Invalid TTD position: {value}");
            return new TtdPosition(ulong.Parse(parts[0], NumberStyles.HexNumber, CultureInfo.InvariantCulture),
                ulong.Parse(parts[1], NumberStyles.HexNumber, CultureInfo.InvariantCulture));
        }

        public int CompareTo(TtdPosition other)
        {
            int sequenceComparison = Sequence.CompareTo(other.Sequence);
            return sequenceComparison != 0 ? sequenceComparison : Step.CompareTo(other.Step);
        }
    }
}
