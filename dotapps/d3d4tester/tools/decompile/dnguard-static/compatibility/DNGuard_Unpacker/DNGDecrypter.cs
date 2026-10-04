using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using dnlib.DotNet;
using dnlib.DotNet.Emit;
using dnlib.IO;
using dnlib.PE;

namespace DNGuard_Unpacker;

public class DNGDecrypter : MethodsDecrypter.DecrypterBase
{
	private bool alternateLayout;
	public int StructSize = 0;

	private string version;

	public static uint[] ivalues;

	private uint value1;

	private uint value2;

	private uint value3;

	private uint valueN4;

	private uint valueN5;

	private Blowfish blowfishInstance;

	private byte[] algoKey;

	private uint UncompressedMethodsBufferLength;

	private uint LEHLocalsOffset;

	private uint HvmTokenTableOffset;

	private uint HvmTokenTableSize;

	private byte[] HvmTable;

	public static uint[] tokenBases = new uint[10] { 452984832u, 16777216u, 33554432u, 167772160u, 67108864u, 167772160u, 100663296u, 721420288u, 1879048192u, 285212672u };

	public DNGDecrypter(ModuleDefMD module)
		: base(module)
	{
	}

	public int GetStructSize(int size, ref byte[] array)
	{
		reader.Position = DataOffset;
		array = reader.ReadBytes(size);
		uint[] dst = new uint[array.Length / 4];
		Buffer.BlockCopy(array, 0, dst, 0, array.Length);
		Adler32 adler = new Adler32();
		adler.Update(array);
		if (MetaDataValue[2] == adler.Value)
		{
			return size;
		}
		return 0;
	}

	public void PrintInformation()
	{
		Console.WriteLine("Value1=" + GetHexBytes(value1) + " Value3=" + GetHexBytes(value3));
		Console.WriteLine("ProtectionSettings=" + DataStructure.ProtectionSettings.ToString("X8"));
		if ((DataStructure.ProtectionSettings & 0x200u) != 0)
		{
			Console.WriteLine("Avoid ilegal jit action is enabled!");
		}
		else
		{
			Console.WriteLine("Avoid ilegal jit action is disabled!");
		}
		Console.WriteLine("ProtectionFeatures=" + DataStructure.ProtectionFeatures);
		bool flag = IsHVMTechnologyEnabled();
		Console.WriteLine("- Version: " + (flag ? "Enterprise" : "Professional"));
	}

	public static string GetHexBytes(uint value1)
	{
		byte[] bytes = BitConverter.GetBytes(value1);
		return BitConverter.ToString(bytes).Replace("-", string.Empty);
	}

	public static uint GetMaximProtectSettings()
	{
		return 4067u;
	}

	public static int CountBits(uint value)
	{
		int num = 0;
		while (value != 0)
		{
			num++;
			value &= value - 1;
		}
		return num;
	}

