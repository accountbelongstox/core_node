// PY-REF: none (DOT-only)
using System.Diagnostics;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using AsmResolver;
using AsmResolver.DotNet;
using AsmResolver.DotNet.Builder;
using AsmResolver.DotNet.Code.Cil;
using AsmResolver.DotNet.Serialized;
using AsmResolver.PE.File.Headers;

namespace DotCore.Decompile.Dynamic;

public sealed class DynamicMethodAcquirer
{
    private static readonly object ProcessLock = new object();
    private static readonly NativeJitHook.CompilationCallback Callback = CompilationCallback;
    private static DynamicMethodAcquirer? _active;
    private static bool _hookWasInstalled;

    private readonly List<DynamicMethodFailure> _failures = new List<DynamicMethodFailure>();
    private Action<string> _log = _ => { };
    private MethodDefinition? _currentMethod;
    private CilMethodBody? _bestCandidateBody;
    private readonly List<CapturedMethodData> _capturedCandidates = new List<CapturedMethodData>();
    private long _bestCandidateScore;
    private bool _captureSucceeded;
    private int _capturedMethodCount;
    private int _removedInvalidCustomAttributeCount;

    public DynamicMethodAcquisitionReport Acquire(string targetPath,
        DynamicMethodAcquisitionOptions? options = null, Action<string>? log = null)
    {
        string inputPath = Path.GetFullPath(targetPath);
        DynamicMethodAcquisitionOptions acquisitionOptions = options ?? new DynamicMethodAcquisitionOptions();
        lock (ProcessLock)
        {
            if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                throw new PlatformNotSupportedException("Runtime method acquisition requires Windows.");
            if (_hookWasInstalled)
                throw new InvalidOperationException("Runtime method acquisition can run only once in a collector process.");
            if (!File.Exists(inputPath))
                throw new FileNotFoundException("The managed target was not found.", inputPath);

            _log = log ?? (_ => { });
            _active = this;
            try
            {
                _hookWasInstalled = true;
                return AcquireCore(inputPath, acquisitionOptions);
            }
            finally
            {
                _active = null;
            }
        }
    }

    private DynamicMethodAcquisitionReport AcquireCore(string inputPath, DynamicMethodAcquisitionOptions options)
    {
        Assembly assembly = Assembly.LoadFrom(inputPath);
        ModuleHandle moduleHandle = assembly.ManifestModule.ModuleHandle;
        RuntimeHelpers.RunModuleConstructor(moduleHandle);
        MethodInfo getModuleHandle = typeof(Marshal).GetMethod("GetHINSTANCE",
            BindingFlags.Public | BindingFlags.Static, null, new[] { typeof(Module) }, null)
            ?? throw new PlatformNotSupportedException("The runtime does not expose a managed module handle.");
        nint moduleBaseAddress = (nint)getModuleHandle.Invoke(null, new object[] { assembly.ManifestModule })!;
        var diagnostics = new DiagnosticBag();
        ModuleDefinition module = ModuleDefinition.FromModuleBaseAddress(moduleBaseAddress,
            new ModuleReaderParameters(diagnostics));
        var assemblyResolver = (AssemblyResolverBase)module.MetadataResolver.AssemblyResolver;
        string inputDirectory = Path.GetDirectoryName(assembly.Location) ?? Directory.GetCurrentDirectory();
        assemblyResolver.SearchDirectories.Add(inputDirectory);
        assemblyResolver.SearchDirectories.Add(RuntimeEnvironment.GetRuntimeDirectory());

        MethodInfo bootstrapMethod = typeof(DynamicMethodAcquirer).GetMethod(nameof(BootstrapMethod),
            BindingFlags.NonPublic | BindingFlags.Static)!;
        bool hookInstalled = NativeJitHook.AddHook(Marshal.GetFunctionPointerForDelegate(Callback),
            bootstrapMethod.MethodHandle.Value, AppDomain.CurrentDomain.Id, Environment.Version.Major);
        if (!hookInstalled)
            throw new InvalidOperationException("The CLR JIT hook could not be installed.");

        MethodDefinition[] methods = module.GetAllTypes().SelectMany(type => type.Methods)
            .Where(method => method.CilMethodBody != null)
            .Where(method => !options.MethodToken.HasValue || method.MetadataToken.ToInt32() == options.MethodToken.Value)
            .ToArray();
        var stopwatch = Stopwatch.StartNew();
        foreach (MethodDefinition method in methods)
            CaptureMethod(moduleHandle, method, options.CompilationMode);
        stopwatch.Stop();
        _log($"Captured {_capturedMethodCount}/{methods.Length} methods with {_failures.Count} failures in {stopwatch.Elapsed}.");

        _removedInvalidCustomAttributeCount = InvalidCustomAttributeRemover.Remove(module);
        var metadataFlags = MetadataBuilderFlags.PreserveAll
                            & ~MetadataBuilderFlags.PreserveStandAloneSignatureIndices;
        var directoryFactory = new DotNetDirectoryFactory(metadataFlags)
        {
            MethodBodySerializer = new CilMethodBodySerializer { ComputeMaxStackOnBuildOverride = false }
        };
        var imageBuilder = new ManagedPEImageBuilder(directoryFactory);
        if (module.MachineType == MachineType.I386 && module.PEKind == OptionalHeaderMagic.Pe32Plus)
            module.PEKind = OptionalHeaderMagic.Pe32;

        string outputPath = ResolveOutputPath(inputPath, options);
        string outputDirectory = Path.GetDirectoryName(outputPath) ?? inputDirectory;
        Directory.CreateDirectory(outputDirectory);
        module.Write(outputPath, imageBuilder);
        _log($"Captured assembly saved to: {outputPath}");
        return new DynamicMethodAcquisitionReport(inputPath, outputPath, methods.Length, _capturedMethodCount,
            _removedInvalidCustomAttributeCount, diagnostics.Exceptions.Count, _failures.AsReadOnly());
    }

