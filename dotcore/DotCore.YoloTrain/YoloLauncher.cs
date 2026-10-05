// PY-REF: none (DOT-only)
namespace DotCore.YoloTrain;

/// <summary>
/// How Ultralytics is started: the probed interpreter running `ultralytics.cfg.entrypoint` (preferred, same environment the probe
/// reported) or a yolo CLI executable. Arguments after the prefix are the usual CLI tokens (`detect train key=value ...`).
/// </summary>
public sealed record YoloLauncher(string FileName, IReadOnlyList<string> PrefixArguments, bool IsPython)
{
    /// <summary>
    /// `python -c` bootstrap: sys.argv is ['-c', *tokens] and entrypoint() drops argv[0], so the tokens parse as for the yolo exe.
    /// Non-Windows: exits when the parent dies (re-parented), because Linux has no job object (Windows uses ChildProcessJob).
    /// </summary>
    public const string PythonBootstrap =
        "import os, threading, time\n" +
        "if os.name != 'nt':\n" +
        "    _ppid = os.getppid()\n" +
        "    def _watch():\n" +
        "        while True:\n" +
        "            time.sleep(2)\n" +
        "            if os.getppid() != _ppid:\n" +
        "                os._exit(143)\n" +
        "    threading.Thread(target=_watch, daemon=True).start()\n" +
        "from ultralytics.cfg import entrypoint\n" +
        "entrypoint()\n";

    private const string PythonDisplay = "-c <ultralytics.cfg.entrypoint>";

    public static YoloLauncher ForPython(string pythonExe) => new(pythonExe, new[] { "-c", PythonBootstrap }, true);

    public static YoloLauncher ForCli(string yoloExe) => new(yoloExe, Array.Empty<string>(), false);

    public static implicit operator YoloLauncher(string yoloExe) => ForCli(yoloExe);

    public bool Exists => File.Exists(FileName);

    public IReadOnlyList<string> Arguments(IEnumerable<string> cliTokens) => PrefixArguments.Concat(cliTokens).ToList();

    /// <summary>Single-line command text for logs (the bootstrap is shown as a placeholder).</summary>
    public string Format(IEnumerable<string> cliTokens) =>
        YoloTrainParameters.FormatCommand(IsPython ? FileName + " " + PythonDisplay : FileName, cliTokens);
}
