using System.Collections.Generic;
using dnlib.DotNet;
using dnlib.DotNet.Emit;
using dnlib.DotNet.MD;
using dnlib.IO;

namespace DNGuard_Unpacker;

internal class MethodReader : MethodBodyReaderBase
{
	private ModuleDefMD module;

	private GenericParamContext gpContext;

	private MethodsDecrypter.DecrypterBase decryptor;

	private MethodsDecrypter.DecrypterBase.methodInfo methodInfo;

	private int hvm_counter = 1;

	private readonly byte[] ehBytes;

	private readonly DataReader ehReader;

	private readonly byte[] localsArray;

	public MethodReader(ModuleDefMD module, MethodsDecrypter.DecrypterBase.methodInfo mi, IList<Parameter> parameters, MethodsDecrypter.DecrypterBase db)
		: base(ByteArrayDataReaderFactory.CreateReader(mi.MethodData), parameters)
	{
		this.module = module;
		ehBytes = mi.MethodEH;
		if (mi.MethodEH != null)
		{
			ehReader = ByteArrayDataReaderFactory.CreateReader(mi.MethodEH);
		}
		localsArray = null;
		foreach (Local method_Local in mi.Method_Locals)
		{
			base.Locals.Add(method_Local);
		}
		decryptor = db;
		methodInfo = mi;
	}

	protected override MethodSig ReadInlineSig(Instruction instr)
	{
		uint token = reader.ReadUInt32();
		if (MDToken.ToTable(token) != Table.StandAloneSig)
		{
			return null;
		}
		return module.ResolveStandAloneSig(MDToken.ToRID(token), gpContext)?.MethodSig;
	}

	public void Read(MethodDef method)
	{
		gpContext = GenericParamContext.Create(method);
		if (localsArray != null)
		{
			LocalSig localSig = (LocalSig)SignatureReader.ReadSig(module, localsArray);
			if (localSig != null)
			{
				SetLocals(localSig.GetLocals());
			}
		}
		ReadInstructions((int)reader.Length);
		if (ehBytes != null)
		{
			ReadExceptionHandlers(ehReader);
		}
	}

	private T Resolve<T>(int token)
	{
		return (T)module.ResolveToken(token, gpContext);
	}

	protected override ITokenOperand ReadInlineTok(Instruction instr)
	{
		uint num = (uint)reader.ReadInt32();
		if (decryptor.IsHVMTechnologyEnabled())
		{
			num = decryptor.DecryptHVMToken(num, hvm_counter, methodInfo);
			hvm_counter++;
		}
		return Resolve<ITokenOperand>((int)num);
	}

	protected override string ReadInlineString(Instruction instr)
	{
		uint num = (uint)reader.ReadInt32();
		if (decryptor.IsHVMTechnologyEnabled())
		{
			num = decryptor.DecryptHVMToken(num, hvm_counter, methodInfo);
			hvm_counter++;
		}
		return module.ReadUserString(num);
	}

	protected override ITypeDefOrRef ReadInlineType(Instruction instr)
	{
		uint num = (uint)reader.ReadInt32();
		if (decryptor.IsHVMTechnologyEnabled())
		{
			num = decryptor.DecryptHVMToken(num, hvm_counter, methodInfo);
			hvm_counter++;
		}
		return Resolve<ITypeDefOrRef>((int)num);
	}

	protected override IField ReadInlineField(Instruction instr)
	{
		uint num = (uint)reader.ReadInt32();
		if (decryptor.IsHVMTechnologyEnabled())
		{
			num = decryptor.DecryptHVMToken(num, hvm_counter, methodInfo);
			hvm_counter++;
		}
		return Resolve<IField>((int)num);
	}

	protected override IMethod ReadInlineMethod(Instruction instr)
	{
		uint num = (uint)reader.ReadInt32();
		if (decryptor.IsHVMTechnologyEnabled())
		{
			num = decryptor.DecryptHVMToken(num, hvm_counter, methodInfo);
			hvm_counter++;
		}
		return Resolve<IMethod>((int)num);
	}

	private void ReadExceptionHandlers(DataReader ehReader)
	{
		byte b = ehReader.ReadByte();
		if ((b & 0x40) > 0)
		{
			ReadFatExceptionHandlers(ref ehReader);
		}
		else if ((b & 0x3F) == 1)
		{
			ReadSmallExceptionHandlers(ref ehReader);
		}
	}

	private static ushort GetNumberOfExceptionHandlers(uint num)
	{
		return (ushort)num;
	}

	private void ReadFatExceptionHandlers(ref DataReader ehReader)
	{
		ehReader.Position--;
		int numberOfExceptionHandlers = GetNumberOfExceptionHandlers((ehReader.ReadUInt32() >> 8) / 24);
		for (int i = 0; i < numberOfExceptionHandlers; i++)
		{
			ExceptionHandler exceptionHandler = new ExceptionHandler((ExceptionHandlerType)ehReader.ReadUInt32());
			uint num = ehReader.ReadUInt32();
			exceptionHandler.TryStart = GetInstruction(num);
			exceptionHandler.TryEnd = GetInstruction(num + ehReader.ReadUInt32());
			num = ehReader.ReadUInt32();
			exceptionHandler.HandlerStart = GetInstruction(num);
			exceptionHandler.HandlerEnd = GetInstruction(num + ehReader.ReadUInt32());
			if (exceptionHandler.HandlerType == ExceptionHandlerType.Catch)
			{
				exceptionHandler.CatchType = module.ResolveToken(ehReader.ReadUInt32(), gpContext) as ITypeDefOrRef;
			}
			else if (exceptionHandler.HandlerType == ExceptionHandlerType.Filter)
			{
				exceptionHandler.FilterStart = GetInstruction(ehReader.ReadUInt32());
			}
			else
			{
				ehReader.ReadUInt32();
			}
			Add(exceptionHandler);
		}
	}

	private void ReadSmallExceptionHandlers(ref DataReader ehReader)
	{
		int numberOfExceptionHandlers = GetNumberOfExceptionHandlers((uint)(ehReader.ReadByte() / 12));
		ehReader.Position += 2u;
		for (int i = 0; i < numberOfExceptionHandlers; i++)
		{
			ExceptionHandler exceptionHandler = new ExceptionHandler((ExceptionHandlerType)ehReader.ReadUInt16());
			uint num = ehReader.ReadUInt16();
			exceptionHandler.TryStart = GetInstruction(num);
			exceptionHandler.TryEnd = GetInstruction(num + ehReader.ReadByte());
			num = ehReader.ReadUInt16();
			exceptionHandler.HandlerStart = GetInstruction(num);
			exceptionHandler.HandlerEnd = GetInstruction(num + ehReader.ReadByte());
			if (exceptionHandler.HandlerType == ExceptionHandlerType.Catch)
			{
				exceptionHandler.CatchType = module.ResolveToken(ehReader.ReadUInt32(), gpContext) as ITypeDefOrRef;
			}
			else if (exceptionHandler.HandlerType == ExceptionHandlerType.Filter)
			{
				exceptionHandler.FilterStart = GetInstruction(ehReader.ReadUInt32());
			}
			else
			{
				ehReader.ReadUInt32();
			}
			Add(exceptionHandler);
		}
	}
}
