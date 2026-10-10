# YOLO Task-Set Synthesis (specific training mode) — Design Requirements

Binding design for the second YOLO training mode. Related: [DOT_ARCHITECTURE.md](../../development-guides/DOT_ARCHITECTURE.md), [DESIGN.md](../DESIGN.md), d3d4tester [VOC_RECORDING_AND_ANNOTATOR_SPEC.md](../../dotapps/d3d4tester/docs/VOC_RECORDING_AND_ANNOTATOR_SPEC.md).

## 0. Source requirement (user, verbatim)

> 现在有两种训练模型，1种是通用，另一种是特定。第二种方式为了减少数据集的采集，先添加 1,2,3 多个需要识别的目录，每个目标可以添加 1.1 1.2 等小图作为各种 1 款的变体，可以针对 1 添加一些特定的场景大图，之后添加一个公共的特定的视频集、或图集，这些就是一个任务集，可以有多个任务集包含上面的，之后任务集可以调整增删改查，一键训练先生成数据集再训练。生成的数据集就是 1 条目中的所有 1.1 1.2 1.x 并集特定场景资源 + 公共资源，以预设的拉伸、旋转、放大、缩小、左拉伸（这些可以针对一个 1 条目单独设置，没有单独设置的应用全局）之后与所有场景资源生成训练数据，图片由合并图片、视频可以按 yolo 支持的方式插入或提取帧。数据标注自动完成。最后训练生成。

## 1. Two training modes

| Mode | Data | Labels | Entry |
|------|------|--------|-------|
| General (通用) | Recorded segments (`{project}/{segment}/frames`) | Manual / AI pre-label in the annotator | Calibration tab → Train → source "General" |
| Specific (特定) | A **task set**: target variant crops pasted onto scene / common backgrounds | Automatic (paste geometry) | Calibration tab → Task sets → One-click train, or Train → source "Specific" |

Both modes end in the same Ultralytics dataset layout and the same training run (`YoloTrainingService` → `YoloTrainRunner` → optional ONNX export), so the result (`best.pt`, `best.onnx`) is used identically (town navigation, AI pre-label).

### 1.1 Video and live recognition (补充需求)

> 同加入 yolo 是否可以识别动态视频？

Yes: YOLO detects per frame, so video files, camera and live screen regions are supported by running the detector on each frame; Ultralytics `predict` accepts video/stream sources and `track` adds multi-object tracking (ByteTrack / BoT-SORT). Required capability (design and implementation follow the review in §10): detection on video files and live screen regions from the C# runtime (`DotCore.YoloDetect`), stable track IDs with temporal smoothing, ROI / tiling for small objects on large screens, FPS reporting, a model test UI, and exporting detected frames as new labeled data for retraining.

## 2. Concepts

- **Task set (任务集)**: self-contained folder with `taskset.json` and its imported resources. Many task sets may exist; full CRUD (create, rename, duplicate, delete, edit contents).
- **Target (目标, "1", "2", "3")**: one detection class. Name = YOLO class name; order in the task set = class id.
- **Variant (变体, "1.1", "1.2", …)**: a small image of the target (crop / icon / sprite). PNG alpha is honored as the object mask; images without alpha are pasted as full rectangles.
- **Target scene (特定场景)**: large background images belonging to one target (where that target normally appears). Used as backgrounds for that target.
- **Common resources (公共资源)**: background images and videos of the task set shared by all targets. Videos contribute frames (YOLO trains on images only; video is supported by Ultralytics for prediction, not training, so frames are extracted).
- **Augmentation profile (增强)**: stretch (拉伸, aspect change), rotation (旋转), zoom in / out (放大/缩小, scale range), left stretch (左拉伸, one-sided horizontal perspective; right stretch is the mirrored option), plus flip, brightness/contrast, blur, edge feather. The task set holds the **global** profile; a target may override any single field (unset field = global).

### 2.1 Variant extraction (补充需求)

> 补充一点，每个小 1.1 1.2 也是从大图或视频中提取，补充这个 UI 界面和添加流程。

Variants are added either as ready-made files or **extracted** from a large image or a video frame:

1. Open the extractor from a target's Variants tab (or from a scene / common resource: "extract variants from this resource").
2. Pick the source: the target's scenes, the task set's common resources, or any external image / video file.
3. Video: choose the frame with a slider, prev/next frame and ±10 buttons (frame index + time).
4. Draw one or more rectangles on the frame (same canvas as the annotator: zoom, pan, move, resize).
5. Cutout mode: **Rectangle** (opaque crop) or **Smart cutout** (OpenCV GrabCut initialised by the rectangle → alpha mask, cleaned and feathered, cropped to the alpha bounds) so the pasted variant carries no source background.
6. Pending crops are previewed; "Add as variants" stores each as PNG under the target (`label` continues `n.x`, `original_path` = `source#frame=N@x,y,w,h`).

Background content rule: scene and common images should not contain unlabeled instances of the targets (they would teach the model that the target is background). Only paste geometry produces labels.

## 3. Storage

Root: `{YOLO_DATA_ROOT}/_tasksets/` (`TaskSetStore.DefaultRoot`; `_` prefix = reserved, not a project or segment).

```
_tasksets/{task_set_id}/
  taskset.json
  targets/{target_id}/variants/{file}
  targets/{target_id}/scenes/{file}
  common/{file}                      (images and videos)
  _cache/frames/{resource_id}/...    (extracted video frames, rebuilt on demand)
  _datasets/{yyyyMMdd_HHmmss}/       (generated datasets)
  _runs/{yyyyMMdd_HHmmss}/           (training runs, weights/best.pt, best.onnx)
```

Resources are **copied** into the task set on add (portable, survives deleted sources); the original path is kept for reference. Ids are short random hex strings; file names are sanitized and made unique.

`taskset.json` (snake_case, System.Text.Json; unknown keys preserved is not required):