	public override void ParseStructure()
	{
		if (DataSection == null)
		{
			return;
		}
		bool flag = false;
		for (int i = 4; i < 400; i += 4)
		{
			reader.Position = DataOffset;
			byte[] array = reader.ReadBytes(i);
			uint[] dst = new uint[array.Length / 4];
			Buffer.BlockCopy(array, 0, dst, 0, array.Length);
			Adler32 adler = new Adler32();
			adler.Update(array);
			if (MetaDataValue[2] == adler.Value && Program.ShouldPrint)
			{
				Console.WriteLine("Generic finded struct size=" + i);
			}
		}
		byte[] array2 = null;
		StructSize = GetStructSize(104, ref array2);
		if (StructSize == 0)
		{
			StructSize = GetStructSize(108, ref array2);
		}
		if (StructSize == 0)
		{
			StructSize = GetStructSize(112, ref array2);
		}
		if (StructSize == 0)
		{
			StructSize = GetStructSize(124, ref array2);
		}
		if (StructSize == 0)
		{
			StructSize = GetStructSize(128, ref array2);
		}
		if (StructSize == 0)
		{
			StructSize = GetStructSize(152, ref array2);
		}
		if (StructSize == 0)
		{
			StructSize = GetStructSize(160, ref array2);
		}
		if (Program.ShouldPrint)
		{
			if (StructSize == 0)
			{
				Console.WriteLine("Failed to find struct size, unknown version!");
			}
			else if (StructSize == 104)
			{
				Console.WriteLine("Struct size=" + StructSize + " =v3.97/3.98/3.99 v4.0");
			}
			else if (StructSize == 108)
			{
				Console.WriteLine("Struct size=" + StructSize + " =v4.30");
			}
			else if (StructSize == 112)
			{
				Console.WriteLine("Struct size=" + StructSize + " =v4.12-4.20");
			}
			else if (StructSize == 124)
			{
				Console.WriteLine("Struct size=" + StructSize + " =v4.60-4.80");
			}
			else if (StructSize == 128)
			{
				Console.WriteLine("Struct size=" + StructSize + " =v3.70/3.72/3.73/3.82");
			}
			else if (StructSize == 152)
			{
				Console.WriteLine("Struct size=" + StructSize + " =v3.90");
			}
			else if (StructSize == 160)
			{
				Console.WriteLine("Struct size=" + StructSize + " Enterprise registered !=v3.97/98/99 !=4.80");
			}
		}
		version = "";
		if (MethodsDecrypter.NativeModulePath32 != null && MethodsDecrypter.NativeModulePath32 != "" && File.Exists(MethodsDecrypter.NativeModulePath32))
		{
			FileVersionInfo versionInfo = FileVersionInfo.GetVersionInfo(MethodsDecrypter.NativeModulePath32);
			version = $"{versionInfo.FileMajorPart}.{versionInfo.FileMinorPart}.{versionInfo.FileBuildPart}.{versionInfo.FilePrivatePart}";
		}
		using (BinaryReader binaryReader = new BinaryReader(new MemoryStream(array2)))
		{
			if (StructSize == 104)
			{
				if (version.StartsWith("3.9.7"))
				{
					valueN4 = binaryReader.ReadUInt32();
					value3 = binaryReader.ReadUInt32();
					DataStructure.Encryption_Dword = binaryReader.ReadUInt32();
					value1 = binaryReader.ReadUInt32();
					DataStructure.ResourceStructureOffset = binaryReader.ReadUInt32();
					ushort num = binaryReader.ReadUInt16();
					DataStructure.ResourceCount = binaryReader.ReadUInt16();
					DataStructure.MethodsDataOffset = binaryReader.ReadUInt32();
					DataStructure.KeyBuffOffset = binaryReader.ReadUInt32();
					UncompressedMethodsBufferLength = binaryReader.ReadUInt32();
					DataStructure.StringsOffset = binaryReader.ReadUInt32();
					DataStructure.LEHSize = binaryReader.ReadUInt32();
					DataStructure.MethodsBufferLength = binaryReader.ReadUInt32();
					value2 = binaryReader.ReadUInt32();
					DataStructure.MethodsCount = binaryReader.ReadUInt32();
					uint num2 = binaryReader.ReadUInt32();
					uint num3 = binaryReader.ReadUInt32();
					uint num4 = binaryReader.ReadUInt32();
					LEHLocalsOffset = binaryReader.ReadUInt32();
					uint num5 = binaryReader.ReadUInt32();
					uint num6 = binaryReader.ReadUInt32();
					HvmTokenTableOffset = binaryReader.ReadUInt32();
					DataStructure.EncryptedStringsSize = binaryReader.ReadUInt32();
					uint num7 = binaryReader.ReadUInt32();
					uint num8 = binaryReader.ReadUInt32();
					HvmTokenTableSize = binaryReader.ReadUInt32();
					uint num9 = binaryReader.ReadUInt32();
				}
				else if (version.StartsWith("3.9.8"))
				{
					valueN4 = binaryReader.ReadUInt32();
					DataStructure.Encryption_Dword = binaryReader.ReadUInt32();
					value1 = binaryReader.ReadUInt32();
					value3 = binaryReader.ReadUInt32();
					DataStructure.ResourceStructureOffset = binaryReader.ReadUInt32();
					ushort num = binaryReader.ReadUInt16();
					DataStructure.ResourceCount = binaryReader.ReadUInt16();
					DataStructure.KeyBuffOffset = binaryReader.ReadUInt32();
					DataStructure.MethodsDataOffset = binaryReader.ReadUInt32();
					DataStructure.LEHSize = binaryReader.ReadUInt32();
					value2 = binaryReader.ReadUInt32();
					LEHLocalsOffset = binaryReader.ReadUInt32();
					DataStructure.StringsOffset = binaryReader.ReadUInt32();
					DataStructure.MethodsCount = binaryReader.ReadUInt32();
					uint num10 = binaryReader.ReadUInt32();
					UncompressedMethodsBufferLength = binaryReader.ReadUInt32();
					uint num11 = binaryReader.ReadUInt32();
					uint num12 = binaryReader.ReadUInt32();
					uint num13 = binaryReader.ReadUInt32();
					HvmTokenTableOffset = binaryReader.ReadUInt32();
					DataStructure.MethodsBufferLength = binaryReader.ReadUInt32();
					uint num14 = binaryReader.ReadUInt32();
					uint num15 = binaryReader.ReadUInt32();
					HvmTokenTableSize = binaryReader.ReadUInt32();
					uint num16 = binaryReader.ReadUInt32();
					uint num17 = binaryReader.ReadUInt32();
					uint num18 = binaryReader.ReadUInt32();
				}
				else if (version.StartsWith("3.9.9"))
				{
					valueN4 = binaryReader.ReadUInt32();
					DataStructure.Encryption_Dword = binaryReader.ReadUInt32();
					value1 = binaryReader.ReadUInt32();
					value3 = binaryReader.ReadUInt32();
					DataStructure.ResourceStructureOffset = binaryReader.ReadUInt32();
					ushort num = binaryReader.ReadUInt16();
					DataStructure.ResourceCount = binaryReader.ReadUInt16();
					DataStructure.KeyBuffOffset = binaryReader.ReadUInt32();
					DataStructure.MethodsDataOffset = binaryReader.ReadUInt32();
					DataStructure.LEHSize = binaryReader.ReadUInt32();
					value2 = binaryReader.ReadUInt32();
					LEHLocalsOffset = binaryReader.ReadUInt32();
					DataStructure.StringsOffset = binaryReader.ReadUInt32();
					DataStructure.MethodsCount = binaryReader.ReadUInt32();
					uint num10 = binaryReader.ReadUInt32();
					UncompressedMethodsBufferLength = binaryReader.ReadUInt32();
					uint num11 = binaryReader.ReadUInt32();
					uint num12 = binaryReader.ReadUInt32();
					uint num13 = binaryReader.ReadUInt32();
					HvmTokenTableOffset = binaryReader.ReadUInt32();
					DataStructure.MethodsBufferLength = binaryReader.ReadUInt32();
					uint num14 = binaryReader.ReadUInt32();
					uint num15 = binaryReader.ReadUInt32();
					HvmTokenTableSize = binaryReader.ReadUInt32();
					uint num16 = binaryReader.ReadUInt32();
					uint num17 = binaryReader.ReadUInt32();
					uint num18 = binaryReader.ReadUInt32();
				}
				else if (version.StartsWith("4.0"))
				{
					valueN4 = binaryReader.ReadUInt32();
					value3 = binaryReader.ReadUInt32();
					value1 = binaryReader.ReadUInt32();
					DataStructure.Encryption_Dword = binaryReader.ReadUInt32();
					DataStructure.ResourceStructureOffset = binaryReader.ReadUInt32();
					ushort num = binaryReader.ReadUInt16();
					DataStructure.ResourceCount = binaryReader.ReadUInt16();
					DataStructure.KeyBuffOffset = binaryReader.ReadUInt32();
					DataStructure.MethodsDataOffset = binaryReader.ReadUInt32();
					DataStructure.LEHSize = binaryReader.ReadUInt32();
					value2 = binaryReader.ReadUInt32();
					LEHLocalsOffset = binaryReader.ReadUInt32();
					DataStructure.StringsOffset = binaryReader.ReadUInt32();
					DataStructure.MethodsCount = binaryReader.ReadUInt32();
					uint num10 = binaryReader.ReadUInt32();
					UncompressedMethodsBufferLength = binaryReader.ReadUInt32();
					uint num11 = binaryReader.ReadUInt32();
					uint num12 = binaryReader.ReadUInt32();
					uint num13 = binaryReader.ReadUInt32();
					HvmTokenTableOffset = binaryReader.ReadUInt32();
					DataStructure.MethodsBufferLength = binaryReader.ReadUInt32();
					uint num14 = binaryReader.ReadUInt32();
					uint num15 = binaryReader.ReadUInt32();
					HvmTokenTableSize = binaryReader.ReadUInt32();
					uint num16 = binaryReader.ReadUInt32();
					uint num17 = binaryReader.ReadUInt32();
					uint num18 = binaryReader.ReadUInt32();
				}
			}
			else if (StructSize == 108)
			{
				if (version.StartsWith("4.3"))
				{
					valueN4 = binaryReader.ReadUInt32();
					value3 = binaryReader.ReadUInt32();
					value1 = binaryReader.ReadUInt32();
					DataStructure.Encryption_Dword = binaryReader.ReadUInt32();
					uint num19 = binaryReader.ReadUInt32();
					value2 = binaryReader.ReadUInt32();
					DataStructure.KeyBuffOffset = binaryReader.ReadUInt32();
					DataStructure.StringsOffset = binaryReader.ReadUInt32();
					uint num2 = binaryReader.ReadUInt32();
					DataStructure.ResourceCount = binaryReader.ReadUInt32();
					DataStructure.EncryptedStringsSize = binaryReader.ReadUInt32();
					DataStructure.LEHSize = binaryReader.ReadUInt32();
					DataStructure.MethodsCount = binaryReader.ReadUInt32();
					UncompressedMethodsBufferLength = binaryReader.ReadUInt32();
					uint num11 = binaryReader.ReadUInt32();
					uint num4 = binaryReader.ReadUInt32();
					uint num7 = binaryReader.ReadUInt32();
					uint num15 = binaryReader.ReadUInt32();
					HvmTokenTableOffset = binaryReader.ReadUInt32();
					HvmTokenTableSize = binaryReader.ReadUInt32();
					uint num16 = binaryReader.ReadUInt32();
					uint num17 = binaryReader.ReadUInt32();
					DataStructure.MethodsDataOffset = binaryReader.ReadUInt32();
					uint num20 = binaryReader.ReadUInt32();
					uint num21 = binaryReader.ReadUInt32();
					DataStructure.MethodsBufferLength = binaryReader.ReadUInt32();
					uint num22 = binaryReader.ReadUInt32();
				}
			}
			else if (StructSize == 112)
			{
				if (version.StartsWith("4.1.3"))
				{
					valueN4 = binaryReader.ReadUInt32();
					value3 = binaryReader.ReadUInt32();
					value1 = binaryReader.ReadUInt32();
					DataStructure.Encryption_Dword = binaryReader.ReadUInt32();
					uint num19 = binaryReader.ReadUInt32();
					uint num2 = binaryReader.ReadUInt32();
					value2 = binaryReader.ReadUInt32();
					DataStructure.KeyBuffOffset = binaryReader.ReadUInt32();
					DataStructure.StringsOffset = binaryReader.ReadUInt32();
					LEHLocalsOffset = binaryReader.ReadUInt32();
					DataStructure.LEHSize = binaryReader.ReadUInt32();
					DataStructure.MethodsCount = binaryReader.ReadUInt32();
					UncompressedMethodsBufferLength = binaryReader.ReadUInt32();
					DataStructure.ResourceCount = binaryReader.ReadUInt32();
					DataStructure.EncryptedStringsSize = binaryReader.ReadUInt32();
					uint num11 = binaryReader.ReadUInt32();
					uint num7 = binaryReader.ReadUInt32();
					uint num8 = binaryReader.ReadUInt32();
					uint num13 = binaryReader.ReadUInt32();
					HvmTokenTableOffset = binaryReader.ReadUInt32();
					HvmTokenTableSize = binaryReader.ReadUInt32();
					uint num16 = binaryReader.ReadUInt32();
					DataStructure.MethodsDataOffset = binaryReader.ReadUInt32();
					uint num17 = binaryReader.ReadUInt32();
					uint num20 = binaryReader.ReadUInt32();
					uint num21 = binaryReader.ReadUInt32();
					DataStructure.MethodsBufferLength = binaryReader.ReadUInt32();
					uint num22 = binaryReader.ReadUInt32();
				}
				else if (version.StartsWith("4.1"))
				{
					valueN4 = binaryReader.ReadUInt32();
					value3 = binaryReader.ReadUInt32();
					value1 = binaryReader.ReadUInt32();
					DataStructure.Encryption_Dword = binaryReader.ReadUInt32();
					uint num2 = binaryReader.ReadUInt32();
					value2 = binaryReader.ReadUInt32();
					DataStructure.ResourceCount = binaryReader.ReadUInt32();
					DataStructure.MethodsDataOffset = binaryReader.ReadUInt32();
					DataStructure.StringsOffset = binaryReader.ReadUInt32();
					LEHLocalsOffset = binaryReader.ReadUInt32();
					DataStructure.KeyBuffOffset = binaryReader.ReadUInt32();
					DataStructure.LEHSize = binaryReader.ReadUInt32();
					UncompressedMethodsBufferLength = binaryReader.ReadUInt32();
					DataStructure.EncryptedStringsSize = binaryReader.ReadUInt32();
					DataStructure.MethodsCount = binaryReader.ReadUInt32();
					uint num11 = binaryReader.ReadUInt32();
					uint num13 = binaryReader.ReadUInt32();
					HvmTokenTableOffset = binaryReader.ReadUInt32();
					uint num7 = binaryReader.ReadUInt32();
					uint num8 = binaryReader.ReadUInt32();
					uint num14 = binaryReader.ReadUInt32();
					uint num15 = binaryReader.ReadUInt32();
					HvmTokenTableSize = binaryReader.ReadUInt32();
					uint num16 = binaryReader.ReadUInt32();
					uint num17 = binaryReader.ReadUInt32();
					DataStructure.MethodsDataOffset = binaryReader.ReadUInt32();
					DataStructure.MethodsBufferLength = binaryReader.ReadUInt32();
					uint num18 = binaryReader.ReadUInt32();
					DataStructure.EncryptedStringsSize = 0u;
					DataStructure.ResourceCount = 0u;
				}
			}
			else if (StructSize == 124)
			{
				if (version.StartsWith("4.5.1"))
				{
					valueN4 = binaryReader.ReadUInt32();
					value3 = binaryReader.ReadUInt32();
					DataStructure.Encryption_Dword = binaryReader.ReadUInt32();
					value1 = binaryReader.ReadUInt32();
					value2 = value3;
					DataStructure.KeyBuffOffset = binaryReader.ReadUInt32();
					DataStructure.StringsOffset = binaryReader.ReadUInt32();
					LEHLocalsOffset = binaryReader.ReadUInt32();
					DataStructure.MethodsDataOffset = binaryReader.ReadUInt32();
					DataStructure.ResourceCount = binaryReader.ReadUInt32();
					uint num23 = binaryReader.ReadUInt32();
					uint num11 = binaryReader.ReadUInt32();
					uint num4 = binaryReader.ReadUInt32();
					uint num5 = binaryReader.ReadUInt32();
					DataStructure.LEHSize = binaryReader.ReadUInt32();
					DataStructure.MethodsCount = binaryReader.ReadUInt32();
					uint num2 = binaryReader.ReadUInt32();
					uint num24 = binaryReader.ReadUInt32();
					DataStructure.EncryptedStringsSize = binaryReader.ReadUInt32();
					HvmTokenTableOffset = binaryReader.ReadUInt32();
					UncompressedMethodsBufferLength = binaryReader.ReadUInt32();
					uint num7 = binaryReader.ReadUInt32();
					DataStructure.MethodsBufferLength = binaryReader.ReadUInt32();
					uint num8 = binaryReader.ReadUInt32();
					uint num13 = binaryReader.ReadUInt32();
					HvmTokenTableSize = binaryReader.ReadUInt32();
					uint num16 = binaryReader.ReadUInt32();
					uint num17 = binaryReader.ReadUInt32();
					uint num20 = binaryReader.ReadUInt32();
					uint num21 = binaryReader.ReadUInt32();
					uint num22 = binaryReader.ReadUInt32();
					uint num25 = binaryReader.ReadUInt32();
				}
				else if (version.StartsWith("4.8"))
				{
					valueN4 = binaryReader.ReadUInt32();
					value3 = binaryReader.ReadUInt32();
					DataStructure.Encryption_Dword = binaryReader.ReadUInt32();
					value1 = binaryReader.ReadUInt32();
					value2 = value3;
					DataStructure.KeyBuffOffset = binaryReader.ReadUInt32();
					uint num26 = binaryReader.ReadUInt32();
					LEHLocalsOffset = binaryReader.ReadUInt32();
					DataStructure.MethodsDataOffset = binaryReader.ReadUInt32();
					DataStructure.ResourceCount = binaryReader.ReadUInt32();
					DataStructure.StringsOffset = binaryReader.ReadUInt32();
					uint num2 = binaryReader.ReadUInt32();
					uint num4 = binaryReader.ReadUInt32();
					uint num5 = binaryReader.ReadUInt32();
					uint num6 = binaryReader.ReadUInt32();
					uint num7 = binaryReader.ReadUInt32();
					uint num27 = binaryReader.ReadUInt32();
					DataStructure.LEHSize = binaryReader.ReadUInt32();
					DataStructure.KeyBuffOffset = binaryReader.ReadUInt32();
					HvmTokenTableOffset = binaryReader.ReadUInt32();
					uint num28 = binaryReader.ReadUInt32();
					DataStructure.LEHSize = binaryReader.ReadUInt32();
					DataStructure.MethodsCount = binaryReader.ReadUInt32();
					HvmTokenTableSize = binaryReader.ReadUInt32();
					UncompressedMethodsBufferLength = binaryReader.ReadUInt32();
					uint num8 = binaryReader.ReadUInt32();
					DataStructure.MethodsBufferLength = binaryReader.ReadUInt32();
					uint num17 = binaryReader.ReadUInt32();
					uint num20 = binaryReader.ReadUInt32();
					DataStructure.EncryptedStringsSize = binaryReader.ReadUInt32();
					uint num22 = binaryReader.ReadUInt32();
					uint num25 = binaryReader.ReadUInt32();
					DataStructure.ResourceCount = 0u;
				}
			}
			else if (StructSize == 152)
			{
				if (version.StartsWith("3.9.0"))
				{
					uint num29 = binaryReader.ReadUInt32();
					value1 = binaryReader.ReadUInt32();
					value3 = binaryReader.ReadUInt32();
					value2 = binaryReader.ReadUInt32();
					DataStructure.Encryption_Dword = binaryReader.ReadUInt32();
					DataStructure.MethodsDataOffset = binaryReader.ReadUInt32();
					uint num30 = binaryReader.ReadUInt32();
					valueN4 = binaryReader.ReadUInt32();
					uint num11 = binaryReader.ReadUInt32();
					uint num12 = binaryReader.ReadUInt32();
					uint num13 = binaryReader.ReadUInt32();
					uint num31 = (DataStructure.KeyBuffOffset = binaryReader.ReadUInt32());
					uint num14 = binaryReader.ReadUInt32();
					UncompressedMethodsBufferLength = binaryReader.ReadUInt32();
					DataStructure.MethodsBufferLength = binaryReader.ReadUInt32();
					DataStructure.LEHSize = binaryReader.ReadUInt32();
					DataStructure.StringsOffset = binaryReader.ReadUInt32();
					DataStructure.ResourceCount = binaryReader.ReadUInt32();
					DataStructure.ResourceStructureOffset = binaryReader.ReadUInt32();
					uint num15 = binaryReader.ReadUInt32();
					uint num16 = (DataStructure.MethodsCount = binaryReader.ReadUInt32());
					uint num17 = binaryReader.ReadUInt32();
					uint num18 = binaryReader.ReadUInt32();
					uint num32 = binaryReader.ReadUInt32();
					DataStructure.LocalsAndEHOffset = binaryReader.ReadUInt32();
					uint num33 = binaryReader.ReadUInt32();
					uint num34 = binaryReader.ReadUInt32();
					LEHLocalsOffset = binaryReader.ReadUInt32();
					DataStructure.EncryptedStringsSize = binaryReader.ReadUInt32();
					uint num25 = binaryReader.ReadUInt32();
					uint num35 = binaryReader.ReadUInt32();
					uint num36 = binaryReader.ReadUInt32();
					HvmTokenTableOffset = binaryReader.ReadUInt32();
					uint num37 = binaryReader.ReadUInt32();
					uint num38 = binaryReader.ReadUInt32();
					uint num39 = binaryReader.ReadUInt32();
					HvmTokenTableSize = binaryReader.ReadUInt32();
					uint num40 = binaryReader.ReadUInt32();
				}
			}
			else if (StructSize == 160)
			{
				if (version.StartsWith("3.9.4"))
				{
					binaryReader.ReadUInt32();
					value3 = binaryReader.ReadUInt32();
					DataStructure.Encryption_Dword = binaryReader.ReadUInt32();
					value1 = binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					DataStructure.ResourceStructureOffset = binaryReader.ReadUInt32();
					DataStructure.LEHSize = binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					UncompressedMethodsBufferLength = binaryReader.ReadUInt32();
					DataStructure.MethodsCount = binaryReader.ReadUInt32();
					DataStructure.KeyBuffOffset = binaryReader.ReadUInt32();
					DataStructure.MethodsBufferLength = binaryReader.ReadUInt32();
					DataStructure.ResourceCount = binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					DataStructure.MethodsDataOffset = binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					LEHLocalsOffset = binaryReader.ReadUInt32();
					DataStructure.LocalsAndEHOffset = binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					HvmTokenTableOffset = binaryReader.ReadUInt32();
					value2 = binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					HvmTokenTableSize = binaryReader.ReadUInt32();
					DataStructure.EncryptedStringsSize = binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
				}
				if (version.StartsWith("3.9.5"))
				{
					binaryReader.ReadUInt32();
					value3 = binaryReader.ReadUInt32();
					DataStructure.Encryption_Dword = binaryReader.ReadUInt32();
					value1 = binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					DataStructure.ResourceStructureOffset = binaryReader.ReadUInt32();
					DataStructure.LEHSize = binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					UncompressedMethodsBufferLength = binaryReader.ReadUInt32();
					DataStructure.MethodsCount = binaryReader.ReadUInt32();
					DataStructure.KeyBuffOffset = binaryReader.ReadUInt32();
					DataStructure.MethodsBufferLength = binaryReader.ReadUInt32();
					DataStructure.ResourceCount = binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					DataStructure.MethodsDataOffset = binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					LEHLocalsOffset = binaryReader.ReadUInt32();
					DataStructure.LocalsAndEHOffset = binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					HvmTokenTableOffset = binaryReader.ReadUInt32();
					value2 = binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					HvmTokenTableSize = binaryReader.ReadUInt32();
					DataStructure.EncryptedStringsSize = binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
				}
				else if (version.StartsWith("3.9.6"))
				{
					binaryReader.ReadUInt32();
					value3 = binaryReader.ReadUInt32();
					DataStructure.Encryption_Dword = binaryReader.ReadUInt32();
					value1 = binaryReader.ReadUInt32();
					DataStructure.MethodsDataOffset = binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					DataStructure.KeyBuffOffset = binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					UncompressedMethodsBufferLength = binaryReader.ReadUInt32();
					DataStructure.StringsOffset = binaryReader.ReadUInt32();
					DataStructure.LEHSize = binaryReader.ReadUInt32();
					DataStructure.MethodsBufferLength = binaryReader.ReadUInt32();
					DataStructure.ResourceCount = binaryReader.ReadUInt32();
					DataStructure.ResourceStructureOffset = binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					DataStructure.MethodsCount = binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					DataStructure.LocalsAndEHOffset = binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					LEHLocalsOffset = binaryReader.ReadUInt32();
					DataStructure.EncryptedStringsSize = binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					HvmTokenTableOffset = binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					binaryReader.ReadUInt32();
					value2 = binaryReader.ReadUInt32();
					HvmTokenTableSize = binaryReader.ReadUInt32();
				}
			}
			if (StructSize == 128)
			{
				valueN4 = binaryReader.ReadUInt32();
				value3 = binaryReader.ReadUInt32();
				DataStructure.Encryption_Dword = binaryReader.ReadUInt32();
				value1 = binaryReader.ReadUInt32();
				DataStructure.ResourceStructureOffset = binaryReader.ReadUInt32();
				binaryReader.ReadUInt16();
				DataStructure.ResourceCount = binaryReader.ReadUInt16();
				DataStructure.MethodsDataOffset = binaryReader.ReadUInt32();
				DataStructure.KeyBuffOffset = binaryReader.ReadUInt32();
				UncompressedMethodsBufferLength = binaryReader.ReadUInt32();
				DataStructure.StringsOffset = binaryReader.ReadUInt32();
				DataStructure.LEHSize = binaryReader.ReadUInt32();
				DataStructure.MethodsBufferLength = binaryReader.ReadUInt32();
				value2 = binaryReader.ReadUInt32();
				DataStructure.MethodsCount = binaryReader.ReadUInt32();
				uint num19 = binaryReader.ReadUInt32();
				uint num2 = binaryReader.ReadUInt32();
				uint num3 = binaryReader.ReadUInt32();
				LEHLocalsOffset = binaryReader.ReadUInt32();
				uint num4 = binaryReader.ReadUInt32();
				uint num5 = binaryReader.ReadUInt32();
				HvmTokenTableOffset = binaryReader.ReadUInt32();
				DataStructure.EncryptedStringsSize = binaryReader.ReadUInt32();
				uint num6 = binaryReader.ReadUInt32();
				uint num7 = binaryReader.ReadUInt32();
				HvmTokenTableSize = binaryReader.ReadUInt32();
				uint num8 = binaryReader.ReadUInt32();
				valueN5 = 0u;
				if (StructSize >= 124)
				{
					uint num9 = binaryReader.ReadUInt32();
					uint num41 = binaryReader.ReadUInt32();
					uint num42 = binaryReader.ReadUInt32();
					uint num43 = binaryReader.ReadUInt32();
					valueN5 = binaryReader.ReadUInt32();
				}
				long position = binaryReader.BaseStream.Position;
			}
		}
		if (version.StartsWith("3.9.0"))
		{
			DataStructure.ProtectionSettings = value1 ^ value3 ^ valueN4 ^ DataStructure.Encryption_Dword;
		}
		else
		{
			DataStructure.ProtectionSettings = value1 ^ value3 ^ DataStructure.Encryption_Dword;
		}
		DataStructure.ProtectionFeatures = (ProtectSettings)((int)DataStructure.ProtectionSettings & 0xFFF);
		DataStructure.MethodsDataOffset ^= value2;
		if (version.StartsWith("3.9.5") || version.StartsWith("3.9.6"))
		{
			DataStructure.LocalsAndEHOffset ^= value3 ^ DataStructure.Encryption_Dword;
		}
		if (StructSize >= 124 && (DataStructure.ProtectionSettings & 0xFFFF0000u) != 0)
		{
			Console.WriteLine("Other version type");
			DataStructure.ProtectionSettings = valueN4 ^ valueN5 ^ value3 ^ DataStructure.Encryption_Dword;
			DataStructure.ProtectionFeatures = (ProtectSettings)((int)DataStructure.ProtectionSettings & 0xFFF);
		}
		if (Program.ShouldPrint)
		{
			if (flag)
			{
				string path = "C:\\framework_Protected_3.9.7\\structs_logs.txt";
				ivalues = new uint[StructSize / 4];
				int num44 = 0;
				File.AppendAllText(path, Program.path + Environment.NewLine);
				for (int i = 0; i < StructSize; i += 4)
				{
					ivalues[i / 4] = BitConverter.ToUInt32(array2, i);
					if (ivalues[i / 4] == 0)
					{
						num44++;
					}
					File.AppendAllText(path, i / 4 + "=" + ivalues[i / 4] + " " + ivalues[i / 4].ToString("X8") + Environment.NewLine);
				}
				DataStructure.MethodsCount = 37u;
				List<uint> list = new List<uint>();
				string text = "C:\\framework_Protected_3.9.7\\godsRva.txt";
				for (int i = 0; i < ivalues.Length; i++)
				{
					for (int j = 0; j < ivalues.Length; j++)
					{
						for (int k = 0; k < ivalues.Length; k++)
						{
							for (int l = 0; l < ivalues.Length; l++)
							{
								if (ivalues[i] != 0 && ivalues[j] != 0 && i != j)
								{
									break;
								}
							}
						}
					}
				}
				File.AppendAllText(path, num44 + Environment.NewLine);
			}
			Console.WriteLine("in trial version Encryption_Dword, HvmTokenTableOffset, HvmTokenTableSize will be zero");
			PrintInformation();
			Console.WriteLine("Encryption_Dword: " + DataStructure.Encryption_Dword);
			Console.WriteLine("Methods_Offset: " + DataStructure.MethodsDataOffset);
			Console.WriteLine("KeyBuffOffset: " + DataStructure.KeyBuffOffset);
			Console.WriteLine("UncompressedMethodsBufferLength: " + UncompressedMethodsBufferLength);
			Console.WriteLine("StringsOffset: " + DataStructure.StringsOffset);
			Console.WriteLine("LEHSize: " + DataStructure.LEHSize);
			Console.WriteLine("MethodsBufferLength: " + DataStructure.MethodsBufferLength);
			Console.WriteLine("MethodsCount: " + DataStructure.MethodsCount);
			Console.WriteLine("LEHLocalsOffset: " + LEHLocalsOffset);
			Console.WriteLine("HvmTokenTableOffset: " + HvmTokenTableOffset);
			Console.WriteLine("HvmTokenTableSize: " + HvmTokenTableSize);
			Program.ShouldPrint = false;
			Console.WriteLine("Press Enter key to try to decrypt or any other key to exit");
			if (Console.ReadKey().Key != ConsoleKey.Enter)
			{
				Environment.Exit(0);
			}
		}
		if (!IsEnterpriseEdition())
		{
			return;
		}
		if (StructSize == 124 && version.StartsWith("4.5.1"))
		{
			reader.Position = DataOffset + 40;
			uint candidate = reader.ReadUInt32() ^ DataStructure.Encryption_Dword;
			uint fileOffset = (uint)module.Metadata.PEImage.ToFileOffset((RVA)candidate);
			if (fileOffset != 0 && fileOffset + 20 <= reader.Length)
			{
				reader.Position = fileOffset;
				if (VerifyKeyBuffer(reader.ReadBytes(20), DataStructure.Encryption_Dword))
				{
					DataStructure.KeyBuffOffset = candidate ^ DataStructure.Encryption_Dword;
					alternateLayout = true;
					reader.Position = DataOffset + 48;
					DataStructure.MethodsDataOffset = reader.ReadUInt32() ^ DataStructure.ProtectionSettings;
					reader.Position = DataOffset + 80;
					HvmTokenTableOffset = reader.ReadUInt32();
					reader.Position = DataOffset + 72;
					HvmTokenTableSize = reader.ReadUInt32();
					reader.Position = DataOffset + 32;
					LEHLocalsOffset = reader.ReadUInt32();
					Console.WriteLine("Validated alternate key field; probing alternate methods field.");
				}
			}
		}
		DataStructure.KeyBuffOffset ^= DataStructure.Encryption_Dword;
		if (DataStructure.KeyBuffOffset != 0)
		{
			reader.Position = (uint)module.Metadata.PEImage.ToFileOffset((RVA)DataStructure.KeyBuffOffset);
			KeyBuff = reader.ReadBytes(20);
			DataStructure.LocalsAndEHOffset ^= DataStructure.ProtectionSettings;
			DataStructure.MethodsDataOffset ^= DataStructure.ProtectionSettings;
			if (!VerifyKeyBuffer(KeyBuff, DataStructure.Encryption_Dword))
			{
				throw new Exception("Invalid key buffer!");
			}
			Array.Resize(ref KeyBuff, 16);
		}
	}

