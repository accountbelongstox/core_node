// PY-REF: none (DOT-only)
using AsmResolver.DotNet;

namespace DotCore.Decompile.Dynamic;

internal static class RuntimeMethodHandleExtensions
{
    internal static nint ResolveUnboxedMethod(this ModuleHandle moduleHandle, IMetadataMember method) =>
        moduleHandle.ResolveUnboxedMethod(method.MetadataToken.ToInt32());

    internal static nint ResolveUnboxedMethod(this ModuleHandle moduleHandle, int token)
    {
        nint methodDescriptor = moduleHandle.ResolveMethodHandle(token).Value;
        return NativeJitHook.GetUnboxedMethod(methodDescriptor);
    }
}
