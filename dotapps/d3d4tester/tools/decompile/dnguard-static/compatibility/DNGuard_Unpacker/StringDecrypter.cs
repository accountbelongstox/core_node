using System;
using System.Collections.Generic;
using dnlib.DotNet;
using dnlib.DotNet.Emit;

namespace DNGuard_Unpacker;

internal class StringDecrypter
{
	public static void Decrypt(ModuleDefMD module, IDecrypter decrypter)
	{
		Dictionary<uint, uint> anonymousTokens = decrypter.GetAnonymousTokens();
		foreach (TypeDef type in module.GetTypes())
		{
			foreach (MethodDef method in type.Methods)
			{
				if (!method.HasBody)
				{
					continue;
				}
				foreach (Instruction instruction in method.Body.Instructions)
				{
					if (instruction.OpCode.Code == Code.Call && instruction.Operand is MethodDef { MDToken: { Rid: var rid } } && anonymousTokens.ContainsKey(rid))
					{
						string text = decrypter.ReadUserStringFromOffset(anonymousTokens[rid]);
						Console.ForegroundColor = ConsoleColor.Blue;
						Console.WriteLine("- Decrypted string: " + text);
						instruction.OpCode = OpCodes.Ldstr;
						instruction.Operand = text;
					}
				}
			}
		}
	}
}
