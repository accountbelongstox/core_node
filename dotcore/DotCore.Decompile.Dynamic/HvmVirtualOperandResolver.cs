// PY-REF: none (DOT-only)
using AsmResolver.DotNet;
using AsmResolver.DotNet.Builder;
using AsmResolver.DotNet.Code.Cil;
using AsmResolver.DotNet.Signatures.Types;
using AsmResolver.IO;
using AsmResolver.PE.DotNet.Cil;
using AsmResolver.PE.DotNet.Metadata.Tables;
using System.Runtime.InteropServices;

namespace DotCore.Decompile.Dynamic;

public sealed class HvmContextOperand
{
    public int JitCallIndex { get; set; }
    public uint MethodToken { get; set; }
    public uint VirtualToken { get; set; }
    public string Kind { get; set; } = string.Empty;
    public uint DefinitionToken { get; set; }
    public string ModuleHandle { get; set; } = string.Empty;
    public int TypeDescriptorKind { get; set; }
    public string TypeModuleHandle { get; set; } = string.Empty;
    public uint ResolvedTypeDefinitionToken { get; set; }
    public string MethodHandle { get; set; } = string.Empty;
}

public sealed class HvmLocalType
{
    public int JitCallIndex { get; set; }
    public string ArgumentPointer { get; set; } = string.Empty;
    public uint CorInfoType { get; set; }
    public int TypeDescriptorKind { get; set; }
    public string ModuleHandle { get; set; } = string.Empty;
    public uint TypeDefinitionToken { get; set; }
}

public sealed class HvmLocalClass
{
    public int JitCallIndex { get; set; }
    public string ArgumentPointer { get; set; } = string.Empty;
    public int TypeDescriptorKind { get; set; }
    public string ModuleHandle { get; set; } = string.Empty;
    public uint TypeDefinitionToken { get; set; }
}

public sealed class HvmLocalTypeDocument
{
    public HvmLocalType[] Locals { get; set; } = Array.Empty<HvmLocalType>();
    public HvmLocalClass[] Classes { get; set; } = Array.Empty<HvmLocalClass>();
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
    public int CallIndex { get; set; }
    public uint MethodToken { get; set; }
    public string ILBytes { get; set; } = string.Empty;
    public int MaxStack { get; set; }
    public int ExceptionHandlerCount { get; set; }
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
        int resolvedLocals, int decodedMethods, int rejectedMethods, int rejectedOperands,
        IReadOnlyList<string> failures)
    {
        OutputPath = outputPath;
        MappedOperands = mappedOperands;
        UnresolvedOperands = unresolvedOperands;
        ResolvedLocals = resolvedLocals;
        DecodedMethods = decodedMethods;
        RejectedMethods = rejectedMethods;
        RejectedOperands = rejectedOperands;
        Failures = failures;
    }

    public string OutputPath { get; }
    public int MappedOperands { get; }
    public int UnresolvedOperands { get; }
    public int ResolvedLocals { get; }
    public int DecodedMethods { get; }
    public int RejectedMethods { get; }
    public int RejectedOperands { get; }
    public IReadOnlyList<string> Failures { get; }
}

public sealed class HvmVirtualOperandResolver
{
    public HvmOperandResolutionReport Resolve(string assemblyPath, IEnumerable<HvmContextOperand> contextOperands,
        IEnumerable<HvmMethodMetadata> methodMetadata, IEnumerable<HvmJitCaptureMethod> captures,
        HvmLocalTypeDocument localTypes, string outputPath, Action<string>? log = null,
        ISet<uint>? selectedMethodTokens = null)
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
        Dictionary<uint, HvmJitCaptureMethod[]> capturedMethods = captures.GroupBy(item => item.MethodToken)
            .ToDictionary(group => group.Key, group => group.OrderByDescending(item => item.ILBytes.Length).ToArray());
        List<string> failures = new();
        HashSet<uint> decodedMethodTokens = new();
        int mappedOperands = 0;
        int unresolvedOperands = 0;
        int resolvedLocals;
        int decodedMethods = 0;
        int rejectedMethods = 0;
        int rejectedOperands = 0;

