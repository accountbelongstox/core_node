using System.Runtime.CompilerServices;
using System.Windows.Controls;

namespace DotApps.d3d4tester.Ui;

/// <summary>
/// Appends text to a log TextBox and keeps at most <see cref="MaxLines"/> lines (oldest dropped in batches), so log boxes do not grow forever.
/// Shared by the Monitor tab, the ROSBOT log block and the Run log tab.
/// </summary>
public static class LogTextBoxHelper
{
    public const int MaxLines = 2000;
    private const int TrimBatchLines = 200;
    private const char NewLine = '\n';

    private static readonly ConditionalWeakTable<TextBox, LineCounter> Counters = new();

    /// <summary>Append text (with its own line break), trim the oldest lines over the cap, optionally scroll to the end. UI thread only.</summary>
    public static void Append(TextBox box, string text, bool scrollToEnd = true)
    {
        box.AppendText(text);
        var counter = Counters.GetOrCreateValue(box);
        counter.Lines += CountLines(text);
        if (counter.Lines > MaxLines + TrimBatchLines) Trim(box, counter);
        if (scrollToEnd) box.ScrollToEnd();
    }

    /// <summary>Replace the whole text (initial fill), trimmed to the cap.</summary>
    public static void SetText(TextBox box, string text)
    {
        box.Text = text;
        var counter = Counters.GetOrCreateValue(box);
        counter.Lines = CountLines(text);
        if (counter.Lines > MaxLines) Trim(box, counter);
    }

    private static void Trim(TextBox box, LineCounter counter)
    {
        string text = box.Text;
        int lines = CountLines(text);
        int drop = lines - MaxLines;
        int index = 0;
        for (int i = 0; i < drop && index >= 0; i++)
        {
            index = text.IndexOf(NewLine, index);
            if (index >= 0) index++;
        }
        if (drop > 0 && index > 0)
        {
            box.Text = text[index..];
            lines -= drop;
        }
        counter.Lines = lines;
    }

    private static int CountLines(string text)
    {
        int count = 0;
        foreach (char c in text)
            if (c == NewLine) count++;
        return count;
    }

    private sealed class LineCounter
    {
        public int Lines;
    }
}
