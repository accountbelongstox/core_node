// PY-REF: none (DOT-only)
using AsmResolver.DotNet;
using AsmResolver.DotNet.Builder;
using AsmResolver.DotNet.Code.Cil;
using AsmResolver.PE.DotNet.Cil;
using AsmResolver.PE.DotNet.Metadata.Tables;

namespace DotCore.Decompile.Dynamic;

public sealed class HvmContextOperand
{
    public uint MethodToken { get; set; }
    public uint VirtualToken { get; set; }
    public string Kind { get; set; } = string.Empty;
    public uint DefinitionToken { get; set; }
    public string ModuleHandle { get; set; } = string.Empty;
    public string MethodHandle { get; set; } = string.Empty;
}

public sealed class HvmContextDocument
{
    public HvmContextOperand[] Operands { get; set; } = Array.Empty<HvmContextOperand>();
}

public sealed class HvmMethodMetadata
{
    public string Handle { get; set; } = string.Empty;
    public uint DefinitionToken { get; set; }
    public string ModuleHandle { get; set; } = string.Empty;
    public string ModulePath { get; set; } = string.Empty;
}

public sealed class HvmMethodMetadataDocument
{
    public HvmMethodMetadata[] Methods { get; set; } = Array.Empty<HvmMethodMetadata>();
}

public sealed class HvmJitCaptureMethod
{
    public uint MethodToken { get; set; }
    public string ILBytes { get; set; } = string.Empty;
}

public sealed class HvmJitCaptureModule
{
    public HvmJitCaptureMethod[] MethodsInfo { get; set; } = Array.Empty<HvmJitCaptureMethod>();
}

public sealed class HvmJitCaptureDocument
{
    public HvmJitCaptureModule[] ModulesInfo { get; set; } = Array.Empty<HvmJitCaptureModule>();
}

public sealed class HvmOperandResolutionReport
{
    public HvmOperandResolutionReport(string outputPath, int mappedOperands, int unresolvedOperands,
        IReadOnlyList<string> failures)
    {
        OutputPath = outputPath;
        MappedOperands = mappedOperands;
        UnresolvedOperands = unresolvedOperands;
        Failures = failures;
    }

    public string OutputPath { get; }
    public int MappedOperands { get; }
    public int UnresolvedOperands { get; }
    public IReadOnlyList<string> Failures { get; }
}

public sealed class HvmVirtualOperandResolver
{
    public HvmOperandResolutionReport Resolve(string assemblyPath, IEnumerable<HvmContextOperand> contextOperands,
        IEnumerable<HvmMethodMetadata> methodMetadata, IEnumerable<HvmJitCaptureMethod> captures,
        string outputPath, Action<string>? log = null)
    {
        string fullAssemblyPath = Path.GetFullPath(assemblyPath);
        string fullOutputPath = Path.GetFullPath(outputPath);
        HvmContextOperand[] operands = contextOperands.ToArray();
        HvmMethodMetadata[] metadata = methodMetadata.ToArray();
        Action<string> writeLog = log ?? (_ => { });
        ModuleDefinition targetModule = ModuleDefinition.FromFile(fullAssemblyPath);
        Dictionary<int, MethodDefinition> targetMethods = targetModule.GetAllTypes().SelectMany(type => type.Methods)
            .ToDictionary(method => method.MetadataToken.ToInt32());
        Dictionary<string, HvmMethodMetadata> methodHandles = metadata
            .GroupBy(item => item.Handle, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);
        Dictionary<string, string> modulePaths = metadata.Where(item => !string.IsNullOrEmpty(item.ModulePath))
            .GroupBy(item => item.ModuleHandle, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First().ModulePath, StringComparer.OrdinalIgnoreCase);
        Dictionary<string, ModuleDefinition> sourceModules = new(StringComparer.OrdinalIgnoreCase);
        Dictionary<string, IMetadataMember?> resolvedMembers = new(StringComparer.Ordinal);
        Dictionary<uint, byte[]> methodBodies = captures.GroupBy(item => item.MethodToken)
            .ToDictionary(group => group.Key, group => ParseHex(group.OrderByDescending(item => item.ILBytes.Length)
                .First().ILBytes));
        List<string> failures = new();
        int mappedOperands = 0;
        int unresolvedOperands = 0;

        foreach (IGrouping<uint, HvmContextOperand> methodGroup in operands.GroupBy(item => item.MethodToken))
        {
            if (!targetMethods.TryGetValue(unchecked((int)methodGroup.Key), out MethodDefinition? method)
                || method.CilMethodBody == null || !methodBodies.TryGetValue(methodGroup.Key, out byte[]? rawBody))
                continue;
            foreach (HvmContextOperand mapping in methodGroup)
            {
                IMetadataMember? resolved = ResolveMember(mapping, targetModule, methodHandles, modulePaths,
                    sourceModules, resolvedMembers, failures);
                bool found = false;
                foreach (var instruction in method.CilMethodBody.Instructions)
                {
                    int operandOffset = checked((int)instruction.Offset + instruction.OpCode.Size);
                    uint rawToken;
                    if (!HasMetadataOperand(instruction.OpCode.OperandType) || operandOffset + 4 > rawBody.Length)
                        continue;
                    rawToken = BitConverter.ToUInt32(rawBody, operandOffset);
                    if (rawToken != mapping.VirtualToken)
                        continue;
                    found = true;
                    if (resolved != null)
                    {
                        instruction.Operand = resolved;
                        mappedOperands++;
                    }
                    else if (instruction.Operand is IMetadataMember existing
                             && unchecked((uint)existing.MetadataToken.ToInt32()) != mapping.VirtualToken)
                        found = false;
                }
                if (found && resolved == null) unresolvedOperands++;
            }
        }

        Directory.CreateDirectory(Path.GetDirectoryName(fullOutputPath) ?? Directory.GetCurrentDirectory());
        int removedInvalidCustomAttributeCount = InvalidCustomAttributeRemover.Remove(targetModule);
        if (removedInvalidCustomAttributeCount > 0)
            writeLog($"Removed {removedInvalidCustomAttributeCount} invalid custom attributes before writing the resolved assembly.");
        var metadataFlags = MetadataBuilderFlags.PreserveAll
                            & ~MetadataBuilderFlags.PreserveStandAloneSignatureIndices;
        var directoryFactory = new DotNetDirectoryFactory(metadataFlags)
        {
            MethodBodySerializer = new CilMethodBodySerializer { ComputeMaxStackOnBuildOverride = false }
        };
        targetModule.Write(fullOutputPath, new ManagedPEImageBuilder(directoryFactory));
        writeLog($"Resolved {mappedOperands} HVM operands; {unresolvedOperands} referenced operands remain unresolved.");
        return new HvmOperandResolutionReport(fullOutputPath, mappedOperands, unresolvedOperands,
            failures.AsReadOnly());
    }