```json
{
  "id": "a1b2c3d4", "name": "town_npc", "description": "",
  "created_utc": "...", "updated_utc": "...",
  "targets": [
    { "id": "t1", "name": "blacksmith",
      "variants": [ { "id": "r1", "kind": "image", "file": "targets/t1/variants/front.png", "original_path": "...", "label": "1.1" } ],
      "scenes":   [ { "id": "r2", "kind": "image", "file": "targets/t1/scenes/town.jpg", "original_path": "..." } ],
      "augmentation": { "rotation_max_degrees": 5 },
      "images_per_target": null }
  ],
  "common_resources": [ { "id": "r9", "kind": "video", "file": "common/run.mp4", "original_path": "..." } ],
  "augmentation": { "scale_min": 0.7, "scale_max": 1.3, "stretch_min": 0.9, "stretch_max": 1.1,
                    "rotation_max_degrees": 8, "left_stretch_max": 0.15, "right_stretch_max": 0.0,
                    "flip_horizontal": false, "brightness_max": 0.15, "contrast_max": 0.15,
                    "blur_probability": 0.15, "blur_max_kernel": 3, "edge_feather": 1.0 },
  "synthesis": { "images_per_target": 200, "val_percent": 20, "seed": 42,
                 "min_objects_per_image": 1, "max_objects_per_image": 3, "cross_target_probability": 0.3,
                 "negative_percent": 8, "max_overlap_iou": 0.3, "min_visible_fraction": 0.75,
                 "scale_mode": "native", "relative_min": 0.05, "relative_max": 0.25,
                 "output_max_side": 1280, "jpeg_quality": 92,
                 "video_frame_interval": 30, "video_max_frames": 300 }
}
```

## 4. Generation algorithm (`TaskSetSynthesizer.Generate`)

Deterministic for a given task set + seed (each job has its own seed; jobs render in parallel, `ProcessorCount − 1`).

