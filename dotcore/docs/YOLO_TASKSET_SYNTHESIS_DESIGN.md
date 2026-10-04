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

Deterministic for a given task set + seed.

1. **Validate** (`Validate`): at least one target; every target has ≥1 readable variant; every target has ≥1 background (own scenes or common resources); unique non-empty target names; unreadable files are reported. Errors block generation; warnings (e.g. no common resources, very few backgrounds) are returned.
2. **Backgrounds**: target scenes (per target) and common images; common videos → frames every `video_frame_interval` frames up to `video_max_frames` (cached under `_cache/frames`). Backgrounds larger than `output_max_side` are downscaled (aspect kept).
3. **Split backgrounds** into train / val by `val_percent` (seeded, per pool) so val images never reuse a train background. Pools with one background go to train and val both (warning).
4. **Per target** `n = target.images_per_target ?? synthesis.images_per_target` images, split `val_percent`. Each image:
   - background: from the target's scenes ∪ common pool (uniform over the union; split-specific);
   - object count k ∈ [min_objects, max_objects]; first object = this target; each further object is this target, or with `cross_target_probability` another target (variants of that target, its own resolved augmentation);
   - for each object: random variant → resolved augmentation (target override ∪ global) → transformed BGRA + mask;
   - size: `scale_mode = native` keeps the variant's pixel size × scale (game assets at the capture resolution); `relative` sets the longest side to `background short side × U(relative_min, relative_max)` × scale;
   - placement: random position; the visible part must keep ≥ `min_visible_fraction` of the object box inside the image (truncation); IoU with already placed objects ≤ `max_overlap_iou` (occlusion; later objects drawn on top); up to 50 attempts, else the object is skipped;
   - compositing: alpha blend with the (feathered) mask; label box = tight bounds of the mask after clipping to the image, dropped when smaller than 4 px;
   - image-level photometric jitter is part of the object augmentation only (backgrounds stay real).
5. **Negatives**: `negative_percent` of the total image count are backgrounds without pasted objects (empty label files), drawn from common resources (target scenes only when no common resource exists, warning).
6. **Write** the Ultralytics layout via `YoloDataYaml` (`images/{train,val}`, `labels/{train,val}`, `data.yaml`, names = targets in order) plus `synthesis_manifest.json` (task set id, seed, counts per split and class, resolved augmentation per target, background usage) and a few `previews/*.jpg` with drawn boxes for inspection.
7. **Progress / cancel**: `IProgress<SynthesisProgress>` per image, `CancellationToken` checked per image.

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
| `blur_probability`/`blur_max_kernel` | Gaussian blur (odd kernel ≤ max) |
| `edge_feather` | mask edge blur radius in px (Gaussian blending, hides paste seams) |

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

`dotcore/DotCore.YoloTaskSet` (net8.0-windows: OpenCvSharp4.Windows for compositing and video decode). Depends on Foundations, VocAnnotator, YoloTrain. Namespace `DotCore.YoloTaskSet`.