    private void CaptureMethod(ModuleHandle moduleHandle, MethodDefinition method, DynamicCompilationMode mode)
    {
        CilMethodBody originalBody = method.CilMethodBody!;
        _currentMethod = method;
        _bestCandidateBody = null;
        _bestCandidateScore = long.MinValue;
        _captureSucceeded = false;
        _capturedCandidates.Clear();
        try
        {
            if (mode == DynamicCompilationMode.PrepareMethod)
            {
                RuntimeMethodHandle runtimeMethod = moduleHandle.ResolveMethodHandle(method.MetadataToken.ToInt32());
                NativeJitHook.SetCurrentMethod(NativeJitHook.GetUnboxedMethod(runtimeMethod.Value));
                RuntimeHelpers.PrepareMethod(runtimeMethod);
            }
            else
            {
                NativeJitHook.CompileMethod(moduleHandle.ResolveUnboxedMethod(method));
            }

            foreach (CapturedMethodData candidate in _capturedCandidates)
                ProcessCandidate(candidate);
            if (_captureSucceeded && _bestCandidateBody != null)
                method.CilMethodBody = _bestCandidateBody;
        }
        catch (Exception exception)
        {
            RecordFailure(method.MetadataToken.ToString(), exception.Message);
        }
    }

    private static void CompilationCallback(ref JitCaptureInfo captureInfo)
    {
        DynamicMethodAcquirer? active = _active;
        if (active == null || active._currentMethod == null)
            return;
        try
        {
            if (captureInfo.CilCodeSize <= 0)
                throw new BadImageFormatException("The JIT callback returned an empty method body.");
            active._capturedCandidates.Add(CapturedMethodData.CopyFrom(captureInfo));
        }
        catch (Exception exception)
        {
            active.RecordFailure(active._currentMethod.MetadataToken.ToString(), exception.Message);
        }
    }

