namespace DotCore.YoloTrain;

/// <summary>Why a value was recommended or what the environment lacks. The app maps each code to an i18n text with a {value} placeholder.</summary>
public enum TrainAdviceCode
{
    NoPython,
    NoUltralytics,
    NoYoloCli,
    TorchCpuOnlyWithNvidiaGpu,
    DeviceCuda,
    DeviceMps,
    DeviceCpu,
    ModelScale,
    BatchFromGpuMemory,
    BatchFromSystemMemory,
    Workers,
    CacheRam,
    CacheOff,
    AmpOn,
    AmpOff,
    EpochsForDatasetSize,
    SmallDataset,
    RareClass,
    UnknownLabels,
    NoValidation,
    ImgszSmallObjects,
}

public sealed record TrainAdvice(TrainAdviceCode Code, string Value, bool IsWarning);

public sealed record TrainRecommendation(YoloTrainParameters Parameters, IReadOnlyList<TrainAdvice> Advice);

/// <summary>
/// Recommends training parameters from the probed environment and (optionally) the planned dataset. Settings the advisor has no
/// basis for (optimizer, lr0, seed, close_mosaic, extra arguments) are kept from the current parameters.
/// </summary>
public static class YoloTrainAdvisor
{
    private const double Gib = 1024d * 1024 * 1024;
    private const int MinBatch = 2;
    private const int MaxBatch = 64;
    private const int MaxWorkers = 8;
    private const int RareClassInstances = 10;
    private const int SmallDatasetImages = 50;
    private const int SmallObjectMinImageSide = 1280;
    private const int SmallObjectImgsz = 960;
    private const double GpuUsableShare = 0.7;
    private const double GpuOverheadGib = 0.6;
    private const double CacheRamHeadroomGib = 4;

    /// <summary>Approximate training memory per image at imgsz 640 for each model scale (GiB, AMP on).</summary>
    private static readonly IReadOnlyDictionary<char, double> GibPerImage640 = new Dictionary<char, double>
    {
        ['n'] = 0.16, ['s'] = 0.26, ['m'] = 0.45, ['l'] = 0.68, ['x'] = 1.0,
    };

