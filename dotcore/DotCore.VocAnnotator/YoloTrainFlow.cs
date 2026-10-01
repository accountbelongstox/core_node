using System.Diagnostics;

namespace DotCore.VocAnnotator;

/// <summary>
/// YOLO detection training pipeline steps 3-6 (record/export steps 1-2 live in DotCore.YoloRecord).
/// 1:1 Python pyapps/d3-check/d3utils/yolo_train_flow.py; GameAISDK yolo_label_lib (clean_unlabeled, voc_annotations_to_yolo_labels) is ported natively.
/// Fixes Python bug: flow6 was a TODO stub; training now launches the Ultralytics CLI built by YoloDatasetBuilder.BuildTrainCommand.
/// </summary>
public static class YoloTrainFlow
{
    public const string VocExtension = ".xml";
    public const string YoloCliExe = "yolo";

    public static readonly IReadOnlySet<string> TrainImageExtensions =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".bmp" };

    /// <summary>Per-step readiness for the UI. 1:1 flow_get_step_summary.</summary>
    public sealed record StepSummary(bool Step1Ready, string Step1Status, bool Step2Ready, bool Step3Ready, bool Step4Ready, bool Step5Ready, bool Step6Ready);

    /// <summary>Step 4 (optional): remove images without VOC XML and XML without image. labelsDir null = imagesDir.</summary>
    public static (bool Ok, string Message) Flow4CleanUnlabeled(string imagesDir, string? labelsDir = null)
    {
        if (string.IsNullOrWhiteSpace(imagesDir) || !Directory.Exists(imagesDir))
            return (false, "images_dir not found");
        labelsDir = string.IsNullOrWhiteSpace(labelsDir) ? imagesDir : labelsDir;
        if (!Directory.Exists(labelsDir))
            return (false, "labels_dir not found");
        try
        {
            var images = Directory.EnumerateFiles(imagesDir).Where(f => TrainImageExtensions.Contains(Path.GetExtension(f))).ToList();
            var xmls = Directory.EnumerateFiles(labelsDir).Where(f => string.Equals(Path.GetExtension(f), VocExtension, StringComparison.OrdinalIgnoreCase)).ToList();
            var imageStems = new HashSet<string>(images.Select(Path.GetFileNameWithoutExtension)!, StringComparer.Ordinal);
            var xmlStems = new HashSet<string>(xmls.Select(Path.GetFileNameWithoutExtension)!, StringComparer.Ordinal);
            int removedImages = 0, removedXml = 0;
            foreach (var img in images.Where(i => !xmlStems.Contains(Path.GetFileNameWithoutExtension(i))))
            {
                File.Delete(img);
                removedImages++;
            }
            foreach (var xml in xmls.Where(x => !imageStems.Contains(Path.GetFileNameWithoutExtension(x))))
            {
                File.Delete(xml);
                removedXml++;
            }
            return (true, $"removed {removedImages} images, {removedXml} xml");
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    /// <summary>Step 5: VOC XML -> YOLO txt for each image id (labels/{id}.txt). Skips difficult boxes and classes not in list.</summary>
    public static (bool Ok, string Message) Flow5VocToYolo(string vocAnnotationsDir, string labelsOutputDir, IReadOnlyList<string> imageIdList, IReadOnlyList<string> classes)
    {
        if (classes == null || classes.Count == 0)
            return (false, "classes list is empty");
        try
        {
            Directory.CreateDirectory(labelsOutputDir);
            int written = 0;
            foreach (var imageId in imageIdList)
            {
                var xmlPath = Path.Combine(vocAnnotationsDir, imageId + VocExtension);
                var size = VocIo.ReadImageSize(xmlPath);
                if (size == null) continue;
                var shapes = AnnotationIo.BoxesToShapes(VocIo.ReadBoxesFromVoc(xmlPath));
                var txtPath = Path.Combine(labelsOutputDir, imageId + ".txt");
                if (AnnotationIo.ExportYoloDetectionTxt(txtPath, (size.Value.Width, size.Value.Height), shapes, classes) == 0)
                    File.WriteAllText(txtPath, "");
                written++;
            }
            return (true, $"converted {written} annotations");
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    /// <summary>Step 5 convenience: image ids from *.xml in vocAnnotationsDir.</summary>
    public static (bool Ok, string Message) Flow5VocToYoloFromAnnotationsDir(string vocAnnotationsDir, string labelsOutputDir, IReadOnlyList<string> classes)
    {
        if (!Directory.Exists(vocAnnotationsDir))
            return (false, "annotations dir not found");
        var ids = ListXmlIds(vocAnnotationsDir);
        if (ids.Count == 0)
            return (false, "no XML files in annotations dir");
        return Flow5VocToYolo(vocAnnotationsDir, labelsOutputDir, ids, classes);
    }

    /// <summary>Training dir for project/segment (Root/project/segment). 1:1 get_yolo_training_dir.</summary>
    public static string GetYoloTrainingDir(string projectName, string segmentId) => YoloDataLayout.GetDataDir(projectName, segmentId);

    /// <summary>Prepare Root/projectName/segmentId: images/ (copied frames), labels/ (VOC->YOLO), data.yaml. 1:1 flow5_prepare_training_dir.</summary>
    public static (bool Ok, string Message, string? DataYamlPath) Flow5PrepareTrainingDir(string projectName, string segmentId, string framesDir, string vocAnnotationsDir, IReadOnlyList<string> classes)
    {
        string segmentDir;
        try
        {
            if (!Directory.Exists(framesDir)) return (false, "frames_dir not found", null);
            if (!Directory.Exists(vocAnnotationsDir)) return (false, "voc_annotations_dir not found", null);
            if (classes == null || classes.Count == 0) return (false, "classes list is empty", null);
            segmentDir = YoloDataLayout.EnsureSegmentDirs(projectName, segmentId);
        }
        catch (ArgumentException)
        {
            return (false, "invalid project_name or segment_id", null);
        }
        return PrepareTrainingDir(segmentDir, framesDir, vocAnnotationsDir, classes);
    }

    /// <summary>Same as Flow5PrepareTrainingDir but into an explicit dataset dir (e.g. the unified-layout segment dir).</summary>
    public static (bool Ok, string Message, string? DataYamlPath) PrepareTrainingDir(string datasetDir, string framesDir, string vocAnnotationsDir, IReadOnlyList<string> classes)
    {
        if (!Directory.Exists(framesDir)) return (false, "frames_dir not found", null);
        if (!Directory.Exists(vocAnnotationsDir)) return (false, "voc_annotations_dir not found", null);
        if (classes == null || classes.Count == 0) return (false, "classes list is empty", null);
        var imagesDir = Path.Combine(datasetDir, YoloDataLayout.ImagesSubdir);
        var labelsDir = Path.Combine(datasetDir, YoloDataLayout.LabelsSubdir);
        int copied = 0;
        try
        {
            Directory.CreateDirectory(imagesDir);
            Directory.CreateDirectory(labelsDir);
            foreach (var f in Directory.EnumerateFiles(framesDir).Where(f => TrainImageExtensions.Contains(Path.GetExtension(f))))
            {
                File.Copy(f, Path.Combine(imagesDir, Path.GetFileName(f)), true);
                copied++;
            }
        }
        catch (Exception ex)
        {
            return (false, "copy images: " + ex.Message, null);
        }
        var ids = ListXmlIds(vocAnnotationsDir);
        if (ids.Count == 0)
            return (false, "no XML files in annotations dir", null);
        var (ok, msg) = Flow5VocToYolo(vocAnnotationsDir, labelsDir, ids, classes);
        if (!ok)
            return (false, string.IsNullOrEmpty(msg) ? "VOC->YOLO failed" : msg, null);
        var yamlPath = YoloDataLayout.WriteDataYaml(datasetDir, classes);
        return (true, $"Prepared {copied} images, {msg}", yamlPath);
    }

    /// <summary>Step 6a: training config paths (Ultralytics: data.yaml in dataset dir, default model).</summary>
    public static IReadOnlyDictionary<string, string> Flow6GetTrainConfigPaths(string datasetDir) => new Dictionary<string, string>
    {
        ["data_yaml"] = Path.Combine(datasetDir, DataYamlWriter.DataYamlFileName),
        ["model"] = YoloDatasetBuilder.DefaultTrainModel,
        ["project_dir"] = datasetDir,
    };

    /// <summary>Step 6b: launch `yolo detect train data=... model=... epochs=... imgsz=... batch=... device=...` as an external process.</summary>
    public static (bool Ok, string Message, Process? Process) Flow6StartTrain(
        string dataYamlPath,
        string model = YoloDatasetBuilder.DefaultTrainModel,
        int epochs = YoloDatasetBuilder.DefaultTrainEpochs,
        int imgsz = YoloDatasetBuilder.DefaultTrainImgsz,
        int batch = YoloDatasetBuilder.DefaultTrainBatch,
        string device = YoloDatasetBuilder.DefaultTrainDevice,
        string? cliExe = null)
    {
        if (string.IsNullOrWhiteSpace(dataYamlPath) || !File.Exists(dataYamlPath))
            return (false, "data.yaml not found", null);
        var startInfo = new ProcessStartInfo
        {
            FileName = string.IsNullOrWhiteSpace(cliExe) ? YoloCliExe : cliExe,
            UseShellExecute = false,
            CreateNoWindow = false,
            WorkingDirectory = Path.GetDirectoryName(Path.GetFullPath(dataYamlPath)) ?? ""
        };
        foreach (var arg in YoloDatasetBuilder.BuildTrainArguments(dataYamlPath, model, epochs, imgsz, batch, device))
            startInfo.ArgumentList.Add(arg);
        try
        {
            var process = Process.Start(startInfo);
            return process == null
                ? (false, "train process not started", null)
                : (true, YoloDatasetBuilder.BuildTrainCommand(dataYamlPath, model, epochs, imgsz, batch, device), process);
        }
        catch (Exception ex)
        {
            return (false, ex.Message, null);
        }
    }

    /// <summary>Per-step readiness. 1:1 flow_get_step_summary (isRecording supplied by the recorder).</summary>
    public static StepSummary FlowGetStepSummary(string? projectPath, bool hasSegment, bool hasFrames, bool isRecording) =>
        new(true, isRecording ? "recording" : "idle", !string.IsNullOrEmpty(projectPath) && hasSegment, hasFrames, false, false, false);

    private static List<string> ListXmlIds(string dir) =>
        Directory.EnumerateFiles(dir, "*" + VocExtension).Select(p => Path.GetFileNameWithoutExtension(p)).ToList();
}
