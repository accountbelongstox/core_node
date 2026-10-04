// PY-REF: none (DOT-only)
using AsmResolver.DotNet.Code.Cil;

namespace DotCore.Decompile.Dynamic;

internal static class DnGuardMethodBodyClassifier
{
    internal static bool IsPlaceholder(CilMethodBody body)
    {
        return body.Instructions.Count == 3
            && body.Instructions[0].OpCode.Mnemonic == "ldstr"
            && body.Instructions[1].OpCode.Mnemonic == "newobj"
            && body.Instructions[2].OpCode.Mnemonic == "throw";
    }
}