	public void ReadMethodsTesting(uint methodOffset, uint lehOffset)
	{
		if (IsApplicationMode())
		{
			throw new NotImplementedException();
		}
		if (version.StartsWith("3.9.7") || version.StartsWith("4.0") || version.StartsWith("4.1") || version.StartsWith("4.3") || version.StartsWith("4.5.1") || version.StartsWith("4.8"))
		{
			reader.Position = (uint)module.Metadata.PEImage.ToFileOffset((RVA)methodOffset);
			DataStructure._MethodsOffsetTable = reader.ReadBytes((int)(DataStructure.MethodsCount * 4));
			DataStructure._MethodsData = reader.ReadBytes((int)DataStructure.MethodsBufferLength);
			uint num = (uint)module.Metadata.PEImage.ToRVA((FileOffset)DataStructure.MethodsDataOffset);
			if (DataStructure.LEHSize == 0)
			{
				throw new Exception("LEHSize can't be zero!");
			}
			DataStructure.LEH = reader.ReadBytes((int)DataStructure.LEHSize);
			if (DataStructure.LEH[0] == 0 && DataStructure.LEH[1] == 0)
			{
				throw new Exception("Invalid LEH!");
			}
		}
		else
		{
			reader.Position = (uint)module.Metadata.PEImage.ToFileOffset((RVA)lehOffset);
			if (DataStructure.LEHSize != 0)
			{
				DataStructure.LEH = reader.ReadBytes((int)DataStructure.LEHSize);
			}
			reader.Position = (uint)module.Metadata.PEImage.ToFileOffset((RVA)DataStructure.MethodsDataOffset);
			DataStructure._MethodsOffsetTable = reader.ReadBytes((int)(DataStructure.MethodsCount * 4));
			DataStructure._MethodsData = reader.ReadBytes((int)DataStructure.MethodsBufferLength);
		}
		if (IsEnterpriseEdition())
		{
			if (DataStructure.LEHSize != 0)
			{
				DataStructure.LEH = new LZAri().Decode(DataStructure.LEH);
				DecryptPrevXor(DataStructure.LEH, KeyBuff);
			}
			DataStructure._MethodsData = new LZAri().Decode(DataStructure._MethodsData);
			if (DataStructure._MethodsData.Length != UncompressedMethodsBufferLength)
			{
				throw new Exception("Invalid methods buffer!");
			}
			DecryptPrevXor(DataStructure._MethodsOffsetTable, KeyBuff);
			if (IsHVMTechnologyEnabled())
			{
				HvmTable = ReadHVMTable();
				if (!alternateLayout) XorSelf(DataStructure._MethodsOffsetTable, 0, 20);
			}
			InitializeEncryptionKeys();
		}
		else
		{
			if (DataStructure.LEHSize != 0)
			{
				DataStructure.LEH = Compressor.Decompress(DataStructure.LEH);
				DecryptXor(DataStructure.LEH, KeyBuff);
			}
			DecryptXor(DataStructure._MethodsData, KeyBuff);
			DecryptXor(DataStructure._MethodsOffsetTable, KeyBuff);
		}
		uint[] array = new uint[DataStructure.MethodsCount];
		if (alternateLayout)
		{
			string outputDirectory = Path.GetDirectoryName(string.IsNullOrEmpty(module.Location) ? Program.path : module.Location);
			if (!string.IsNullOrEmpty(outputDirectory))
			{
				File.WriteAllBytes(Path.Combine(outputDirectory, "method-buffer-decoded.bin"), DataStructure._MethodsData);
				File.WriteAllBytes(Path.Combine(outputDirectory, "locals-eh-decoded.bin"), DataStructure.LEH);
				File.WriteAllBytes(Path.Combine(outputDirectory, "method-offset-table-decoded.bin"), DataStructure._MethodsOffsetTable);
			}
		}
		Buffer.BlockCopy(DataStructure._MethodsOffsetTable, 0, array, 0, DataStructure._MethodsOffsetTable.Length);
		using BinaryReader binaryReader = new BinaryReader(new MemoryStream(DataStructure._MethodsData));
		for (int i = 0; i < array.Length; i++)
		{
			if ((i == 0 || i == 1) && array[i] == 0)
			{
				throw new Exception("Invalid MethodOffset");
			}
			if (array[i] == 0)
			{
				continue;
			}
			if (array[i] >> 24 == 248)
			{
				_anonymous_tokens.Add((uint)(i + 1), (uint)((array[i] & 0xFFFFFFu) ^ (i + 1)));
				continue;
			}
			reader.Position = (uint)module.Metadata.PEImage.ToFileOffset((RVA)array[i]);
			if (reader.Position == 0)
			{
				throw new Exception("Position wrong");
			}
			if (reader.ReadByte() != 254)
			{
				throw new Exception("First byte missing!");
			}
			methodInfo methodInfo = default(methodInfo);
			methodInfo.DecryptorType = reader.ReadByte();
			methodInfo.MDToken = new MDToken(i + 1);
			methodInfo.MethodDataOffset = reader.ReadUInt32();
			methodInfo.Method = module.ResolveMethod((uint)(i + 1));
			methodInfo methodInfo2 = methodInfo;
			binaryReader.BaseStream.Position = methodInfo2.MethodDataOffset;
			if (binaryReader.BaseStream.Position == 0)
			{
				throw new Exception("Position wrong");
			}
			if (methodInfo2.DecryptorType > 14)
			{
				throw new Exception("Decryptor wrong");
			}
			binaryReader.BaseStream.Position = methodInfo2.MethodDataOffset;
			methodInfo2.Header = binaryReader.ReadBytes(4);
			int num2 = BitConverter.ToInt32(methodInfo2.Header, 0) >> 8;
			if (i == 0 && num2 != 305)
			{
				throw new Exception("Invalid hint!");
			}
			if (i == 1 && num2 != 15)
			{
				throw new Exception("Invalid hint!");
			}
			if (i == 2 && num2 != 317)
			{
				throw new Exception("Invalid hint!");
			}
			if (i == 0 && methodInfo2.Header[0] != 0)
			{
				throw new Exception("Invalid header!");
			}
			if (i == 1 && methodInfo2.Header[0] != 8)
			{
				throw new Exception("Invalid header!");
			}
			if (i == 2 && methodInfo2.Header[0] != 3)
			{
				throw new Exception("Invalid header!");
			}
			using BinaryReader binaryReader2 = new BinaryReader(new MemoryStream(DataStructure.LEH));
			binaryReader2.BaseStream.Position = num2;
			int num3 = binaryReader2.ReadInt32() >> 8;
			int num4 = binaryReader2.ReadInt32() >> 8;
			if (i == 0 && (num3 != 104 || num4 != 104))
			{
				throw new Exception("Invalid method size!");
			}
			if (i == 2 && (num3 != 497 || num4 != 497))
			{
				throw new Exception("Invalid method size!");
			}
		}
	}