    private void ProcessCandidate(CapturedMethodData candidate)
    {
        CilMethodBody originalBody = _currentMethod!.CilMethodBody!;
        var candidateBody = new CilMethodBody(_currentMethod)
        {
            InitializeLocals = originalBody.InitializeLocals,
            MaxStack = originalBody.MaxStack,
            BuildFlags = originalBody.BuildFlags
        };
        var bodyReader = new CapturedMethodBodyReader(candidateBody);
        GCHandle localHandle = default;
        GCHandle codeHandle = default;
        GCHandle exceptionHandle = default;
        try
        {
            localHandle = GCHandle.Alloc(candidate.LocalSignatures, GCHandleType.Pinned);
            codeHandle = GCHandle.Alloc(candidate.CilCode, GCHandleType.Pinned);
            exceptionHandle = GCHandle.Alloc(candidate.ExceptionHandlers, GCHandleType.Pinned);
            bodyReader.ReadVariables(localHandle.AddrOfPinnedObject(), candidate.LocalSignatures.Length);
            bodyReader.ReadInstructions(codeHandle.AddrOfPinnedObject(), candidate.CilCode.Length);
            bodyReader.ReadExceptionHandlers(exceptionHandle.AddrOfPinnedObject(), candidate.ExceptionHandlerCount);
            bodyReader.Body.VerifyLabels();
            try
            {
                bodyReader.Body.MaxStack = bodyReader.Body.ComputeMaxStack();
            }
            catch (Exception exception)
            {
                _log($"Preserving the original max-stack fallback for {_currentMethod.MetadataToken}: {exception.Message}");
            }
            long candidateScore = (DnGuardMethodBodyClassifier.IsPlaceholder(bodyReader.Body) ? 0L : 1L << 32)
                + candidate.CilCode.Length;
            if (candidateScore > _bestCandidateScore)
            {
                _bestCandidateScore = candidateScore;
                _bestCandidateBody = candidateBody;
            }
            if (!_captureSucceeded)
            {
                _captureSucceeded = true;
                _capturedMethodCount++;
            }
        }
        catch (Exception exception)
        {
            RecordFailure(_currentMethod.MetadataToken.ToString(), exception.Message);
        }
        finally
        {
            if (localHandle.IsAllocated)
                localHandle.Free();
            if (codeHandle.IsAllocated)
                codeHandle.Free();
            if (exceptionHandle.IsAllocated)
                exceptionHandle.Free();
        }
    }

    private sealed class CapturedMethodData
    {
        private CapturedMethodData(byte[] localSignatures, byte[] cilCode, byte[] exceptionHandlers,
            int exceptionHandlerCount)
        {
            LocalSignatures = localSignatures;
            CilCode = cilCode;
            ExceptionHandlers = exceptionHandlers;
            ExceptionHandlerCount = exceptionHandlerCount;
        }

        internal byte[] LocalSignatures { get; }

        internal byte[] CilCode { get; }

        internal byte[] ExceptionHandlers { get; }

        internal int ExceptionHandlerCount { get; }

        internal static CapturedMethodData CopyFrom(JitCaptureInfo captureInfo)
        {
            int localSize = checked((int)captureInfo.LocalSignaturesSize);
            int codeSize = checked((int)captureInfo.CilCodeSize);
            int exceptionHandlerCount = checked((int)captureInfo.ExceptionHandlerCount);
            int exceptionSize = checked(exceptionHandlerCount * (int)CilExceptionHandler.FatExceptionHandlerSize);
            byte[] localSignatures = CopyBytes(captureInfo.LocalSignatures, localSize);
            byte[] cilCode = CopyBytes(captureInfo.CilCode, codeSize);
            byte[] exceptionHandlers = CopyBytes(captureInfo.ExceptionHandlers, exceptionSize);
            return new CapturedMethodData(localSignatures, cilCode, exceptionHandlers, exceptionHandlerCount);
        }

        private static byte[] CopyBytes(nint address, int size)
        {
            var result = new byte[size];
            if (size > 0)
                Marshal.Copy(address, result, 0, size);
            return result;
        }
    }

    private void RecordFailure(string token, string message)
    {
        _failures.Add(new DynamicMethodFailure(token, message));
        _log($"Capture failed for {token}: {message}");
    }

    private static string ResolveOutputPath(string inputPath, DynamicMethodAcquisitionOptions options)
    {
        if (!string.IsNullOrWhiteSpace(options.OutputPath))
            return Path.GetFullPath(options.OutputPath!);
        string directory = Path.GetDirectoryName(inputPath) ?? Directory.GetCurrentDirectory();
        string suffix = options.CompilationMode == DynamicCompilationMode.PrepareMethod ? "-Prepared" : "-Captured";
        return Path.Combine(directory, Path.GetFileNameWithoutExtension(inputPath) + suffix + Path.GetExtension(inputPath));
    }

    [MethodImpl(MethodImplOptions.NoInlining | MethodImplOptions.NoOptimization)]
    private static void BootstrapMethod()
    {
        GC.KeepAlive(typeof(DynamicMethodAcquirer));
    }
}
