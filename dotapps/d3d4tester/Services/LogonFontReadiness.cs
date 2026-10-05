using System.IO;
using System.Windows;
using System.Windows.Media;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Services;

public static class LogonFontReadiness
{
    private const string LogTag = "[Startup]";
    private const int MaxWaitMs = 180_000;
    private const int PollMs = 1_000;
    private static readonly string[] ThemeFontKeys = { "UiFontFamily", "UiDisplayFontFamily", "MonoFontFamily", "IconFontFamily" };

    public static void WaitUntilReady()
    {
        int waited = 0;
        while (true)
        {
            if (TryLoad(SystemFonts.MessageFontFamily.Source))
            {
                if (waited > 0) ColorPrinter.Green($"{LogTag} fonts ready after {waited} ms");
                return;
            }
            if (waited >= MaxWaitMs)
            {
                ColorPrinter.Yellow($"{LogTag} fonts not ready after {waited} ms, continuing");
                return;
            }
            if (waited == 0) ColorPrinter.Yellow($"{LogTag} waiting for session fonts (logon race)");
            Thread.Sleep(PollMs);
            waited += PollMs;
        }
    }

    public static void DropUnusableThemeFonts()
    {
        var resources = Application.Current.Resources;
        foreach (string key in ThemeFontKeys)
        {
            if (resources[key] is not FontFamily family) continue;
            var names = family.Source.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            var usable = names.Where(TryLoad).ToArray();
            if (usable.Length == names.Length) continue;
            foreach (string bad in names.Except(usable)) ColorPrinter.Yellow($"{LogTag} font '{bad}' is unusable on this system, dropped from {key}");
            resources[key] = new FontFamily(usable.Length > 0 ? string.Join(", ", usable) : SystemFonts.MessageFontFamily.Source);
        }
    }

    private static bool TryLoad(string familyName)
    {
        try
        {
            return new Typeface(new FontFamily(familyName), FontStyles.Normal, FontWeights.Normal, FontStretches.Normal).TryGetGlyphTypeface(out _);
        }
        catch (UnauthorizedAccessException) { return false; }
        catch (IOException) { return false; }
    }
}