	public override void ReadMethods()
	{
		if (IsApplicationMode())
		{
			throw new NotImplementedException();
		}
		if (version.StartsWith("3.9.0") || version.StartsWith("3.9.7") || version.StartsWith("4.0") || version.StartsWith("4.1") || version.StartsWith("4.3") || version.StartsWith("4.5.1") || version.StartsWith("4.8"))
		{
			reader.Position = (uint)module.Metadata.PEImage.ToFileOffset((RVA)DataStructure.MethodsDataOffset);
			if (alternateLayout)
			{
				uint start = reader.Position;
				uint compressedStart = start + DataStructure.MethodsCount * 4;
				bool found = false;
				for (uint gap = 0; gap <= 4096 && compressedStart + gap + 4 <= reader.Length; gap += 4)
				{
					reader.Position = compressedStart + gap;
					if (reader.ReadUInt32() != UncompressedMethodsBufferLength) continue;
					reader.Position = start + gap;
					Console.WriteLine("Validated alternate table alignment: " + gap);
					found = true;
					break;
				}
				if (!found) throw new Exception("No validated alternate table alignment.");
			}
			DataStructure._MethodsOffsetTable = reader.ReadBytes((int)(DataStructure.MethodsCount * 4));
			if (StructSize == 124 && version.StartsWith("4.5.1"))
			{
				uint start = reader.Position;
				bool found = false;
				for (uint gap = 0; gap <= 256; gap += 4)
				{
					reader.Position = start + gap;
					if (reader.ReadUInt32() != UncompressedMethodsBufferLength) continue;
					reader.Position = start + gap;
					Console.WriteLine("Validated compressed methods header; table gap: " + gap);
					found = true;
					break;
				}
				if (!found) throw new Exception("No matching compressed methods header.");
			}
			DataStructure._MethodsData = reader.ReadBytes((int)DataStructure.MethodsBufferLength);
			uint num = (uint)module.Metadata.PEImage.ToRVA((FileOffset)reader.Position);
			if (DataStructure.LEHSize != 0)
			{
				DataStructure.LEH = reader.ReadBytes((int)DataStructure.LEHSize);
			}
		}
		else
		{
			reader.Position = (uint)module.Metadata.PEImage.ToFileOffset((RVA)DataStructure.LocalsAndEHOffset);
			if (DataStructure.LEHSize != 0)
			{
				DataStructure.LEH = reader.ReadBytes((int)DataStructure.LEHSize);
			}
			reader.Position = (uint)module.Metadata.PEImage.ToFileOffset((RVA)DataStructure.MethodsDataOffset);
			DataStructure._MethodsOffsetTable = reader.ReadBytes((int)(DataStructure.MethodsCount * 4));
			DataStructure._MethodsData = reader.ReadBytes((int)DataStructure.MethodsBufferLength);
		}
		if (IsEnterpriseEdition())
		{
			if (DataStructure.LEHSize != 0)
			{
				DataStructure.LEH = new LZAri().Decode(DataStructure.LEH);
				DecryptPrevXor(DataStructure.LEH, KeyBuff);
			}
			DataStructure._MethodsData = new LZAri().Decode(DataStructure._MethodsData);
			if (DataStructure._MethodsData.Length != UncompressedMethodsBufferLength)
			{
				throw new Exception("Invalid methods buffer!");
			}
			DecryptPrevXor(DataStructure._MethodsOffsetTable, KeyBuff);
			if (IsHVMTechnologyEnabled())
			{
				HvmTable = ReadHVMTable();
				if (!alternateLayout) XorSelf(DataStructure._MethodsOffsetTable, 0, 20);
			}
			InitializeEncryptionKeys();
		}
		else
		{
			if (DataStructure.LEHSize != 0)
			{
				DataStructure.LEH = Compressor.Decompress(DataStructure.LEH);
				DecryptXor(DataStructure.LEH, KeyBuff);
			}
			DecryptXor(DataStructure._MethodsData, KeyBuff);
			DecryptXor(DataStructure._MethodsOffsetTable, KeyBuff);
		}
		uint[] array = new uint[DataStructure.MethodsCount];
		Buffer.BlockCopy(DataStructure._MethodsOffsetTable, 0, array, 0, DataStructure._MethodsOffsetTable.Length);
		using BinaryReader binaryReader = new BinaryReader(new MemoryStream(DataStructure._MethodsData));
		List<object> failures = new List<object>();
		for (int i = 0; i < array.Length; i++)
		{
			try
			{
			if (alternateLayout && Environment.GetEnvironmentVariable("DNG_TARGET_ONLY") == "1")
			{
				MethodDef target = module.ResolveMethod((uint)(i + 1));
				if (target == null || !(target.DeclaringType.FullName == "Rcdw32.Ws.Plugins.LocalPlayer" || (target.DeclaringType.FullName == "Rcdw32.Ws.Plugins.Context" && target.Name == "FindPaths"))) continue;
				Console.WriteLine("Target method " + target.FullName + " entry=" + array[i].ToString("X8"));
			}
			if (alternateLayout && array[i] == 0xAFAFAFAFu) continue;
			if (alternateLayout && array[i] >> 28 == 2 && Environment.GetEnvironmentVariable("DNG_SKIP_PROXY") == "1") continue;
			if (array[i] == 0)
			{
				continue;
			}
			if (IsEnterpriseEdition())
			{
				if (array[i] >> 28 == 2 && (!alternateLayout || IsAlternateProxy(array[i])))
				{
					uint num = (array[i] ^ DataStructure.ProtectionSettings) & 0xFFFFFFFu;
					reader.Position = (uint)module.Metadata.PEImage.ToFileOffset((RVA)num);
					if (reader.ReadByte() != 254)
					{
						throw new Exception("First byte missing!");
					}
					methodInfo methodInfo = default(methodInfo);
					methodInfo.DecryptorType = reader.ReadByte();
					methodInfo.MethodDataOffset = reader.ReadUInt32();
					methodInfo methodInfo2 = methodInfo;
					binaryReader.BaseStream.Position = methodInfo2.MethodDataOffset;
					methodInfo2.Header = binaryReader.ReadBytes(4);
					if (binaryReader.ReadUInt32() != uint.MaxValue)
					{
						throw new Exception("Invalid proxy method pointer! RID=" + (i + 1) + " DataOffset=" + methodInfo2.MethodDataOffset.ToString("X8") + " Header=" + BitConverter.ToString(methodInfo2.Header));
					}
					uint proxyPointer = alternateLayout ? 0u : binaryReader.ReadUInt32();
					if (proxyPointer != 0)
					{
						throw new Exception("Invalid proxy secondary pointer: " + proxyPointer.ToString("X8") + " Header=" + BitConverter.ToString(methodInfo2.Header));
					}
					byte[] array2 = binaryReader.ReadBytes(BitConverter.ToInt32(methodInfo2.Header, 0) >> 8);
					byte[] encryptedProxy = (byte[])array2.Clone();
					DecryptXor(array2, KeyBuff);
					DecryptPrevXor(array2, KeyBuff);
					DecryptData2(array2, methodInfo2.DecryptorType, hvm_xor: false);
					Array.Resize(ref array2, array2.Length);
					if (alternateLayout && BitConverter.ToUInt32(array2, 0) != 656676094 && (BitConverter.ToUInt32(array2, 0) & 0xFF) != 255)
					{
						array2 = DecodeAlternateProxy(encryptedProxy, methodInfo2.DecryptorType);
					}
					if (BitConverter.ToUInt32(array2, 0) != 656676094 && (BitConverter.ToUInt32(array2, 0) & 0xFF) != 255)
					{
						throw new Exception("Invalid dummy value!");
					}
					uint num2 = BitConverter.ToUInt32(array2, 4);
					num2 = (num2 ^ ((DataStructure.Encryption_Dword ^ DataStructure.ProtectionSettings) & 0xFFFFFFu)) & 0xFFFFFFu;
					uint value = (uint)(i + 1);
					proxyMethods.Add(num2, value);
					if (array[num2 - 1] >> 28 == 4 || array[num2 - 1] >> 28 == 12)
					{
						num = (array[num2 - 1] ^ DataStructure.Encryption_Dword ^ value3) & 0xFFFFFFu;
						reader.Position = (uint)module.Metadata.PEImage.ToFileOffset((RVA)num);
					}
				}
				else if (alternateLayout && array[i] >> 28 == 2)
				{
					uint rva = (array[i] ^ DataStructure.ProtectionSettings) & 0xFFFFFFFu;
					reader.Position = (uint)module.Metadata.PEImage.ToFileOffset((RVA)rva);
				}
				else if (array[i] >> 28 == 1)
				{
					uint rva = (array[i] ^ DataStructure.Encryption_Dword) & (alternateLayout ? 0xFFFFFFu : 0xFFFFFFFu);
					reader.Position = (uint)module.Metadata.PEImage.ToFileOffset((RVA)rva);
				}
				else
				{
					if (array[i] >> 28 == 4)
					{
						continue;
					}
					if (array[i] >> 28 == 6)
					{
						fakeMethods.Add(i);
						continue;
					}
					if (array[i] >> 28 == 12)
					{
						secureMethods.Add(i);
						continue;
					}
					if (array[i] >> 24 == 248)
					{
						_anonymous_tokens.Add((uint)(i + 1), (uint)((array[i] & 0xFFFFFFu) ^ (i + 1)));
						continue;
					}
					uint rva2 = (array[i] ^ DataStructure.Encryption_Dword) & (alternateLayout ? 0xFFFFFFu : 0xFFFFFFFu);
					reader.Position = (uint)module.Metadata.PEImage.ToFileOffset((RVA)rva2);
				}
			}
			else
			{
				if (array[i] >> 24 == 248)
				{
					_anonymous_tokens.Add((uint)(i + 1), (uint)((array[i] & 0xFFFFFFu) ^ (i + 1)));
					continue;
				}
				reader.Position = (uint)module.Metadata.PEImage.ToFileOffset((RVA)array[i]);
			}
			if (reader.ReadByte() != 254)
			{
				throw new Exception("First byte missing! Method RID=" + (i + 1) + " Entry=" + array[i].ToString("X8") + " Offset=" + reader.Position.ToString("X8"));
			}
			methodInfo methodInfo3 = default(methodInfo);
			methodInfo3.DecryptorType = reader.ReadByte();
			methodInfo3.MDToken = new MDToken(i + 1);
			methodInfo3.MethodDataOffset = reader.ReadUInt32();
			methodInfo3.Method = module.ResolveMethod((uint)(i + 1));
			methodInfo value2 = methodInfo3;
			int num3 = 0;
			binaryReader.BaseStream.Position = value2.MethodDataOffset;
			value2.Header = binaryReader.ReadBytes(4);
			if (alternateLayout) Console.WriteLine("Method RID=" + (i + 1) + " algorithm=" + value2.DecryptorType + " data=" + value2.MethodDataOffset.ToString("X8") + " prefix=" + BitConverter.ToString(DataStructure._MethodsData, (int)value2.MethodDataOffset, 24));
			int num4 = BitConverter.ToInt32(value2.Header, 0) >> 8;
			value2.Method_Locals = new List<Local>();
			if (IsHVMTechnologyEnabled())
			{
				if ((value2.Header[0] & 8) == 0)
				{
					using BinaryReader binaryReader2 = new BinaryReader(new MemoryStream(DataStructure.LEH));
					binaryReader2.BaseStream.Position = num4;
					short num5 = 0;
					short num6 = 0;
					if (version.StartsWith("3.9.5") || version.StartsWith("3.9.6") || version.StartsWith("4.1"))
					{
						num3 = binaryReader2.ReadInt32() >> 8;
						binaryReader2.ReadInt16();
						num5 = binaryReader2.ReadInt16();
						num6 = binaryReader2.ReadInt16();
						binaryReader2.ReadInt16();
					}
					else if (version.StartsWith("3.9.7") || version.StartsWith("4.0"))
					{
						num5 = binaryReader2.ReadInt16();
						binaryReader2.ReadInt16();
						num3 = binaryReader2.ReadInt32() >> 8;
						binaryReader2.ReadInt16();
						num6 = binaryReader2.ReadInt16();
					}
					else if (alternateLayout)
					{
						num6 = binaryReader2.ReadInt16();
						num5 = binaryReader2.ReadInt16();
						num3 = binaryReader2.ReadInt32() >> 8;
						value2.HvmTokenTableSize = binaryReader2.ReadUInt16();
						binaryReader2.ReadUInt16();
					}
					else if (!version.StartsWith("4.3") && !version.StartsWith("4.5.1") && !version.StartsWith("4.8"))
					{
					}
					if (num5 > 0)
					{
						using BinaryReader binaryReader3 = new BinaryReader(new MemoryStream(DataStructure.LEH));
						for (int j = 0; j < num5; j++)
						{
							uint num7 = binaryReader2.ReadUInt32();
							binaryReader3.BaseStream.Position = LEHLocalsOffset + (num7 & 0xFFFFFF);
							byte[] signature = binaryReader3.ReadBytes((int)((num7 >> 24) * 4));
							value2.Method_Locals.Add(new Local(SignatureReader.ReadTypeSig(module, signature)));
						}
					}
					value2.MethodEH = ((num6 == 0) ? null : binaryReader2.ReadBytes(num6));
					value2.HvmTokenTableOffset = binaryReader.ReadUInt32();
					if (!alternateLayout) value2.HvmTokenTableSize = binaryReader.ReadUInt32();
					value2.MethodData = binaryReader.ReadBytes(num3);
					if (IsHVMTechnologyEnabled() && value2.HvmTokenTableOffset != uint.MaxValue && value2.HvmTokenTableSize != 0)
					{
						value2.MethodHvmTokens = ParseHVMTableAtOffset(HvmTable, value2.HvmTokenTableOffset, value2.HvmTokenTableSize);
					}
				}
				else
				{
					num3 = num4;
					value2.HvmTokenTableOffset = binaryReader.ReadUInt32();
					value2.HvmTokenTableSize = alternateLayout ? 0u : binaryReader.ReadUInt32();
					value2.MethodData = binaryReader.ReadBytes(num4);
					if (IsHVMTechnologyEnabled() && value2.HvmTokenTableOffset != uint.MaxValue && value2.HvmTokenTableSize != 0)
					{
						value2.MethodHvmTokens = ParseHVMTableAtOffset(HvmTable, value2.HvmTokenTableOffset, value2.HvmTokenTableSize);
					}
				}
			}
			else if ((value2.Header[0] & 8) == 0)
			{
				using BinaryReader binaryReader4 = new BinaryReader(new MemoryStream(DataStructure.LEH));
				binaryReader4.BaseStream.Position = num4;
				short num5 = 0;
				short num6 = 0;
				if (version.StartsWith("3.9.5") || version.StartsWith("3.9.6") || version.StartsWith("4.1"))
				{
					num3 = binaryReader4.ReadInt32() >> 8;
					short num8 = binaryReader4.ReadInt16();
					num5 = binaryReader4.ReadInt16();
					num6 = binaryReader4.ReadInt16();
					short num9 = binaryReader4.ReadInt16();
				}
				else if (version.StartsWith("3.9.7") || version.StartsWith("4.0"))
				{
					int num10 = binaryReader4.ReadInt32();
					num3 = binaryReader4.ReadInt32() >> 8;
					num5 = binaryReader4.ReadInt16();
					num6 = binaryReader4.ReadInt16();
				}
				else if (version.StartsWith("4.3"))
				{
					int num10 = binaryReader4.ReadInt32();
					num6 = binaryReader4.ReadInt16();
					num5 = binaryReader4.ReadInt16();
					num3 = binaryReader4.ReadInt32() >> 8;
				}
				else if (version.StartsWith("4.5.1"))
				{
					num6 = binaryReader4.ReadInt16();
					short num11 = binaryReader4.ReadInt16();
					num3 = binaryReader4.ReadInt32() >> 8;
					num5 = binaryReader4.ReadInt16();
					binaryReader4.ReadInt16();
				}
				else if (version.StartsWith("4.8"))
				{
					num3 = binaryReader4.ReadInt32() >> 8;
					short num8 = binaryReader4.ReadInt16();
					num6 = binaryReader4.ReadInt16();
					short num12 = binaryReader4.ReadInt16();
					num5 = binaryReader4.ReadInt16();
				}
				value2.MethodData = binaryReader.ReadBytes(num3);
				IList<TypeSig> locals = ((LocalSig)SignatureReader.ReadSig(module, binaryReader4.ReadBytes(num5))).GetLocals();
				for (int k = 0; k < locals.Count; k++)
				{
					value2.Method_Locals.Add(new Local(locals[k]));
				}
				value2.MethodEH = ((num6 == 0) ? null : binaryReader4.ReadBytes(num6));
			}
			else
			{
				num3 = num4;
				value2.MethodData = binaryReader.ReadBytes(num4);
			}
			binaryReader.BaseStream.Position = value2.MethodDataOffset + 4 + (IsHVMTechnologyEnabled() ? (alternateLayout ? 4 : 8) : 0);
			value2.MethodData = binaryReader.ReadBytes(Convert.ToInt32((num3 + 7) & 0xFFFFFFF8u));
			if (alternateLayout) DecryptData(value2.MethodData, value2.DecryptorType, hvm_xor: true);
			else DecryptData2(value2.MethodData, value2.DecryptorType, hvm_xor: true);
			Array.Resize(ref value2.MethodData, num3);
			if (alternateLayout) Console.WriteLine("Decoded method bytes: " + BitConverter.ToString(value2.MethodData) + " HVM tokens: " + string.Join(",", Array.ConvertAll(value2.MethodHvmTokens ?? Array.Empty<uint>(), x => x.ToString("X8"))));
			methodInfos.Add((uint)(i + 1), value2);
			}
			catch (Exception exception) when (alternateLayout && Environment.GetEnvironmentVariable("DNG_SCAN_METHODS") == "1")
			{
				failures.Add(new { Token = "0x" + (0x06000000u | (uint)(i + 1)).ToString("X8"), Entry = array[i].ToString("X8"), Error = exception.Message });
				if (failures.Count <= 10) Console.WriteLine("Method decode failure RID=" + (i + 1) + ": " + exception.Message);
			}
		}
		if (Environment.GetEnvironmentVariable("DNG_SCAN_METHODS") == "1")
		{
			File.WriteAllText(Path.Combine(Path.GetDirectoryName(Program.path), "method_decode_failures.json"), System.Text.Json.JsonSerializer.Serialize(failures));
			var hvmTokenReport = new
			{
				EncryptionDword = DataStructure.Encryption_Dword,
				ProtectionSettings = DataStructure.ProtectionSettings,
				CompatibilityMode = IsCompatibilityModeEnabled(),
				ApplicationMode = IsApplicationMode(),
				Methods = methodInfos.Select(entry => new
				{
					Token = 0x06000000u | entry.Key,
					TableOffset = entry.Value.HvmTokenTableOffset,
					TableSize = entry.Value.HvmTokenTableSize,
					RawTokens = entry.Value.MethodHvmTokens ?? Array.Empty<uint>()
				}).ToArray()
			};
			File.WriteAllText(Path.Combine(Path.GetDirectoryName(Program.path), "hvm_token_tables.json"),
				System.Text.Json.JsonSerializer.Serialize(hvmTokenReport));
			Console.WriteLine("Method scan: parsed=" + methodInfos.Count + " failures=" + failures.Count);
		}
	}

