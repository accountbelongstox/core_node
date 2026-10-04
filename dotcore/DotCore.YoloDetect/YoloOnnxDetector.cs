// PY-REF: none (DOT-only; Python used the Ultralytics runtime)
using System.Text.RegularExpressions;
using DotCore.Foundations;
using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;
using OpenCvSharp;
using OpenCvSharp.Dnn;

namespace DotCore.YoloDetect;

/// <summary>One detection in source-image pixels.</summary>
public sealed record YoloDetection(int ClassId, string ClassName, float Confidence, Rect Box)
{
    public Point Center => new(Box.X + Box.Width / 2, Box.Y + Box.Height / 2);

    /// <summary>Bottom center of the box (an NPC's feet / the floor point to click).</summary>
    public Point BottomCenter => new(Box.X + Box.Width / 2, Box.Y + Box.Height);
}

/// <summary>
/// Ultralytics YOLO detection model exported to ONNX (`yolo export format=onnx`): input [1,3,S,S] RGB 0..1 letterboxed,
/// output [1, 4 + classes, anchors] (cx, cy, w, h, class scores). Class names come from the model's "names" metadata.
/// Thread-safe for concurrent Detect calls (InferenceSession.Run is thread-safe).
/// </summary>
public sealed class YoloOnnxDetector : IDisposable
{
    private const string LogTag = "[YoloOnnxDetector]";
    private const string NamesMetadataKey = "names";
    private const float LetterboxPad = 114f / 255f;
    private static readonly Regex NameEntry = new(@"(\d+)\s*:\s*['""]([^'""]*)['""]", RegexOptions.Compiled);

    private readonly InferenceSession _session;
    private readonly string _inputName;
    private readonly int _inputSize;

    public string ModelPath { get; }

    public IReadOnlyList<string> ClassNames { get; }

    public YoloOnnxDetector(string modelPath)
    {
        ModelPath = modelPath;
        _session = new InferenceSession(modelPath);
        var input = _session.InputMetadata.First();
        _inputName = input.Key;
        var dims = input.Value.Dimensions;
        _inputSize = dims.Length == 4 && dims[3] > 0 ? dims[3] : 640;
        ClassNames = ReadClassNames(_session.ModelMetadata.CustomMetadataMap);
        ColorPrinter.Blue($"{LogTag} Loaded {Path.GetFileName(modelPath)} input={_inputSize} classes=[{string.Join(", ", ClassNames)}]");
    }

    /// <summary>Detect objects in a BGR (or BGRA) image; boxes above the confidence threshold after class-wise NMS.</summary>
    public IReadOnlyList<YoloDetection> Detect(Mat image, float confidence = 0.35f, float iou = 0.45f)
    {
        if (image == null || image.Empty()) return Array.Empty<YoloDetection>();
        var (tensor, scale, padX, padY) = Preprocess(image);
        using var results = _session.Run(new[] { NamedOnnxValue.CreateFromTensor(_inputName, tensor) });
        var output = results.First().AsTensor<float>();
        int channels = output.Dimensions[1];
        int anchors = output.Dimensions[2];
        int classCount = channels - 4;

        var boxes = new List<Rect>();
        var scores = new List<float>();
        var classIds = new List<int>();
        for (int a = 0; a < anchors; a++)
        {
            int bestClass = -1;
            float best = 0f;
            for (int c = 0; c < classCount; c++)
            {
                float s = output[0, 4 + c, a];
                if (s > best) { best = s; bestClass = c; }
            }
            if (best < confidence) continue;
            float cx = (output[0, 0, a] - padX) / scale, cy = (output[0, 1, a] - padY) / scale;
            float w = output[0, 2, a] / scale, h = output[0, 3, a] / scale;
            int x = (int)Math.Round(cx - w / 2), y = (int)Math.Round(cy - h / 2);
            var rect = new Rect(x, y, (int)Math.Round(w), (int)Math.Round(h)).Intersect(new Rect(0, 0, image.Width, image.Height));
            if (rect.Width <= 0 || rect.Height <= 0) continue;
            boxes.Add(rect);
            scores.Add(best);
            classIds.Add(bestClass);
        }

        var detections = new List<YoloDetection>();
        foreach (int cls in classIds.Distinct())
        {
            var idx = Enumerable.Range(0, boxes.Count).Where(i => classIds[i] == cls).ToArray();
            CvDnn.NMSBoxes(idx.Select(i => boxes[i]), idx.Select(i => scores[i]), confidence, iou, out int[] kept);
            foreach (int k in kept)
            {
                int i = idx[k];
                detections.Add(new YoloDetection(cls, cls < ClassNames.Count ? ClassNames[cls] : cls.ToString(), scores[i], boxes[i]));
            }
        }
        return detections.OrderByDescending(d => d.Confidence).ToList();
    }

    /// <summary>Copy of the image with labeled boxes (debug output).</summary>
    public static Mat Annotate(Mat image, IEnumerable<YoloDetection> detections)
    {
        var copy = image.Clone();
        foreach (var d in detections)
        {
            Cv2.Rectangle(copy, d.Box, Scalar.LimeGreen, 2);
            Cv2.PutText(copy, $"{d.ClassName} {d.Confidence:0.00}", new Point(d.Box.X, Math.Max(12, d.Box.Y - 4)),
                HersheyFonts.HersheySimplex, 0.5, Scalar.LimeGreen, 1);
        }
        return copy;
    }

    public void Dispose() => _session.Dispose();

    private (DenseTensor<float> Tensor, float Scale, float PadX, float PadY) Preprocess(Mat image)
    {
        float scale = Math.Min((float)_inputSize / image.Width, (float)_inputSize / image.Height);
        int w = (int)Math.Round(image.Width * scale), h = (int)Math.Round(image.Height * scale);
        float padX = (_inputSize - w) / 2f, padY = (_inputSize - h) / 2f;
        using var bgr = new Mat();
        if (image.Channels() == 4) Cv2.CvtColor(image, bgr, ColorConversionCodes.BGRA2BGR);
        else image.CopyTo(bgr);
        using var resized = new Mat();
        Cv2.Resize(bgr, resized, new Size(w, h));

        var tensor = new DenseTensor<float>(new[] { 1, 3, _inputSize, _inputSize });
        tensor.Buffer.Span.Fill(LetterboxPad);
        int left = (int)Math.Floor(padX), top = (int)Math.Floor(padY);
        var indexer = resized.GetGenericIndexer<Vec3b>();
        for (int y = 0; y < h; y++)
        {
            for (int x = 0; x < w; x++)
            {
                var px = indexer[y, x];
                tensor[0, 0, top + y, left + x] = px.Item2 / 255f;
                tensor[0, 1, top + y, left + x] = px.Item1 / 255f;
                tensor[0, 2, top + y, left + x] = px.Item0 / 255f;
            }
        }
        return (tensor, scale, left, top);
    }

    /// <summary>Ultralytics writes names as a Python dict literal: {0: 'blacksmith', 1: 'stash'}.</summary>
    private static IReadOnlyList<string> ReadClassNames(IReadOnlyDictionary<string, string> metadata)
    {
        if (!metadata.TryGetValue(NamesMetadataKey, out var raw) || string.IsNullOrWhiteSpace(raw)) return Array.Empty<string>();
        return NameEntry.Matches(raw)
            .Select(m => (Id: int.Parse(m.Groups[1].Value), Name: m.Groups[2].Value))
            .OrderBy(e => e.Id)
            .Select(e => e.Name)
            .ToList();
    }
}
