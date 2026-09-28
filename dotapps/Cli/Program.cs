// Multi-command CLI entry (e.g. dotcore tool-name --args)

using DotCore.Foundations;

if (args.Length == 0 || args[0] is "-h" or "--help")
{
    ColorPrinter.Blue("[Cli] Usage: DotCore.Cli <command> [options...]");
    ColorPrinter.Blue("[Cli] Commands: (register in tool map)");
    return 0;
}

var command = args[0];
// TODO: route to tool handlers
ColorPrinter.Blue("[Cli] Command: " + command);
return 0;
