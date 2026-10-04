// PY-REF: none (DOT-only)
using DotCore.VocAnnotator;

namespace DotCore.YoloTaskSet;

/// <summary>
/// Task sets on disk: {root}/{id}/taskset.json plus imported resources (YOLO_TASKSET_SYNTHESIS_DESIGN.md §3).
/// Every mutating method saves taskset.json.
/// </summary>
public sealed class TaskSetStore
{
    public const string TaskSetFileName = "taskset.json";
    public const string TaskSetsSubdir = YoloDataLayout.ReservedPrefix + "tasksets";

    public TaskSetStore(string rootDir)
    {
        RootDir = Path.GetFullPath(rootDir);
    }

    public static string DefaultRoot => Path.Combine(YoloDataLayout.Root, TaskSetsSubdir);

    public string RootDir { get; }

    public static bool IsSupportedImage(string path) => throw new NotImplementedException();

    public static bool IsSupportedVideo(string path) => throw new NotImplementedException();

    public IReadOnlyList<TaskSet> List() => throw new NotImplementedException();

    public TaskSet? Load(string id) => throw new NotImplementedException();

    public TaskSet Create(string name) => throw new NotImplementedException();

    public void Save(TaskSet set) => throw new NotImplementedException();

    public void Delete(string id) => throw new NotImplementedException();

    public TaskSet Duplicate(string id, string newName) => throw new NotImplementedException();

    public string GetDir(string id) => throw new NotImplementedException();

    public string ResourcePath(TaskSet set, TaskResource resource) => throw new NotImplementedException();

    public TaskTarget AddTarget(TaskSet set, string name) => throw new NotImplementedException();

    public void RemoveTarget(TaskSet set, string targetId) => throw new NotImplementedException();

    public void MoveTarget(TaskSet set, string targetId, int delta) => throw new NotImplementedException();

    public TaskResource AddVariant(TaskSet set, TaskTarget target, string sourcePath) => throw new NotImplementedException();

    public TaskResource AddScene(TaskSet set, TaskTarget target, string sourcePath) => throw new NotImplementedException();

    public TaskResource AddCommon(TaskSet set, string sourcePath) => throw new NotImplementedException();

    public void RemoveResource(TaskSet set, TaskResource resource) => throw new NotImplementedException();
}
