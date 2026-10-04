// PY-REF: none (DOT-only)
using System.Reflection;
using System.Reflection.Emit;
using System.Reflection.Metadata;
using System.Reflection.Metadata.Ecma335;
using System.Reflection.PortableExecutable;

namespace DotCore.Decompile;

public sealed record MethodInspection(string Token, string Type, string Name, int Rva, int IlSize, string State);
public sealed record AssemblyInspection(string InputPath, string MetadataVersion, string Machine,
    IReadOnlyList<MethodInspection> Methods);

public static class ManagedAssemblyInspector
{
    public const string ReportFileName = "method_inventory.json";
    private const string GuardMarker = "DNGuard Runtime library not loaded";
    private static readonly IReadOnlyDictionary<ushort, OpCode> Codes = typeof(OpCodes).GetFields(BindingFlags.Public | BindingFlags.Static)
        .Where(field => field.FieldType == typeof(OpCode))
        .Select(field => (OpCode)field.GetValue(null)!)
        .ToDictionary(code => unchecked((ushort)code.Value));

    public static AssemblyInspection Inspect(string path)
    {
        var methods = new List<MethodInspection>();
        using var stream = File.OpenRead(path);
        using var pe = new PEReader(stream);
        var metadata = pe.GetMetadataReader();
        foreach (var handle in metadata.MethodDefinitions)
        {
            var method = metadata.GetMethodDefinition(handle);
            var type = metadata.GetTypeDefinition(method.GetDeclaringType());
            var typeName = metadata.GetString(type.Namespace) + "." + metadata.GetString(type.Name);
            var state = "NoBody";
            int size = 0;
            if ((method.ImplAttributes & MethodImplAttributes.CodeTypeMask) == MethodImplAttributes.Native)
                state = "NativeBody";
            else if (method.RelativeVirtualAddress != 0)
            {
                try
                {
                    var il = pe.GetMethodBody(method.RelativeVirtualAddress).GetILBytes() ?? Array.Empty<byte>();
                    size = il.Length;
                    state = InspectIl(il, metadata);
                }
                catch (BadImageFormatException) { state = "InvalidBody"; }
            }
            methods.Add(new MethodInspection($"0x{MetadataTokens.GetToken(handle):X8}", typeName.TrimStart('.'),
                metadata.GetString(method.Name), method.RelativeVirtualAddress, size, state));
        }
        return new AssemblyInspection(Path.GetFullPath(path), metadata.MetadataVersion,
            pe.PEHeaders.CoffHeader.Machine.ToString(), methods);
    }

    private static string InspectIl(byte[] il, MetadataReader metadata)
    {
        int offset = 0;
        int operandSize;
        ushort key;
        bool guard = false;
        while (offset < il.Length)
        {
            key = il[offset++];
            if (key == 0xFE)
            {
                if (offset == il.Length) return "InvalidIL";
                key = (ushort)(0xFE00 | il[offset++]);
            }
            if (!Codes.TryGetValue(key, out var code)) return "InvalidIL";
            operandSize = code.OperandType switch
            {
                OperandType.InlineNone => 0,
                OperandType.ShortInlineBrTarget or OperandType.ShortInlineI or OperandType.ShortInlineVar => 1,
                OperandType.InlineVar => 2,
                OperandType.InlineI8 or OperandType.InlineR => 8,
                OperandType.InlineSwitch => -1,
                _ => 4
            };
            if (operandSize == -1)
            {
                if (offset + 4 > il.Length) return "InvalidIL";
                int count = BitConverter.ToInt32(il, offset);
                if (count < 0 || count > (il.Length - offset - 4) / 4) return "InvalidIL";
                operandSize = 4 + count * 4;
            }
            if (operandSize > il.Length - offset) return "InvalidIL";
            if (code.OperandType == OperandType.InlineString)
            {
                int token = BitConverter.ToInt32(il, offset);
                if ((token & unchecked((int)0xFF000000)) != 0x70000000) return "InvalidStringToken";
                try
                {
                    guard |= metadata.GetUserString(MetadataTokens.UserStringHandle(token & 0xFFFFFF))
                        .Contains(GuardMarker, StringComparison.Ordinal);
                }
                catch (BadImageFormatException) { return "InvalidStringToken"; }
            }
            offset += operandSize;
        }
        return guard ? "DnGuardPlaceholder" : "StaticIL";
    }
}