	private bool IsAlternateProxy(uint entry)
	{
		uint rva = (entry ^ DataStructure.ProtectionSettings) & 0xFFFFFFFu;
		reader.Position = (uint)module.Metadata.PEImage.ToFileOffset((RVA)rva);
		if (reader.ReadByte() != 254) throw new Exception("Invalid alternate method header.");
		reader.ReadByte();
		uint offset = reader.ReadUInt32();
		if (offset + 8 > DataStructure._MethodsData.Length) throw new Exception("Alternate method offset outside buffer.");
		return (DataStructure._MethodsData[offset] & 8) != 0 && BitConverter.ToUInt32(DataStructure._MethodsData, (int)offset + 4) == uint.MaxValue;
	}

	private byte[] DecodeAlternateProxy(byte[] encrypted, int decryptorId)
	{
		if (Environment.GetEnvironmentVariable("DNG_SCAN_METHODS") == "1") throw new Exception("Proxy cipher unresolved; deferred during full method scan.");
		for (int algorithm = 0; algorithm < 2; algorithm++)
		for (int id = 0; id < 16; id++)
		for (int mask = 0; mask < 8; mask++)
		for (int hvm = 0; hvm < 2; hvm++)
		for (int order = 0; order < 6; order++)
		{
			byte[] candidate = (byte[])encrypted.Clone();
			int[][] orders = { new[] {0,1,2}, new[] {0,2,1}, new[] {1,0,2}, new[] {1,2,0}, new[] {2,0,1}, new[] {2,1,0} };
			try
			{
			foreach (int operation in orders[order])
			{
				if (operation == 0 && (mask & 1) != 0) DecryptXor(candidate, KeyBuff);
				if (operation == 1 && (mask >> 1) == 1) DecryptPrevXor(candidate, KeyBuff);
				if (operation == 1 && (mask >> 1) == 2) DecryptNextXor(candidate, KeyBuff);
				if (operation == 1 && (mask >> 1) == 3) XorSelf(candidate, 0, candidate.Length);
				if (operation == 2 && algorithm == 0) DecryptData2(candidate, id, hvm != 0);
				if (operation == 2 && algorithm == 1) DecryptData(candidate, id, hvm != 0);
			}
			}
			catch (NotImplementedException) { continue; }
			uint magic = BitConverter.ToUInt32(candidate, 0);
			uint target = (BitConverter.ToUInt32(candidate, 4) ^ ((DataStructure.Encryption_Dword ^ DataStructure.ProtectionSettings) & 0xFFFFFFu)) & 0xFFFFFFu;
			if ((magic == 656676094 || (magic & 0xFF) == 255) && target > 0 && target <= DataStructure.MethodsCount)
			{
				Console.WriteLine("Proxy decode candidate algorithm=" + algorithm + " id=" + id + " mask=" + mask + " order=" + order + " target=" + target);
				return candidate;
			}
		}
		throw new Exception("No validated alternate proxy decoding. Ciphertext=" + BitConverter.ToString(encrypted) + " Algorithm=" + decryptorId);
	}

