// PY-REF: none (DOT-only)
using AsmResolver.DotNet;
using AsmResolver.DotNet.Builder;
using AsmResolver.DotNet.Code.Cil;
using AsmResolver.PE.DotNet.Cil;

namespace DotCore.Decompile.Dynamic;

public sealed class DynamicMethodAssemblyMergeReport
{
    public DynamicMethodAssemblyMergeReport(string outputPath, int candidateCount, int mergedMethodCount,
        IReadOnlyList<DynamicMethodFailure> failures)
    {
        OutputPath = outputPath;
        CandidateCount = candidateCount;
        MergedMethodCount = mergedMethodCount;
        Failures = failures;
    }

    public string OutputPath { get; }

    public int CandidateCount { get; }

    public int MergedMethodCount { get; }

    public IReadOnlyList<DynamicMethodFailure> Failures { get; }
}

public sealed class DynamicMethodAssemblyMerger
{
    public DynamicMethodAssemblyMergeReport Merge(string baseAssemblyPath, IEnumerable<string> candidatePaths,
        string outputPath, Action<string>? log = null)
    {
        string fullBasePath = Path.GetFullPath(baseAssemblyPath);
        string fullOutputPath = Path.GetFullPath(outputPath);
        string[] fullCandidatePaths = candidatePaths.Select(Path.GetFullPath).Distinct().ToArray();
        Action<string> writeLog = log ?? (_ => { });
        var failures = new List<DynamicMethodFailure>();
        ModuleDefinition targetModule = ModuleDefinition.FromFile(fullBasePath);
        Dictionary<int, MethodDefinition> targetMethods = targetModule.GetAllTypes()
            .SelectMany(type => type.Methods)
            .ToDictionary(method => method.MetadataToken.ToInt32());
        int mergedMethodCount = 0;

        foreach (string candidatePath in fullCandidatePaths)
        {
            try
            {
                ModuleDefinition candidateModule = ModuleDefinition.FromFile(candidatePath);
                foreach (MethodDefinition candidateMethod in candidateModule.GetAllTypes().SelectMany(type => type.Methods))
                {
                    int token = candidateMethod.MetadataToken.ToInt32();
                    if (!targetMethods.TryGetValue(token, out MethodDefinition? targetMethod)
                        || candidateMethod.CilMethodBody == null || targetMethod.CilMethodBody == null
                        || DnGuardMethodBodyClassifier.IsPlaceholder(candidateMethod.CilMethodBody)
                        || !DnGuardMethodBodyClassifier.IsPlaceholder(targetMethod.CilMethodBody))
                        continue;

                    targetMethod.CilMethodBody = CloneBody(candidateMethod.CilMethodBody, targetMethod, targetModule);
                    mergedMethodCount++;
                    writeLog($"Merged runtime method {targetMethod.MetadataToken} from {Path.GetFileName(candidatePath)}.");
                }
            }
            catch (Exception exception)
            {
                failures.Add(new DynamicMethodFailure(Path.GetFileName(candidatePath), exception.Message));
                writeLog($"Merge failed for {candidatePath}: {exception.Message}");
            }
        }

        string outputDirectory = Path.GetDirectoryName(fullOutputPath) ?? Directory.GetCurrentDirectory();
        Directory.CreateDirectory(outputDirectory);
        int removedInvalidCustomAttributeCount = InvalidCustomAttributeRemover.Remove(targetModule);
        if (removedInvalidCustomAttributeCount > 0)
            writeLog($"Removed {removedInvalidCustomAttributeCount} invalid custom attributes before writing the merged assembly.");
        var metadataFlags = MetadataBuilderFlags.PreserveAll
                            & ~MetadataBuilderFlags.PreserveStandAloneSignatureIndices;
        var directoryFactory = new DotNetDirectoryFactory(metadataFlags)
        {
            MethodBodySerializer = new CilMethodBodySerializer { ComputeMaxStackOnBuildOverride = false }
        };
        targetModule.Write(fullOutputPath, new ManagedPEImageBuilder(directoryFactory));
        return new DynamicMethodAssemblyMergeReport(fullOutputPath, fullCandidatePaths.Length, mergedMethodCount,
            failures.AsReadOnly());
    }

