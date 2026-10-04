// PY-REF: none (DOT-only)
using System.Diagnostics;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

namespace DotCore.Decompile.Dynamic;

public sealed class NativeHvmRuntimeSnapshot
{
    public NativeHvmRuntimeSnapshot(string moduleName, string sourcePath, string mappedImagePath,
        long baseAddress, int imageSize)
    {
        ModuleName = moduleName;
        SourcePath = sourcePath;
        MappedImagePath = mappedImagePath;
        BaseAddress = baseAddress;
        ImageSize = imageSize;
    }

    public string ModuleName { get; }
    public string SourcePath { get; }
    public string MappedImagePath { get; }
    public long BaseAddress { get; }
    public int ImageSize { get; }
}

public sealed class NativeHvmRuntimeSnapshotter
{
    private static readonly HashSet<string> RuntimeModuleNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "ucrtbase2.dll",
        "ucrtbasex.dll",
        "HVMRuntime.dll"
    };

    public IReadOnlyList<NativeHvmRuntimeSnapshot> Capture(string targetPath, string outputDirectory,
        Action<string>? log = null)
    {
        string inputPath = Path.GetFullPath(targetPath);
        string snapshotDirectory = Path.GetFullPath(outputDirectory);
        Assembly assembly;
        ModuleHandle moduleHandle;
        var snapshots = new List<NativeHvmRuntimeSnapshot>();
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            throw new PlatformNotSupportedException("HVM runtime snapshots require Windows.");
        if (!File.Exists(inputPath))
            throw new FileNotFoundException("The managed target was not found.", inputPath);

        Directory.CreateDirectory(snapshotDirectory);
        assembly = Assembly.LoadFrom(inputPath);
        moduleHandle = assembly.ManifestModule.ModuleHandle;
        RuntimeHelpers.RunModuleConstructor(moduleHandle);
        using (Process process = Process.GetCurrentProcess())
        {
            foreach (ProcessModule module in process.Modules)
            {
                string moduleName = module.ModuleName;
                string mappedImagePath;
                byte[] mappedImage;
                if (!RuntimeModuleNames.Contains(moduleName))
                    continue;
                mappedImagePath = Path.Combine(snapshotDirectory,
                    Path.GetFileNameWithoutExtension(moduleName) + ".mapped.bin");
                mappedImage = new byte[module.ModuleMemorySize];
                Marshal.Copy(module.BaseAddress, mappedImage, 0, mappedImage.Length);
                File.WriteAllBytes(mappedImagePath, mappedImage);
                snapshots.Add(new NativeHvmRuntimeSnapshot(moduleName, module.FileName, mappedImagePath,
                    module.BaseAddress.ToInt64(), module.ModuleMemorySize));
                log?.Invoke($"Captured mapped HVM runtime: {moduleName}, base=0x{module.BaseAddress.ToInt64():X}, size={module.ModuleMemorySize}");
            }
        }
        return snapshots;
    }
}
