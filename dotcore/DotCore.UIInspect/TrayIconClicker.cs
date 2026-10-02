// PY-REF: pycore/pyutils/input/tray_clicker.py
using System.Drawing;
using System.IO;
using DotCore.Foundations;
using DotCore.Utils.Input;
using FlaUI.Core.AutomationElements;
using FlaUI.UIA3;

namespace DotCore.UIInspect;

/// <summary>
/// Find a notification-area (system tray) icon by keyword via UI Automation and double-click it (cursor restored).
/// 1:1 Python pycore/pyutils/input/tray_clicker.py TrayIconClicker.
/// </summary>
public static class TrayIconClicker
{
    private const string LogTag = "[TrayClicker]";
    private const int TrayIconWidth = 32;
    private const int TrayIconMaxPlausibleWidth = 100;
    private const double MoveDurationSec = 0.0;
    private static readonly string[] TrayWindowClassKeywords = { "tray", "notify", "shell" };

    /// <summary>Double-click the first tray icon whose name or class contains any keyword (tried in order). True when clicked.</summary>
    public static bool ClickTrayIcon(params string[] keywords)
    {
        foreach (var keyword in keywords)
        {
            var needle = NormalizeKeyword(keyword);
            if (needle.Length == 0) continue;
            var rect = FindIconRect(needle);
            if (rect == null)
            {
                ColorPrinter.Gray($"{LogTag} No tray icon found containing keyword: '{needle}'");
                continue;
            }
            var (x, y) = ClickPoint(rect.Value);
            ColorPrinter.Gray($"{LogTag} Double-clicking '{needle}' at ({x}, {y})");
            return ClickHandler.Instance.DoubleClick(x, y, MoveDurationSec, returnToOriginal: true);
        }
        return false;
    }

    /// <summary>Strip a path and extension from a keyword such as C:/x/Battle.net.exe.</summary>
    private static string NormalizeKeyword(string keyword)
    {
        if (string.IsNullOrWhiteSpace(keyword)) return "";
        var baseName = Path.GetFileName(keyword.Trim());
        var stem = Path.GetFileNameWithoutExtension(baseName);
        return (string.IsNullOrEmpty(stem) ? baseName : stem).Trim().ToLowerInvariant();
    }

    private static Rectangle? FindIconRect(string needle)
    {
        try
        {
            using var automation = new UIA3Automation();
            foreach (var window in automation.GetDesktop().FindAllChildren())
            {
                var className = window.Properties.ClassName.ValueOrDefault ?? "";
                if (!TrayWindowClassKeywords.Any(k => className.Contains(k, StringComparison.OrdinalIgnoreCase))) continue;
                foreach (var child in window.FindAllChildren())
                {
                    foreach (var icon in child.FindAllChildren())
                    {
                        if (!Matches(icon, needle)) continue;
                        ColorPrinter.Gray($"{LogTag} Found matching icon: '{icon.Properties.Name.ValueOrDefault}'");
                        return icon.BoundingRectangle;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"{LogTag} UI Automation enumeration failed keyword={needle}: {ex.Message}");
        }
        return null;
    }

    private static bool Matches(AutomationElement icon, string needle)
    {
        var name = icon.Properties.Name.ValueOrDefault ?? "";
        var cls = icon.Properties.ClassName.ValueOrDefault ?? "";
        return name.Contains(needle, StringComparison.OrdinalIgnoreCase) || cls.Contains(needle, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Icon centre; a rectangle wider than a plausible icon is treated as inaccurate and its first icon slot is used.</summary>
    private static (int X, int Y) ClickPoint(Rectangle rect)
    {
        int centerY = rect.Top + rect.Height / 2;
        return rect.Width > TrayIconMaxPlausibleWidth ? (rect.Left + TrayIconWidth / 2, centerY) : (rect.Left + rect.Width / 2, centerY);
    }
}
