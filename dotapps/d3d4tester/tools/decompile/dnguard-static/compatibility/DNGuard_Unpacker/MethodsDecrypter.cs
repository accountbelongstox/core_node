using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using dnlib.DotNet;
using dnlib.DotNet.Emit;
using dnlib.DotNet.MD;
using dnlib.IO;
using dnlib.PE;

namespace DNGuard_Unpacker;

public class MethodsDecrypter
{
	public class DecrypterBase : IDecrypter
	{
		public int RestoredMethodCount { get; private set; }
		private readonly List<object> candidateMethods = new List<object>();
		protected struct DataStruct
		{
			public uint Encryption_Dword;

			public uint MethodsBufferLength;

			public uint MethodsDataOffset;

			public uint KeyBuffOffset;

			public uint MethodsCount;

			public uint StringsOffset;

			public uint EncryptedStringsSize;

			public uint LocalsAndEHOffset;

			public uint LEHSize;

			public uint ResourceStructureOffset;

			public uint ResourceCount;

			public uint ProtectionSettings;

			public ProtectSettings ProtectionFeatures;

			public byte[] _MethodsOffsetTable;

			public byte[] LEH;

			public byte[] _MethodsData;
		}

		public struct methodInfo
		{
			public byte DecryptorType;

			public uint MethodDataOffset;

			public MDToken MDToken;

			public byte[] Header;

			public byte[] MethodData;

			public List<Local> Method_Locals;

			public byte[] MethodEH;

			public uint HvmTokenTableOffset;

			public uint HvmTokenTableSize;

			public uint[] MethodHvmTokens;

			public MethodDef Method;
		}

		[Flags]
		protected enum ProtectSettings
		{
			Default = 0x200,
			MorePerformanceButLessSecurity = 1,
			HVMTechnology = 2,
			HVMEHTable = 0x20,
			HVMLocalVarSigTok = 0x40,
			HVMStrings = 0x80,
			HVMIllegalAction = 0x100,
			ApplicationMode = 0x400,
			CompatibilityMode = 0x800
		}

		protected ModuleDefMD module;

		protected DataReader reader;

		protected readonly Dictionary<uint, methodInfo> methodInfos;

		protected Dictionary<uint, uint> proxyMethods = new Dictionary<uint, uint>();

		protected List<int> fakeMethods = new List<int>();

		protected List<int> secureMethods = new List<int>();

		protected Dictionary<uint, uint> _anonymous_tokens = new Dictionary<uint, uint>();

		protected ImageSectionHeader DataSection;

		protected uint DataOffset;

		protected DataStruct DataStructure;

		protected uint[] MetaDataValue;

		protected byte[] KeyBuff = new byte[16]
		{
			139, 248, 59, 251, 15, 132, 191, 25, 40, 0,
			199, 69, 232, 1, 0, 0
		};

		public Dictionary<uint, uint> GetAnonymousTokens()
		{
			return _anonymous_tokens;
		}

		protected DecrypterBase(ModuleDefMD module)
		{
			this.module = module;
			reader = module.Metadata.PEImage.CreateReader();
			methodInfos = new Dictionary<uint, methodInfo>();
			LocateDataStructure();
			MetaDataValue = ReadMetaDataStructure();
			if (MetaDataValue == null)
			{
				throw new Exception();
			}
		}

		private void LocateDataStructure()
		{
			foreach (ImageSectionHeader imageSectionHeader in module.Metadata.PEImage.ImageSectionHeaders)
			{
				if (DataSection != null)
				{
					break;
				}
				DataOffset = imageSectionHeader.PointerToRawData;
				reader.Position = DataOffset;
				byte[] array = reader.ReadBytes((int)imageSectionHeader.SizeOfRawData);
				for (int i = 0; i < array.Length; i++)
				{
					if (array[i] == 43 && array[i + 1] == 7 && (array[i + 2] == 115 || array[i + 2] == 32 || array[i + 2] == 40) && (array[i + 7] == 43 || array[i + 7] == 45) && array[i + 8] == 7 && (array[i + 9] == 114 || array[i + 9] == 32))
					{
						DataSection = imageSectionHeader;
						DataOffset += (uint)(i + 25);
						break;
					}
				}
			}
		}

