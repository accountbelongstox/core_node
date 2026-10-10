// PY-REF: none (DOT-only)
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Threading.Tasks;

namespace DotCore.Decompile.Dynamic;

public sealed class DynamicMethodInvocationReport
{
    public DynamicMethodInvocationReport(string targetPath, int methodToken, string methodName,
        bool invocationCompleted, bool timedOut, string exceptionType, string exceptionMessage)
    {
        TargetPath = targetPath;
        MethodToken = methodToken;
        MethodName = methodName;
        InvocationCompleted = invocationCompleted;
        TimedOut = timedOut;
        ExceptionType = exceptionType;
        ExceptionMessage = exceptionMessage;
    }

    public string TargetPath { get; }
    public int MethodToken { get; }
    public string MethodName { get; }
    public bool InvocationCompleted { get; }
    public bool TimedOut { get; }
    public string ExceptionType { get; }
    public string ExceptionMessage { get; }
}

public sealed class DynamicMethodInvoker
{
    private static readonly TimeSpan DefaultMethodTimeout = TimeSpan.FromSeconds(15);

    public DynamicMethodInvocationReport InvokeStatic(string targetPath, int methodToken)
    {
        return InvokeStatics(targetPath, new[] { methodToken })[0];
    }

    public IReadOnlyList<DynamicMethodInvocationReport> InvokeStatics(string targetPath,
        IEnumerable<int> methodTokens, TimeSpan? methodTimeout = null, Action? initialized = null)
    {
        string fullTargetPath = Path.GetFullPath(targetPath);
        Assembly assembly;
        Module module;
        int[] tokens;
        TimeSpan timeout;
        List<DynamicMethodInvocationReport> reports = new();

        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            throw new PlatformNotSupportedException("Runtime method invocation requires Windows.");
        if (!File.Exists(fullTargetPath))
            throw new FileNotFoundException("The managed target was not found.", fullTargetPath);

        tokens = methodTokens.Distinct().ToArray();
        timeout = methodTimeout ?? DefaultMethodTimeout;
        if (tokens.Length == 0)
            throw new ArgumentException("At least one method token is required.", nameof(methodTokens));
        if (timeout <= TimeSpan.Zero)
            throw new ArgumentOutOfRangeException(nameof(methodTimeout), "The method timeout must be positive.");

        assembly = Assembly.LoadFrom(fullTargetPath);
        module = assembly.ManifestModule;
        RuntimeHelpers.RunModuleConstructor(module.ModuleHandle);
        initialized?.Invoke();
        foreach (int token in tokens)
        {
            MethodBase method = ResolveMethod(module, token);
            Task<DynamicMethodInvocationReport> task = Task.Run(() => InvokeStatic(fullTargetPath, method, token));
            if (!task.Wait(timeout))
            {
                reports.Add(new DynamicMethodInvocationReport(fullTargetPath, token,
                    method.ToString() ?? method.Name, false, true, typeof(TimeoutException).FullName!,
                    $"Invocation exceeded {timeout.TotalSeconds:0.###} seconds."));
                break;
            }
            reports.Add(task.Result);
        }
        return reports.AsReadOnly();
    }

    private static MethodBase ResolveMethod(Module module, int methodToken)
    {
        MethodBase method = module.ResolveMethod(methodToken)
            ?? throw new MissingMethodException($"Metadata token 0x{methodToken:X8} was not resolved.");
        if (!method.IsStatic)
            throw new NotSupportedException("The isolated runtime trigger accepts static methods only.");
        if (method.ContainsGenericParameters)
            throw new NotSupportedException("The isolated runtime trigger does not accept open generic methods.");
        return method;
    }

    private static DynamicMethodInvocationReport InvokeStatic(string fullTargetPath, MethodBase method,
        int methodToken)
    {
        ParameterInfo[] parameters;
        object?[] arguments;
        Exception? invocationException = null;

        parameters = method.GetParameters();
        arguments = parameters.Select(CreateDefaultArgument).ToArray();
        try
        {
            method.Invoke(null, arguments);
        }
        catch (TargetInvocationException exception)
        {
            invocationException = exception.InnerException ?? exception;
        }
        catch (Exception exception)
        {
            invocationException = exception;
        }

        return new DynamicMethodInvocationReport(fullTargetPath, methodToken, method.ToString() ?? method.Name,
            invocationException == null, false, invocationException?.GetType().FullName ?? string.Empty,
            invocationException?.Message ?? string.Empty);
    }

    private static object? CreateDefaultArgument(ParameterInfo parameter)
    {
        Type type = parameter.ParameterType;
        if (type.IsByRef)
            type = type.GetElementType() ?? type;
        return type.IsValueType ? Activator.CreateInstance(type) : null;
    }
}