    private static CilMethodBody CloneBody(CilMethodBody source, MethodDefinition targetMethod,
        ModuleDefinition targetModule)
    {
        var result = new CilMethodBody(targetMethod)
        {
            InitializeLocals = source.InitializeLocals,
            MaxStack = source.MaxStack,
            BuildFlags = source.BuildFlags
        };
        var instructionMap = new Dictionary<CilInstruction, CilInstruction>();
        var localMap = new Dictionary<CilLocalVariable, CilLocalVariable>();
        var importer = new ReferenceImporter(targetModule);

        foreach (CilLocalVariable sourceLocal in source.LocalVariables)
        {
            var targetLocal = new CilLocalVariable(importer.ImportTypeSignature(sourceLocal.VariableType));
            result.LocalVariables.Add(targetLocal);
            localMap.Add(sourceLocal, targetLocal);
        }
        foreach (CilInstruction sourceInstruction in source.Instructions)
        {
            var targetInstruction = new CilInstruction(sourceInstruction.OpCode);
            result.Instructions.Add(targetInstruction);
            instructionMap.Add(sourceInstruction, targetInstruction);
        }
        for (int index = 0; index < source.Instructions.Count; index++)
        {
            CilInstruction sourceInstruction = source.Instructions[index];
            result.Instructions[index].Operand = CloneOperand(sourceInstruction.Operand, source, targetMethod,
                targetModule, importer, instructionMap, localMap);
        }
        foreach (CilExceptionHandler sourceHandler in source.ExceptionHandlers)
        {
            var targetHandler = new CilExceptionHandler
            {
                HandlerType = sourceHandler.HandlerType,
                TryStart = CloneLabel(sourceHandler.TryStart, instructionMap),
                TryEnd = CloneLabel(sourceHandler.TryEnd, instructionMap),
                HandlerStart = CloneLabel(sourceHandler.HandlerStart, instructionMap),
                HandlerEnd = CloneLabel(sourceHandler.HandlerEnd, instructionMap),
                FilterStart = CloneLabel(sourceHandler.FilterStart, instructionMap),
                ExceptionType = sourceHandler.ExceptionType == null
                    ? null
                    : (ITypeDefOrRef)targetModule.LookupMember(sourceHandler.ExceptionType.MetadataToken)
            };
            result.ExceptionHandlers.Add(targetHandler);
        }
        result.VerifyLabels();
        return result;
    }

    private static object? CloneOperand(object? operand, CilMethodBody source, MethodDefinition targetMethod,
        ModuleDefinition targetModule, ReferenceImporter importer,
        IReadOnlyDictionary<CilInstruction, CilInstruction> instructionMap,
        IReadOnlyDictionary<CilLocalVariable, CilLocalVariable> localMap)
    {
        if (operand is CilLocalVariable local)
            return localMap[local];
        if (operand is ParameterDefinition parameter)
        {
            int parameterIndex = source.Owner.ParameterDefinitions.IndexOf(parameter);
            return targetMethod.ParameterDefinitions[parameterIndex];
        }
        if (operand is ICilLabel label)
            return CloneLabel(label, instructionMap);
        if (operand is IList<ICilLabel> labels)
            return labels.Select(item => CloneLabel(item, instructionMap)!).ToArray();
        if (operand is StandAloneSignature standAlone)
        {
            if (standAlone.Signature is AsmResolver.DotNet.Signatures.MethodSignature methodSignature)
                return new StandAloneSignature(importer.ImportMethodSignature(methodSignature));
            if (standAlone.Signature is AsmResolver.DotNet.Signatures.LocalVariablesSignature localSignature)
                return new StandAloneSignature(importer.ImportLocalVariablesSignature(localSignature));
        }
        if (operand is IMetadataMember metadataMember)
            return targetModule.LookupMember(metadataMember.MetadataToken);
        return operand;
    }

    private static ICilLabel? CloneLabel(ICilLabel? label,
        IReadOnlyDictionary<CilInstruction, CilInstruction> instructionMap)
    {
        if (label == null)
            return null;
        if (label is CilInstructionLabel instructionLabel && instructionLabel.Instruction != null)
            return new CilInstructionLabel(instructionMap[instructionLabel.Instruction]);
        return new CilOffsetLabel(label.Offset);
    }
}