		private uint[] ReadMetaDataStructure()
		{
			ImageDataDirectory imageDataDirectory = module.Metadata.PEImage.ImageNTHeaders.OptionalHeader.DataDirectories[14];
			DataReader dataReader = module.Metadata.PEImage.CreateReader(imageDataDirectory.VirtualAddress, 72u);
			ImageCor20Header imageCor20Header = new ImageCor20Header(ref dataReader, verify: false);
			try
			{
				reader.Position = (uint)module.Metadata.PEImage.ToFileOffset(imageCor20Header.Metadata.VirtualAddress);
				if (Encoding.UTF8.GetString(reader.ReadBytes(4)) == "BSJB")
				{
					reader.Position -= 20;
					if (Encoding.UTF8.GetString(reader.ReadBytes(4)) == "BSJB")
					{
						byte[] array = new byte[12];
						array = reader.ReadBytes(array.Length);
						uint[] array2 = new uint[array.Length / 4];
						Buffer.BlockCopy(array, 0, array2, 0, array.Length);
						return array2;
					}
				}
			}
			catch
			{
				return null;
			}
			return null;
		}

		public bool VerifyKeyBuffer(byte[] keybuffFull, uint encryption_dword)
		{
			Adler32 adler = new Adler32();
			adler.Update(keybuffFull);
			byte[] array = MD5.Create().ComputeHash(keybuffFull);
			long num = adler.Value >> 16;
			long num2 = adler.Value & 0xFFFF;
			byte[] array2 = array;
			foreach (byte b in array2)
			{
				num2 += b;
				num += num2;
			}
			num = (num & 0xFFFF) + 15;
			return encryption_dword == (uint)((num << 16) | num2);
		}

		public bool IsHVMTechnologyEnabled()
		{
			return (DataStructure.ProtectionFeatures & ProtectSettings.HVMTechnology) == ProtectSettings.HVMTechnology;
		}

		public bool IsEnterpriseEdition()
		{
			return DataStructure.Encryption_Dword != 0;
		}

		public bool IsCompatibilityModeEnabled()
		{
			return (DataStructure.ProtectionFeatures & ProtectSettings.CompatibilityMode) == ProtectSettings.CompatibilityMode;
		}

		public bool IsApplicationMode()
		{
			return (DataStructure.ProtectionFeatures & ProtectSettings.ApplicationMode) == ProtectSettings.ApplicationMode;
		}

		protected void DecryptXor(byte[] buff, byte[] key)
		{
			for (int i = 0; i < buff.Length; i++)
			{
				buff[i] ^= key[i % key.Length];
			}
		}

		public byte[] DecryptPrevXor(byte[] buff, byte[] key)
		{
			byte b = 0;
			for (int i = 0; i < buff.Length; i++)
			{
				byte b2 = (byte)(buff[i] ^ key[i % key.Length] ^ b);
				b = buff[i];
				buff[i] = b2;
			}
			return buff;
		}

		public byte[] DecryptNextXor(byte[] buff, byte[] key)
		{
			byte b = buff[0];
			for (int i = 0; i < buff.Length - 1; i++)
			{
				byte b2 = (byte)(buff[i + 1] ^ key[i % key.Length] ^ b);
				b = buff[i + 1];
				buff[i + 1] = b2;
			}
			return buff;
		}

		public byte[] XorSelf(byte[] buff, int startoffset, int endoffset)
		{
			for (int num = endoffset - 1; num > startoffset; num--)
			{
				buff[num] ^= buff[num - 1];
			}
			buff[0] = (byte)(buff[endoffset - 1] ^ buff[0]);
			return buff;
		}

