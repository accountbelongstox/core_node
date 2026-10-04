// PY-REF: pyapps/d3-check/d3utils/yolo_train_flow.py
namespace DotCore.VocAnnotator;

/// <summary>
/// Removes images without an annotation (JSON or VOC) and annotations without an image.
/// 1:1 Python flow4_clean_unlabeled (GameAISDK yolo_label_lib clean_unlabeled), extended to the JSON annotation files.
/// </summary>
public static class AnnotationCleanup
{
    public sealed record Result(int RemovedImages, int RemovedAnnotations);

    public static Result RemoveUnpaired(string imagesDir, string? annotationDir = null)
    {
        annotationDir = string.IsNullOrWhiteSpace(annotationDir) ? imagesDir : annotationDir;
        if (!Directory.Exists(imagesDir) || !Directory.Exists(annotationDir))
            throw new DirectoryNotFoundException(Directory.Exists(imagesDir) ? annotationDir : imagesDir);
        var images = AnnotationIo.ListImages(imagesDir);
        var imageStems = new HashSet<string>(images.Select(Path.GetFileNameWithoutExtension)!, StringComparer.Ordinal);
        int removedImages = 0, removedAnnotations = 0;
        foreach (var img in images.Where(i => !AnnotationIo.HasAnnotation(i, annotationDir)))
        {
            File.Delete(img);
            removedImages++;
        }
        foreach (var ext in new[] { AnnotationIo.JsonExtension, AnnotationIo.XmlExtension })
        {
            foreach (var file in Directory.EnumerateFiles(annotationDir, "*" + ext).ToList())
            {
                if (imageStems.Contains(Path.GetFileNameWithoutExtension(file)) || !AnnotationIo.IsAnnotationFile(file)) continue;
                File.Delete(file);
                removedAnnotations++;
            }
        }
        return new Result(removedImages, removedAnnotations);
    }
}
