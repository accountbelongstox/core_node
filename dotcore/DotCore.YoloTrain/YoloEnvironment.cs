namespace DotCore.YoloTrain;

/// <summary>One NVIDIA GPU as reported by nvidia-smi.</summary>
public sealed record GpuInfo(int Index, string Name, int MemoryTotalMb, int MemoryFreeMb, string Driver);

/// <summary>Python interpreter with its torch / Ultralytics stack and the yolo CLI that belongs to it.</summary>
public sealed record PythonEnvironment(
    string Executable,
    string Version,
    string? TorchVersion,
    bool CudaAvailable,
    string? CudaVersion,
    IReadOnlyList<string> CudaDevices,
    bool MpsAvailable,
    string? UltralyticsVersion,
    string? YoloCli,
    string? Error)
{
    public bool HasUltralytics => !string.IsNullOrEmpty(UltralyticsVersion);

    /// <summary>`from ultralytics.cfg import entrypoint` works in this interpreter.</summary>
    public bool HasEntrypoint { get; init; }

    public bool CanTrain => HasUltralytics && Launcher != null;

    /// <summary>The interpreter itself (entrypoint) when possible, else this environment's yolo CLI; null when neither works.</summary>
    public YoloLauncher? Launcher =>
        HasEntrypoint && File.Exists(Executable) ? YoloLauncher.ForPython(Executable)
        : !string.IsNullOrEmpty(YoloCli) && File.Exists(YoloCli) ? YoloLauncher.ForCli(YoloCli)
        : null;
}

/// <summary>Machine and Python environment used to recommend training parameters.</summary>
public sealed record YoloEnvironment(
    string OsDescription,
    string Architecture,
    string CpuName,
    int LogicalCores,
    long TotalMemoryBytes,
    long AvailableMemoryBytes,
    IReadOnlyList<GpuInfo> Gpus,
    PythonEnvironment? Python,
    IReadOnlyList<string> PythonCandidates,
    DateTime ProbedAtUtc)
{
    public bool CanTrain => Python?.CanTrain == true;

    public bool CudaReady => Python?.CudaAvailable == true;

    public bool HasNvidiaGpu => Gpus.Count > 0;

    /// <summary>Largest VRAM of the CUDA devices (nvidia-smi), 0 when unknown.</summary>
    public int MaxGpuMemoryMb => Gpus.Count == 0 ? 0 : Gpus.Max(g => g.MemoryTotalMb);
}
