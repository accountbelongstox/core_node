# CnSTD / CnOCR Detection Model Install (Official)

When you see:

- `can not find model file ... ch_PP-OCRv5_det_infer.onnx`
- `FileNotFoundError: ... ch_PP-OCRv5_det ... does not exists`
- `[OCR] Det model init failed, trying naive_det (no position/boxes).`

the OCR engine falls back to `naive_det` (text only, no bounding boxes). To get **position/boxes** for CN login clicks, install a detection model as below.

## 1. Use CnSTD native model (recommended, auto-download)

This app tries **db_shufflenet_v2_small** first (CnSTD native model; usually auto-downloads). If that succeeds, no manual steps.

If it still fails, ensure cnstd is installed with ONNX:

```bash
# CPU
pip install cnstd[ort-cpu]

# GPU
pip install cnstd[ort-gpu]
```

If you already have `onnxruntime`, uninstall it first then install the extra above:

```bash
pip uninstall onnxruntime
pip install cnstd[ort-cpu]
```

## 2. PP-OCRv5 model (ch_PP-OCRv5_det) when auto-download fails

CnSTD normally auto-downloads models to:

- Windows: `C:\Users\<user>\AppData\Roaming\cnstd\1.2\`
- Linux/Mac: `~/.cnstd/1.2/`

If auto-download fails (e.g. `huggingface-cli` not found or network error), **manual download** (from [CnSTD README](https://github.com/breezedeus/CnSTD)):

1. **From Hugging Face**  
   [breezedeus/cnstd-cnocr-models](https://huggingface.co/breezedeus/cnstd-cnocr-models) → open `models/cnstd/1.2/` → download the zip for the model you need (e.g. PP-OCRv5 det).

2. **From Baidu (China)**  
   [Baidu Pan](https://pan.baidu.com/s/1zDMzArCDrrXHWL0AWxwYQQ?pwd=nstd) (code: `nstd`) → download the matching zip.

3. **Place the zip** in the cnstd 1.2 directory:
   - Windows: `C:\Users\<user>\AppData\Roaming\cnstd\1.2\`
   - Extract if the project expects a folder (e.g. `ppocr/ch_PP-OCRv5_det/` with `ch_PP-OCRv5_det_infer.onnx` inside). Some versions auto-unzip when the zip is in `1.2`.

4. **Optional: install Hugging Face CLI** (for future auto-download):
   ```bash
   pip install huggingface_hub
   ```
   Then login if needed: `huggingface-cli login` (or set `HF_TOKEN`).

## 3. Engine fallback order in this app

1. `db_shufflenet_v2_small` (CnSTD native, auto-download)
2. `ch_PP-OCRv5_det` (PP-OCR ONNX; may need manual download above)
3. `naive_det` (no detection model; text only, no boxes; CN login uses ratio fallback clicks)

## References

- CnSTD: https://github.com/breezedeus/CnSTD  
- CnSTD models: https://huggingface.co/breezedeus/cnstd-cnocr-models  
- CnOCR: https://github.com/breezedeus/CnOCR  
