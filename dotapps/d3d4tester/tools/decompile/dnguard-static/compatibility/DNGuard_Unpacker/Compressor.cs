using System;
using System.Collections.Generic;
using System.IO;

namespace DNGuard_Unpacker;

public static class Compressor
{
	private struct CompressorStruct
	{
		public uint Count;

		public readonly byte b;

		public int C2;

		public int C3;

		public CompressorStruct Create()
		{
			CompressorStruct result = default(CompressorStruct);
			result.C2 = (result.C3 = -1);
			return result;
		}

		public CompressorStruct(uint Count, byte b)
		{
			this.Count = Count;
			this.b = b;
			C2 = (C3 = -1);
		}
	}

	public static byte[] Decompress(byte[] buffer)
	{
		List<byte> list = new List<byte>();
		using (BinaryReader binaryReader = new BinaryReader(new MemoryStream(buffer)))
		{
			uint num = binaryReader.ReadUInt32();
			byte b = binaryReader.ReadByte();
			List<CompressorStruct> list2 = new List<CompressorStruct>();
			for (int i = 0; i <= b; i++)
			{
				list2.Add(new CompressorStruct(binaryReader.ReadUInt32(), binaryReader.ReadByte()));
			}
			int num2 = (int)binaryReader.BaseStream.Position;
			byte[] array = binaryReader.ReadBytes(buffer.Length - (b + 2) * 5);
			Array.Resize(ref array, array.Length + 3);
			CompressorStruct[] array2 = BuildCompressorTable(list2);
			int num3 = (b + 2) * 5 * 8;
			for (int j = 0; j < num; j++)
			{
				int num4 = num3 >> 3;
				num4 -= num2;
				uint num5 = BitConverter.ToUInt32(array, num4);
				num5 >>= num3 & 7;
				int num6 = array2.Length - 1;
				while (array2[num6].C2 != -1)
				{
					CompressorStruct compressorStruct = array2[num6];
					num6 = (((num5 & 1) == 0) ? compressorStruct.C2 : compressorStruct.C3);
					num5 >>= 1;
					num3++;
				}
				list.Add(array2[num6].b);
			}
		}
		return list.ToArray();
	}

	private static CompressorStruct[] BuildCompressorTable(List<CompressorStruct> Table)
	{
		List<CompressorStruct> list = Table;
		if (Table.Count - 1 > 0)
		{
			int num;
			for (num = list.Count - 1; num > 0; num++)
			{
				CompressorStruct compressorStruct = default(CompressorStruct).Create();
				CompressorStruct compressorStruct2 = default(CompressorStruct).Create();
				CompressorStruct compressorStruct3 = default(CompressorStruct).Create();
				CompressorStruct compressorStruct4 = default(CompressorStruct).Create();
				compressorStruct3 = list[num];
				compressorStruct.C2 = Table.IndexOf(compressorStruct3);
				num--;
				compressorStruct4 = list[num];
				compressorStruct.C3 = Table.IndexOf(compressorStruct4);
				num--;
				compressorStruct.Count = compressorStruct3.Count + compressorStruct4.Count;
				Table.Add(compressorStruct);
				int num2 = num;
				while (num2 > -1 && list[num2].Count < compressorStruct.Count)
				{
					num2--;
				}
				int length = num - num2;
				compressorStruct2 = list[num2 + 1];
				compressorStruct3 = list[num2 + 2];
				CompressorStruct[] array = list.ToArray();
				Array.Copy(array, list.IndexOf(compressorStruct2), array, list.IndexOf(compressorStruct3), length);
				list = new List<CompressorStruct>(array);
				list[list.IndexOf(compressorStruct2)] = compressorStruct;
			}
		}
		return Table.ToArray();
	}
}
