// PY-REF: none (DOT-only)
using AsmResolver.DotNet;
using AsmResolver.DotNet.Builder;
using AsmResolver.DotNet.Code.Cil;
using AsmResolver.DotNet.Signatures;

namespace DotCore.Decompile.Dynamic;

public sealed class HvmMethodAliasMapping
{
    public HvmMethodAliasMapping(int targetToken, int sourceToken)
    {
        TargetToken = targetToken;
        SourceToken = sourceToken;
    }

    public int TargetToken { get; }

    public int SourceToken { get; }
}

public sealed class HvmMethodAliasReport
{
    public HvmMethodAliasReport(string outputPath, int recoveredMethodCount, int requestedCount, int mappedCount,
        IReadOnlyList<DynamicMethodFailure> failures)
    {
        OutputPath = outputPath;
        RecoveredMethodCount = recoveredMethodCount;
        RequestedCount = requestedCount;
        MappedCount = mappedCount;
        Failures = failures;
    }

    public string OutputPath { get; }

    public int RecoveredMethodCount { get; }

    public int RequestedCount { get; }

    public int MappedCount { get; }

    public IReadOnlyList<DynamicMethodFailure> Failures { get; }
}

public sealed class HvmMethodAliasMapper
{
    public HvmMethodAliasReport Map(string baseAssemblyPath, string recoveredAssemblyPath,
        IEnumerable<HvmMethodAliasMapping> mappings, string outputPath, Action<string>? log = null)
    {
        string fullBaseAssemblyPath = Path.GetFullPath(baseAssemblyPath);
        string fullRecoveredAssemblyPath = Path.GetFullPath(recoveredAssemblyPath);
        string fullOutputPath = Path.GetFullPath(outputPath);
        HvmMethodAliasMapping[] requestedMappings = mappings.ToArray();
        Action<string> writeLog = log ?? (_ => { });
        var failures = new List<DynamicMethodFailure>();
        ModuleDefinition module = ModuleDefinition.FromFile(fullBaseAssemblyPath);
        ModuleDefinition recoveredModule = ModuleDefinition.FromFile(fullRecoveredAssemblyPath);
        Dictionary<int, MethodDefinition> methods = module.GetAllTypes()
            .SelectMany(type => type.Methods)
            .ToDictionary(method => method.MetadataToken.ToInt32());
        Dictionary<int, MethodDefinition> recoveredMethods = recoveredModule.GetAllTypes()
            .SelectMany(type => type.Methods)
            .ToDictionary(method => method.MetadataToken.ToInt32());
        var targetTokens = new HashSet<int>();
        int recoveredMethodCount = DynamicMethodAssemblyMerger.MergeRecoveredBodies(module, methods,
            recoveredModule, Path.GetFileName(fullRecoveredAssemblyPath), failures, writeLog);
        int mappedCount = 0;

        foreach (HvmMethodAliasMapping mapping in requestedMappings)
        {
            string mappingText = $"0x{mapping.TargetToken:X8}=0x{mapping.SourceToken:X8}";
            if (!targetTokens.Add(mapping.TargetToken))
            {
                failures.Add(new DynamicMethodFailure(mappingText, "The target token is mapped more than once."));
                continue;
            }
            if (!methods.TryGetValue(mapping.TargetToken, out MethodDefinition? targetMethod))
            {
                failures.Add(new DynamicMethodFailure(mappingText, "The target method does not exist."));
                continue;
            }
            if (!recoveredMethods.TryGetValue(mapping.SourceToken, out MethodDefinition? sourceMethod))
            {
                failures.Add(new DynamicMethodFailure(mappingText, "The source method does not exist."));
                continue;
            }
            if (targetMethod.CilMethodBody == null || !DnGuardMethodBodyClassifier.IsPlaceholder(targetMethod.CilMethodBody))
            {
                failures.Add(new DynamicMethodFailure(mappingText, "The target method is not a protected placeholder."));
                continue;
            }
            if (sourceMethod.CilMethodBody == null || DnGuardMethodBodyClassifier.IsPlaceholder(sourceMethod.CilMethodBody))
            {
                failures.Add(new DynamicMethodFailure(mappingText, "The source method is not a recovered implementation."));
                continue;
            }
            if (!HaveEquivalentSignatures(targetMethod.Signature, sourceMethod.Signature))
            {
                failures.Add(new DynamicMethodFailure(mappingText, "The source and target signatures differ."));
                continue;
            }
            if (!ForwardsToNamedTarget(sourceMethod, targetMethod))
            {
                failures.Add(new DynamicMethodFailure(mappingText,
                    "The source body does not forward to a method with the target name and signature."));
                continue;
            }

            try
            {
                targetMethod.CilMethodBody = DynamicMethodAssemblyMerger.CloneBody(sourceMethod.CilMethodBody,
                    targetMethod, module);
                mappedCount++;
                writeLog($"Mapped HVM alias {targetMethod.MetadataToken} from {sourceMethod.MetadataToken}.");
            }
            catch (Exception exception)
            {
                failures.Add(new DynamicMethodFailure(mappingText, exception.Message));
            }
        }

        string outputDirectory = Path.GetDirectoryName(fullOutputPath) ?? Directory.GetCurrentDirectory();
        Directory.CreateDirectory(outputDirectory);
        int removedInvalidCustomAttributeCount = InvalidCustomAttributeRemover.Remove(module);
        if (removedInvalidCustomAttributeCount > 0)
            writeLog($"Removed {removedInvalidCustomAttributeCount} invalid custom attributes before writing the mapped assembly.");
        var metadataFlags = MetadataBuilderFlags.PreserveAll
                            & ~MetadataBuilderFlags.PreserveStandAloneSignatureIndices;
        var directoryFactory = new DotNetDirectoryFactory(metadataFlags)
        {
            MethodBodySerializer = new CilMethodBodySerializer { ComputeMaxStackOnBuildOverride = false }
        };
        module.Write(fullOutputPath, new ManagedPEImageBuilder(directoryFactory));
        return new HvmMethodAliasReport(fullOutputPath, recoveredMethodCount, requestedMappings.Length, mappedCount,
            failures.AsReadOnly());
    }

    private static bool ForwardsToNamedTarget(MethodDefinition sourceMethod, MethodDefinition targetMethod)
    {
        return sourceMethod.CilMethodBody!.Instructions.Any(instruction =>
            instruction.Operand is IMethodDescriptor calledMethod
            && string.Equals(calledMethod.Name?.ToString(), targetMethod.Name?.ToString(),
                StringComparison.Ordinal)
            && HaveEquivalentSignatures(targetMethod.Signature, calledMethod.Signature,
                ignoreInstanceConvention: true));
    }

    private static bool HaveEquivalentSignatures(MethodSignature? left, MethodSignature? right,
        bool ignoreInstanceConvention = false)
    {
        if (left == null || right == null
            || left.ReturnType.FullName != right.ReturnType.FullName
            || left.ParameterTypes.Count != right.ParameterTypes.Count
            || (!ignoreInstanceConvention && left.HasThis != right.HasThis))
            return false;
        for (int index = 0; index < left.ParameterTypes.Count; index++)
        {
            if (left.ParameterTypes[index].FullName != right.ParameterTypes[index].FullName)
                return false;
        }
        return true;
    }
}
