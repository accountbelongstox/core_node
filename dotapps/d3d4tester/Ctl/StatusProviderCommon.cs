// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/status_provider_common.py
using DotCore.Foundations;

namespace DotApps.d3d4tester.Ctl;

/// <summary>
/// Shared refresh flow for window-based state: set running from window found, optional geometry, detect the dynamic
/// triple (on_login, disconnected, third), set dynamic. Same-line progress (run, geom, detect, dynamic, done).
/// 1:1 Python d3utils/status_provider_common.py.
/// </summary>
public static class StatusProviderCommon
{
    private const string StepRun = "run";
    private const string StepGeom = "geom";
    private const string StepDetect = "detect";
    private const string StepDynamic = "dynamic";
    private const string StepDone = "done";

    /// <summary>
    /// setRunning and setDynamic return whether the value changed. When progressRefresh is null and logPrefix set,
    /// progress is a same-line gray refresh. Returns true if any state changed (for conditional notify).
    /// </summary>
    public static bool RefreshWindowState<TWindow>(
        TWindow? windowInfo,
        Func<bool, bool> setRunning,
        Func<bool, bool, bool, bool> setDynamic,
        Func<bool, TWindow?, (bool OnLogin, bool Disconnected, bool Third)> detectDynamic,
        Action<TWindow?>? applyGeometry = null,
        string logPrefix = "",
        Action<string>? progressRefresh = null,
        bool skipFinalNewline = false)
        where TWindow : class
    {
        if (progressRefresh == null && logPrefix.Length > 0)
            progressRefresh = s => ColorPrinter.GrayRefresh($"{logPrefix} {s}");
        bool found = windowInfo != null;
        if (progressRefresh != null) progressRefresh(StepRun);
        else ColorPrinter.Gray($"{logPrefix} progress: set_running(found={found})");
        bool runningChanged = setRunning(found);

        bool geometryChanged = false;
        if (applyGeometry != null)
        {
            try
            {
                if (progressRefresh != null) progressRefresh(StepGeom);
                else ColorPrinter.Gray($"{logPrefix} progress: apply_geometry...");
                applyGeometry(windowInfo);
                geometryChanged = true;
                if (progressRefresh == null) ColorPrinter.Gray($"{logPrefix} progress: apply_geometry done");
            }
            catch (Exception ex)
            {
                ColorPrinter.Red($"{logPrefix} apply_geometry error: {ex.Message}");
            }
        }

        bool dynamicChanged;
        try
        {
            if (progressRefresh != null) progressRefresh(StepDetect);
            else ColorPrinter.Gray($"{logPrefix} progress: detect_dynamic...");
            var (onLogin, disconnected, third) = detectDynamic(found, windowInfo);
            if (progressRefresh != null) progressRefresh(StepDynamic);
            else ColorPrinter.Gray($"{logPrefix} progress: detect_dynamic done -> set_dynamic...");
            dynamicChanged = setDynamic(onLogin, disconnected, third);
            if (progressRefresh == null) ColorPrinter.Gray($"{logPrefix} progress: set_dynamic done");
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"{logPrefix} detect_dynamic error: {ex.Message}");
            dynamicChanged = setDynamic(false, false, false);
        }

        if (progressRefresh != null)
        {
            progressRefresh(StepDone);
            if (!skipFinalNewline) EndRefreshLine();
        }
        return runningChanged || geometryChanged || dynamicChanged;
    }

    private static void EndRefreshLine()
    {
        try
        {
            if (!Console.IsOutputRedirected) Console.WriteLine();
        }
        catch
        {
            // no console attached
        }
    }
}
