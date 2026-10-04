// PY-REF: none (DOT-only)
using AsmResolver.DotNet;
using AsmResolver.DotNet.Code.Cil;
using AsmResolver.PE.DotNet.Metadata.Tables;

namespace DotCore.Decompile.Dynamic;

internal sealed class CapturedCilOperandResolver : PhysicalCilOperandResolver
{
    internal CapturedCilOperandResolver(ModuleDefinition contextModule, CilMethodBody methodBody)
        : base(contextModule, methodBody)
    {
    }

    public override object ResolveMember(MetadataToken token)
    {
        MetadataToken resolvedToken = NativeJitHook.ResolveToken(token);
        return base.ResolveMember(resolvedToken.ToInt32() == 0 ? token : resolvedToken)!;
    }
}
