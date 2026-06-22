# CnOCR 安装与检测模型 (Official)

本项目使用 **CnOCR** 做 OCR，官方仓库与安装见 [CnOCR](https://github.com/breezedeus/cnocr)。检测模型由 CnOCR 内部通过 CnSTD 加载；若自动下载失败，再按下文手动下载。

## 1. 官方推荐安装（CnOCR）

按 [CnOCR 官方安装说明](https://github.com/breezedeus/cnocr?tab=readme-ov-file#%E5%AE%89%E8%A3%85)：

```bash
# CPU（推荐）
pip install cnocr[ort-cpu]

# GPU
pip install cnocr[ort-gpu]
```

国内安装慢可指定源：

```bash
pip install cnocr[ort-cpu] -i https://mirrors.aliyun.com/pypi/simple
```

若需在 GPU 上使用 ONNX，需先卸载 CPU 版再装 GPU 版：

```bash
pip uninstall onnxruntime
pip install cnocr[ort-gpu]
```

## 2. 检测模型缺失时的报错与回退

当出现：

- `can not find model file ... ch_PP-OCRv5_det_infer.onnx`
- `FileNotFoundError: ... ch_PP-OCRv5_det ... does not exists`
- `[OCR] Det model init failed, trying naive_det (no position/boxes).`

引擎会回退到 `naive_det`（仅文字，无框）。若要 **position/boxes**（如 CN 登录点击），需有检测模型。

## 3. 自动下载（huggingface_hub）

若报 **'huggingface-cli' is not recognized**，可安装 Hugging Face 库（本项目在 third_party 中会初始化，未装时请手动安装）：

```bash
pip install huggingface_hub
```

可选：`huggingface-cli login` 或设置 `HF_TOKEN`。公开的 cnstd-cnocr-models 一般无需登录。

## 4. 本应用检测模型回退顺序

1. `db_shufflenet_v2_small`（CnSTD 原生，安装 huggingface_hub 后多可自动下载）
2. `ch_PP-OCRv5_det`、`ch_PP-OCRv4_det`、`ch_PP-OCRv3_det`
3. `naive_det`（无检测模型，仅文字无框）

## 5. 自动下载失败时手动放置模型

模型目录（CnOCR/CnSTD 共用）：

- Windows: `C:\Users\<user>\AppData\Roaming\cnstd\1.2\`
- Linux/Mac: `~/.cnstd/1.2/`

**来源：**

- [Hugging Face cnstd-cnocr-models](https://huggingface.co/breezedeus/cnstd-cnocr-models) → `models/cnstd/1.2/` 下对应 zip
- [百度网盘](https://pan.baidu.com/s/1zDMzArCDrrXHWL0AWxwYQQ?pwd=nstd)（提取码 `nstd`）

将 zip 放入上述 `1.2` 目录，部分版本会自动解压；或解压出 `ppocr/ch_PP-OCRv5_det/` 且内含 `ch_PP-OCRv5_det_infer.onnx`。

## References

- CnOCR（本项目使用的 OCR 包）: https://github.com/breezedeus/CnOCR  
- CnOCR 安装: https://cnocr.readthedocs.io/zh-cn/stable/install/  
- CnSTD（CnOCR 内部用于检测）: https://github.com/breezedeus/CnSTD  
- 模型仓库: https://huggingface.co/breezedeus/cnstd-cnocr-models  
