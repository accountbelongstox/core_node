// PY-REF: none (DOT-only)
namespace DotCore.Decompile.Dynamic;

public enum DynamicCompilationMode
{
    ForceJit,
    PrepareMethod
}

public sealed class DynamicMethodAcquisitionOptions
{
    public DynamicCompilationMode CompilationMode { get; set; } = DynamicCompilationMode.ForceJit;

    public int? MethodToken { get; set; }

    public IReadOnlyCollection<int>? MethodTokens { get; set; }

    public TimeSpan CompilationDelay { get; set; }

    public string? OutputPath { get; set; }
}

public sealed class DynamicMethodFailure
{
    public DynamicMethodFailure(string token, string message)
    {
        Token = token;
        Message = message;
    }

    public string Token { get; }

    public string Message { get; }
}

public sealed class DynamicMethodAcquisitionReport
{
    public DynamicMethodAcquisitionReport(string inputPath, string? outputPath, int selectedMethodCount,
        int capturedMethodCount, int removedInvalidCustomAttributeCount, int metadataDiagnosticCount,
        IReadOnlyList<DynamicMethodFailure> failures)
    {
        InputPath = inputPath;
        OutputPath = outputPath;
        SelectedMethodCount = selectedMethodCount;
        CapturedMethodCount = capturedMethodCount;
        RemovedInvalidCustomAttributeCount = removedInvalidCustomAttributeCount;
        MetadataDiagnosticCount = metadataDiagnosticCount;
        Failures = failures;
    }

    public string InputPath { get; }

    public string? OutputPath { get; }

    public int SelectedMethodCount { get; }

    public int CapturedMethodCount { get; }

    public int RemovedInvalidCustomAttributeCount { get; }

    public int MetadataDiagnosticCount { get; }

    public IReadOnlyList<DynamicMethodFailure> Failures { get; }
}