		private byte[] DecryptUS(USStream us_stream, uint length, byte[] encryption_key, uint encryption_dword_1, uint encryption_dword_2)
		{
			byte[] main_encryption_key = encryption_key;
			int num = 0;
			byte[] array = new byte[us_stream.StreamLength];
			DataReader dataReader = us_stream.CreateReader();
			dataReader.Position = 0u;
			dataReader.ReadBytes(array, 0, (int)us_stream.StreamLength);
			dataReader.Position = 0u;
			Stream stream = new MemoryStream(array);
			BinaryWriter binaryWriter = new BinaryWriter(stream);
			while ((ulong)dataReader.Position < (ulong)(length - 1))
			{
				dataReader.Position++;
				TransformEncryptionKey(ref main_encryption_key, encryption_dword_1 ^ dataReader.Position, encryption_dword_2);
				uint num2 = dataReader.ReadCompressedUInt32();
				binaryWriter.BaseStream.Position = dataReader.Position;
				byte[] array2 = new byte[num2 - 1];
				dataReader.ReadBytes(array2, 0, array2.Length);
				num += array2.Length;
				for (int i = 0; i < array2.Length; i++)
				{
					array2[i] ^= main_encryption_key[i % main_encryption_key.Length];
				}
				binaryWriter.Write(array2);
			}
			stream.Position = 0L;
			stream.Read(array, 0, (int)us_stream.StreamLength);
			return array;
		}

		private byte[] DecryptUSAtOffset(uint offset, uint length, byte[] encryption_key, uint encryption_dword_1, uint encryption_dword_2)
		{
			byte[] main_encryption_key = encryption_key;
			byte[] array = new byte[length];
			DataReader dataReader = module.Metadata.PEImage.CreateReader();
			dataReader.Position = offset;
			dataReader.ReadBytes(array, 0, array.Length);
			dataReader.Position = offset;
			DataReader dataReader2 = ByteArrayDataReaderFactory.CreateReader(array);
			Stream stream = new MemoryStream(array);
			BinaryWriter binaryWriter = new BinaryWriter(stream);
			uint position;
			uint num2;
			uint position2;
			for (uint num = 1u; (ulong)num < (ulong)length; num += num2 + position2 - position)
			{
				position = dataReader2.Position;
				num2 = dataReader2.ReadCompressedUInt32();
				position2 = dataReader2.Position;
				binaryWriter.BaseStream.Position = dataReader2.Position;
				TransformEncryptionKey(ref main_encryption_key, encryption_dword_1 ^ num, encryption_dword_2);
				if (num2 == 0)
				{
					throw new Exception("num2 is too short");
				}
				byte[] array2 = new byte[num2 - 1];
				dataReader2.ReadBytes(array2, 0, array2.Length);
				for (int i = 0; i < array2.Length; i++)
				{
					array2[i] ^= main_encryption_key[i % main_encryption_key.Length];
				}
				dataReader2.Position++;
				binaryWriter.Write(array2);
			}
			stream.Position = 0L;
			stream.Read(array, 0, array.Length);
			return array;
		}

		public void TransformEncryptionKey(ref byte[] main_encryption_key, uint encryption_dword_1, uint encryption_dword_2)
		{
			uint[] array = new uint[main_encryption_key.Length / 4];
			Buffer.BlockCopy(main_encryption_key, 0, array, 0, main_encryption_key.Length);
			for (int i = 0; i < array.Length; i++)
			{
				array[i] ^= encryption_dword_2;
			}
			for (int j = 0; j < array.Length; j++)
			{
				array[j] ^= encryption_dword_1;
				main_encryption_key = new byte[array.Length * 4];
				Buffer.BlockCopy(array, 0, main_encryption_key, 0, main_encryption_key.Length);
			}
		}

