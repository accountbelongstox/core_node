using System.Collections.Generic;
using dnlib.DotNet;
using dnlib.DotNet.Emit;

namespace DNGuard_Unpacker;

internal class InvalidMethodsFinder
{
	public static void Remove(ModuleDef module)
	{
		foreach (MethodDef item in FindAll(module))
		{
			item.DeclaringType.Remove(item);
		}
	}

	public static List<MethodDef> FindAll(ModuleDef module)
	{
		List<MethodDef> list = new List<MethodDef>();
		foreach (TypeDef type in module.GetTypes())
		{
			foreach (MethodDef method in type.Methods)
			{
				if (IsInvalidMethod(method))
				{
					list.Add(method);
				}
			}
		}
		return list;
	}

	public static bool IsInvalidMethod(MethodDef method)
	{
		if (method == null)
		{
			return false;
		}
		if (!method.HasBody)
		{
			return false;
		}
		foreach (Instruction instruction in method.Body.Instructions)
		{
			if (instruction.OpCode.Code == Code.Ldstr)
			{
				string text = (string)instruction.Operand;
				if (text == "魇" || text == "寠" || text == "Error, DNGuard Runtime library not loaded!")
				{
					return true;
				}
			}
		}
		return false;
	}
}
