// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/system_initializer.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/cnocr_engine_registry.py
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Core.D4;
using DotApps.d3d4tester.Core.Flow;
using DotApps.d3d4tester.Ctl;
using DotCore.Foundations;
using DotCore.UIInspect;
using DotCore.Utils.Input;
using DotCore.Utils.Ocr;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// System-wide initialization before the UI (or bridge-only host) starts: configuration, app-provided hooks for
/// DotCore/Core libraries, shutdown runner and OCR engine pre-initialization (background, so startup stays responsive).
/// GUI mode exits only through the UI; there is no console Ctrl+C path in a WPF app.
/// 1:1 Python d3utils/system_initializer.py (initialize_system, initialize_configuration, ensure_cnocr_loaded_and_engines_initialized).
/// </summary>
public static class SystemInitializer
{
    private static readonly object Lock = new();
    private static bool _initialized;
    private static Task<bool>? _ocrInitTask;

    public static bool IsInitialized
    {
        get { lock (Lock) return _initialized; }
    }

    /// <summary>OCR pre-init task (null before Initialize). Callers needing OCR may await it; engines also load lazily.</summary>
    public static Task<bool>? OcrInitTask => _ocrInitTask;

    /// <summary>Initialize once. Returns false when configuration could not be loaded.</summary>
    public static bool Initialize(bool guiMode)
    {
        lock (Lock)
        {
            if (_initialized)
            {
                ColorPrinter.Yellow("[INIT] System already initialized");
                return true;
            }
            try
            {
                ColorPrinter.Blue("[INIT] Starting system initialization...");
                InitializeConfiguration();
                InstallLibraryHooks();
                ShutdownManager.RegisterShutdownRunner(TickDriver.Instance.Stop);
                StartOcrPreInit();
                if (guiMode)
                    ColorPrinter.Blue("[INIT] GUI mode: close via UI only");
                _initialized = true;
                ColorPrinter.Green("[INIT] System initialization completed successfully");
                return true;
            }
            catch (Exception ex)
            {
                ColorPrinter.Red($"[INIT] System initialization failed: {ex.Message}");
                return false;
            }
        }
    }

    private static void InitializeConfiguration()
    {
        ColorPrinter.Blue("[INIT] Initializing system configuration...");
        D3D4TesterConfigService.Instance.Load();
        ConfigOptionsProvider.Initialize();
        ColorPrinter.Green("[INIT] Configuration initialized successfully");
    }

    /// <summary>App-provided callbacks for libraries that cannot reference the app, and OCR task maps (D4 tasks).</summary>
    private static void InstallLibraryHooks()
    {
        UIOperations.DefaultRectClick = rect =>
            ClickHandler.Instance.Click(rect.X + rect.Width / 2, rect.Y + rect.Height / 2);
        RosbotFlowController.InstallHooks();
        D4OcrConfig.EnsureRegistered();
    }

    private static void StartOcrPreInit()
    {
        _ocrInitTask = Task.Run(() =>
        {
            try
            {
                bool ok = OcrEngineRegistry.Instance.EnsureLoaded();
                if (!ok)
                    ColorPrinter.Yellow("[INIT] OCR load/init skipped or failed, OCR features may be limited");
                return ok;
            }
            catch (Exception ex)
            {
                ColorPrinter.Yellow($"[INIT] OCR load/init failed: {ex.Message}");
                return false;
            }
        });
    }
}