	private void DecryptData2(byte[] data, int decryptorId, bool hvm_xor)
	{
		switch (decryptorId)
		{
		case 0:
			if (IsHVMTechnologyEnabled() && hvm_xor)
			{
				DecryptNextXor(data, KeyBuff);
			}
			DecryptXor(data, KeyBuff);
			break;
		case 1:
		{
			if (IsHVMTechnologyEnabled() && hvm_xor)
			{
				DecryptNextXor(data, KeyBuff);
			}
			byte b = KeyBuff[KeyBuff.Length - 1];
			for (int i = 0; i < data.Length; i++)
			{
				byte b2 = (byte)(data[i] ^ KeyBuff[i % KeyBuff.Length] ^ b);
				b = data[i];
				data[i] = b2;
			}
			break;
		}
		case 8:
		{
			if (IsHVMTechnologyEnabled() && hvm_xor)
			{
				DecryptNextXor(data, KeyBuff);
			}
			int num19 = 0;
			int num20 = 0;
			if (data.Length >> 3 <= 0)
			{
				break;
			}
			uint[] array4 = new uint[data.Length / 4];
			Buffer.BlockCopy(data, 0, array4, 0, data.Length);
			while (num19 < data.Length >> 3)
			{
				uint num21 = DataStructure.Encryption_Dword * 8;
				int num22 = 7;
				uint num23 = array4[num20];
				uint num24 = array4[num20 + 1] - ((((num23 >> 5) ^ (num23 << 4)) + num23) ^ (BitConverter.ToUInt32(KeyBuff, (int)(((num21 >> 11) & 3) * 4)) + num21));
				num21 -= DataStructure.Encryption_Dword;
				while (num22 != 0)
				{
					num23 -= (((num24 >> 5) ^ (num24 * 16)) + num24) ^ (BitConverter.ToUInt32(KeyBuff, (int)((num21 & 3) * 4)) + num21);
					num24 -= (((num23 >> 5) ^ (num23 * 16)) + num23) ^ (BitConverter.ToUInt32(KeyBuff, (int)(((num21 >> 11) & 3) * 4)) + num21);
					num21 -= DataStructure.Encryption_Dword;
					num22--;
				}
				array4[num20] = (num23 - ((((num24 >> 5) ^ (num24 * 16)) + num24) ^ BitConverter.ToUInt32(KeyBuff, (int)((num21 & 3) * 4)))) ^ DataStructure.Encryption_Dword;
				array4[num20 + 1] = num24;
				num19++;
				num20 += 2;
			}
			Buffer.BlockCopy(array4, 0, data, 0, data.Length);
			break;
		}
		case 6:
		{
			if (IsHVMTechnologyEnabled() && hvm_xor)
			{
				DecryptNextXor(data, KeyBuff);
			}
			int num30 = 0;
			int num31 = 0;
			if (data.Length >> 3 <= 0)
			{
				break;
			}
			uint[] array6 = new uint[data.Length / 4];
			Buffer.BlockCopy(data, 0, array6, 0, data.Length);
			while (num30 < data.Length >> 3)
			{
				uint num32 = DataStructure.Encryption_Dword * 6;
				for (int num33 = 6; num33 != 0; num33--)
				{
					uint num34 = (num32 >> 2) & 3u;
					uint num35 = array6[num31];
					uint num36 = (((num35 << 4) ^ (num35 >> 3)) + ((num35 >> 5) ^ (num35 * 4))) ^ ((BitConverter.ToUInt32(KeyBuff, (int)((num34 ^ 1) * 4)) ^ num35) + (num35 ^ num32));
					array6[num31 + 1] = array6[num31 + 1] - num36;
					num35 = array6[num31 + 1];
					num36 = (((num35 << 4) ^ (num35 >> 3)) + ((num35 >> 5) ^ (num35 * 4))) ^ ((BitConverter.ToUInt32(KeyBuff, (int)(num34 * 4)) ^ num35) + (num35 ^ num32));
					array6[num31] -= num36;
					num32 -= DataStructure.Encryption_Dword;
				}
				num30++;
				num31 += 2;
			}
			Buffer.BlockCopy(array6, 0, data, 0, data.Length);
			break;
		}
		case 10:
		{
			if (IsHVMTechnologyEnabled() && hvm_xor)
			{
				DecryptNextXor(data, KeyBuff);
			}
			int num12 = 0;
			int num13 = 0;
			if (data.Length >> 3 <= 0)
			{
				break;
			}
			uint[] array3 = new uint[data.Length / 4];
			Buffer.BlockCopy(data, 0, array3, 0, data.Length);
			while (num12 < data.Length >> 3)
			{
				array3[num13] ^= DataStructure.Encryption_Dword;
				uint num14 = DataStructure.Encryption_Dword * 8;
				for (int num15 = 8; num15 != 0; num15--)
				{
					uint num16 = (num14 >> 2) & 3u;
					uint num17 = array3[num13];
					uint num18 = (((num17 << 4) ^ (num17 >> 3)) + ((num17 >> 5) ^ (num17 * 4))) ^ ((BitConverter.ToUInt32(KeyBuff, (int)((ulong)(((num16 ^ 1) + num12) * 4) % (ulong)KeyBuff.Length)) ^ num17) + (num17 ^ num14));
					array3[num13 + 1] = array3[num13 + 1] - num18;
					num17 = array3[num13 + 1];
					num18 = (((num17 << 4) ^ (num17 >> 3)) + ((num17 >> 5) ^ (num17 * 4))) ^ ((BitConverter.ToUInt32(KeyBuff, (int)((num16 + num12) * 4) % KeyBuff.Length) ^ num17) + (num17 ^ num14));
					array3[num13] -= num18;
					num14 -= DataStructure.Encryption_Dword;
				}
				num12++;
				num13 += 2;
			}
			Buffer.BlockCopy(array3, 0, data, 0, data.Length);
			break;
		}
		case 14:
		{
			if (IsHVMTechnologyEnabled() && hvm_xor)
			{
				DecryptNextXor(data, KeyBuff);
			}
			int num6 = 0;
			int num7 = 0;
			if (data.Length >> 3 <= 0)
			{
				break;
			}
			uint[] array2 = new uint[data.Length / 4];
			Buffer.BlockCopy(data, 0, array2, 0, data.Length);
			while (num6 < data.Length >> 3)
			{
				uint num8 = DataStructure.Encryption_Dword * 9;
				int num9 = 8;
				uint num10 = array2[num7];
				uint num11 = (array2[num7 + 1] ^ DataStructure.Encryption_Dword) - ((((num10 >> 5) ^ (num10 << 4)) + num10) ^ (BitConverter.ToUInt32(KeyBuff, (int)(((num8 >> 11) & 3) * 4)) + num8));
				num8 -= DataStructure.Encryption_Dword;
				while (num9 != 0)
				{
					num10 -= (((num11 >> 5) ^ (num11 * 16)) + num11) ^ (BitConverter.ToUInt32(KeyBuff, (int)((num8 & 3) * 4)) + num8);
					num11 -= (((num10 >> 5) ^ (num10 * 16)) + num10) ^ (BitConverter.ToUInt32(KeyBuff, (int)(((num8 >> 11) & 3) * 4)) + num8);
					num8 -= DataStructure.Encryption_Dword;
					num9--;
				}
				array2[num7] = num10 - ((((num11 >> 5) ^ (num11 * 16)) + num11) ^ BitConverter.ToUInt32(KeyBuff, (int)((num8 & 3) * 4)));
				array2[num7 + 1] = num11;
				num6++;
				num7 += 2;
			}
			Buffer.BlockCopy(array2, 0, data, 0, data.Length);
			break;
		}
		case 2:
		{
			if (IsHVMTechnologyEnabled() && hvm_xor)
			{
				DecryptNextXor(data, KeyBuff);
			}
			byte[] array7 = new byte[256];
			int num37 = 0;
			int num38 = 0;
			for (int l = 0; l < array7.Length; l++)
			{
				if (l % 4 == 0)
				{
					num38 = 0;
				}
				array7[l] = (byte)(BitConverter.GetBytes(DataStructure.Encryption_Dword)[num38] ^ num37);
				num37++;
				num38++;
			}
			byte[] array8 = new byte[256];
			num37 = 0;
			num38 = 0;
			for (int m = 0; m < array8.Length; m++)
			{
				if (m % 16 == 0)
				{
					num38 = 0;
				}
				array8[m] = (byte)(KeyBuff[num38] ^ (byte)(num37 >> 4));
				byte[] array9 = array7;
				int num39 = m;
				array9[num39] ^= array8[m];
				num37++;
				num38++;
			}
			int num40 = 0;
			for (int n = 0; n < array7.Length; n++)
			{
				num40 = num40 + array7[n] + array8[n];
				byte b3 = array7[n];
				array7[n] = array7[num40 & 0xFF];
				array7[num40 & 0xFF] = b3;
			}
			int num41 = 1;
			num40 = 0;
			for (int num42 = 0; num42 < data.Length; num42++)
			{
				byte b4 = array7[num41 & 0xFF];
				num40 = (num40 + b4) & 0xFF;
				byte b5 = (array7[num41 & 0xFF] = array7[num40]);
				array7[num40] = b4;
				int num43 = num42;
				data[num43] ^= array7[(b4 + b5) & 0xFF];
				num41++;
			}
			break;
		}
		case 12:
		{
			if (IsHVMTechnologyEnabled() && hvm_xor)
			{
				DecryptNextXor(data, KeyBuff);
			}
			if (data.Length >> 3 <= 0)
			{
				break;
			}
			uint num25 = DataStructure.Encryption_Dword ^ 0x9E5993C5u;
			uint num26 = 8 * num25;
			uint num27 = num26;
			uint[] array5 = new uint[data.Length / 4];
			Buffer.BlockCopy(data, 0, array5, 0, data.Length);
			for (int k = 0; k < array5.Length; k += 2)
			{
				uint num28 = array5[k] ^ DataStructure.Encryption_Dword;
				uint num29 = array5[k + 1] ^ num28;
				while (num26 != 0)
				{
					num29 -= BitConverter.ToUInt32(KeyBuff, (int)(((num26 >> 11) & 3) * 4)) + ((num28 << 5) ^ (num28 >> 7)) + (num28 ^ num26);
					num26 -= num25;
					num28 -= BitConverter.ToUInt32(KeyBuff, (int)((num26 & 3) * 4)) + ((32 * num29) ^ (num29 >> 7)) + (num29 ^ num26);
				}
				num26 = num27;
				array5[k] = num28;
				array5[k + 1] = num29;
			}
			Buffer.BlockCopy(array5, 0, data, 0, data.Length);
			break;
		}
		case 4:
		{
			if (IsHVMTechnologyEnabled() && hvm_xor)
			{
				DecryptNextXor(data, KeyBuff);
			}
			if (data.Length >> 3 <= 0)
			{
				break;
			}
			uint num = DataStructure.Encryption_Dword ^ 0x9E5993C5u;
			uint num2 = 8 * num;
			uint num3 = num2;
			uint[] array = new uint[data.Length / 4];
			Buffer.BlockCopy(data, 0, array, 0, data.Length);
			for (int j = 0; j < array.Length; j += 2)
			{
				uint num4 = array[j + 1];
				uint num5 = array[j] ^ num4;
				while (num2 != 0)
				{
					num4 -= BitConverter.ToUInt32(KeyBuff, (int)(((num2 >> 11) & 3) * 4)) + ((8 * num5) ^ (num5 >> 7)) + (num5 ^ num2);
					num2 -= num;
					num5 -= BitConverter.ToUInt32(KeyBuff, (int)((num2 & 3) * 4)) + ((8 * num4) ^ (num4 >> 7)) + (num4 ^ num2);
				}
				num2 = num3;
				array[j] = num5;
				array[j + 1] = num4;
			}
			Buffer.BlockCopy(array, 0, data, 0, data.Length);
			break;
		}
		case 11:
		{
			if (IsHVMTechnologyEnabled() && hvm_xor)
			{
				DecryptNextXor(data, KeyBuff);
			}
			int type3 = 2;
			new Blowfish(KeyBuff, DataStructure.Encryption_Dword).Process(data, data.Length, type3);
			break;
		}
		case 9:
		{
			if (IsHVMTechnologyEnabled() && hvm_xor)
			{
				DecryptNextXor(data, KeyBuff);
			}
			int type2 = 1;
			new Blowfish(KeyBuff, DataStructure.Encryption_Dword).Process(data, data.Length, type2);
			break;
		}
		default:
			throw new NotImplementedException();
		case 13:
		{
			if (IsHVMTechnologyEnabled() && hvm_xor)
			{
				DecryptNextXor(data, KeyBuff);
			}
			int type = 0;
			new Blowfish(KeyBuff, DataStructure.Encryption_Dword).Process(data, data.Length, type);
			break;
		}
		}
	}

