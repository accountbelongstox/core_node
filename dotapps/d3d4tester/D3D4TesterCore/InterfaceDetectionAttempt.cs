// PY-REF: pyapps/d3-check/d3utils/d3u_common/image_annotator_helper.py
using DotCore.TemplateMatcher;

namespace DotApps.d3d4tester.Core;

/// <summary>One template attempt during interface detection. Filled by DetectInterfaceTypeFromFullWindow when debugAttempts is provided. 1:1 Python image_annotator_helper draw_match_result / save_no_match_debug_image.</summary>
public sealed class InterfaceDetectionAttempt
{
    public string TemplateName { get; set; } = "";
    public string TemplatePath { get; set; } = "";
    public bool TemplateExists { get; set; }
    public TemplateMatchResult? MatchResult { get; set; }
    public bool InLeft30 { get; set; }
}
