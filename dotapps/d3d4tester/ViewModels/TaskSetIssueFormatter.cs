// PY-REF: none (DOT-only)
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotCore.YoloTaskSet;

namespace DotApps.d3d4tester.ViewModels;

/// <summary>Localized text and Segoe Fluent glyph of a task-set validation issue (shared by the task-set manager and the training window).</summary>
public static class TaskSetIssueFormatter
{
    public const string GlyphError = "\uEA39";
    public const string GlyphWarning = "\uE7BA";
    private const string SubjectPlaceholder = "{subject}";

    public static string Text(TaskSetIssue issue) =>
        D3D4TesterI18n.Provider.GetUiText(I18nKeys.YoloTaskSetIssue(issue.Code)).Replace(SubjectPlaceholder, issue.Subject);

    public static string Glyph(TaskSetIssue issue) => issue.IsError ? GlyphError : GlyphWarning;

    /// <summary>Plain-text line with a localized severity prefix (for logs and text blocks without an icon font).</summary>
    public static string Line(TaskSetIssue issue) =>
        D3D4TesterI18n.Provider.GetUiText(issue.IsError ? I18nKeys.YoloTaskSetIssueErrorPrefix : I18nKeys.YoloTaskSetIssueWarningPrefix) + Text(issue);

    public static TaskSetIssueRow Row(TaskSetIssue issue, ContaminationHit? hit = null) => new(issue, Glyph(issue), Text(issue), hit);

    /// <summary>Errors first, then warnings, each in library order.</summary>
    public static IEnumerable<TaskSetIssue> Ordered(IEnumerable<TaskSetIssue> issues) => issues.OrderByDescending(i => i.IsError);
}
