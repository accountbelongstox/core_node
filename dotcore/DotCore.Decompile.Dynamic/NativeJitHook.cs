// PY-REF: none (DOT-only)
using System.Runtime.InteropServices;
using AsmResolver.PE.DotNet.Metadata.Tables;

namespace DotCore.Decompile.Dynamic;

internal static class NativeJitHook
{
    private const string LibraryName = "jit_hook.dll";

    [DllImport(LibraryName, EntryPoint = "compile_method", CallingConvention = CallingConvention.Cdecl)]
    internal static extern void CompileMethod(nint methodDescriptor);

    [DllImport(LibraryName, EntryPoint = "set_current_method", CallingConvention = CallingConvention.Cdecl)]
    internal static extern void SetCurrentMethod(nint methodDescriptor);

    [DllImport(LibraryName, EntryPoint = "add_hook", CallingConvention = CallingConvention.Cdecl)]
    [return: MarshalAs(UnmanagedType.I1)]
    internal static extern bool AddHook(nint compilationCallback, nint bootstrapMethodDescriptor, int domainId,
        int runtimeVersionMajor);

    [DllImport(LibraryName, EntryPoint = "get_unboxed_method", CallingConvention = CallingConvention.Cdecl)]
    internal static extern nint GetUnboxedMethod(nint methodDescriptor);

    [DllImport(LibraryName, EntryPoint = "resolve_token", CallingConvention = CallingConvention.Cdecl)]
    internal static extern MetadataToken ResolveToken(MetadataToken token);

    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    internal delegate void CompilationCallback(ref JitCaptureInfo info);
}

[StructLayout(LayoutKind.Sequential)]
internal struct JitCaptureInfo
{
    public nint LocalSignatures;
    public nint CilCode;
    public nint ExceptionHandlers;
    public nint CilCodeSize;
    public nint ExceptionHandlerCount;
    public nint LocalSignaturesSize;
}
