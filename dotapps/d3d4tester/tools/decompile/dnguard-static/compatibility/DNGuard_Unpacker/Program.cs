using System;
using System.IO;
using System.Threading;
using dnlib.DotNet;
using dnlib.DotNet.Emit;
using dnlib.DotNet.Writer;

namespace DNGuard_Unpacker;

internal class Program
{
	public static string path = "";

	public static bool ShouldPrint = false;

	public static ModuleDefMD module;

	public static void Run(string[] args)
	{
		Console.Title = "DNGuard Static Unpacker";
		if (args != null && args.Length > 0)
		{
			path = args[0];
		}
		else
		{
			Console.WriteLine("Warning: no file specified to the program");
			Console.WriteLine("start it by DNGuard Static Unpacker.exe file_to_unpack");
			path = "C:\\framework_Protected_3.9.0\\FrameworkChanger.exe";
			if (!File.Exists(path))
			{
				Environment.Exit(0);
			}
		}
		Console.WriteLine(path);
		byte[] fileData = File.ReadAllBytes(path);
		module = ModuleDefMD.Load(path);
		MethodsDecrypter methodsDecrypter = new MethodsDecrypter(module);
		ShouldPrint = Array.IndexOf(args, "--noninteractive") < 0;
		methodsDecrypter.Find();
		Thread.Sleep(3000);
		if (Array.IndexOf(args, "--methods-only") < 0)
			methodsDecrypter.DecryptInternal(ref fileData);
		module = ModuleDefMD.Load(fileData);
		methodsDecrypter = new MethodsDecrypter(module);
		methodsDecrypter.Find();
		methodsDecrypter.Decrypt();
		if (Environment.GetEnvironmentVariable("DNG_SCAN_METHODS") == "1")
		{
			Save(path, module);
			throw new InvalidOperationException("Diagnostic scan finished. Candidate IL is not emitted as verified recovery.");
		}
		if (methodsDecrypter.decrypter is not MethodsDecrypter.DecrypterBase decoder || decoder.RestoredMethodCount == 0)
			throw new InvalidOperationException("No method bodies were restored. No successful output will be emitted.");
		MethodDef initializeMethod = methodsDecrypter.InitializeMethod;
		RemoveAllCalls(module, initializeMethod);
		if (Array.IndexOf(args, "--methods-only") < 0)
			StringDecrypter.Decrypt(module, methodsDecrypter.decrypter);
		if (Array.IndexOf(args, "--methods-only") < 0)
			InvalidMethodsFinder.Remove(module);
		Save(path, module);
	}

	private static void RemoveAllCalls(ModuleDef module, MethodDef initializeMethod)
	{
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
					if (instruction.Operand is MethodDef && instruction.Operand is MethodDef methodDef && methodDef == initializeMethod)
					{
						instruction.OpCode = OpCodes.Nop;
					}
				}
			}
		}
	}

	private static void Save(string location, ModuleDefMD module)
	{
		Console.ForegroundColor = ConsoleColor.Green;
		Console.WriteLine("- Saving module...");
		NativeModuleWriterOptions nativeModuleWriterOptions = new NativeModuleWriterOptions(module, optimizeImageSize: true);
		nativeModuleWriterOptions.KeepExtraPEData = true;
		nativeModuleWriterOptions.KeepWin32Resources = true;
		nativeModuleWriterOptions.Logger = DummyLogger.NoThrowInstance;
		NativeModuleWriterOptions nativeModuleWriterOptions2 = nativeModuleWriterOptions;
		nativeModuleWriterOptions2.MetadataOptions.Flags = MetadataFlags.PreserveAll | MetadataFlags.KeepOldMaxStack;
		string suffix = Environment.GetEnvironmentVariable("DNG_SCAN_METHODS") == "1" ? "-Candidate" : "-NoDNG";
		string filename = Path.Combine(Path.GetDirectoryName(location), Path.GetFileNameWithoutExtension(location) + suffix + Path.GetExtension(location));
		module.NativeWrite(filename, nativeModuleWriterOptions2);
		Console.WriteLine("- Saved!");
		if (!Console.IsInputRedirected)
			Console.ReadKey();
	}
}
