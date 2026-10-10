using System.Formats.Tar;
using System.Text.Json;
using DotCore.Common;
using DotCore.Foundations;

namespace DotCore.Utils.Ocr;

/// <summary>One OCR model choice: id, display name, and (for downloaded ones) the official archives of its detection / recognition models.</summary>
public sealed record OcrModelInfo(string Id, string Name, bool Bundled, string? DetArchiveUrl, string? RecArchiveUrl, long ApproxBytes);

/// <summary>
/// Global CPU OCR model choice shared by every dot app: the PaddleOCRSharp bundled PP-OCRv5 mobile model (fast, default) or the
/// official PP-OCRv5 server model (more accurate, slower on CPU), downloaded from PaddlePaddle's official PaddleX inference model
/// storage into &lt;user data&gt;/ocr_models/&lt;id&gt;/ (det + rec folders of inference.json / inference.pdiparams / inference.yml, the Paddle
/// 3.0 format PaddleOCRSharp 6 loads; the angle classifier stays the bundled one). The selection is stored in selected.json there,
/// so all apps on the machine use the same model; <see cref="Select"/> reloads the OCR engines.
/// </summary>
public static class OcrModelCatalog
{
    public const string BundledId = "pp-ocrv5-mobile";
    public const string ServerId = "pp-ocrv5-server";
    private const string ModelsDirName = "ocr_models";
    private const string SelectionFileName = "selected.json";
    private const string DetDirName = "det";
    private const string RecDirName = "rec";
    private const string ParamsFileName = "inference.pdiparams";
    private const string ArchiveSuffix = ".tar";
    private const string PartialSuffix = ".part";
    private const string LogTag = "[OcrModels]";
    private const string OfficialBase = "https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/";
    private const int CopyBufferBytes = 1 << 16;
    private static readonly TimeSpan DownloadTimeout = TimeSpan.FromMinutes(30);

    public static readonly IReadOnlyList<OcrModelInfo> Models = new[]
    {
        new OcrModelInfo(BundledId, "PP-OCRv5 mobile", true, null, null, 0),
        new OcrModelInfo(ServerId, "PP-OCRv5 server", false, OfficialBase + "PP-OCRv5_server_det_infer.tar", OfficialBase + "PP-OCRv5_server_rec_infer.tar", 173_000_000),
    };

    /// <summary>Raised after the selection changed and the engines were reset.</summary>
    public static event Action? SelectionChanged;

    public static string ModelsDir => Path.Combine(AppPaths.GetUserDataDirectory(), ModelsDirName);

    public static string ModelDir(string id) => Path.Combine(ModelsDir, id);

    public static OcrModelInfo? Find(string? id) => Models.FirstOrDefault(m => m.Id == id);

    public static bool IsInstalled(string id) =>
        Find(id) is { } m && (m.Bundled || (File.Exists(Path.Combine(ModelDir(id), DetDirName, ParamsFileName)) && File.Exists(Path.Combine(ModelDir(id), RecDirName, ParamsFileName))));

    /// <summary>Selected model id; the bundled model when nothing (or a model no longer installed) is selected.</summary>
    public static string SelectedId
    {
        get
        {
            try
            {
                string path = Path.Combine(ModelsDir, SelectionFileName);
                if (File.Exists(path) && JsonSerializer.Deserialize<Selection>(File.ReadAllText(path)) is { Id: { } id } && IsInstalled(id)) return id;
            }
            catch (Exception ex) when (ex is IOException or JsonException or UnauthorizedAccessException)
            {
                ColorPrinter.Yellow($"{LogTag} selection not readable: {ex.Message}");
            }
            return BundledId;
        }
    }

    /// <summary>(det, rec) folders of the selected downloaded model; null for the bundled model.</summary>
    public static (string Det, string Rec)? SelectedModelDirs()
    {
        string id = SelectedId;
        return Find(id) is { Bundled: false } ? (Path.Combine(ModelDir(id), DetDirName), Path.Combine(ModelDir(id), RecDirName)) : null;
    }

    /// <summary>Use an installed model for every app on this machine and reload the OCR engines. False when it is not installed.</summary>
    public static bool Select(string id)
    {
        if (!IsInstalled(id)) return false;
        Directory.CreateDirectory(ModelsDir);
        File.WriteAllText(Path.Combine(ModelsDir, SelectionFileName), JsonSerializer.Serialize(new Selection { Id = id }));
        OcrEngineRegistry.Instance.Reset();
        ColorPrinter.Blue($"{LogTag} OCR model -> {id}");
        SelectionChanged?.Invoke();
        return true;
    }

    /// <summary>Download and unpack a model's official archives (det, rec); progress 0..1 over both. Idempotent (installed = no-op).</summary>
    public static async Task DownloadAsync(string id, IProgress<double>? progress = null, CancellationToken ct = default)
    {
        if (Find(id) is not { Bundled: false, DetArchiveUrl: { } det, RecArchiveUrl: { } rec } || IsInstalled(id)) return;
        using var http = new HttpClient { Timeout = DownloadTimeout };
        string dir = ModelDir(id);
        Directory.CreateDirectory(dir);
        var parts = new[] { (Url: det, Name: DetDirName), (Url: rec, Name: RecDirName) };
        for (int i = 0; i < parts.Length; i++)
        {
            int index = i;
            var partProgress = new Progress<double>(p => progress?.Report((index + p) / parts.Length));
            string archive = Path.Combine(dir, parts[i].Name + ArchiveSuffix);
            await DownloadFileAsync(http, parts[i].Url, archive, partProgress, ct).ConfigureAwait(false);
            Unpack(archive, Path.Combine(dir, parts[i].Name));
            File.Delete(archive);
        }
        progress?.Report(1);
        ColorPrinter.Green($"{LogTag} {id} installed in {dir}");
    }

    private static async Task DownloadFileAsync(HttpClient http, string url, string target, IProgress<double> progress, CancellationToken ct)
    {
        string partial = target + PartialSuffix;
        using (var response = await http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct).ConfigureAwait(false))
        {
            response.EnsureSuccessStatusCode();
            long total = response.Content.Headers.ContentLength ?? 0;
            await using var source = await response.Content.ReadAsStreamAsync(ct).ConfigureAwait(false);
            await using var file = File.Create(partial);
            var buffer = new byte[CopyBufferBytes];
            long done = 0;
            int read;
            while ((read = await source.ReadAsync(buffer, ct).ConfigureAwait(false)) > 0)
            {
                await file.WriteAsync(buffer.AsMemory(0, read), ct).ConfigureAwait(false);
                done += read;
                if (total > 0) progress.Report((double)done / total);
            }
        }
        File.Move(partial, target, true);
    }

    /// <summary>Unpack the archive's single top folder (e.g. PP-OCRv5_server_det_infer/) into target (TarFile rejects entries outside it).</summary>
    private static void Unpack(string archive, string target)
    {
        string temp = target + PartialSuffix;
        if (Directory.Exists(temp)) Directory.Delete(temp, true);
        Directory.CreateDirectory(temp);
        TarFile.ExtractToDirectory(archive, temp, overwriteFiles: true);
        string root = Directory.GetDirectories(temp) is [var only] && Directory.GetFiles(temp).Length == 0 ? only : temp;
        if (Directory.Exists(target)) Directory.Delete(target, true);
        Directory.Move(root, target);
        if (Directory.Exists(temp)) Directory.Delete(temp, true);
    }

    private sealed class Selection
    {
        public string? Id { get; set; }
    }
}