```csharp
public enum TaskResourceKind { Image, Video }
public sealed class TaskResource { string Id; TaskResourceKind Kind; string File; string OriginalPath; string Label; }
public sealed class AugmentationProfile { double ScaleMin, ScaleMax, StretchMin, StretchMax, RotationMaxDegrees, LeftStretchMax, RightStretchMax;
    bool FlipHorizontal; double BrightnessMax, ContrastMax, BlurProbability; int BlurMaxKernel; double EdgeFeather;
    AugmentationProfile Resolve(AugmentationOverride? o); AugmentationProfile Normalized(); }
public sealed class AugmentationOverride { same fields, all nullable; bool IsEmpty; }
public sealed class SynthesisSettings { int ImagesPerTarget, ValPercent, Seed, MinObjectsPerImage, MaxObjectsPerImage; double CrossTargetProbability;
    int NegativePercent; double MaxOverlapIou, MinVisibleFraction; string ScaleMode; double RelativeMin, RelativeMax;
    int OutputMaxSide, JpegQuality, VideoFrameInterval, VideoMaxFrames; SynthesisSettings Normalized(); }
public sealed class TaskTarget { string Id; string Name; List<TaskResource> Variants; List<TaskResource> Scenes; AugmentationOverride? Augmentation; int? ImagesPerTarget; }
public sealed class TaskSet { string Id; string Name; string Description; DateTime CreatedUtc, UpdatedUtc;
    List<TaskTarget> Targets; List<TaskResource> CommonResources; AugmentationProfile Augmentation; SynthesisSettings Synthesis;
    IReadOnlyList<string> ClassNames; }

public sealed class TaskSetStore {
    static string DefaultRoot; TaskSetStore(string rootDir); string RootDir;
    IReadOnlyList<TaskSet> List(); TaskSet? Load(string id); TaskSet Create(string name); void Save(TaskSet set);
    void Delete(string id); TaskSet Duplicate(string id, string newName); string GetDir(string id);
    string ResourcePath(TaskSet set, TaskResource r);
    TaskTarget AddTarget(TaskSet set, string name); void RemoveTarget(TaskSet set, string targetId);
    void MoveTarget(TaskSet set, string targetId, int delta);
    TaskResource AddVariant(TaskSet set, TaskTarget target, string sourcePath);
    TaskResource AddScene(TaskSet set, TaskTarget target, string sourcePath);
    TaskResource AddCommon(TaskSet set, string sourcePath);
    void RemoveResource(TaskSet set, TaskResource resource);   // all mutators save
    static bool IsSupportedImage(string path); static bool IsSupportedVideo(string path);
}

public enum TaskSetIssueCode { NoTargets, EmptyTargetName, DuplicateTargetName, NoVariants, NoBackgrounds, UnreadableResource, NoCommonResources, FewBackgrounds, SingleBackgroundShared }
public sealed record TaskSetIssue(TaskSetIssueCode Code, string Subject, bool IsError);
public sealed record SynthesisProgress(int Done, int Total);
public sealed record SynthesisResult(string DatasetDir, string DataYamlPath, IReadOnlyList<string> Classes,
    int TrainImages, int ValImages, int NegativeImages, IReadOnlyDictionary<string, int> Instances, IReadOnlyList<TaskSetIssue> Warnings);
public sealed record PreviewResult(byte[] Png, IReadOnlyList<(string Label, double XMin, double YMin, double XMax, double YMax)> Boxes);

public static class TaskSetSynthesizer {
    IReadOnlyList<TaskSetIssue> Validate(TaskSet set, string taskSetDir);
    SynthesisResult Generate(TaskSet set, string taskSetDir, string outputDir, IProgress<SynthesisProgress>? progress, CancellationToken ct);
    PreviewResult RenderPreview(TaskSet set, string taskSetDir, int seed);
}
public static class VariantAugmenter { (Mat Bgra, Mat Mask) Apply(Mat bgra, AugmentationProfile p, double extraScale, Random rng); }
public readonly record struct VariantRegion(int X, int Y, int Width, int Height);
public enum VariantCutout { Rectangle, GrabCut }
public sealed record VideoInfo(int FrameCount, double Fps, int Width, int Height);
public static class VariantExtractor { bool IsVideo(string path); VideoInfo? GetVideoInfo(string videoPath);
    byte[]? LoadFramePng(string sourcePath, int frameIndex); byte[]? Cut(string sourcePath, int frameIndex, VariantRegion region, VariantCutout mode); }
// TaskSetStore: TaskResource AddVariantFromPng(TaskSet set, TaskTarget target, byte[] png, string originalPath, string nameHint);
public static class VideoFrameExtractor { int EstimateFrames(string path, int interval, int max); IReadOnlyList<string> ExtractToCache(string videoPath, string cacheDir, int interval, int max, CancellationToken ct); }
```

## 8. Verification

- Library: generate from a synthetic task set (two targets with alpha and non-alpha variants, scenes, one common video) → label boxes match the pasted masks, splits use disjoint backgrounds, counts match settings, deterministic for the same seed.
- End to end: short CPU training on the generated dataset + ONNX export; `YoloOnnxDetector` loads the model with the target names.

## 9. References

- Dwibedi, Misra, Hebert — *Cut, Paste and Learn: Surprisingly Easy Synthesis for Instance Detection* (ICCV 2017): random scale / rotation / position / background, Gaussian or Poisson blending to hide seams, occlusion up to IoU 0.75, truncation keeping ≥25 % of the box, distractors. https://openaccess.thecvf.com/content_ICCV_2017/papers/Dwibedi_Cut_Paste_and_ICCV_2017_paper.pdf, code https://github.com/debidatta/syndata-generation
- Ultralytics detection dataset format (images/ and labels/ mirrors, normalized `class xc yc w h`, data.yaml): https://docs.ultralytics.com/datasets/detect ; training CLI: https://docs.ultralytics.com/modes/train

## 10. Design review findings and backlog (2026-10-05)

Multi-agent review (synthesis library, training pipeline, UI/architecture; cross-checked between reviewers, verified against code and the live run of task set `tray_icons`). Status: all **open**, assigned to the workstreams in §10.4.

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

## 11. Inference contract (small objects, video, live)

- The run records how it was trained: `scale_mode`, the native tile size (synthesis window / background size) and an optional ROI hint (e.g. the bottom 48 px band of the primary screen for tray icons).
- Consumers run `Detect(image, roi)` when an ROI hint exists, else `DetectTiled(image, tile = training window, overlap >= 2 x max object side)` with global NMS; never a whole-screen letterbox for native-scale models.
- Video / live: one reused ONNX session, per-frame detection (ROI or tiles), an IoU/ByteTrack-style tracker for stable IDs, temporal smoothing (min hits, max misses), FPS reporting; frames with misses or false positives can be exported as labeled data or task-set resources (hard-example loop).