	private void DecryptData(byte[] data, int decryptorId, bool hvm_xor)
	{
		switch (decryptorId)
		{
		case 0:
			DecryptXor(data, KeyBuff);
			break;
		case 1:
		{
			byte b6 = KeyBuff[KeyBuff.Length - 1];
			for (int num44 = 0; num44 < data.Length; num44++)
			{
				byte b7 = (byte)(data[num44] ^ KeyBuff[num44 % KeyBuff.Length] ^ b6);
				b6 = data[num44];
				data[num44] = b7;
			}
			break;
		}
		case 2:
		{
			byte[] array6 = new byte[256];
			int num28 = 0;
			int num29 = 0;
			for (int k = 0; k < array6.Length; k++)
			{
				if (k % 4 == 0)
				{
					num29 = 0;
				}
				array6[k] = (byte)(BitConverter.GetBytes(DataStructure.Encryption_Dword)[num29] ^ num28);
				num28++;
				num29++;
			}
			byte[] array7 = new byte[256];
			num28 = 0;
			num29 = 0;
			for (int l = 0; l < array7.Length; l++)
			{
				if (l % 16 == 0)
				{
					num29 = 0;
				}
				array7[l] = KeyBuff[num29];
				array6[l] ^= array7[l];
				num28++;
				num29++;
			}
			int num30 = 0;
			byte b3 = 0;
			for (int m = 0; m < array6.Length; m++)
			{
				num30 = num30 + array6[m] + array7[m];
				b3 = array6[m];
				array6[m] = array6[num30 & 0xFF];
				array6[num30 & 0xFF] = b3;
			}
			int num31 = 1;
			byte b4 = 0;
			num30 = 0;
			byte b5 = 0;
			for (int n = 0; n < data.Length; n++)
			{
				b4 = array6[num31 & 0xFF];
				num30 = (num30 + b4) & 0xFF;
				b5 = (array6[num31 & 0xFF] = array6[num30]);
				array6[num30] = b4;
				data[n] ^= array6[(b4 + b5) & 0xFF];
				num31++;
			}
			break;
		}
		case 4:
		{
			int num15 = 0;
			int num16 = 0;
			if (data.Length >> 3 <= 0)
			{
				break;
			}
			uint[] array4 = new uint[data.Length / 4];
			Buffer.BlockCopy(data, 0, array4, 0, data.Length);
			while (num15 < data.Length >> 3)
			{
				uint num17 = DataStructure.Encryption_Dword * 4;
				int num18 = 3;
				uint num19 = array4[num16];
				uint num20 = array4[num16 + 1] - ((((num19 >> 5) ^ (num19 << 4)) + num19) ^ (BitConverter.ToUInt32(KeyBuff, (int)(((num17 >> 11) & 3) * 4)) + num17));
				num17 -= DataStructure.Encryption_Dword;
				while (num18 != 0)
				{
					num19 -= (((num20 >> 5) ^ (num20 * 16)) + num20) ^ (BitConverter.ToUInt32(KeyBuff, (int)((num17 & 3) * 4)) + num17);
					num20 -= (((num19 >> 5) ^ (num19 * 16)) + num19) ^ (BitConverter.ToUInt32(KeyBuff, (int)(((num17 >> 11) & 3) * 4)) + num17);
					num17 -= DataStructure.Encryption_Dword;
					num18--;
				}
				array4[num16] = num19 - ((((num20 >> 5) ^ (num20 * 16)) + num20) ^ BitConverter.ToUInt32(KeyBuff, (int)((num17 & 3) * 4)));
				array4[num16 + 1] = num20 ^ DataStructure.Encryption_Dword;
				num15++;
				num16 += 2;
			}
			Buffer.BlockCopy(array4, 0, data, 0, data.Length);
			break;
		}
		case 5:
		{
			int num21 = 0;
			int num22 = 0;
			if (data.Length >> 3 <= 0)
			{
				break;
			}
			uint[] array5 = new uint[data.Length / 4];
			Buffer.BlockCopy(data, 0, array5, 0, data.Length);
			while (num21 < data.Length >> 3)
			{
				uint num23 = DataStructure.Encryption_Dword * 3;
				for (int num24 = 3; num24 != 0; num24--)
				{
					uint num25 = (num23 >> 2) & 3u;
					uint num26 = array5[num22];
					uint num27 = (((num26 << 4) ^ (num26 >> 3)) + ((num26 >> 5) ^ (num26 * 4))) ^ ((BitConverter.ToUInt32(KeyBuff, (int)((num25 ^ 1) * 4)) ^ num26) + (num26 ^ num23));
					array5[num22 + 1] = array5[num22 + 1] - num27;
					num26 = array5[num22 + 1];
					num27 = (((num26 << 4) ^ (num26 >> 3)) + ((num26 >> 5) ^ (num26 * 4))) ^ ((BitConverter.ToUInt32(KeyBuff, (int)(num25 * 4)) ^ num26) + (num26 ^ num23));
					array5[num22] -= num27;
					num23 -= DataStructure.Encryption_Dword;
				}
				num21++;
				num22 += 2;
			}
			Buffer.BlockCopy(array5, 0, data, 0, data.Length);
			break;
		}
		case 6:
		{
			if (data.Length >> 3 <= 0)
			{
				break;
			}
			uint num38 = DataStructure.Encryption_Dword ^ 0x9E5993C5u;
			uint num39 = 8 * num38;
			uint num40 = num39;
			uint[] array9 = new uint[data.Length / 4];
			Buffer.BlockCopy(data, 0, array9, 0, data.Length);
			for (int num41 = 0; num41 < array9.Length; num41 += 2)
			{
				uint num42 = array9[num41];
				uint num43 = array9[num41 + 1] ^ num42;
				while (num39 != 0)
				{
					num43 -= BitConverter.ToUInt32(KeyBuff, (int)(((num39 >> 11) & 3) * 4)) + ((8 * num42) ^ (num42 >> 7)) + (num42 ^ num39);
					num39 -= num38;
					num42 -= BitConverter.ToUInt32(KeyBuff, (int)((num39 & 3) * 4)) + ((8 * num43) ^ (num43 >> 7)) + (num43 ^ num39);
				}
				num39 = num40;
				array9[num41] = num42;
				array9[num41 + 1] = num43;
			}
			Buffer.BlockCopy(array9, 0, data, 0, data.Length);
			break;
		}
		case 9:
		{
			if (data.Length >> 3 <= 0)
			{
				break;
			}
			uint num3 = DataStructure.Encryption_Dword ^ 0x9E5993C5u;
			uint num4 = 8 * num3;
			uint num5 = num4;
			uint[] array2 = new uint[data.Length / 4];
			Buffer.BlockCopy(data, 0, array2, 0, data.Length);
			for (int j = 0; j < array2.Length; j += 2)
			{
				uint num6 = array2[j] ^ DataStructure.Encryption_Dword;
				uint num7 = array2[j + 1];
				while (num4 != 0)
				{
					num7 -= BitConverter.ToUInt32(KeyBuff, (int)(((num4 >> 11) & 3) * 4)) + ((num6 << 5) ^ (num6 >> 7)) + (num6 ^ num4);
					num4 -= num3;
					num6 -= BitConverter.ToUInt32(KeyBuff, (int)((num4 & 3) * 4)) + ((32 * num7) ^ (num7 >> 7)) + (num7 ^ num4);
				}
				num4 = num5;
				array2[j] = num6;
				array2[j + 1] = num7;
			}
			Buffer.BlockCopy(array2, 0, data, 0, data.Length);
			break;
		}
		case 10:
		{
			int type3 = 2;
			blowfishInstance.Process(data, data.Length, type3);
			break;
		}
		case 11:
		{
			int type2 = 0;
			blowfishInstance.Process(data, data.Length, type2);
			break;
		}
		case 12:
		{
			int type = 1;
			blowfishInstance.Process(data, data.Length, type);
			break;
		}
		case 13:
		{
			int num32 = 0;
			int num33 = 0;
			if (data.Length >> 3 <= 0)
			{
				break;
			}
			uint[] array8 = new uint[data.Length / 4];
			Buffer.BlockCopy(data, 0, array8, 0, data.Length);
			while (num32 < data.Length >> 3)
			{
				uint num34 = DataStructure.Encryption_Dword * 6;
				int num35 = 5;
				uint num36 = array8[num33] ^ array8[num33 + 1];
				uint num37 = array8[num33 + 1] - ((((num36 >> 5) ^ (num36 << 4)) + num36) ^ (BitConverter.ToUInt32(KeyBuff, (int)(((num34 >> 11) & 3) * 4)) + num34));
				num34 -= DataStructure.Encryption_Dword;
				while (num35 != 0)
				{
					num36 -= (((num37 >> 5) ^ (num37 * 16)) + num37) ^ (BitConverter.ToUInt32(KeyBuff, (int)((num34 & 3) * 4)) + num34);
					num37 -= (((num36 >> 5) ^ (num36 * 16)) + num36) ^ (BitConverter.ToUInt32(KeyBuff, (int)(((num34 >> 11) & 3) * 4)) + num34);
					num34 -= DataStructure.Encryption_Dword;
					num35--;
				}
				array8[num33] = num36 - ((((num37 >> 5) ^ (num37 * 16)) + num37) ^ BitConverter.ToUInt32(KeyBuff, (int)((num34 & 3) * 4)));
				array8[num33 + 1] = num37;
				num32++;
				num33 += 2;
			}
			Buffer.BlockCopy(array8, 0, data, 0, data.Length);
			break;
		}
		case 14:
		{
			int num8 = 0;
			int num9 = 0;
			if (data.Length >> 3 <= 0)
			{
				break;
			}
			uint[] array3 = new uint[data.Length / 4];
			Buffer.BlockCopy(data, 0, array3, 0, data.Length);
			while (num8 < data.Length >> 3)
			{
				array3[num9] ^= DataStructure.Encryption_Dword;
				uint num10 = DataStructure.Encryption_Dword * 6;
				for (int num11 = 6; num11 != 0; num11--)
				{
					uint num12 = (num10 >> 2) & 3u;
					uint num13 = array3[num9];
					uint num14 = (((num13 << 4) ^ (num13 >> 3)) + ((num13 >> 5) ^ (num13 * 4))) ^ ((BitConverter.ToUInt32(KeyBuff, (int)(((num12 ^ 1) + num8) * 4 % KeyBuff.Length)) ^ num13) + (num13 ^ num10));
					array3[num9 + 1] = array3[num9 + 1] - num14;
					num13 = array3[num9 + 1];
					num14 = (((num13 << 4) ^ (num13 >> 3)) + ((num13 >> 5) ^ (num13 * 4))) ^ ((BitConverter.ToUInt32(KeyBuff, (int)((num12 + num8) * 4) % KeyBuff.Length) ^ num13) + (num13 ^ num10));
					array3[num9] -= num14;
					num10 -= DataStructure.Encryption_Dword;
				}
				num8++;
				num9 += 2;
			}
			Buffer.BlockCopy(array3, 0, data, 0, data.Length);
			break;
		}
		case 15:
		{
			byte[] array = new byte[256];
			Buffer.BlockCopy(algoKey, 0, array, 0, algoKey.Length);
			int num = 0;
			int num2 = 0;
			for (int i = 0; i < data.Length; i++)
			{
				num++;
				byte b = array[num & 0xFF];
				num2 = (num2 + b) & 0xFF;
				byte b2 = (array[num & 0xFF] = array[num2 & 0xFF]);
				array[num2 & 0xFF] = b;
				data[i] ^= array[(byte)((b2 + b) & 0xFF)];
			}
			break;
		}
		default:
			throw new NotImplementedException();
		}
	}

