# Button / Text-Region Recognition — Design (DotCore)

This document designs a **high-level recognition library** for .NET (C#) that automatically detects UI elements that look like **buttons with text and specific colors**. It follows: **Utils = basic, no cross-calls; DotCore aggregate = composes Utils** to implement the pipelines below. Implement code only after this design is approved.

---

## 1. Purpose and scope

- **Goal:** Detect rectangular regions that behave like “buttons” (e.g. colored background + text), optionally filtered by color and/or verified by OCR.
- **Use cases:** Screen scraping, automation (click by visual “button”), accessibility, testing. Aligns with ROSBOT/C-block flows that need “find button by color/text” without full UI Automation.
- **Out of scope:** Full UI Automation tree (handled by DotCore.UIInspect); generic object detection beyond button-like regions (future YOLO is optional).

---

## 2. References (technical literature and articles)

All references below were used to derive algorithms and C#/OpenCV usage. Include them in any downstream implementation notes or comments.

| # | URL | Topic |
|---|-----|--------|
| 1 | https://agneya.medium.com/color-detection-using-python-and-opencv-8305c29d4a42 | Color detection with Python and OpenCV (HSV, masking). |
| 2 | https://blog.roboflow.com/color-sensing-with-computer-vision/ | HSV color space for reliable color detection in computer vision. |
| 3 | https://devindeep.com/text-detection-with-c/ | Text detection in C# (candidate areas, image processing). |
| 4 | https://devindeep.com/text-detection-with-c/ (second snippet: “This C# application is based … to improve text detection accuracy”) | C# app for text detection and accuracy improvements. |
| 5 | https://ieeexplore.ieee.org/document/8442875 | IEEE: text/region detection (MSER, morphology, etc.). |

**Summary from references:**

- **HSV** (Hue, Saturation, Value) is more stable than RGB for “specific color” detection under lighting changes; use `InRange` on HSV for masking.
- **Contours** on the binary mask (after color filter or edge/morphology) yield candidate rectangles; filter by area and aspect ratio to keep button-like shapes.
- **Canny + Dilation** and **MSER** are standard for text-region detection when color is unknown; then verify with OCR.
- **OCR** on cropped candidate regions (after grayscale/binarization) improves verification; Tesseract or existing DotCore.Utils.Ocr (e.g. PaddleOCR) can be used.
- **YOLO/ONNX** is the high-end option when button shapes are very varied; C# can load models via ML.NET or ONNX Runtime.

---

## 3. Algorithm overview (four approaches)

Ordered by implementation effort and runtime cost (fast → heavy).

| Approach | Description | Typical use |
|----------|-------------|-------------|
| **1. Color filter + contours** | HSV `InRange` → binary mask → `FindContours` → filter by area and aspect ratio. | Fast; use when button color is known and background is simple. |
| **2. Edge + morphology (text regions)** | Canny edge → Dilation (and optional MSER) to get candidate rectangles. | When color is unknown but “has text” is known. |
| **3. OCR verification** | Crop candidate rectangles → grayscale/binarize → run OCR → match expected text. | Confirm that a candidate is the desired button by text. |
| **4. Deep learning (YOLO/ONNX)** | Run a pre-trained model to detect “Button” or custom class; get bounding boxes. | When shapes are very diverse (round, shadow, gradient). |

The **aggregate library** will orchestrate 1–3 (and optionally 4) by calling **Utils** that provide a single responsibility each and **do not call each other**.

---

## 4. Architecture: Utils (no cross-calls) + DotCore aggregate

- **Utils:** Small, focused libraries or namespaces. **No project/namespace A calls B** among these Utils. Each provides one kind of operation (e.g. “HSV + InRange”, “Contours”, “Canny + Dilation”, “Binarize for OCR”).
- **DotCore aggregate:** One project (e.g. `DotCore.ButtonRecognizer` or `DotCore.ImageRecognition`) that **depends on** these Utils and on existing DotCore (ScreenCapture, TemplateMatcher, Utils.Ocr). It implements the four pipelines above by **calling** Utils in sequence.

```
┌─────────────────────────────────────────────────────────────────┐
│  DotCore.ButtonRecognizer (aggregate)                           │
│  - Pipeline 1: Color filter → Contours → filter rects            │
│  - Pipeline 2: Canny + Dilation (→ optional MSER) → rects        │
│  - Pipeline 3: Crop → Preprocess → OCR → text match             │
│  - Pipeline 4 (optional): ONNX/YOLO inference                    │
└─────────────────────────────────────────────────────────────────┘
         │                │                │                │
         ▼                ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Utils.Image  │ │ Utils.Image  │ │ Utils.Image  │ │ Utils.Image  │
│ Color        │ │ Contours     │ │ Morphology   │ │ Preprocess   │
│ (HSV, InRange)│ │(FindContours,│ │(Canny,Dilate,│ │(Gray,Binarize)│
│              │ │ area/ratio)  │ │ MSER)        │ │              │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
     no cross-references between the four Utils above
         │                │                │                │
         └────────────────┴────────────────┴────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            DotCore.Utils    DotCore.          DotCore.
            (Ocr)            TemplateMatcher   ScreenCapture
```

---

## 5. Existing vs missing base libraries

**Existing in dotcore:**

| Component | Project / location | Role |
|-----------|--------------------|------|
| Template matching (find small image in large) | `DotCore.TemplateMatcher` | OpenCvSharp; `Match(source, template)` → position, score. |
| Screen capture | `DotCore.ScreenCapture` | Screenshot (full screen / window). |
| OCR | `DotCore.Utils` (Ocr) | `IOcrEngine`, PaddleOCRSharp; init, OCR on image path (and optional grid). |

**Missing (to be added as Utils or part of aggregate):**

| Capability | Status | Proposed home |
|------------|--------|----------------|
| HSV color conversion + range mask (InRange) | **Missing** | New: **DotCore.Utils.ImageColor** |
| Contour detection + filter by area / aspect ratio | **Missing** | New: **DotCore.Utils.ImageContours** |
| Canny edge + Dilation / Erosion / MSER | **Missing** | New: **DotCore.Utils.ImageMorphology** |
| Grayscale + Binarization for OCR input | **Missing** | New: **DotCore.Utils.ImagePreprocess** |
| Orchestration of 1–4 pipelines (button/text-region detection) | **Missing** | New: **DotCore.ButtonRecognizer** (aggregate) |
| YOLO/ONNX inference (optional) | **Missing** | Optional: inside aggregate or **DotCore.Utils.ImageOnnx** (no ref to other Utils) |

**Dependency rule:** Utils projects do **not** reference each other. They may reference only DotCore.Foundations (and optionally OpenCvSharp where needed). The aggregate references the Utils it needs plus DotCore.Utils (Ocr), DotCore.TemplateMatcher, DotCore.ScreenCapture.

---

## 6. Proposed Utils (per-concern, no mutual calls)

### 6.1 DotCore.Utils.ImageColor

- **Responsibility:** Color space and range filtering only.
- **Input:** Image (Bitmap or OpenCvSharp `Mat`).
- **Output:** Binary mask `Mat` (or list of masked regions) for “pixels in HSV range”.
- **Operations:** RGB → HSV conversion; `Cv2.InRange(hsv, low, high)` with configurable HSV bounds; optional helper to define common “button” colors (e.g. blue, green) as HSV ranges.
- **References:** OpenCvSharp, DotCore.Foundations (optional). **Does not reference** ImageContours, ImageMorphology, ImagePreprocess, Ocr.

### 6.2 DotCore.Utils.ImageContours

- **Responsibility:** Contour detection and rectangle filtering.
- **Input:** Binary (or grayscale) `Mat` (e.g. from color mask or morphology output).
- **Output:** List of candidate rectangles (e.g. `Rect` or `Rectangle`) with optional area and aspect-ratio metadata.
- **Operations:** `Cv2.FindContours`; bounding rect per contour; filter by min/max area and min/max aspect ratio (to keep “button-like” oblong shapes); optional merge of overlapping/near rects.
- **References:** OpenCvSharp, DotCore.Foundations. **Does not reference** ImageColor, ImageMorphology, ImagePreprocess, Ocr.

### 6.3 DotCore.Utils.ImageMorphology

- **Responsibility:** Edge detection and morphology for text-region candidates.
- **Input:** Image (Bitmap or `Mat`).
- **Output:** Binary or processed `Mat`, or list of regions (e.g. MSER blobs as rects).
- **Operations:** Canny edge detection; Dilation / Erosion (structuring element size configurable); optionally MSER (if available in OpenCvSharp or native bindings) to get stable extremal regions for text.
- **References:** OpenCvSharp, DotCore.Foundations. **Does not reference** ImageColor, ImageContours, ImagePreprocess, Ocr.

### 6.4 DotCore.Utils.ImagePreprocess

- **Responsibility:** Image preprocessing for OCR only.
- **Input:** Image (Bitmap or `Mat`) or cropped region.
- **Output:** Grayscale or binarized `Mat`/Bitmap suitable for OCR (e.g. Otsu threshold).
- **Operations:** Grayscale conversion; Binarization (e.g. Otsu, fixed threshold); optional deskew / contrast normalization. No OCR call inside this Util.
- **References:** OpenCvSharp, DotCore.Foundations. **Does not reference** ImageColor, ImageContours, ImageMorphology, Ocr.

### 6.5 DotCore.Utils.Ocr (existing)

- **Responsibility:** Run OCR on an image (path or in-memory if API extended).
- **No change** to mutual-call rule: other Utils do not call Ocr; only the aggregate calls Ocr after cropping and optional preprocess (using ImagePreprocess).

---

## 7. Proposed aggregate: DotCore.ButtonRecognizer

- **Responsibility:** Implement the four recognition pipelines by **calling** the Utils above and existing DotCore (ScreenCapture, TemplateMatcher, Utils.Ocr). No duplicate implementation of HSV/Contours/Morphology/Preprocess inside the aggregate; it only orchestrates.
- **References:**  
  - DotCore.Utils.ImageColor  
  - DotCore.Utils.ImageContours  
  - DotCore.Utils.ImageMorphology  
  - DotCore.Utils.ImagePreprocess  
  - DotCore.Utils (Ocr)  
  - DotCore.TemplateMatcher (optional, for template fallback)  
  - DotCore.ScreenCapture (optional, for “capture then recognize”)  
  - DotCore.Foundations, DotCore.Common (as needed)

**Pipelines implemented in the aggregate:**

1. **Color + contours:**  
   Screenshot or input image → **ImageColor** (HSV InRange) → binary mask → **ImageContours** (FindContours, area/aspect filter) → list of candidate rectangles. Optionally return best N or filter by size.

2. **Edge + morphology (text regions):**  
   Input image → **ImageMorphology** (Canny + Dilation, or MSER) → binary/regions → **ImageContours** (if output is binary) or direct rect list from MSER → candidate rectangles.

3. **OCR verification:**  
   For each candidate rect: crop → **ImagePreprocess** (Grayscale + Binarize) → save to temp or pass to **Utils.Ocr** → compare OCR text to expected string(s) → return rects that match (e.g. “Start”, “OK”). Optionally run only for rects from pipeline 1 or 2.

4. **YOLO/ONNX (optional):**  
   If a small Util **DotCore.Utils.ImageOnnx** is added (only ONNX Runtime + load model + run inference → list of boxes), the aggregate can call it and merge with 1–3. No Utils cross-calls: ImageOnnx does not reference ImageColor/Contours/Morphology/Preprocess/Ocr.

**Public API (conceptual):**

- `DetectByColor(Mat input, HsvRange range, ContourFilterOptions options) → IReadOnlyList<Rect>`  
- `DetectTextRegions(Mat input, MorphologyOptions options) → IReadOnlyList<Rect>`  
- `VerifyByOcr(Mat input, IReadOnlyList<Rect> candidates, string[] expectedTexts, IOcrEngine ocr) → IReadOnlyList<Rect>`  
- `DetectButtons(Mat input, ButtonRecognizerOptions options) → IReadOnlyList<ButtonCandidate>`  
  where `ButtonCandidate` holds Rect + optional color label + optional OCR text.

---

## 8. Implementation order

1. **Add Utils (no cross-calls):**  
   - DotCore.Utils.ImageColor  
   - DotCore.Utils.ImageContours  
   - DotCore.Utils.ImageMorphology  
   - DotCore.Utils.ImagePreprocess  

2. **Add aggregate:**  
   - DotCore.ButtonRecognizer, referencing the four Utils + DotCore.Utils (Ocr) + DotCore.TemplateMatcher + DotCore.ScreenCapture as needed.  
   - Implement pipelines 1, 2, 3 in order; add pipeline 4 (ONNX) later if required.

3. **Optional:**  
   - DotCore.Utils.ImageOnnx (ONNX inference only) if YOLO/ONNX is needed; then ButtonRecognizer calls it for pipeline 4.

4. **Docs and references:**  
   - Keep this document and the reference table (Section 2) in sync with code; add short comments in code pointing to these references where applicable.

---

## 9. References list (for copy-paste)

```
https://agneya.medium.com/color-detection-using-python-and-opencv-8305c29d4a42
https://blog.roboflow.com/color-sensing-with-computer-vision/
https://devindeep.com/text-detection-with-c/
https://ieeexplore.ieee.org/document/8442875
```