		private void DecryptStrings(ref byte[] fileData)
		{
			byte[] encryption_key;
			if (DataStructure.KeyBuffOffset != 0)
			{
				reader.Position = (uint)module.Metadata.PEImage.ToFileOffset((RVA)DataStructure.KeyBuffOffset);
				encryption_key = reader.ReadBytes(16);
			}
			else
			{
				encryption_key = KeyBuff;
			}
			if (DataStructure.StringsOffset == 0)
			{
				byte[] array = DecryptUS(module.USStream, DataStructure.EncryptedStringsSize, encryption_key, MetaDataValue[0], DataStructure.Encryption_Dword);
				Array.Copy(array, 0, fileData, (int)module.USStream.StartOffset, array.Length);
			}
			else
			{
				uint num = (uint)module.Metadata.PEImage.ToFileOffset((RVA)DataStructure.StringsOffset);
				byte[] array = DecryptUSAtOffset(num, DataStructure.EncryptedStringsSize, encryption_key, MetaDataValue[0], DataStructure.Encryption_Dword);
				Array.Copy(array, 0L, fileData, num, array.Length);
			}
		}

		private void DecryptResources(ref byte[] fileData)
		{
			reader.Position = (uint)module.Metadata.PEImage.ToFileOffset((RVA)DataStructure.ResourceStructureOffset);
			for (int i = 0; i < DataStructure.ResourceCount; i++)
			{
				uint num = reader.ReadUInt32();
				uint num2 = (reader.ReadUInt32() ^ num ^ DataStructure.Encryption_Dword) & 0x7FFFFFFFu;
				Array.Copy(BitConverter.GetBytes(num2), 0L, fileData, (long)module.Metadata.PEImage.ToFileOffset((RVA)num), 4L);
				if (IsHVMTechnologyEnabled())
				{
					uint position = reader.Position;
					reader.Position = (uint)module.Metadata.PEImage.ToFileOffset((RVA)(num + 4));
					byte[] array = reader.ReadBytes((int)num2);
					DecryptPrevXor(array, KeyBuff);
					Array.Copy(array, 0L, fileData, (long)module.Metadata.PEImage.ToFileOffset((RVA)(num + 4)), num2);
					reader.Position = position;
				}
			}
		}

		public string ReadUserStringFromOffset(uint token)
		{
			uint num = (uint)module.Metadata.PEImage.ToFileOffset((RVA)DataStructure.StringsOffset);
			reader.Position = num + token - 1;
			uint num2 = reader.ReadCompressedUInt32();
			byte[] array = new byte[num2 - 1];
			reader.ReadBytes(array, 0, array.Length);
			return Encoding.Unicode.GetString(array);
		}

		public virtual void DecryptInternal(ref byte[] fileData)
		{
			if (DataStructure.EncryptedStringsSize != 0)
			{
				DecryptStrings(ref fileData);
			}
			if (DataStructure.ResourceCount != 0)
			{
				DecryptResources(ref fileData);
			}
		}

		public virtual void ParseStructure()
		{
		}

		public virtual void ReadMethods()
		{
		}

		public virtual uint DecryptHVMToken(uint hvmToken, int hvmCounter, methodInfo mi)
		{
			return 0u;
		}