    public static TrainRecommendation Recommend(YoloEnvironment env, YoloTrainParameters current, YoloDatasetPlan? dataset = null)
    {
        var advice = new List<TrainAdvice>();
        var py = env.Python;
        if (py == null) advice.Add(Warn(TrainAdviceCode.NoPython, string.Join(", ", env.PythonCandidates)));
        else if (!py.HasUltralytics) advice.Add(Warn(TrainAdviceCode.NoUltralytics, py.Executable));
        else if (!py.CanTrain) advice.Add(Warn(TrainAdviceCode.NoYoloCli, py.Executable));

        string device;
        if (env.CudaReady)
        {
            device = "0";
            advice.Add(Info(TrainAdviceCode.DeviceCuda, py!.CudaDevices.FirstOrDefault() ?? env.Gpus.FirstOrDefault()?.Name ?? "0"));
        }
        else if (py?.MpsAvailable == true)
        {
            device = YoloTrainParameters.DeviceMps;
            advice.Add(Info(TrainAdviceCode.DeviceMps, device));
        }
        else
        {
            device = YoloTrainParameters.DeviceCpu;
            advice.Add(env.HasNvidiaGpu && py?.TorchVersion != null
                ? Warn(TrainAdviceCode.TorchCpuOnlyWithNvidiaGpu, env.Gpus[0].Name + " / torch " + py.TorchVersion)
                : Info(TrainAdviceCode.DeviceCpu, env.CpuName));
        }

        bool gpu = device != YoloTrainParameters.DeviceCpu;
        double gpuGib = env.MaxGpuMemoryMb / 1024d;
        double ramGib = env.TotalMemoryBytes / Gib;
        double freeRamGib = (env.AvailableMemoryBytes > 0 ? env.AvailableMemoryBytes : env.TotalMemoryBytes) / Gib;

        char scale = gpu ? (gpuGib >= 8 ? 's' : 'n') : 'n';
        var model = YoloTrainParameters.WithScale(current.Model, scale);
        if (model != current.Model || YoloTrainParameters.Models.Contains(Path.GetFileName(current.Model)))
            advice.Add(Info(TrainAdviceCode.ModelScale, Path.GetFileName(model)));
        char modelScale = YoloTrainParameters.ModelScale(model);

        int imgsz = YoloTrainParameters.NormalizeImgsz(current.Imgsz);
        if (dataset != null && Math.Max(dataset.MaxWidth, dataset.MaxHeight) >= SmallObjectMinImageSide && gpu && gpuGib >= 8 && imgsz < SmallObjectImgsz)
        {
            imgsz = SmallObjectImgsz;
            advice.Add(Info(TrainAdviceCode.ImgszSmallObjects, imgsz.ToString()));
        }
        double sizeFactor = Math.Pow(imgsz / 640d, 2);
        double perImage = GibPerImage640[modelScale] * sizeFactor;

        int batch;
        if (gpu && gpuGib > 0)
        {
            batch = EvenClamp((int)Math.Floor((gpuGib * GpuUsableShare - GpuOverheadGib) / perImage));
            advice.Add(Info(TrainAdviceCode.BatchFromGpuMemory, $"{gpuGib:0.#} GiB -> {batch}"));
        }
        else
        {
            batch = EvenClamp(ramGib < 8 ? 4 : ramGib < 16 ? 8 : 16);
            advice.Add(Info(TrainAdviceCode.BatchFromSystemMemory, $"{ramGib:0.#} GiB -> {batch}"));
        }

        int workers = OperatingSystem.IsWindows() ? env.LogicalCores / 2 : env.LogicalCores - 1;
        workers = Math.Clamp(workers, 0, MaxWorkers);
        if (ramGib < 8) workers = Math.Min(workers, 2);
        advice.Add(Info(TrainAdviceCode.Workers, $"{env.LogicalCores} -> {workers}"));

        string cache = YoloTrainParameters.CacheOff;
        if (dataset != null && dataset.Entries.Count > 0)
        {
            double cacheGib = dataset.Entries.Count * (double)imgsz * imgsz * 3 / Gib;
            if (freeRamGib - CacheRamHeadroomGib > cacheGib * 2)
            {
                cache = YoloTrainParameters.CacheRam;
                advice.Add(Info(TrainAdviceCode.CacheRam, $"{cacheGib:0.##} GiB"));
            }
            else
            {
                advice.Add(Info(TrainAdviceCode.CacheOff, $"{cacheGib:0.##} GiB"));
            }
        }

        bool amp = gpu && device != YoloTrainParameters.DeviceMps;
        advice.Add(Info(amp ? TrainAdviceCode.AmpOn : TrainAdviceCode.AmpOff, amp.ToString()));

        int epochs = current.Epochs, patience = current.Patience;
        if (dataset != null)
        {
            int labeled = dataset.LabeledImages;
            epochs = labeled < 100 ? 150 : labeled < 500 ? 100 : 60;
            patience = Math.Max(20, epochs / 5);
            advice.Add(Info(TrainAdviceCode.EpochsForDatasetSize, $"{labeled} -> {epochs}"));
            if (labeled < SmallDatasetImages) advice.Add(Warn(TrainAdviceCode.SmallDataset, labeled.ToString()));
            foreach (var (cls, n) in dataset.ClassInstances.Where(kv => kv.Value < RareClassInstances))
                advice.Add(Warn(TrainAdviceCode.RareClass, $"{cls}: {n}"));
            if (dataset.UnknownLabels.Count > 0)
                advice.Add(Warn(TrainAdviceCode.UnknownLabels, string.Join(", ", dataset.UnknownLabels.Select(kv => $"{kv.Key} ({kv.Value})"))));
            if (dataset.Summary(YoloSplit.Val).Images == 0)
                advice.Add(Warn(TrainAdviceCode.NoValidation, "0"));
        }

        var parameters = current with
        {
            Model = model,
            Imgsz = imgsz,
            Batch = batch,
            Device = device,
            Workers = workers,
            Cache = cache,
            Amp = amp,
            Epochs = epochs,
            Patience = patience,
        };
        return new TrainRecommendation(parameters, advice);
    }

    private static int EvenClamp(int batch)
    {
        batch = Math.Clamp(batch, MinBatch, MaxBatch);
        return batch - batch % 2;
    }

    private static TrainAdvice Info(TrainAdviceCode code, string value) => new(code, value, false);

    private static TrainAdvice Warn(TrainAdviceCode code, string value) => new(code, value, true);
}
