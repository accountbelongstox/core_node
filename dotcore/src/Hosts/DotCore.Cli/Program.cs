// Multi-command CLI entry (e.g. dotcore tool-name --args)

if (args.Length == 0 || args[0] is "-h" or "--help")
{
    Console.WriteLine("Usage: DotCore.Cli <command> [options...]");
    Console.WriteLine("Commands: (register in tool map)");
    return 0;
}

var command = args[0];
// TODO: route to tool handlers
Console.WriteLine($"Command: {command}");
return 0;