1. **Validate** (`Validate` / `ValidateDetailed`). Errors (block): `NoTargets`, `EmptyTargetName`, `DuplicateTargetName`, `NoVariants`, `NoBackgrounds`. Warnings: `UnreadableResource`, `ResourceTooLarge` (> `max_resource_pixels`, skipped), `NoCommonResources`, `FewBackgrounds` (< 5), `NoValBackground`, `NativeScaleJitterLarge` (native size jitter > ±10 %), `UnknownBoxLabel`, `InvalidRegion`, `VariantWithoutAlpha`, `HoldoutUnreadable`. With `contamination_check` (no errors): every variant is template-matched (≥ `contamination_threshold`) over scenes, common images and `contamination_video_frames` sampled frames per video → `BackgroundContainsTarget` + `ContaminationHit` (cache `_cache/contamination.json`). Sizes come from file headers.
2. **Backgrounds**: target scenes, common images, common videos → frames every `video_frame_interval` up to `video_max_frames` (cache `_cache/frames/{id}`). Split group = resource id (all frames of a video share it). Decoded through an LRU cache (`background_cache_size`); relative mode downscales to `output_max_side`, native mode keeps full resolution.
3. **Split** (stable hash, S14): a group goes to val when FNV(seed | group) < `val_percent`; adding a group never moves others. A single-group pool stays train-only; with ≥ 2 groups both splits get one. Targets without any val background generate their val jobs as train (`NoValBackground`, manifest `val_jobs_moved_to_train`). Variants with `val_only` serve val only.
4. **Jobs**: per target `n = images_per_target` (target override or global), val = round(n · val %) clamped to [1, n − 1]; negatives = positives · neg % / (100 − neg %), drawn from common ∪ all scenes.
5. **Render** one job:
   - background: random from the job's split pool (target: own scenes ∪ common); unreadable ones are skipped;
   - native: a `native_window_width × native_window_height` window cut at full resolution (S2); with placement regions the window always contains a region point; relative: the whole (downscaled) background;
   - resource boxes: a target label ≥ `min_visible_fraction` inside → real positive plus occupancy; `mask` or unknown label → inpainted (Telea);
   - objects k ∈ [min, max]; first = job target, each further one another target with `cross_target_probability`;
   - size: relative = background short side × U(`relative_min`, `relative_max`) × profile scale; native = background `pixel_scale` / variant `pixel_scale` × profile scale; with `dpi_steps` = ratio × random step × U(1 ± `scale_jitter`) (profile scale ignored); objects larger than the image are fitted to 95 % (Area);
   - augmentation (`VariantAugmenter`, premultiplied float BGRA): flip, scale × stretch (Nearest upscale for icons ≤ 64 px), one-sided perspective, expanded rotation, crop to alpha, contrast / brightness, blur (skipped below 24 px short side), feather min(`edge_feather`, 4 % of short side; none for soft-alpha variants);
   - placement: with regions, `in_region_probability` → the first 25 attempts inside a region (snapped to the region's pitch grid), else uniform; truncation keeps ≥ `min_visible_fraction` of the mask pixels; label IoU with placed labels ≤ `max_overlap_iou`; occlusion (S7): every earlier labeled object keeps ≥ `min_visible_fraction` of its mask pixels (occupancy masks), occluded labels are re-tightened; 50 attempts, else skipped;
   - label = tight bounds of mask pixels ≥ 25 % opacity, clipped; dropped below 4 px;
   - distractors (S10): with `distractor_probability`, 1..`max_distractors_per_image` unlabeled pastes (global profile, same occlusion rules);
   - a positive job without a placeable object is written as a negative.
6. **Holdout**: annotated real images of `holdout_sources` are copied as `real_*` into val, or test with `holdout_split = test` (data.yaml then lists test).
7. **Write** into `{out}.partial`, renamed on success (a non-empty output dir is rejected): PNG (default) or JPEG (quality U[`jpeg_quality_min`, `jpeg_quality`]); failed jobs are skipped and counted; `data.yaml`; `synthesis_manifest.json` (settings, `inference`, resolved augmentation per target, counts per split / class, planned negatives, moved val jobs, failed stems, holdout, distractors, background splits / uses, warnings); 6 `previews/*.jpg`.
8. **Inference info** (§11): `SynthesisInferenceInfo` (scale mode, window = largest written image, background min / max side, min / max object side, `tile_overlap` = 2 × max object side, `roi_hint`) → manifest `inference` and `SynthesisResult.Inference`.
9. **Progress / cancel**: `IProgress<SynthesisProgress>` and `CancellationToken` per image (preview: per extracted video).

### Augmentation definitions (per object)

| Field | Effect |
|-------|--------|
| `scale_min`/`scale_max` | uniform zoom out / in factor |
| `stretch_min`/`stretch_max` | width multiplier (height unchanged) — 拉伸 |
| `rotation_max_degrees` | rotation uniform in ±value, canvas expanded so nothing is cut |
| `left_stretch_max` | perspective: left edge height × (1 + U(0, value)) — 左拉伸 |
| `right_stretch_max` | same on the right edge |
| `flip_horizontal` | 50 % mirror |
| `brightness_max`/`contrast_max` | ±value jitter |
| `blur_probability`/`blur_max_kernel` | Gaussian blur (odd kernel ≤ max; skipped below 24 px short side) |
| `edge_feather` | mask edge blur sigma in px, capped at 4 % of the short side; 0 for soft-alpha variants |

Override resolution: `AugmentationProfile.Resolve(AugmentationOverride?)` — each null field takes the global value.

## 5. Training integration

- `YoloTrainingService.RunAsync(YoloTrainingJob)`: the job carries a dataset-build delegate, parameters, CLI path, runs dir and export flag. General mode builds with `YoloDatasetAssembler`; specific mode with `TaskSetSynthesizer` into `{task_set}/_datasets/{stamp}`, runs in `{task_set}/_runs/{stamp}`.
- `YoloTrainingWindow`: dataset source **General / Specific**; specific shows the task set picker, its targets / resource counts, validation result and a "Manage task sets" button; training parameters, environment detection and recommendations are shared by both modes.
- One-click train (task set window): `YoloTrainingWindow.ShowForTaskSet(owner, taskSetId, autoStart: true)` — opens the training window in specific mode and starts after the environment check.

## 6. Task-set manager UI (d3d4tester `Windows/TaskSetWindow`)

- Left: task set list (create, rename, duplicate, delete with confirm; description).
- Center: targets of the selected set (add, rename, delete, move up/down = class order) and, for the selected target, tabs **Variants** (thumbnails, add files / folder, remove, label "1.x"), **Scenes** (thumbnails, add, remove), **Augmentation** (each field with "inherit global" checkbox), images-per-target override.
- Variant extractor window (`Windows/VariantExtractWindow`, §2.1): source picker, frame navigation, multi-rectangle drawing on the shared `AnnotationCanvas`, Rectangle / Smart cutout, pending crop previews, add as variants.
- Common resources: images and videos list (add files / folder, remove; video shows frame count estimate).
- Global augmentation and synthesis settings editor.
- Validate (issues list), **Preview** (renders one synthetic sample with boxes via `TaskSetSynthesizer.RenderPreview`), **Generate dataset only**, **One-click train**.
- Every user-facing text via i18n (`ui.yolo_taskset.*`, zh + en), theme styles only, config keys only for UI state (`yolo_taskset.last_task_set`).

## 7. Library placement and API contract

`dotcore/DotCore.YoloTaskSet` (net8.0-windows, OpenCvSharp4.Windows; depends on Foundations, VocAnnotator, YoloTrain), `dotcore/DotCore.YoloDetect` (ONNX Runtime + OpenCvSharp), `dotcore/DotCore.YoloTrain` (net8.0, Ultralytics process driver). App glue: d3d4tester `Services/YoloTrainingService.cs`.

### 7.1 DotCore.YoloTaskSet

```csharp
// Model (taskset.json, snake_case)
enum TaskResourceKind { Image, Video }
class TaskResource { Id; Kind; File; OriginalPath; Label; double PixelScale /*DPI factor*/; bool ValOnly /*variant: val only*/;
    List<PlacementRegion>? Regions /*background*/; List<ResourceBox>? Boxes /*background objects | variant parts (§12)*/;
    int SourceWidth, SourceHeight /*variant source frame*/; double EffectivePixelScale; bool HasSourceSize; bool IsCompound; }
class SegmentSource { SegmentDir; bool Backgrounds; bool RealImages; int FrameStep; }        // §12, shared in place
static class TargetPlacement { Anywhere = "anywhere"; Source = "source"; }
class PixelRect { X, Y, Width, Height; bool IsEmpty; PixelRect? ClampTo(int w, int h); }
class PlacementRegion : PixelRect { int SnapPitchX, SnapPitchY; }          // slot grid from the region origin
class ResourceBox : PixelRect { string Label; bool Mask; }                 // real positive, or inpainted when Mask / unknown label
class HoldoutSource { ImagesDir; AnnotationDir; }                          // real annotated eval images
class InferenceRoiHint { Anchor bottom|top|left|right|rect; BandPixels = 48; PixelRect? Rect; PixelRect? Resolve(int w, int h); }
class AugmentationProfile { ScaleMin/Max, StretchMin/Max, RotationMaxDegrees, LeftStretchMax, RightStretchMax, FlipHorizontal,
    BrightnessMax, ContrastMax, BlurProbability, BlurMaxKernel, EdgeFeather; Clone(); Resolve(AugmentationOverride?); Normalized(); }
class AugmentationOverride { same fields nullable; bool IsEmpty; }
class SynthesisSettings { §3 fields + NativeWindowWidth/Height (640), DpiSteps, ScaleJitter, InRegionProbability, DistractorProbability,
    MaxDistractorsPerImage, OutputFormat png|jpg, JpegQualityMin, MaxResourcePixels, BackgroundCacheSize, ContaminationCheck,
    ContaminationThreshold, ContaminationVideoFrames, HoldoutSplit val|test, RelativeSizing range|source, SegmentBlockFrames;
    IsNative; UsesDpiSteps; SizesFromSource; Clone(); Normalized(); }
class TaskTarget { Id; Name; Variants; Scenes; AugmentationOverride? Augmentation; int? ImagesPerTarget; Placement; PlacementJitter; }
class TaskSet { Id; Name; Description; CreatedUtc; UpdatedUtc; Targets; CommonResources; Distractors; HoldoutSources; SegmentSources;
    InferenceRoiHint? InferenceRoiHint; AugmentationProfile Augmentation; SynthesisSettings Synthesis; ClassNames; }
enum TaskSetIssueCode { NoTargets, EmptyTargetName, DuplicateTargetName, NoVariants, NoBackgrounds, UnreadableResource, NoCommonResources,
    FewBackgrounds, SingleBackgroundShared /*legacy*/, NoValBackground, BackgroundContainsTarget, ResourceTooLarge, NativeScaleJitterLarge,
    UnknownBoxLabel, HoldoutUnreadable, InvalidRegion, VariantWithoutAlpha, SegmentUnreadable, PlacementSourceUnknown }
record TaskSetIssue(Code, Subject, IsError); record TaskSetValidation(Issues, Hits); record SynthesisProgress(Done, Total);
record SynthesisInferenceInfo(ScaleMode, WindowWidth, WindowHeight, BackgroundMinSide, BackgroundMaxSide, MaxObjectSide, MinObjectSide, TileOverlap, RoiHint);
record SynthesisResult(DatasetDir, DataYamlPath, Classes, TrainImages, ValImages, NegativeImages, Instances, Warnings, Inference, HoldoutImages, FailedJobs,
    RealImages);   // Train / Val include the real segment frames
record TaskSetEstimate(Classes, TrainImages, ValImages, NegativeImages, HoldoutImages, ImageWidth, ImageHeight, MaxImageSide, MaxObjectSide, ScaleMode,
    RealTrainImages, RealValImages);
record ContaminationHit(ResourceId, ResourceFile, Frame, TargetId, TargetName, VariantId, X, Y, Width, Height, Score);
record PreviewBox(Label, XMin, YMin, XMax, YMax); record PreviewResult(byte[] Png, IReadOnlyList<PreviewBox> Boxes);

// Store (every mutator saves once)
sealed partial class TaskSetStore {
    static DefaultRoot; RootDir; List(); Load(id); Create(name); Save(set); Delete(id); Duplicate(id, newName); static Clone(set) /*snapshot*/;
    GetDir(id); ResourcePath(set, r); static ResolveResourcePath(dir, r); static FrameCacheDir(dir, resourceId);
    AddTarget; MoveTarget(set, targetId, delta); AddVariant; AddVariantFromPng(set, target, png, originalPath, nameHint); AddScene; AddCommon;
    AddDistractor; AddDistractorFromPng; static IsSupportedImage/IsSupportedVideo/IsSupportedFor(pool, path)/PoolNeedsTarget(pool)/IsReadableImage (header only);
    AddMany(set, target?, pool, paths, progress, ct) → ImportFileResult[]          // bulk add, per-file outcome, one save
    PlanFolderTree(set, root) / ImportFolderTree(set, root, dryRun, ...)        // subfolder = target, scenes/, common/, distractors/
    CopyTargets(fromSet, targetIds, toSet)                                        // merge by name
    AddVariantsFromAnnotations(set, imagesDir, annotationDir, classFilter, cutout, cutOptions, ..., AnnotationVariantOptions?)   // annotated boxes → variants
    AddSegmentSources(set, dirs) / RemoveSegmentSources / static ResolveSegmentDir / SegmentFramesDir / ScanSegment / AddVariantsFromSegments   // §12
record AnnotationVariantOptions(FrameStep, MinHashDistance, MaxPerLabel, MinSide, GroupLabels?, GroupRegion?);   // dedupe, compound group crops
    string? RemoveTarget / RemoveResource / RemoveResources → undo token;  bool Restore(set, token);  ListTrash(set);  PurgeTrash(set, keepLatest);  // _trash/
}
enum TaskResourcePool { Variants, Scenes, Common, Distractors }

// Synthesis
static partial class TaskSetSynthesizer {
    Validate(set, dir[, progress, ct]); ValidateDetailed(set, dir, progress, ct) → TaskSetValidation;
    FindContamination(set, dir, progress, ct); ToIssue(ContaminationHit);
    Generate(set, dir, outputDir, progress, ct) → SynthesisResult;
    RenderPreview(set, dir, seed[, targetId, progress, ct]);                     // cached context until set / files change
    RenderAugmentationGrid(set, dir, targetId, count, seed) → PNG;               // per-target augmentation on checkerboard
    Estimate(set, dir?) → TaskSetEstimate;                                        // planned counts / sizes, no rendering
    ReadInferenceInfo(datasetDir) → SynthesisInferenceInfo?;                     // manifest "inference"
}
static class VariantAugmenter { (Mat Bgra, Mat Mask) Apply(bgra, profile, extraScale, rng[, fixedScale]); }

// Extraction
record struct VariantRegion(X, Y, Width, Height); enum VariantCutout { Rectangle, GrabCut, ColorKey };
record VariantCutOptions(ColorKeyTolerance = 24, VariantMaskHints? Hints, ColorKeyHoles = true);
record VariantMaskHints(Strokes, Mat? Mask); record VariantStroke(Kind fg|bg, Points, Thickness);   // GrabCut retouch
record VideoInfo(FrameCount, Fps, Width, Height); record VariantAlphaInfo(HasTransparency, UniformBorder, BorderB/G/R); record WorkProgress(Done, Total, Item);
static partial class VariantExtractor {
    IsVideo; GetVideoInfo; LoadFramePng; Cut(path|Mat, frame, region, mode, options) → PNG; CutMat;
    FormatSourceRef / TryParseSourceRef("path[#frame=N]@x,y,w,h"); HasTransparency; InspectAlpha(Mat|path);
    Track(path|reader, startFrame, region, step, maxCount, direction, ct, progress, tracker Auto|Csrt|Kcf|Template, minConfidence) → TrackResult;
    FixedBox(region, first, last, every) ; PerceptualHash(Mat|bytes); HashDistance; Dedupe(hashes, minDistance);   // dHash dedupe
}
record TrackedRegion(FrameIndex, Region, Confidence); record TrackResult(Regions, Tracker, Lost, Recoveries);
sealed class VideoFrameReader : IDisposable { (path, cacheCapacity = 8); IsVideo; Info; ReadBgr/ReadBgra/ReadPng(frame); }   // one open decoder, LRU frames
static class VideoFrameExtractor { EstimateFrames(path, interval, max); ExtractToCache(path, cacheDir, interval, max, ct); }   // marker _frames.json
```

### 7.2 DotCore.YoloDetect

```csharp
record YoloDetection(ClassId, ClassName, Confidence, Rect Box) { Center; BottomCenter; }
record struct YoloDetectTiming(PreMs, InferMs, PostMs, Passes); record YoloDetectionResult(Detections, Timing);
enum YoloScaleMode { Relative, Native }; enum YoloExecutionProvider { Cpu, Auto, Cuda, DirectML }
record YoloDetectorOptions(Provider = Cpu, IntraOpThreads = 0, WarmUp = true, DeviceId = 0) { static ParseProvider(string); }
record YoloInferenceProfile(ScaleMode, TileWidth, TileHeight, TileOverlap = -1, Rect? Roi, Confidence = 0.35, Iou = 0.45) {
    static FromInference(JsonObject?); static ParseScaleMode; ResolveRoi(w, h); static ResolveRegion(roi, w, h); }   // §11
sealed class YoloOnnxDetector : IDisposable {        // thread-safe; [1,4+C,N], transposed or end2end [1,N,6]; names / imgsz from metadata
    (modelPath, options); ModelPath; ClassNames; InputWidth; InputHeight; ExecutionProvider; Options; ClassName(id);
    Detect(image[, roi], conf, iou); DetectTiled(image, tileW, tileH, overlap, roi, conf, iou); Detect(image, profile); DetectTimed(image, profile);
    static Annotate(image, detections | tracks); }
sealed class YoloModelHost : IDisposable {           // one session per (path, write time, options); never picks a model
    static Shared; DefaultOptions; MaxIdle = 1; Changed; Loaded; Acquire(path, options) → YoloModelLease; TryAcquire(resolver, options); Trim(); }
sealed class YoloModelLease : IDisposable { Detector; ModelPath; ModelWriteUtc; IsStale /*file re-exported*/; }
record YoloTrackerOptions(MatchIou = 0.3, MinHits = 3, MaxMisses = 15, HighConfidence = 0.5, LowConfidence = 0.1, PerClass = true, Smoothing = 0.6, MaxCenterShift = 1.0);
record YoloTrack(TrackId, ClassId, ClassName, Confidence, Box, Hits, Misses, Age);
sealed class YoloFrameTracker { Options; Tracks; Reset(); Update(detections) → confirmed tracks; }   // ByteTrack-lite, constant velocity
record YoloVideoOptions(FrameStep = 1, StartFrame, EndFrame = -1, Profile, Track = true, Tracker);
record YoloVideoFrame(FrameIndex, Timestamp, Image, Detections, Tracks, InferenceMs, Timing);
sealed class YoloVideoDetector { (detector); IEnumerable<YoloVideoFrame> Run(path, options, ct); }   // lazy, one session
record YoloLiveOptions(TargetFps = 10, Profile, Track = true, Tracker);
record LiveDetectionFrame(Sequence, TimestampUtc, Image, Detections, Tracks, Fps, LatencyMs, CaptureMs, InferenceMs, Timing);
sealed class YoloLiveDetector : IDisposable { (detector, Func<Mat?> frameProvider, options); Options; IsRunning; FrameProcessed; Faulted; Start(); Stop(); ResetTracks(); }
```

### 7.3 DotCore.YoloTrain

```csharp
record YoloTrainParameters { Model, Epochs, Imgsz, Batch, Device, Workers, Patience, Cache, Amp, Optimizer, Lr0, Seed, CloseMosaic, ExtraArguments,
    YoloAugmentation Augmentation; static ManagedKeys /*extra args cannot override*/; NormalizeImgsz; ResolveModelPath(model, weightsDir);
    ParseExtraArguments(); ToTrainArguments(yaml, project, name, weightsDir); }
record YoloAugmentation { Fliplr, Flipud, Degrees, Translate, Scale, Shear, Perspective, Mosaic, Mixup, HsvH, HsvS, HsvV, Erasing (null = Ultralytics default);
    static UltralyticsDefaults; IsDefault; ToArguments(); FromValues; Parse; }
static class YoloTrainAdvisor { Recommend(env, current, IYoloDatasetStats?) → TrainRecommendation; }   // RequiredImgsz > 0 forces imgsz (advice ImgszNativeWindow)
interface IYoloDatasetStats { …; int RequiredImgsz /*native window, 0 = free*/; }  record YoloDatasetStats(…) { RequiredImgsz; }
record YoloDatasetSplit { Train/Val/TestPercent, Seed, Shuffle, Stratify, GroupBySource = true, IncludeUnreviewedPseudoLabels = false, IncludeBackground, BackgroundMaxPercent, SkipDifficult; }
static class YoloDatasetAssembler { Plan(sources, classes, split, ct); PlanEvaluation(sources, classes, ct); Build(plan, dir, progress, ct); }   // pseudo-labels train-only
sealed class YoloTrainRunner { WeightsDir; Output; Progress; Metrics; TrainAsync; ResumeAsync(launcher, last.pt); ExportOnnxAsync(launcher, weights, imgsz | YoloExportOptions);
    ValAsync(launcher, weights, yaml, imgsz, project, name, device, ct) → YoloValResult; Cancel(); WaitForIdle(timeout); }   // child in a job object (ChildProcessJob)
record YoloLauncher(FileName, PrefixArguments, IsPython) { static ForPython(exe) /*probed interpreter*/; static ForCli(exe); Arguments(tokens); Format(tokens); }
record YoloRunInfo { Status Running|Completed|Cancelled|Failed; Source; DatasetDir; DataYaml; Classes; Parameters; Imgsz; BaseModel; StartFromRun; UltralyticsVersion;
    Python; Resumes; EpochsCompleted; BestEpoch; FinalEpoch; Onnx; Export; RealEvals; JsonObject? Inference; Error; Load; Save; WithResults(runDir); }   // run_info.json
record YoloExportOptions { Imgsz, Half, Dynamic, Simplify, Opset; }  record YoloRealEval(CreatedUtc, Sources, DatasetDir, Imgsz, Metrics);
static class YoloResultsCsv { Read; Parse; Best; }   record YoloEpochMetrics(Epoch, Values) { Precision, Recall, MAP50, MAP50To95, losses, Fitness; }
sealed class YoloModelRegistry { (root); static Default; ConsumerNavigation / ConsumerAutoLabel; RunsDirs(); ListRuns(); static ListRunsIn / ReadRun;
    static ClassesForModel / ReadDataYamlNames; GetAllCurrent(); GetCurrent(consumer); SetCurrent(consumer, model); Resolve(consumer, requiredClasses);
    static Check(model, requiredClasses) → YoloModelResolution(Ok|NotSet|FileMissing|MissingClasses); }   // {root}/_models.json
sealed class YoloRunLock : IDisposable { static TryAcquire(runsDir, description, out owner); static ReadOwner(runsDir); }   // {runs}/.lock across instances
```

### 7.4 d3d4tester `YoloTrainingService`

```csharp
record YoloTrainingJob(RunsDir, BuildDataset, Parameters, Launcher, ExportOnnx) { Stamp; Source; }
record YoloDatasetBuild(DatasetDir, DataYamlPath, Train, Val, Test) { Classes; SynthesisResult? Synthesis; JsonObject? Inference; }
sealed class YoloTrainingService {   // single owner of the running job; phases Idle|Building|Training|Exporting|Evaluating
    static Instance; Log; Progress; BuildProgress; PhaseChanged; Metrics; OutcomeChanged; Phase; IsRunning; LastOutcome;
    static NewStamp(); static UniqueStamp(dirs);   static InitializeRuntime();   // model host options from config, shutdown hooks
    static ForSegments(...); static ForTaskSet(set, dir, parameters, launcher, export); static ForDataset(yaml, runsDir, ...);
    static AugmentationForTaskSet(set);   // geometry off, fliplr from flip_horizontal, scale 0.1 native / 0.25 relative, hsv from brightness/contrast
    static EstimateStats(set, dir) → IYoloDatasetStats (RequiredImgsz = native window);
    RunAsync(job); ResumeAsync(runDir, launcher, export); ExportAsync(runDir, launcher, options); EvaluateOnRealDataAsync(runDir, sources, launcher); Cancel(); }
```

## 8. Verification

- Library: generate from a synthetic task set (two targets with alpha and non-alpha variants, scenes, one common video) → label boxes match the pasted masks, splits use disjoint backgrounds, counts match settings, deterministic for the same seed.
- End to end: short CPU training on the generated dataset + ONNX export; `YoloOnnxDetector` loads the model with the target names.
- **Measured** (task set `tray_icons_v2`: 2 targets wechat / bluetooth, ColorKey variants, taskbar placement band, 18 distractors incl. 10 taskbar app icons as hard negatives): 25-epoch CPU train early-stopped at 21 (val mAP50 0.995, mAP50-95 0.93), then an 8-epoch hard-negative fine-tune. Fresh 3440x1440 screenshot: both icons IoU 1.00, 0 px offset, conf 0.96 / 0.97, 0 false positives (3 on taskbar app icons before the fine-tune); a naive full-frame letterbox finds neither. Live 10 s screen loop: 2.8 FPS on CPU (6 tiles of the bottom band), 29/29 frames, one track id per icon. Earlier v1 (opaque crops, Ultralytics default fliplr / scale) missed bluetooth (conf 0.047).

## 9. References

- Dwibedi, Misra, Hebert — *Cut, Paste and Learn: Surprisingly Easy Synthesis for Instance Detection* (ICCV 2017): random scale / rotation / position / background, Gaussian or Poisson blending to hide seams, occlusion up to IoU 0.75, truncation keeping ≥25 % of the box, distractors. https://openaccess.thecvf.com/content_ICCV_2017/papers/Dwibedi_Cut_Paste_and_ICCV_2017_paper.pdf, code https://github.com/debidatta/syndata-generation
- Ultralytics detection dataset format (images/ and labels/ mirrors, normalized `class xc yc w h`, data.yaml): https://docs.ultralytics.com/datasets/detect ; training CLI: https://docs.ultralytics.com/modes/train

## 10. Design review findings and backlog (2026-10-05)

Multi-agent review (synthesis library, training pipeline, UI/architecture; cross-checked between reviewers, verified against code and the live run of task set `tray_icons`). Status per item: §10.5.

### 10.1 Critical

| ID | Defect | Fix |
|----|--------|-----|
| S1 / T6 | No inference contract for small objects: the detector letterboxes the whole frame (a 16 px tray icon on a 3440 px screen becomes ~3 px). | §11 inference contract; `Detect(roi)`, `DetectTiled(tile, overlap)` at training scale, global NMS; record scale mode, tile size and ROI hint in the manifest and run info. |
| S2 | Native scale mode downscales large backgrounds to `output_max_side` but pastes variants unscaled (2.7x too large on full screenshots). | Native mode cuts native-resolution windows from backgrounds instead of resizing. |
| T1 | Navigation without a configured model loads the newest `best.onnx` anywhere under the data root, so any task-set export silently replaces the NPC model; "Use for navigation" accepts any model. | Model registry with a current model per consumer, class check (`D3TownTargets` subset of model classes), cached resolution. |
| T2 / S8 | No evaluation on real data; synthetic val leaks (single scenes and adjacent video frames in both splits), so mAP ~0.99 is meaningless. | "Evaluate on real data" (`yolo detect val` on annotated segments), real holdout sources, split by resource / video, stable hash split (S14), surface synthesis warnings. |
| U1 | No way to test a trained model on a screenshot, file, video or the live screen. | `ModelTestWindow` (image / video / live region, sliders, track IDs, hard-example export). |

### 10.2 Major

| ID | Defect | Fix |
|----|--------|-----|
| S3 | DPI not modelled; continuous scale makes impossible icon sizes, bilinear upscaling blurs. | `pixel_scale` per resource, discrete DPI steps, Area/Nearest resize. |
| S4 | Opaque variants paste their source background square; GrabCut erodes small icons. | `VariantWithoutAlpha` warning, `ColorKey` (border flood-fill) cutout, border-color-matched backgrounds. |
| S5 | Uniform placement ignores context (icons on terminal text). | Per-background placement regions, in-region probability, optional slot grid. |
| S6 | Unlabeled targets in backgrounds are not detected. | Template-match variants over backgrounds; auto-label or mask out. |
| S7 | IoU-based occlusion lets a small object be fully covered but keep its label. | Occupancy mask, visible fraction per earlier object. |
| S9 | Ultralytics default augmentation (fliplr 0.5, scale 0.5, mosaic, hsv) runs on top of synthesis (the live run mirrors icons and halves 16 px icons). | Augmentation hyper-parameters in `YoloTrainParameters`; specific mode derives them from the task set. |
| S10 | No hard negatives / distractors. | Task-set distractor images pasted unlabeled; negatives from common + scenes. |
| T3 | Training process orphaned or killed uncleanly on app exit; no cross-instance lock. | Job object (Windows) / process group (Linux), shutdown hook, run lock file. |
| T4 | No run metadata / registry; dataset-run link lost. | `run_info.json`, `YoloModelRegistry`, runs list with metrics, set current. |
| T5 | No resume, cancelled runs unusable, no fine-tune from a run. | `ResumeAsync`, export best so far, start from run (class check). |
| T7 | General-mode split leaks consecutive frames of one segment. | Group by source. |
| T8 | Metrics (results.csv) not read. | `YoloResultsCsv`, metrics event, best row in run info. |
| T9 | Probe may report one Python while the CLI of another runs; misses user/Store installs. | Run Ultralytics through the probed interpreter, skip the WindowsApps alias. |
| U2 | Targets cannot be created from a folder tree. | Import folder tree (subfolder = target; `scenes/`, `common/`), dry run. |
| U3 | Video extraction one box/frame at a time. | `VariantExtractor.Track` (CSRT/KCF, template fallback), fixed box over frames, dHash dedupe, filmstrip review. |
| U4 | Cutouts cannot be retouched. | GrabCut with FG/BG strokes, per-crop mode, edit stored variant, checkerboard thumbnails. |
| U5 | No per-target augmentation preview. | `RenderAugmentationGrid`, `RenderPreview(targetId)`. |
| U6 | Window unresponsive with hundreds of resources. | Virtualization, bounded thumbnail decode, cache, incremental updates, video thumbnails. |
| U7 | Bulk import aborts on one bad file, saves per file, no drag-and-drop. | `AddMany` (one save, per-file result), progress/cancel/summary, `AllowDrop`. |
| U8 | Deletes are permanent; no undo. | Trash + undo; extractor undo. |
| U9 | Pending extracted crops silently lost on reload. | Keep extractor for the same set; closing guard. |
| U10 | Double one-click train starts two runs; generate races with extraction. | Single-instance training window; generate on a snapshot. |
| U11 | No bridge from recorded segments / annotated boxes / other task sets. | Segment to task set, annotated boxes to variants, copy targets. |
| U12 | Generated datasets and runs invisible; training always regenerates. | History tab, `ForDataset` (train on an existing dataset). |

Late additions (final review round, video / live scope §1.1):

| ID | Sev | Defect | Fix | Owner |
|----|-----|--------|-----|-------|
| T16 / U17 | critical | No detection on video files (no frame stepping, FPS, per-frame results, labeled export). | `YoloVideoDetector`, "Analyze whole video" with cached detections and class timeline, export frames as labeled data. | W1, W8 |
| T17 / U18 | critical | No live screen / window / region detection loop (navigator sleeps a fixed 1.2 s on full frames). | `YoloLiveDetector` (newest-frame worker, FPS cap, ROI/tiling, stats), region picker, snapshot hotkey. | W1, W8 |
| T18 | major | No tracking or temporal smoothing (navigator gives up after one missed frame). | ByteTrack-style tracker with stable ids, min hits / max misses, box smoothing; navigator acts on confirmed tracks. | W1, W4 |
| T19 / U19 | major | Inference not tuned (CPU-only, per-pixel loops, no timings) and every consumer loads its own detector. | `YoloModelHost` (one session per model, provider DirectML/CUDA/CPU fallback, threads, warm-up), buffer reuse, timings; models resolved through the registry, never "newest file". | W1, W4, W7, W8 |
| T20 | major | Auto-labels are saved as reviewed ground truth (pseudo-labels leak into train and val). | Provenance in annotations (`source`, `reviewed`, per-box confidence), assembler option `IncludeUnreviewedPseudoLabels` (off, never in val). | W7, W4 |
| T21 | major | = S9 (Ultralytics augmentation not aligned with the task-set profile). | see S9 | W4 |
| U16 | major | UI for S4 / S5 / S6 / S10 (color-key cutout, placement-region editor, contamination actions, distractors tab). | see items | W6, W7 |

### 10.3 Minor

S11 PNG output / no double JPEG; S12 size-aware feather and blur; S13 pixel caps, background LRU, skip failed jobs, `.partial` output dir; S14 stable hash split; S15 cross-platform OpenCvSharp runtime; S16 preview context cache + cancel; S17 header-only readability check, batch add; S18 decoded-frame reuse in the extractor; T10 synthesis warnings/stats surfaced, advisor dataset estimate in specific mode; T11 busy/outcome consistency across windows; T12 extra args must not override managed keys; T13 export options, rectangular/dynamic detector input, `BlobFromImage`; T14 class-name parsing with quotes; T15 shared weights dir; U13 i18n error mapping, validated preview; U14 MVVM extraction of `TaskSetWindow`, one shared byte-to-BitmapSource helper, shared issue formatter; U15 keyboard map, `AutomationProperties.Name`, dynamic issue brushes.

### 10.4 Workstreams (file ownership, parallel)

| Workstream | Items | Owns |
|------------|-------|------|
| W1 detect & video | S1/T6, T13, T14, video/live detection, tracker | `dotcore/DotCore.YoloDetect/*` |
| W2 synthesis | S2, S3, S5–S8, S10–S14, S16, U5 (lib), T10 (estimate), manifest inference metadata | `TaskSetSynthesizer.cs`, `VariantAugmenter.cs`, `TaskSetImageIo.cs`, `TaskSetModel.cs` |
| W3 store & extraction | S4, S17, S18, U2/U3/U4/U8/U11 (lib) | `TaskSetStore.cs`, `VariantExtractor.cs`, `VideoFrameExtractor.cs` (+ new files) |
| W4 training core | T1–T5, T7–T12, T15, S9, U12 (`ForDataset`) | `dotcore/DotCore.YoloTrain/*`, `Services/YoloTrainingService.cs`, `D3TownNavigator.cs`, shutdown hook |
| W5 training window | runs/metrics/registry/resume/evaluate UI, T11, U10 (training side) | `Windows/YoloTrainingWindow.*`, `Constants/I18nKeys.YoloTraining.cs` |
| W6 task-set manager | U2, U5–U8, U10–U14, S3/S5/S10 editors | `Windows/TaskSetWindow.*`, `ViewModels/TaskSet*`, `Pages/Calibration/*` |
| W7 extractor UI | U3, U4, U9, U15 (canvas key map, strokes) | `Windows/VariantExtractWindow.*`, `dotcore/DotCore.VocAnnotatorUI/*` |
| W8 model test | U1, video/live UI | new `Windows/ModelTestWindow.*`, `Constants/I18nKeys.ModelTest.cs`, `D3D4TesterCore/Constants/ConfigKeys.YoloModelTest.cs` |

### 10.5 Status (verified against code, 2026-10-05)

**Done** (where):

| IDs | Implementation |
|-----|----------------|
| S1/T6, T13, T14 | `YoloInferenceProfile`, `Detect(roi)`, `DetectTiled`, `Detect(profile)`; rectangular input, pooled buffers, quoted-name parsing; `YoloExportOptions` |
| S2, S3, S5, S7, S8, S10–S14, S16, U5, T10 | `TaskSetSynthesizer` (native window, `pixel_scale` / `dpi_steps`, regions + slot grid, occupancy, group hash split, distractors, PNG / JPEG range, size-aware feather, `.partial`, LRU, preview cache, `RenderAugmentationGrid`, `Estimate`) |
| S4, S6, S17, S18 | `VariantCutout.ColorKey`, `VariantWithoutAlpha`, `FindContamination`, header-only checks, `VideoFrameReader` |
| S9 / T21 | `YoloAugmentation`, `AugmentationForTaskSet` |
| T1, T4, T8, T15, T19 | `YoloModelRegistry` (consumer current, class check), `YoloRunInfo`, `YoloResultsCsv`, shared weights dir, `YoloModelHost` |
| T2, T3, T5, T7, T9, T11, T12 | holdout + `EvaluateOnRealDataAsync`, `ChildProcessJob` + shutdown hook + `YoloRunLock`, `ResumeAsync` / export best / start from run, `GroupBySource`, `YoloLauncher.ForPython`, service-wide phase / outcome, `ManagedKeys` |
| T16–T18, T20, U1, U17–U19 | `YoloVideoDetector`, `YoloLiveDetector`, `YoloFrameTracker` (navigator acts on matched tracks), `Reviewed = false` pseudo-labels (train only); `ModelTestWindow` (image / video timeline / live, tracks, hard-example export, snapshot hotkey) |
| U2–U4, U6–U16 | folder-tree import, track / fixed box / dHash + filmstrip, strokes + per-crop mode, virtualized thumbnails, `AddMany` + drag-and-drop, trash + undo, extractor closing guard, single training window + generate on snapshot, annotations → variants / copy targets / segment → task set, `ForDataset` + history, issue formatter, `TaskSetManagerViewModel`, `AutomationProperties.Name`, region / contamination / distractor editors |

**Open**:

- S15: `DotCore.YoloTaskSet` / `DotCore.YoloDetect` reference `OpenCvSharp4.Windows` only (no Linux runtime).
- Placement-region snap pitch is set per resource in the editor (model supports per region).
- Undo is session-only; the trash keeps the 20 newest entries.
- Video auto-label applies a box to every frame of the video (`ResourceBox` on a video).
- ModelTest region picking is in-canvas only; monitor enumeration lives in `ModelTestScreens` (belongs in `DotCore.ScreenCapture`).
- Annotated MP4 export and a click-through overlay are not built.
- Stamp race: two jobs created in the same second, before either folder exists, get the same stamp.
- Group-by-source split may exceed the val share to cover every class.
- WPF binding-trace noise in two windows; some English captions are clipped.

## 11. Inference contract (small objects, video, live)

- **Record**: synthesis writes `SynthesisInferenceInfo` to the manifest `inference` block (`scale_mode`, `window_width/height`, background and object side ranges, `tile_overlap` = 2 × max object side, `roi_hint` from `TaskSet.InferenceRoiHint`: `anchor` bottom|top|left|right + `band_pixels`, or `rect`). `YoloTrainingService` copies it into `run_info.json` (`YoloRunInfo.Inference`); `ForDataset` reads it via `TaskSetSynthesizer.ReadInferenceInfo`.
- **Train**: native task sets require `imgsz` = max(native window) (`IYoloDatasetStats.RequiredImgsz` → advisor `ImgszNativeWindow`; the training window shows a mismatch hint) so tiles reach the model unscaled.
- **Profile**: `YoloInferenceProfile.FromInference(run_info.inference)` (thresholds set by the caller); a bottom band becomes `Roi = (0, −band, 0, band)` (negative X / Y = offset from the right / bottom edge, size ≤ 0 = to the edge).
- **Detect(image, profile)**: Relative → one letterbox of the ROI (or full frame). Native → region = ROI or full frame; a region within one tile is detected in one pass without upscaling; otherwise `DetectTiled` (tile = window, 0 = model input; overlap = `tile_overlap`, default a quarter of the smaller tile side), each tile letterboxed without upscaling, global class-wise NMS dropping boxes cut by an inner tile edge when a whole copy exists. Never a whole-screen letterbox for native models.
- **Sessions**: `YoloModelHost.Shared` owns one ONNX session per (path, write time, options), handed out as leases (`IsStale` after re-export, `MaxIdle` idle sessions kept); provider CPU / Auto / CUDA / DirectML with CPU fallback, intra-op threads and warm-up from config. Models come from `YoloModelRegistry` (current model per consumer `navigation` / `auto_label`, class check), never "newest file".
- **Video / live**: `YoloVideoDetector.Run` (lazy, frame step / range, per-frame timing) and `YoloLiveDetector` (provider thread, `TargetFps`, newest frame, `FrameProcessed` with FPS / latency / capture / inference times, `Faulted`, `ResetTracks`), both on `Detect(image, profile)`.
- **Tracking**: `YoloFrameTracker` (ByteTrack-lite: high / low confidence two-stage matching, constant-velocity prediction, center-shift fallback for small fast objects, `MinHits` 3, `MaxMisses` 15, box smoothing 0.6); the navigator acts only on tracks matched this frame (`Misses == 0`).
- **Hard examples**: the model tester exports frames as annotations with `Reviewed = false` and a `source`; `YoloDatasetAssembler` skips them unless `IncludeUnreviewedPseudoLabels`, and then only in train.

## 12. Shared segments, source placement, compound variants (2026-10-10)

> 打通段和特定任务集的数据共享，这特定任务集中可以获取到这些段当中的数据作为资源 … 识别仓库、铁匠、珠宝匠、卡内魔盒、凯恩之书、装备库、卡达拉、尖碑、附魔工匠，以及铁匠的修复装备、分解装备，附魔工匠的附魔，并能获取附魔中的文字。

- **Segment sources** (`TaskSet.SegmentSources`: `segment_dir` relative to the YOLO data root or absolute, `backgrounds`, `real_images`, `frame_step`): recorded segments are read in place (`{segment}/frames` + JSON / VOC), nothing is copied. Every `frame_step`-th annotated frame is (a) a common background whose target boxes are real positives and whose difficult / non-target boxes are inpainted, and (b) a real labeled image `seg_*` (difficult boxes inpainted). Split group = segment + block of `segment_block_frames` frames, shared by both uses (no block in train and val). Validation: `SegmentUnreadable`; contamination samples `contamination_video_frames` frames per segment (annotated boxes are known objects). Store: `AddSegmentSources` (a project dir adds all segments), `RemoveSegmentSources`, `ScanSegment`, `AddVariantsFromSegments`. UI: task-set window tab **Segments** (add folders / drag-drop, use toggles, frame step, extract deduplicated variants), calibration segment menu **Share with task set**.
- **Annotation variants** (`AnnotationVariantOptions`): frame step, dHash dedupe, cap per label, minimum side; variants record `source_width/height` of their frame.
- **Relative sizing "source"** (`synthesis.relative_sizing`): in relative mode an object keeps the size it had in its source frame, scaled by background / source short side. Recordings are downscaled frames of the game window, so the model is trained in relative mode and the detector letterboxes the whole capture (§11 Relative).
- **Source placement** (`TaskTarget.placement` = `source`, `placement_jitter`): the object is pasted at the position it was cut from (fixed UI), after world objects and distractors; it may hide earlier objects, which lose their label below `min_visible_fraction`. `PlacementSourceUnknown` when no usable variant knows its source.
- **Compound variants** (`TaskResource.boxes` on a variant): labeled parts in variant pixels; when present they are the variant's labels (scaled with the paste; no flip, rotation or one-sided stretch). `AnnotationVariantOptions.GroupLabels` + `GroupRegion` cut one region per frame (e.g. the whole NPC window) carrying panel, tabs, buttons and text. A target without own variants is pasted through the compound variants that carry it (`NoVariants` only when none does); compound variants are not contamination templates and skip `VariantWithoutAlpha`.
- **Consumer** (d3d4tester): `D3TownTargets` (10 world targets) and `D3TownUi` (panels, tabs, buttons, `enchant_text`); `D3TownNavigator.ReadPanel` / test pathfinding log the open panel, button centers and the enchant affix lines read by `D3EnchantTextReader` (YOLO box → enlarged crop → `OcrEngineRegistry` general engine → lines).