	public void InitializeEncryptionKeys()
	{
		if (alternateLayout)
		{
			string outputDirectory = Path.GetDirectoryName(Program.path);
			File.WriteAllBytes(Path.Combine(outputDirectory, "method-buffer-decoded.bin"), DataStructure._MethodsData);
			File.WriteAllBytes(Path.Combine(outputDirectory, "locals-eh-decoded.bin"), DataStructure.LEH);
			File.WriteAllBytes(Path.Combine(outputDirectory, "method-offset-table-decoded.bin"), DataStructure._MethodsOffsetTable);
		}
		blowfishInstance = new Blowfish(KeyBuff, DataStructure.Encryption_Dword ^ DataStructure.ProtectionSettings);
		byte[] array = new byte[KeyBuff.Length + 4];
		Buffer.BlockCopy(KeyBuff, 0, array, 0, KeyBuff.Length);
		Buffer.BlockCopy(BitConverter.GetBytes(DataStructure.Encryption_Dword), 0, array, array.Length - 4, 4);
		algoKey = InitializeEncryptionKey(array);
	}

	public byte[] InitializeEncryptionKey(byte[] hash_key)
	{
		byte[] array = new byte[256];
		byte[] array2 = new byte[256];
		for (int i = 0; i < array.Length; i++)
		{
			array[i] = (byte)i;
			array2[i] = hash_key[i % hash_key.Length];
		}
		int num = 0;
		for (int j = 0; j < array.Length; j++)
		{
			int num2 = (array2[j] + num + array[j] + 1) & 0xFF;
			int num3 = array[num2];
			int num4 = array[j];
			array[j] = (byte)num3;
			array[num2] = (byte)num4;
			num = num2;
		}
		return array;
	}

	private byte[] ReadHVMTable()
	{
		using BinaryReader binaryReader = new BinaryReader(new MemoryStream(DataStructure.LEH));
		binaryReader.BaseStream.Position = HvmTokenTableOffset;
		return binaryReader.ReadBytes((int)HvmTokenTableSize);
	}

	private uint[] ParseHVMTableAtOffset(byte[] hvm_table, uint offset, uint size)
	{
		List<uint> list = new List<uint>();
		int num = 0;
		using (BinaryReader binaryReader = new BinaryReader(new MemoryStream(hvm_table)))
		{
			binaryReader.BaseStream.Position = offset >> 1;
			while (num != size)
			{
				uint num2 = binaryReader.ReadUInt32();
				if ((num2 >> 28) - 3 < 5)
				{
					if ((offset & 1) == 0)
					{
						list.Add(num2);
						num++;
					}
					else if ((offset & 1) == 1)
					{
						list.Add(num2);
						binaryReader.BaseStream.Position += 4L;
						num += 2;
					}
				}
				else
				{
					list.Add(num2);
					num++;
				}
			}
		}
		return list.ToArray();
	}

	public override uint DecryptHVMToken(uint hvmToken, int hvm_counter, methodInfo mi)
	{
		if ((hvmToken & 0xFF000000u) == 1879048192)
		{
			return hvmToken;
		}
		int num = (int)(hvmToken & 0xFFFFF);
		hvmToken = mi.MethodHvmTokens[hvm_counter - 1];
		byte[] bytes = BitConverter.GetBytes(hvmToken);
		byte[] array = new byte[bytes.Length];
		bytes.CopyTo(array, 0);
		bytes[0] = array[2];
		bytes[1] = array[0];
		bytes[2] = array[1];
		hvmToken = BitConverter.ToUInt32(bytes, 0);
		uint num2 = (uint)((!IsCompatibilityModeEnabled()) ? (DataStructure.ProtectionSettings ^ (DataStructure.Encryption_Dword & 0xFFFFFFFu) ^ hvmToken ^ num) : (DataStructure.ProtectionSettings ^ ((DataStructure.Encryption_Dword ^ (DataStructure.Encryption_Dword >> 8)) & 0xFFFFFFFu) ^ hvmToken ^ num));
		if (IsApplicationMode())
		{
			num2 ^= DataStructure.Encryption_Dword >> 16;
		}
		uint decodedToken = tokenBases[num2 >> 28] | ((num2 >> 6) & 0x3FFFFFu);
		if (alternateLayout) Console.WriteLine("HVM operand=" + num.ToString("X8") + " table=" + mi.MethodHvmTokens[hvm_counter - 1].ToString("X8") + " result=" + decodedToken.ToString("X8"));
		return decodedToken;
	}
}