		public void RestoreMethods()
		{
			if (methodInfos.Count <= 0)
			{
				return;
			}
			Console.ForegroundColor = ConsoleColor.Yellow;
			Console.WriteLine($"- Restoring {methodInfos.Count} methods");
			foreach (TypeDef type in module.GetTypes())
			{
				foreach (MethodDef method in type.Methods)
				{
					try
					{
						if (method.HasBody && RestoreMethod(method))
						{
							RestoredMethodCount++;
							candidateMethods.Add(new { Token = method.MDToken.ToString(), Name = method.FullName, Instructions = method.Body.Instructions.Select(instruction => instruction.ToString()).ToArray() });
							method.ImplAttributes &= ~MethodImplAttributes.NoInlining;
							int num = 10;
							string text = method.Name.Replace('\n', ' ').Replace('\r', ' ');
							if (text.Length > num)
							{
								text = text.Substring(0, num);
							}
							Console.ForegroundColor = ConsoleColor.Cyan;
							Console.WriteLine("- Restored method {0} ({1:X8})\r\n  Instrs: {2}\r\n  Locals: {3}\r\n  Exceptions: {4}", text, method.MDToken, method.Body.Instructions.Count, method.Body.Variables.Count, method.Body.ExceptionHandlers.Count);
						}
					}
					catch (Exception exception)
					{
						Console.WriteLine("Restore failure " + method.MDToken + ": " + exception.Message);
					}
				}
			}
			if (methodInfos.Count != 0)
			{
				Console.ForegroundColor = ConsoleColor.Red;
				Console.WriteLine("- {0} methods weren't restored", new object[1] { methodInfos.Count });
			}
			if (Environment.GetEnvironmentVariable("DNG_SCAN_METHODS") == "1")
				File.WriteAllText(Path.Combine(Path.GetDirectoryName(Program.path), "candidate_methods.json"), System.Text.Json.JsonSerializer.Serialize(candidateMethods));
		}

		private static void ValidateCandidateBody(MethodDef method)
		{
			IList<Instruction> instructions = method.Body.Instructions;
			HashSet<Instruction> members = new HashSet<Instruction>(instructions);
			Dictionary<Instruction, int> depths = new Dictionary<Instruction, int>();
			Queue<Instruction> pending = new Queue<Instruction>();
			bool returnsValue = method.MethodSig.RetType.RemovePinnedAndModifiers().ElementType != ElementType.Void;
			if (instructions.Count == 0) throw new InvalidOperationException("Decoded body is empty.");
			foreach (Instruction instruction in instructions)
			{
				if (instruction.OpCode.Name == null || instruction.OpCode.Name.StartsWith("UNKNOWN", StringComparison.OrdinalIgnoreCase)
					|| instruction.OpCode.Name.StartsWith("prefix", StringComparison.OrdinalIgnoreCase))
					throw new InvalidOperationException("Decoded body contains an unknown/reserved opcode.");
				if (instruction.OpCode.OperandType != OperandType.InlineNone && instruction.Operand == null)
					throw new InvalidOperationException("Decoded instruction has a missing operand.");
				if (instruction.Operand is Instruction target && !members.Contains(target))
					throw new InvalidOperationException("Decoded branch target is outside the body.");
				if (instruction.Operand is IList<Instruction> targets && targets.Any(target => target == null || !members.Contains(target)))
					throw new InvalidOperationException("Decoded switch target is outside the body.");
			}
			void Enqueue(Instruction instruction, int depth)
			{
				if (instruction == null || !members.Contains(instruction)) throw new InvalidOperationException("Invalid control-flow boundary.");
				if (depths.TryGetValue(instruction, out int previous))
				{
					if (previous != depth) throw new InvalidOperationException("Inconsistent evaluation stack at control-flow merge.");
					return;
				}
				depths.Add(instruction, depth);
				pending.Enqueue(instruction);
			}
			Enqueue(instructions[0], 0);
			foreach (ExceptionHandler handler in method.Body.ExceptionHandlers)
			{
				Enqueue(handler.HandlerStart, handler.HandlerType == ExceptionHandlerType.Catch || handler.HandlerType == ExceptionHandlerType.Filter ? 1 : 0);
				if (handler.FilterStart != null) Enqueue(handler.FilterStart, 1);
			}
			while (pending.Count > 0)
			{
				Instruction instruction = pending.Dequeue();
				int depth = depths[instruction];
				instruction.CalculateStackUsage(returnsValue, out int pushes, out int pops);
				if (pops >= 0 && depth < pops) throw new InvalidOperationException("Evaluation stack underflow.");
				int nextDepth = pops < 0 ? 0 : depth - pops + pushes;
				if (instruction.OpCode.Code == Code.Ret && nextDepth != 0) throw new InvalidOperationException("Return leaves values on the evaluation stack.");
				if (instruction.OpCode.Code == Code.Leave || instruction.OpCode.Code == Code.Leave_S) nextDepth = 0;
				if (instruction.Operand is Instruction target) Enqueue(target, nextDepth);
				if (instruction.Operand is IList<Instruction> targets) foreach (Instruction switchTarget in targets) Enqueue(switchTarget, nextDepth);
				if (instruction.OpCode.FlowControl is FlowControl.Return or FlowControl.Throw or FlowControl.Branch) continue;
				int index = instructions.IndexOf(instruction) + 1;
				if (index >= instructions.Count) throw new InvalidOperationException("Decoded control flow falls beyond the end of the body.");
				Enqueue(instructions[index], nextDepth);
			}
		}

