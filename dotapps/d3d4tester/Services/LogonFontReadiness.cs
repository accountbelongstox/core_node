using System.Windows;
using System.Windows.Media;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Services;

public static class LogonFontReadiness
{
    private const string LogTag = "[Startup]";
    private const int MaxWaitMs = 180_000;
    private const int PollMs = 1_000;

    public static void WaitUntilReady()
    {
        int waited = 0;
        while (true)
        {
            try
            {
                var family = SystemFonts.MessageFontFamily;
                if (new Typeface(family, FontStyles.Normal, FontWeights.Normal, FontStretches.Normal).TryGetGlyphTypeface(out _))
                {
                    if (waited > 0) ColorPrinter.Green($"{LogTag} fonts ready after {waited} ms");
                    return;
                }
            }
            catch (UnauthorizedAccessException) { }
            catch (System.IO.IOException) { }
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
}