    private static bool HasMetadataOperand(CilOperandType operandType)
    {
        return operandType == CilOperandType.InlineField || operandType == CilOperandType.InlineMethod
               || operandType == CilOperandType.InlineType || operandType == CilOperandType.InlineTok;
    }

    private static byte[] ParseHex(string value)
    {
        byte[] result = new byte[value.Length / 2];
        for (int index = 0; index < result.Length; index++)
            result[index] = Convert.ToByte(value.Substring(index * 2, 2), 16);
        return result;
    }

    private static IMetadataMember? ResolveMember(HvmContextOperand mapping, ModuleDefinition targetModule,
        IReadOnlyDictionary<string, HvmMethodMetadata> methodHandles,
        IReadOnlyDictionary<string, string> modulePaths, IDictionary<string, ModuleDefinition> sourceModules,
        IDictionary<string, IMetadataMember?> cache, ICollection<string> failures)
    {
        string modulePath;
        uint definitionToken;
        string cacheKey;
        ModuleDefinition sourceModule;
        IMetadataMember? sourceMember;
        IMetadataMember? resolved;

        if (string.Equals(mapping.Kind, "Method", StringComparison.OrdinalIgnoreCase))
        {
            if (!methodHandles.TryGetValue(mapping.MethodHandle, out HvmMethodMetadata? method))
                return null;
            modulePath = method.ModulePath;
            definitionToken = method.DefinitionToken;
        }
        else
        {
            if (!modulePaths.TryGetValue(mapping.ModuleHandle, out modulePath!)) return null;
            definitionToken = mapping.DefinitionToken;
        }
        cacheKey = modulePath + "|" + definitionToken.ToString("X8");
        if (cache.TryGetValue(cacheKey, out resolved)) return resolved;
        try
        {
            if (!sourceModules.TryGetValue(modulePath, out sourceModule!))
            {
                sourceModule = ModuleDefinition.FromFile(modulePath);
                sourceModules.Add(modulePath, sourceModule);
            }
            sourceMember = sourceModule.LookupMember(new MetadataToken(definitionToken));
            resolved = FindEquivalent(targetModule, sourceModule, sourceMember);
            cache[cacheKey] = resolved;
            if (resolved == null) failures.Add($"No target reference matches {GetFullName(sourceMember) ?? cacheKey}.");
            return resolved;
        }
        catch (Exception exception)
        {
            cache[cacheKey] = null;
            failures.Add($"Could not resolve {cacheKey}: {exception.Message}");
            return null;
        }
    }

    private static IMetadataMember? FindEquivalent(ModuleDefinition targetModule, ModuleDefinition sourceModule,
        IMetadataMember? sourceMember)
    {
        if (sourceMember == null) return null;
        if (string.Equals(sourceModule.Name, targetModule.Name, StringComparison.OrdinalIgnoreCase))
            return targetModule.LookupMember(sourceMember.MetadataToken);
        if (sourceMember is TypeDefinition sourceType)
            return targetModule.GetImportedTypeReferences().FirstOrDefault(item => item.FullName == sourceType.FullName);
        string? fullName = GetFullName(sourceMember);
        if (fullName != null && (sourceMember is MethodDefinition || sourceMember is FieldDefinition))
        {
            MemberReference? exact = targetModule.GetImportedMemberReferences()
                .FirstOrDefault(item => item.FullName == fullName);
            if (exact != null) return exact;
            foreach (MemberReference reference in targetModule.GetImportedMemberReferences())
            {
                try
                {
                    IMetadataMember? definition = reference.Resolve();
                    if (definition != null && definition.MetadataToken == sourceMember.MetadataToken
                        && string.Equals(GetModuleName(definition), sourceModule.Name,
                            StringComparison.OrdinalIgnoreCase))
                        return reference;
                }
                catch
                {
                }
            }
        }
        return null;
    }

    private static string? GetFullName(IMetadataMember? member)
    {
        if (member is TypeDefinition type) return type.FullName;
        if (member is MethodDefinition method) return method.FullName;
        if (member is FieldDefinition field) return field.FullName;
        return null;
    }

    private static string? GetModuleName(IMetadataMember member)
    {
        if (member is TypeDefinition type) return type.Module?.Name;
        if (member is MethodDefinition method) return method.Module?.Name;
        if (member is FieldDefinition field) return field.Module?.Name;
        return null;
    }
}