		private bool RestoreMethod(MethodDef method)
		{
			uint rid = method.Rid;
			if (!methodInfos.ContainsKey(rid))
			{
				return false;
			}
			ParameterList parameters = method.Parameters;
			methodInfo mi = methodInfos[rid];
			MethodReader methodReader = new MethodReader(module, mi, parameters, this);
			methodReader.Read(method);
			CilBody originalBody = method.Body;
			methodReader.RestoreMethod(method);
			try
			{
				ValidateCandidateBody(method);
			}
			catch
			{
				method.Body = originalBody;
				throw;
			}
			methodInfos.Remove(rid);
			return true;
		}
	}

	public static string NativeModulePath32 = string.Empty;

	private ModuleDefMD module;

	public IDecrypter decrypter;

	private string version;

	private TypeDef DNGRtType;

	private MethodDef initializeMethod;

	private bool foundRtType;

	public bool Detected => foundRtType || DNGRtType != null;

	public MethodDef InitializeMethod => initializeMethod;

	public TypeDef RTType => DNGRtType;

	public string Version => version;

	public MethodsDecrypter(ModuleDefMD module)
	{
		this.module = module;
	}

	public void DecryptInternal(ref byte[] fileData)
	{
		if (decrypter != null)
		{
			decrypter.DecryptInternal(ref fileData);
		}
	}

	public void Decrypt()
	{
		if (decrypter != null)
		{
			decrypter.ReadMethods();
			decrypter.RestoreMethods();
		}
	}

	public void Find()
	{
		string text = "NETShieldRT";
		foreach (TypeDef type in module.GetTypes())
		{
			if (type.FullName.Contains("ZYXDNGuarder"))
			{
				DNGRtType = type;
				foreach (MethodDef method in type.Methods)
				{
					if ((method.FullName.Contains("ZYXDNGuarder::CheckRuntime()") || method.FullName.Contains("ZYXDNGuarder::CheckRuntime(System.Int32)")) && method.HasImplMap)
					{
						string path = method.ImplMap.Module.Name;
						string text2 = "";
						text2 = ((module.Location != null && !(module.Location == "")) ? Path.GetDirectoryName(module.Location) : Path.GetDirectoryName(Program.path));
						if (text2 == null)
						{
							throw new InvalidOperationException("Invalid path");
						}
						NativeModulePath32 = Path.Combine(text2, path);
						foundRtType = true;
					}
				}
			}
			if (!type.FullName.Contains(text))
			{
				continue;
			}
			DNGRtType = type;
			foreach (MethodDef method2 in type.Methods)
			{
				if (method2.FullName.Contains(text + "::Startup()") || method2.FullName.Contains(text + "::Execute()"))
				{
					initializeMethod = method2;
					foundRtType = true;
				}
			}
		}
		decrypter = new DNGDecrypter(module);
		if (decrypter != null)
		{
			decrypter.ParseStructure();
		}
	}
}
