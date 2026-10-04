using DotCore.VocAnnotator;

namespace DotCore.VocAnnotatorUI;

/// <summary>User interaction the view model needs; implemented by the view.</summary>
public interface IAnnotatorDialogs
{
    bool Confirm(string message);

    /// <summary>Yes = true, No = false, Cancel = null.</summary>
    bool? ConfirmSave(string message);

    string? Prompt(string title, string label, string initial);

    string? PickFolder(string title, string? initial);

    AnnotatorSettings? EditSettings(AnnotatorSettings current);

    void ShowMessage(string message, bool isError);

    void ShowHelp(string title, string text);
}
