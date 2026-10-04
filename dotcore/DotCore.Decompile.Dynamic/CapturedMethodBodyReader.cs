// PY-REF: none (DOT-only)
using AsmResolver.DotNet.Code.Cil;
using AsmResolver.DotNet.Serialized;
using AsmResolver.DotNet.Signatures;
using AsmResolver.DotNet.Signatures.Types;
using AsmResolver.IO;
using AsmResolver.PE.DotNet.Cil;

namespace DotCore.Decompile.Dynamic;

internal sealed class CapturedMethodBodyReader
{
    private readonly BlobReadContext _readContext;

    internal CapturedMethodBodyReader(CilMethodBody body)
    {
        if (!(body.Owner.Module is SerializedModuleDefinition module))
            throw new NotSupportedException("The method owner must belong to a serialized module.");

        _readContext = new BlobReadContext(module.ReaderContext);
        Body = body;
    }

    internal CilMethodBody Body { get; }

    internal void ReadVariables(nint address, nint size)
    {
        Body.LocalVariables.Clear();
        var source = new UnmanagedDataSource(address, (ulong)size);
        var reader = new BinaryStreamReader(source, source.BaseAddress, 0, (uint)size);
        while (reader.Offset != reader.EndOffset)
            Body.LocalVariables.Add(new CilLocalVariable(TypeSignature.FromReader(in _readContext, ref reader)));
    }

    internal void ReadInstructions(nint address, nint size)
    {
        Body.Instructions.Clear();
        var source = new UnmanagedDataSource(address, (ulong)size);
        var reader = new BinaryStreamReader(source, source.BaseAddress, 0, (uint)size);
        var resolver = new CapturedCilOperandResolver(Body.Owner.Module!, Body);
        var disassembler = new CilDisassembler(in reader, resolver);
        Body.Instructions.AddRange(disassembler.ReadInstructions());
    }

    internal void ReadExceptionHandlers(nint address, nint count)
    {
        const uint handlerSize = CilExceptionHandler.FatExceptionHandlerSize;
        Body.ExceptionHandlers.Clear();
        var source = new UnmanagedDataSource(address, handlerSize * (ulong)count);
        var reader = new BinaryStreamReader(source, source.BaseAddress, 0, handlerSize * (uint)count);
        for (int index = 0; index < count; index++)
            Body.ExceptionHandlers.Add(CilExceptionHandler.FromReader(Body, ref reader, true));
    }
}
