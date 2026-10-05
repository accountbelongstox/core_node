// PY-REF: none (DOT-only)
using System.IO;
using System.Text.Json;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;

namespace DotApps.d3d4tester.ViewModels;

/// <summary>Exceptions the YOLO task-set UI reports instead of crashing, and their localized description (library text only as detail).</summary>
public static class TaskSetUiErrors
{
    private const string MessagePlaceholder = "{message}";

    public static bool IsHandled(Exception ex) =>
        ex is IOException or UnauthorizedAccessException or InvalidOperationException or ArgumentException
            or NotSupportedException or JsonException or FormatException or OpenCvSharp.OpenCVException;

    public static string Describe(Exception ex)
    {
        var key = ex switch
        {
            FileNotFoundException or DirectoryNotFoundException => I18nKeys.YoloTaskSetErrorNotFound,
            UnauthorizedAccessException => I18nKeys.YoloTaskSetErrorAccessDenied,
            JsonException => I18nKeys.YoloTaskSetErrorInvalidData,
            OpenCvSharp.OpenCVException or FormatException => I18nKeys.YoloTaskSetErrorDecode,
            NotSupportedException or ArgumentException => I18nKeys.YoloTaskSetErrorUnsupported,
            IOException => I18nKeys.YoloTaskSetErrorFile,
            _ => I18nKeys.YoloTaskSetErrorOperation,
        };
        return D3D4TesterI18n.Provider.GetUiText(key) + Environment.NewLine
            + D3D4TesterI18n.Provider.GetUiText(I18nKeys.YoloTaskSetErrorIo).Replace(MessagePlaceholder, ex.Message);
    }
}
