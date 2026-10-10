// PY-REF: none (DOT-only)
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

namespace DotCore.Decompile.Dynamic;

public sealed class DynamicMethodPreparationReport
{
    public DynamicMethodPreparationReport(string targetPath, int methodToken, string methodName)
    {
        TargetPath = targetPath;
        MethodToken = methodToken;
        MethodName = methodName;
    }

    public string TargetPath { get; }
    public int MethodToken { get; }
    public string MethodName { get; }
}

public sealed class DynamicMethodPreparer
{
    public DynamicMethodPreparationReport Prepare(string targetPath, int methodToken)
    {
        return PrepareMany(targetPath, new[] { methodToken })[0];
    }

    public IReadOnlyList<DynamicMethodPreparationReport> PrepareMany(string targetPath,
        IEnumerable<int> methodTokens, Action? initialized = null)
    {
        string fullTargetPath = Path.GetFullPath(targetPath);
        Assembly assembly;
        Module module;
        RuntimeMethodHandle methodHandle;
        MethodBase? method;
        List<DynamicMethodPreparationReport> reports = new();

        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            throw new PlatformNotSupportedException("Runtime method preparation requires Windows.");
        if (!File.Exists(fullTargetPath))
            throw new FileNotFoundException("The managed target was not found.", fullTargetPath);

        assembly = Assembly.LoadFrom(fullTargetPath);
        module = assembly.ManifestModule;
        RuntimeHelpers.RunModuleConstructor(module.ModuleHandle);
        initialized?.Invoke();
        foreach (int methodToken in methodTokens.Distinct())
        {
            method = module.ResolveMethod(methodToken);
            methodHandle = module.ModuleHandle.ResolveMethodHandle(methodToken);
            RuntimeHelpers.PrepareMethod(methodHandle);
            reports.Add(new DynamicMethodPreparationReport(fullTargetPath, methodToken,
                method?.ToString() ?? $"0x{methodToken:X8}"));
        }
        return reports.AsReadOnly();
    }
}
