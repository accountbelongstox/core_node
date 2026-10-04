// PY-REF: none (DOT-only)
namespace DotCore.YoloTaskSet;

/// <summary>Validates a task set and synthesizes an auto-labeled Ultralytics dataset (YOLO_TASKSET_SYNTHESIS_DESIGN.md §4).</summary>
public static class TaskSetSynthesizer
{
    public const string ManifestFileName = "synthesis_manifest.json";
    public const string PreviewsSubdir = "previews";

    public static IReadOnlyList<TaskSetIssue> Validate(TaskSet set, string taskSetDir) => throw new NotImplementedException();

    public static SynthesisResult Generate(TaskSet set, string taskSetDir, string outputDir, IProgress<SynthesisProgress>? progress, CancellationToken ct) =>
        throw new NotImplementedException();

    public static PreviewResult RenderPreview(TaskSet set, string taskSetDir, int seed) => throw new NotImplementedException();
}
