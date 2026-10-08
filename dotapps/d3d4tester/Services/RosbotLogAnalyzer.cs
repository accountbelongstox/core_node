// PY-REF: pyapps/d3-check/d3utils/log_analyzer.py
using System.Linq;
using System.Text.RegularExpressions;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Config.Options;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Flow;
using DotApps.d3d4tester.I18n;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// Analyzes ROSBOT logs.txt lines; state + order match Python d3utils.log_analyzer.LogAnalyzer.
/// </summary>
public static class RosbotLogAnalyzer
{
    public static readonly object SyncRoot = new();
    private static readonly RosbotLogAnalyzerEngine Engine = new();

    public static bool AnalyzeLine(string line) => Engine.AnalyzeLine(line);
}

internal sealed class RosbotLogAnalyzerEngine
{
    private const string PythonFormatPlaceholder = "%s";
    private static readonly Regex RosbotStart = new(@"ROSBOT.*started|ROSBOT.*running", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex RosbotStop = new(@"ROSBOT.*stopped|ROSBOT.*exit", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex MapGreaterRift = new(@"greater.*rift|gr\d+", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex MapRift = new(@"rift|nephalem.*rift", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex StageGem = new(@"gem.*upgrade|upgrade.*gem", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex StageKillBoss = new(@"kill.*boss|boss.*kill", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex StageBackTown = new(@"back.*town|return.*town", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex StageInGr = new(@"in.*greater.*rift", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex StageInRift = new(@"in.*rift", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private readonly List<string> _recentLines = new();
    private readonly List<string> _lineBuffer = new();
    private readonly List<string> _atErrorBuffer = new();
    private int _firstbornObjectiveCount;
    private int _linesSinceSystemKill = 999;

    public bool AnalyzeLine(string line)
    {
        if (string.IsNullOrWhiteSpace(line))
            return false;
        line = line.Trim();
        var game = GameInterfaceData.Instance;
        bool updated = false;

        if (RosbotStart.IsMatch(line))
        {
            game.SetRosbotStatus(true);
            updated = true;
        }
        else if (RosbotStop.IsMatch(line))
        {
            game.SetRosbotStatus(false);
            updated = true;
        }

        if ((line.Contains("WARN", StringComparison.Ordinal) && line.Contains("Disconnected", StringComparison.Ordinal))
            || (line.Contains("Session Time out", StringComparison.Ordinal) && (line.Contains("min", StringComparison.OrdinalIgnoreCase) || line.Contains("timeout", StringComparison.OrdinalIgnoreCase))))
        {
            game.SetRosbotDisconnectedFromLog(true);
            ColorPrinter.Yellow("[LogAnalyzer] ROSBOT disconnection detected from log: " + line[..Math.Min(80, line.Length)]);
            updated = true;
        }

        bool firstbornReuse = ConfigOptionsProvider.GetOptions<RosbotOptions>().FirstbornBlueGateReuse;
        if (line.Contains("Objective RunLogic: Temple of the Firstbor", StringComparison.Ordinal))
        {
            _firstbornObjectiveCount++;
            bool isOdd = (_firstbornObjectiveCount % 2) == 1;
            if (!firstbornReuse || isOdd)
            {
                if (game.SetMapType("firstborn_temple"))
                    updated = true;
                if (game.SetGameStage("back_town"))
                    updated = true;
            }
            if (firstbornReuse && isOdd)
            {
                string msg = D3D4TesterI18n.Provider.GetUiText(I18nKeys.RosbotFirstbornReuseNeeded)
                    .Replace(PythonFormatPlaceholder, _firstbornObjectiveCount.ToString(), StringComparison.Ordinal);
                ColorPrinter.Blue($"[LogAnalyzer] {msg}");
            }
        }
        else if (line.Contains("Town portal done", StringComparison.Ordinal))
        {
            if (game.SetMapType("town")) updated = true;
            if (game.SetGameStage("back_town")) updated = true;
        }
        else if (line.Contains("Map: town", StringComparison.Ordinal))
        {
            if (game.SetMapType("town")) updated = true;
        }
        else if (line.Contains("Map: echo", StringComparison.Ordinal))
        {
            if (game.SetMapType("echo")) updated = true;
        }
        else if (StageBackTown.IsMatch(line))
        {
            if (game.SetMapType("town")) updated = true;
        }
        else if (MapGreaterRift.IsMatch(line))
        {
            if (game.SetMapType("greater_rift")) updated = true;
        }
        else if (MapRift.IsMatch(line))
        {
            if (game.SetMapType("rift")) updated = true;
        }

        if (line.Contains("Running: Echoing Fury Exploration", StringComparison.Ordinal))
        {
            if (game.SetMapType("echo")) updated = true;
        }
        if (line.Contains("Running: Temple of the Firstborn", StringComparison.Ordinal))
        {
            if (game.SetMapType("firstborn_temple")) updated = true;
        }
        var snapMid = game.GetStateSnapshot();
        if (line.Contains("Game ended", StringComparison.Ordinal) && string.Equals(snapMid.MapType, "echo", StringComparison.Ordinal))
        {
            if (game.SetMapType("echo_completed")) updated = true;
        }

        IReadOnlyList<string> recentBefore = _recentLines.ToArray();
        RosbotSmartEchoCoordinator.TryPickingEndEchoRule(line, recentBefore);
        RosbotLogNoItemsHandler.OnLine(line);

        List<string> recent10 = TakeLast(_recentLines, RosbotLogConstants.SystemErrorLookbackLines);
        CheckSystemError(line, recent10);
        _linesSinceSystemKill++;

        _recentLines.Add(line);
        while (_recentLines.Count > RosbotLogConstants.RecentLinesMax)
            _recentLines.RemoveAt(0);

        _lineBuffer.Add(line);
        while (_lineBuffer.Count > RosbotLogConstants.LineBufferMax)
            _lineBuffer.RemoveAt(0);

        if (StageGem.IsMatch(line))
        {
            if (game.SetGameStage("gem_upgrade")) updated = true;
        }
        else if (StageKillBoss.IsMatch(line))
        {
            if (game.SetGameStage("kill_boss")) updated = true;
        }
        else if (StageBackTown.IsMatch(line))
        {
            if (game.SetGameStage("back_town")) updated = true;
        }
        else if (StageInGr.IsMatch(line))
        {
            if (game.SetGameStage("in_greater_rift")) updated = true;
        }
        else if (StageInRift.IsMatch(line))
        {
            if (game.SetGameStage("in_rift")) updated = true;
        }

        string loginTry = ConfigOptionsProvider.GetOptions<LogDetectionOptions>().LoginTry?.Trim() ?? "";
        if (string.IsNullOrEmpty(loginTry))
            loginTry = RosbotLogConstants.LoginTryTriggerDefault;
        if (!string.IsNullOrEmpty(loginTry) && line.Contains(loginTry, StringComparison.Ordinal))
        {
            try { RosbotLogLoginTryRegistry.LoginTryCallback?.Invoke(); }
            catch (Exception ex) { ColorPrinter.Gray("[LogAnalyzer] Login try callback: " + ex.Message); }
            updated = true;
        }

        if (updated)
            ColorPrinter.Debug("[LogAnalyzer] State updated from line: " + line[..Math.Min(50, line.Length)] + "...");
        return updated;
    }

    private static List<string> TakeLast(List<string> list, int n)
    {
        if (list.Count == 0) return new List<string>();
        int take = Math.Min(n, list.Count);
        return list.Skip(list.Count - take).ToList();
    }

    private void CheckSystemError(string line, IReadOnlyList<string> recent10Lines)
    {
        if (_linesSinceSystemKill < RosbotLogConstants.SystemErrorCooldownLines)
        {
            _atErrorBuffer.Clear();
            return;
        }
        if (line.Contains("at System", StringComparison.Ordinal))
        {
            if (recent10Lines.Any(ln => ln.Contains("Plugins", StringComparison.Ordinal)))
            {
                _atErrorBuffer.Clear();
                return;
            }
            _atErrorBuffer.Add(line);
            if (_atErrorBuffer.Count >= 2)
            {
                ColorPrinter.Red("[LogAnalyzer] System error detected: consecutive 'at System' lines, restarting D3 and ROSBOT");
                RestartAfterSystemError();
                _atErrorBuffer.Clear();
                _linesSinceSystemKill = 0;
            }
        }
        else
            _atErrorBuffer.Clear();
    }

    /// <summary>
    /// ROSBOT stack traces (e.g. its server unreachable) are ROSBOT's problem: while D3 runs normally only ROSBOT is restarted (monitoring
    /// on: the flow's ROSBOT-only restart; off: ROSBOT ended). Only with D3 gone or disconnected: the full F4 restart (counted, notified)
    /// or, monitoring off, end D3 and ROSBOT.
    /// </summary>
    private static void RestartAfterSystemError()
    {
        if (!GameControl.Allowed("log system error restart", needsMonitoring: false)) return;
        bool monitoring = RosbotFlowState.Instance.FlowMasterEnabled;
        if (F3MonitorProcess.D3ShowsFine())
        {
            ColorPrinter.Yellow("[LogAnalyzer] ROSBOT system error but D3 is fine -> restart ROSBOT only");
            if (monitoring) F3MonitorProcess.RequestRosbotRestart();
            else RosbotManager.Instance.KillIfRunning();
            return;
        }
        if (monitoring)
        {
            Monitor.MonitorService.Instance.RequestRestart(RosbotRestartRequest.ReasonLogSystemError, "", restartBattlenet: false);
            return;
        }
        Task.Run(RosbotFlowRunner.EndD3AndRosbot);
    }
}
