// CallModule service entry (e.g. --port 59000)

using DotCore.Foundations;

var port = 59000;
for (var i = 0; i < args.Length; i++)
    if (args[i] == "--port" && i + 1 < args.Length && int.TryParse(args[i + 1], out var p))
        port = p;

ColorPrinter.Blue("[CallModule] Host would listen on port " + port);
return 0;
