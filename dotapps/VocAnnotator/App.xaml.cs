// PY-REF: none (DOT-only)
using System.IO;
using System.Windows;
using DotCore.VocAnnotatorUI;

namespace DotApps.VocAnnotator;

/// <summary>
/// Standalone annotator: hosts DotCore.VocAnnotatorUI.AnnotatorWindow.
/// Arguments (VocAnnotatorLauncher contract): [imagesDir] [--project-path dir] [--annotation-dir dir] [--lang zh|en].
/// </summary>
public partial class App : Application
{
    private const string ProjectPathArg = "--project-path";
    private const string AnnotationDirArg = "--annotation-dir";
    private const string LanguageArg = "--lang";

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        string? images = null, project = null, annotations = null, language = null;
        for (int i = 0; i < e.Args.Length; i++)
        {
            var arg = e.Args[i];
            string? Next() => i + 1 < e.Args.Length ? e.Args[++i].Trim() : null;
            switch (arg)
            {
                case ProjectPathArg: project = Next(); break;
                case AnnotationDirArg: annotations = Next(); break;
                case LanguageArg: language = Next(); break;
                default:
                    if (images == null && Directory.Exists(arg.Trim())) images = Path.GetFullPath(arg.Trim());
                    break;
            }
        }
        if (!string.IsNullOrWhiteSpace(language)) AnnotatorI18n.UseProvider(AnnotatorI18n.CreateProvider(language));
        var window = new AnnotatorWindow(new AnnotatorSession(images, annotations ?? (project != null && images == null ? project : null), project));
        MainWindow = window;
        window.Show();
    }
}
