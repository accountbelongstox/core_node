using System;
using System.IO;

namespace DNGuard_Unpacker;

internal class LZAri
{
	internal static class LZConstants
	{
		public const int N = 4096;

		public const int F = 60;

		public const int THRESHOLD = 2;

		public const int M = 15;

		public const int Q1 = 32768;

		public const int Q2 = 65536;

		public const int Q3 = 98304;

		public const int Q4 = 131072;

		public const int MAX_CUM = 32767;
	}

	private MemoryStream in_stream;

	private MemoryStream out_stream = new MemoryStream();

	private BinaryReader reader;

	private uint low = 0u;

	private uint high = 131072u;

	private uint value = 0u;

	private int shifts = 0;

	private int[] char_to_sym = new int[314];

	private int[] sym_to_char = new int[315];

	private uint[] sym_freq = new uint[315];

	private uint[] sym_cum = new uint[315];

	private uint[] position_cum = new uint[4097];

	private uint buffer = 0u;

	private uint mask = 0u;

	private int GetBit()
	{
		if ((mask >>= 1) == 0)
		{
			try
			{
				buffer = reader.ReadByte();
			}
			catch
			{
				buffer = 268435455u;
			}
			mask = 128u;
		}
		return Convert.ToInt32((buffer & mask) != 0);
	}

	private void StartDecode()
	{
		value = 0u;
		for (int i = 0; i < 17; i++)
		{
			value = (uint)(2 * value + GetBit());
		}
	}

	private void StartModel()
	{
		sym_cum[314] = 0u;
		for (int num = 314; num >= 1; num--)
		{
			int num2 = num - 1;
			char_to_sym[num2] = num;
			sym_to_char[num] = num2;
			sym_freq[num] = 1u;
			sym_cum[num - 1] = sym_cum[num] + sym_freq[num];
		}
		sym_freq[0] = 0u;
		position_cum[4096] = 0u;
		for (int num3 = 4096; num3 >= 1; num3--)
		{
			position_cum[num3 - 1] = (uint)(position_cum[num3] + 10000 / (num3 + 200));
		}
	}

	private int BinarySearchSym(uint x)
	{
		int num = 1;
		int num2 = 314;
		while (num < num2)
		{
			int num3 = (num + num2) / 2;
			if (sym_cum[num3] > x)
			{
				num = num3 + 1;
			}
			else
			{
				num2 = num3;
			}
		}
		return num;
	}

	private void UpdateModel(int sym)
	{
		int num2;
		if (sym_cum[0] >= 32767)
		{
			int num = 0;
			for (num2 = 314; num2 > 0; num2--)
			{
				sym_cum[num2] = (uint)num;
				num += (int)(sym_freq[num2] = sym_freq[num2] + 1 >> 1);
			}
			sym_cum[0] = (uint)num;
		}
		num2 = sym;
		while (sym_freq[num2] == sym_freq[num2 - 1])
		{
			num2--;
		}
		if (num2 < sym)
		{
			int num3 = sym_to_char[num2];
			int num4 = sym_to_char[sym];
			sym_to_char[num2] = num4;
			sym_to_char[sym] = num3;
			char_to_sym[num3] = sym;
			char_to_sym[num4] = num2;
		}
		sym_freq[num2]++;
		while (--num2 >= 0)
		{
			sym_cum[num2]++;
		}
	}

	private int DecodeChar()
	{
		uint num = high - low;
		int num2 = BinarySearchSym(((value - low + 1) * sym_cum[0] - 1) / num);
		high = low + num * sym_cum[num2 - 1] / sym_cum[0];
		low += num * sym_cum[num2] / sym_cum[0];
		while (true)
		{
			bool flag = true;
			if (low >= 65536)
			{
				value -= 65536u;
				low -= 65536u;
				high -= 65536u;
			}
			else if (low >= 32768 && high <= 98304)
			{
				value -= 32768u;
				low -= 32768u;
				high -= 32768u;
			}
			else if (high > 65536)
			{
				break;
			}
			low += low;
			high += high;
			value = (uint)(2 * value + GetBit());
		}
		int result = sym_to_char[num2];
		UpdateModel(num2);
		return result;
	}

	private int BinarySearchPos(uint x)
	{
		int num = 1;
		int num2 = 4096;
		while (num < num2)
		{
			int num3 = (num + num2) / 2;
			if (position_cum[num3] > x)
			{
				num = num3 + 1;
			}
			else
			{
				num2 = num3;
			}
		}
		return num - 1;
	}

	private int DecodePosition()
	{
		uint num = high - low;
		int num2 = BinarySearchPos(((value - low + 1) * position_cum[0] - 1) / num);
		high = low + num * position_cum[num2] / position_cum[0];
		low += num * position_cum[num2 + 1] / position_cum[0];
		while (true)
		{
			bool flag = true;
			if (low >= 65536)
			{
				value -= 65536u;
				low -= 65536u;
				high -= 65536u;
			}
			else if (low >= 32768 && high <= 98304)
			{
				value -= 32768u;
				low -= 32768u;
				high -= 32768u;
			}
			else if (high > 65536)
			{
				break;
			}
			low += low;
			high += high;
			value = (uint)(2 * value + GetBit());
		}
		return num2;
	}

	public byte[] Decode(byte[] encoded)
	{
		in_stream = new MemoryStream(encoded);
		BinaryWriter binaryWriter = new BinaryWriter(out_stream);
		reader = new BinaryReader(in_stream);
		byte[] array = new byte[4155];
		int num = reader.ReadInt32();
		if (num < 1)
		{
			throw new Exception("Read Error");
		}
		if (encoded.Length == 0)
		{
			return null;
		}
		StartDecode();
		StartModel();
		for (int i = 0; i < 4036; i++)
		{
			array[i] = 32;
		}
		int num2 = 4036;
		uint num3 = 0u;
		while (num3 < num)
		{
			int num4 = DecodeChar();
			if (num4 < 256)
			{
				binaryWriter.Write((byte)num4);
				array[num2++] = (byte)num4;
				num2 &= 0xFFF;
				num3++;
				continue;
			}
			int i = (num2 - DecodePosition() - 1) & 0xFFF;
			int num5 = num4 - 255 + 2;
			for (int j = 0; j < num5; j++)
			{
				num4 = array[(i + j) & 0xFFF];
				binaryWriter.Write((byte)num4);
				array[num2++] = (byte)num4;
				num2 &= 0xFFF;
				num3++;
			}
		}
		byte[] result = out_stream.ToArray();
		out_stream.Flush();
		in_stream.Flush();
		binaryWriter.Flush();
		return result;
	}
}