        foreach (IGrouping<uint, HvmContextOperand> methodGroup in operands.GroupBy(item => item.MethodToken))
        {
            if (selectedMethodTokens != null && !selectedMethodTokens.Contains(methodGroup.Key))
                continue;
            if (!targetMethods.TryGetValue(unchecked((int)methodGroup.Key), out MethodDefinition? method)
                || method.CilMethodBody == null
                || !DnGuardMethodBodyClassifier.IsPlaceholder(method.CilMethodBody)
                || !capturedMethods.TryGetValue(methodGroup.Key, out HvmJitCaptureMethod[]? methodCaptures))
                continue;
            CilMethodBody originalBody = method.CilMethodBody;
            HvmContextOperand[] methodOperands = methodGroup.ToArray();
            HvmJitCaptureMethod? acceptedCapture = null;
            HvmContextOperand[] acceptedOperands = Array.Empty<HvmContextOperand>();
            byte[] rawBody = Array.Empty<byte>();
            Dictionary<uint, IMetadataMember> methodMembers = new();
            foreach (HvmJitCaptureMethod capture in OrderCaptures(methodCaptures, methodOperands))
            {
                HvmContextOperand[] captureOperands = methodOperands
                    .Where(item => capture.CallIndex == 0 || item.JitCallIndex == capture.CallIndex)
                    .ToArray();
                if (captureOperands.Length == 0) continue;
                rawBody = ParseHex(capture.ILBytes);
                methodMembers = new Dictionary<uint, IMetadataMember>();
                foreach (HvmContextOperand mapping in captureOperands)
                {
                    IMetadataMember? member = ResolveMember(mapping, targetModule, methodHandles, modulePaths,
                        sourceModules, resolvedMembers, failures);
                    if (member != null)
                        methodMembers[mapping.VirtualToken] = member;
                }
                if (!TryDecodeCapturedBody(method, capture, rawBody, methodGroup.Key,
                        capture.CallIndex == 0 ? captureOperands[0].JitCallIndex : capture.CallIndex,
                        methodMembers, localTypes, failures))
                    continue;
                acceptedCapture = capture;
                acceptedOperands = captureOperands;
                break;
            }
            if (acceptedCapture == null)
                continue;
            int methodMappedOperands = 0;
            int methodUnresolvedOperands = 0;
            foreach (HvmContextOperand mapping in acceptedOperands)
            {
                methodMembers.TryGetValue(mapping.VirtualToken, out IMetadataMember? resolved);
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
                        methodMappedOperands++;
                    }
                    else if (instruction.Operand is IMetadataMember existing
                             && unchecked((uint)existing.MetadataToken.ToInt32()) != mapping.VirtualToken)
                        found = false;
                }
                if (found && resolved == null) methodUnresolvedOperands++;
            }
            if (methodUnresolvedOperands != 0)
            {
                method.CilMethodBody = originalBody;
                rejectedMethods++;
                unresolvedOperands += methodUnresolvedOperands;
                rejectedOperands += methodUnresolvedOperands;
                continue;
            }
            decodedMethods++;
            decodedMethodTokens.Add(methodGroup.Key);
            mappedOperands += methodMappedOperands;
        }

        resolvedLocals = ResolveLocals(targetModule, targetMethods, decodedMethodTokens, operands, localTypes, modulePaths,
            sourceModules, failures);

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
        writeLog($"Decoded {decodedMethods} HVM methods; resolved {mappedOperands} operands and {resolvedLocals} local variables; {unresolvedOperands} referenced operands remain unresolved; rejected {rejectedMethods} methods with {rejectedOperands} unresolved operands.");
        return new HvmOperandResolutionReport(fullOutputPath, mappedOperands, unresolvedOperands, resolvedLocals,
            decodedMethods, rejectedMethods, rejectedOperands, failures.AsReadOnly());
    }

    private static IEnumerable<HvmJitCaptureMethod> OrderCaptures(IEnumerable<HvmJitCaptureMethod> captures,
        IReadOnlyCollection<HvmContextOperand> operands)
    {
        var contextualCallIndexes = new HashSet<int>(operands.Select(item => item.JitCallIndex));
        return captures.OrderByDescending(item => contextualCallIndexes.Contains(item.CallIndex))
            .ThenByDescending(item => item.ILBytes.Length);
    }

    private static bool TryDecodeCapturedBody(MethodDefinition method, HvmJitCaptureMethod capture, byte[] rawBody,
        uint methodToken, int jitCallIndex, IReadOnlyDictionary<uint, IMetadataMember> mappedMembers,
        HvmLocalTypeDocument localTypes, ICollection<string> failures)
    {
        CilMethodBody originalBody = method.CilMethodBody!;
        var candidateBody = new CilMethodBody(method)
        {
            InitializeLocals = originalBody.InitializeLocals,
            MaxStack = capture.MaxStack > 0 ? capture.MaxStack : originalBody.MaxStack,
            BuildFlags = originalBody.BuildFlags
        };
        int localCount = localTypes.Locals.Where(item => item.JitCallIndex == jitCallIndex)
            .Select(item => item.ArgumentPointer)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Count();
        GCHandle codeHandle = default;

        if (capture.ExceptionHandlerCount != 0)
        {
            failures.Add($"Captured method 0x{methodToken:X8} has {capture.ExceptionHandlerCount} exception handlers but no captured handler table.");
            return false;
        }
        try
        {
            for (int index = 0; index < localCount; index++)
                candidateBody.LocalVariables.Add(new CilLocalVariable(method.Module!.CorLibTypeFactory.Object));
            candidateBody.InitializeLocals = localCount > 0 || originalBody.InitializeLocals;
            codeHandle = GCHandle.Alloc(rawBody, GCHandleType.Pinned);
            var source = new UnmanagedDataSource(codeHandle.AddrOfPinnedObject(), (ulong)rawBody.Length);
            var reader = new BinaryStreamReader(source, source.BaseAddress, 0, (uint)rawBody.Length);
            var resolver = new MappedCilOperandResolver(method.Module!, candidateBody, mappedMembers);
            var disassembler = new CilDisassembler(in reader, resolver);
            candidateBody.Instructions.AddRange(disassembler.ReadInstructions());
            candidateBody.VerifyLabels();
            candidateBody.MaxStack = candidateBody.ComputeMaxStack();
            method.CilMethodBody = candidateBody;
            return true;
        }
        catch (Exception exception)
        {
            failures.Add($"Could not decode captured method 0x{methodToken:X8}: {exception.Message}");
            return false;
        }
        finally
        {
            if (codeHandle.IsAllocated)
                codeHandle.Free();
        }
    }

    private static int ResolveLocals(ModuleDefinition targetModule,
        IReadOnlyDictionary<int, MethodDefinition> targetMethods, ISet<uint> decodedMethodTokens,
        IEnumerable<HvmContextOperand> operands,
        HvmLocalTypeDocument localTypes, IReadOnlyDictionary<string, string> modulePaths,
        IDictionary<string, ModuleDefinition> sourceModules, ICollection<string> failures)
    {
        Dictionary<int, uint> methodTokens = operands.GroupBy(item => item.JitCallIndex)
            .ToDictionary(group => group.Key, group => group.First().MethodToken);
        Dictionary<string, HvmLocalClass> classes = localTypes.Classes
            .GroupBy(item => LocalKey(item.JitCallIndex, item.ArgumentPointer), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);
        int resolvedLocals = 0;

        foreach (IGrouping<int, HvmLocalType> group in localTypes.Locals.GroupBy(item => item.JitCallIndex))
        {
            if (!methodTokens.TryGetValue(group.Key, out uint methodToken)
                || !decodedMethodTokens.Contains(methodToken)
                || !targetMethods.TryGetValue(unchecked((int)methodToken), out MethodDefinition? method)
                || method.CilMethodBody == null)
                continue;
            HvmLocalType[] capturedLocals = group
                .GroupBy(item => item.ArgumentPointer, StringComparer.OrdinalIgnoreCase)
                .Select(items => items.First())
                .OrderBy(item => ParsePointer(item.ArgumentPointer))
                .ToArray();
            var replacementLocals = new List<CilLocalVariable>();
            bool valid = true;
            foreach (HvmLocalType capturedLocal in capturedLocals)
            {
                classes.TryGetValue(LocalKey(group.Key, capturedLocal.ArgumentPointer), out HvmLocalClass? capturedClass);
                if (capturedClass == null && capturedLocal.TypeDefinitionToken != 0)
                {
                    capturedClass = new HvmLocalClass
                    {
                        JitCallIndex = capturedLocal.JitCallIndex,
                        ArgumentPointer = capturedLocal.ArgumentPointer,
                        TypeDescriptorKind = capturedLocal.TypeDescriptorKind,
                        ModuleHandle = capturedLocal.ModuleHandle,
                        TypeDefinitionToken = capturedLocal.TypeDefinitionToken
                    };
                }
                TypeSignature? signature = ResolveLocalType(targetModule, capturedLocal, capturedClass, modulePaths,
                    sourceModules, failures);
                if (signature == null)
                {
                    valid = false;
                    break;
                }
                replacementLocals.Add(new CilLocalVariable(signature));
            }
            if (!valid) continue;

            CilLocalVariable[] oldLocals = method.CilMethodBody.LocalVariables.ToArray();
            foreach (CilInstruction instruction in method.CilMethodBody.Instructions)
            {
                if (instruction.Operand is not CilLocalVariable oldLocal) continue;
                int index = Array.IndexOf(oldLocals, oldLocal);
                if (index < 0 || index >= replacementLocals.Count)
                {
                    failures.Add($"Local index {index} is outside the captured signature for method 0x{methodToken:X8}.");
                    valid = false;
                    break;
                }
                instruction.Operand = replacementLocals[index];
            }
            if (!valid) continue;
            method.CilMethodBody.LocalVariables.Clear();
            foreach (CilLocalVariable local in replacementLocals)
                method.CilMethodBody.LocalVariables.Add(local);
            resolvedLocals += replacementLocals.Count;
        }
        return resolvedLocals;
    }

    private static TypeSignature? ResolveLocalType(ModuleDefinition targetModule, HvmLocalType local,
        HvmLocalClass? capturedClass, IReadOnlyDictionary<string, string> modulePaths,
        IDictionary<string, ModuleDefinition> sourceModules, ICollection<string> failures)
    {
        uint corInfoType = local.CorInfoType & 0x3f;
        TypeSignature? result = corInfoType switch
        {
            2 => targetModule.CorLibTypeFactory.Boolean,
            3 => targetModule.CorLibTypeFactory.Char,
            4 => targetModule.CorLibTypeFactory.SByte,
            5 => targetModule.CorLibTypeFactory.Byte,
            6 => targetModule.CorLibTypeFactory.Int16,
            7 => targetModule.CorLibTypeFactory.UInt16,
            8 => targetModule.CorLibTypeFactory.Int32,
            9 => targetModule.CorLibTypeFactory.UInt32,
            10 => targetModule.CorLibTypeFactory.Int64,
            11 => targetModule.CorLibTypeFactory.UInt64,
            12 => targetModule.CorLibTypeFactory.IntPtr,
            13 => targetModule.CorLibTypeFactory.UIntPtr,
            14 => targetModule.CorLibTypeFactory.Single,
            15 => targetModule.CorLibTypeFactory.Double,
            16 => targetModule.CorLibTypeFactory.String,
            19 or 20 => ResolveClassType(targetModule, capturedClass, corInfoType == 19, modulePaths,
                sourceModules, failures),
            _ => null
        };
        if (result == null)
        {
            failures.Add($"Unsupported local type 0x{local.CorInfoType:X} at JIT call {local.JitCallIndex}, argument {local.ArgumentPointer}.");
            return null;
        }
        return (local.CorInfoType & 0x40) != 0 ? new PinnedTypeSignature(result) : result;
    }

    private static TypeSignature? ResolveClassType(ModuleDefinition targetModule, HvmLocalClass? capturedClass,
        bool isValueType, IReadOnlyDictionary<string, string> modulePaths,
        IDictionary<string, ModuleDefinition> sourceModules, ICollection<string> failures)
    {
        string modulePath;
        ModuleDefinition sourceModule;
        IMetadataMember? sourceMember;
        IMetadataMember? equivalent;

        if (capturedClass == null || capturedClass.TypeDefinitionToken == 0
            || !modulePaths.TryGetValue(capturedClass.ModuleHandle, out modulePath!))
            return null;
        try
        {
            if (!sourceModules.TryGetValue(modulePath, out sourceModule!))
            {
                sourceModule = ModuleDefinition.FromFile(modulePath);
                sourceModules.Add(modulePath, sourceModule);
            }
            sourceMember = sourceModule.LookupMember(new MetadataToken(capturedClass.TypeDefinitionToken));
            equivalent = FindEquivalent(targetModule, sourceModule, sourceMember);
            if (equivalent is not ITypeDefOrRef type)
            {
                failures.Add($"No target type reference matches {GetFullName(sourceMember) ?? capturedClass.TypeDefinitionToken.ToString("X8")}.");
                return null;
            }
            TypeSignature result = new TypeDefOrRefSignature(type, isValueType);
            return capturedClass.TypeDescriptorKind == 0x1d ? new SzArrayTypeSignature(result) : result;
        }
        catch (Exception exception)
        {
            failures.Add($"Could not resolve local class 0x{capturedClass.TypeDefinitionToken:X8}: {exception.Message}");
            return null;
        }
    }

    private static string LocalKey(int jitCallIndex, string argumentPointer) =>
        jitCallIndex + "|" + argumentPointer;

    private static ulong ParsePointer(string value) =>
        Convert.ToUInt64(value.StartsWith("0x", StringComparison.OrdinalIgnoreCase) ? value.Substring(2) : value, 16);

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

        if (string.Equals(mapping.Kind, "Type", StringComparison.OrdinalIgnoreCase)
            && mapping.TypeDescriptorKind != 0)
            return ResolveConstructedType(mapping, targetModule, modulePaths, sourceModules, cache, failures);

        if (string.Equals(mapping.Kind, "Method", StringComparison.OrdinalIgnoreCase))
        {
            if (!methodHandles.TryGetValue(mapping.MethodHandle, out HvmMethodMetadata? method))
                return null;
            modulePath = method.ModulePath;
            definitionToken = method.DefinitionToken;
        }
        else
        {
            definitionToken = mapping.DefinitionToken;
            if (!modulePaths.TryGetValue(mapping.ModuleHandle, out modulePath!))
            {
                if (ParsePointer(mapping.ModuleHandle) != 0) return null;
                cacheKey = targetModule.Name + "|" + definitionToken.ToString("X8");
                if (cache.TryGetValue(cacheKey, out resolved)) return resolved;
                try
                {
                    resolved = targetModule.LookupMember(new MetadataToken(definitionToken));
                    cache[cacheKey] = resolved;
                    return resolved;
                }
                catch (ArgumentException exception)
                {
                    cache[cacheKey] = null;
                    failures.Add($"Could not resolve {cacheKey}: {exception.Message}");
                    return null;
                }
            }
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

    private sealed class MappedCilOperandResolver : PhysicalCilOperandResolver
    {
        private readonly IReadOnlyDictionary<uint, IMetadataMember> _mappedMembers;

        internal MappedCilOperandResolver(ModuleDefinition module, CilMethodBody body,
            IReadOnlyDictionary<uint, IMetadataMember> mappedMembers)
            : base(module, body)
        {
            _mappedMembers = mappedMembers;
        }

        public override object ResolveMember(MetadataToken token)
        {
            uint rawToken = unchecked((uint)token.ToInt32());
            return _mappedMembers.TryGetValue(rawToken, out IMetadataMember? member)
                ? member
                : base.ResolveMember(token)!;
        }
    }

    private static IMetadataMember? ResolveConstructedType(HvmContextOperand mapping,
        ModuleDefinition targetModule, IReadOnlyDictionary<string, string> modulePaths,
        IDictionary<string, ModuleDefinition> sourceModules, IDictionary<string, IMetadataMember?> cache,
        ICollection<string> failures)
    {
        string modulePath;
        string cacheKey;
        ModuleDefinition sourceModule;
        IMetadataMember? sourceMember;
        IMetadataMember? equivalent;
        TypeSignature elementSignature;
        IMetadataMember resolved;

        if (mapping.TypeDescriptorKind != 0x1d || mapping.ResolvedTypeDefinitionToken == 0
            || !modulePaths.TryGetValue(mapping.TypeModuleHandle, out modulePath!))
            return null;
        cacheKey = modulePath + "|" + mapping.ResolvedTypeDefinitionToken.ToString("X8")
                   + "|" + mapping.TypeDescriptorKind.ToString("X2");
        if (cache.TryGetValue(cacheKey, out equivalent)) return equivalent;
        try
        {
            if (!sourceModules.TryGetValue(modulePath, out sourceModule!))
            {
                sourceModule = ModuleDefinition.FromFile(modulePath);
                sourceModules.Add(modulePath, sourceModule);
            }
            sourceMember = sourceModule.LookupMember(new MetadataToken(mapping.ResolvedTypeDefinitionToken));
            equivalent = FindEquivalent(targetModule, sourceModule, sourceMember);
            if (sourceMember is not TypeDefinition sourceType || equivalent is not ITypeDefOrRef targetType)
            {
                failures.Add($"No target type reference matches {GetFullName(sourceMember) ?? cacheKey}.");
                cache[cacheKey] = null;
                return null;
            }
            elementSignature = new TypeDefOrRefSignature(targetType, sourceType.IsValueType);
            resolved = new TypeSpecification(new SzArrayTypeSignature(elementSignature));
            cache[cacheKey] = resolved;
            return resolved;
        }
        catch (Exception exception)
        {
            cache[cacheKey] = null;
            failures.Add($"Could not resolve constructed type {cacheKey}: {exception.Message}");
            return null;
        }
    }
}
