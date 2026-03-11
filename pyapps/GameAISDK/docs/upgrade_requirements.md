# GameAISDK 第三方包升级要求文档

本文档基于当前代码中声明的依赖版本与 PyPI 最新版本对比，并结合官方迁移说明整理差异与升级要求。涉及文件：`requirements.txt`、`requirements_SDKTool.txt`、`Modules/server/rainbow/requirements.txt`。

---

## 一、当前版本与 PyPI 最新版本对照

### 1. 核心运行时 / 训练栈

| 包名 | 当前要求版本 | PyPI 最新版本 | 说明 |
|------|--------------|---------------|------|
| numpy | 1.14.5 | **2.4.2** | 跨大版本，见下文 NumPy 2.0 差异 |
| tensorflow | 1.10.0 | **2.20.0** | TF1→TF2 为重大迁移 |
| tensorboard | 1.10.0 | 随 tensorflow 2.x（~2.20.0） | 与 TF 版本绑定 |
| torch | 1.3.0+cpu | **2.10.0** | 需与 torchvision 配对 |
| torchvision | 0.4.1+cpu | **0.25.0** | 官方表：torch 2.10 ↔ torchvision 0.25 |
| onnx | 1.5 | **1.20.1** | 新版本要求 Python ≥3.10、protobuf≥4.25、numpy≥1.23 |

### 2. 图像 / 视觉与 UI（SDKTool）

| 包名 | 当前要求版本 | PyPI 最新版本 | 说明 |
|------|--------------|---------------|------|
| opencv-python | 3.4.2.17 | **4.13.0.92** | 主版本升级，部分 C API/常量有变 |
| PyQt5 | 5.12.2 | **5.15.11** | 小版本升级，相对平滑 |
| PyQt5-sip | 12.7.1 | 随 PyQt5（如 &lt;13,≥12.15） | 与 PyQt5 配套 |
| labelme | 3.16.7 | **5.11.3** | 大版本跳跃，依赖链与 API 均有变化 |
| matplotlib | 3.0.3 | 当前最新 3.x | 可酌情升级到 3.8+ |
| Pillow | 6.2.2 | 当前最新 10.x | 建议先确认与 opencv/labelme 兼容 |

### 3. 序列化与通信

| 包名 | 当前要求版本 | PyPI 最新版本 | 说明 |
|------|--------------|---------------|------|
| protobuf | 3.7.0 | **6.33.5** | 主版本跨度大，TF/grpcio 等依赖会约束实际可用版本 |
| grpcio | 1.27.2 | 当前最新 1.x/2.x | 需与 tensorflow 及 protobuf 版本一致 |
| pyzmq | 18.0.1 | 当前最新 26.x | 一般可向后兼容 |
| msgpack | 0.6.1 | 当前最新 1.x | 需确认是否仍用旧二进制格式 |

### 4. 其他常用依赖

| 包名 | 当前要求版本 | PyPI 最新版本 | 说明 |
|------|--------------|---------------|------|
| requests | 2.23.0 | 2.32+ | 小版本升级即可 |
| h5py | 2.9.0 | 3.11+ | TF2/Keras 常与 3.x 搭配 |
| absl-py | 0.9.0 | 随 TF | 由 tensorflow 拉取 |
| Werkzeug | 1.0.0 | 3.x | tensorboard 会约束版本 |
| certifi / chardet / idna / urllib3 | 见 requirements | 可升级到当前稳定版 | 建议与 requests 一起测 |

---

## 二、官方文档差异与迁移要点

### 2.1 NumPy 1.14 → 2.x（2.0 迁移指南）

- **Python**：NumPy 2.x 当前最新要求 **Python ≥3.11**（2.4.2 的 requires_python）。
- **ABI**：2.0 为 ABI 破坏性更新，针对 NumPy C API 编译的扩展（如部分旧版 scipy、opencv 源码构建、旧版 tensorflow/torch 等）需用 NumPy 2.x 重新编译或使用支持 2.x 的预编译轮子。
- **API 移除**（摘要）：  
  - 类型别名：`np.float_` → `np.float64`，`np.int_` → `np.int64`，`np.bool_` → `np.bool8`，`np.string_` → `np.bytes_`，`np.unicode_` → `np.str_`，`np.Inf`/`np.NaN` → `np.inf`/`np.nan` 等。  
  - 函数：如 `np.geterrobj`/`np.seterrobj`、`np.cast`、`np.source`、`np.lookfor`、`np.asfarray`、`np.find_common_type`、`np.round_`、`np.recfromcsv`/`np.recfromtxt` 等已移除或迁移到子模块。  
  - `np.mat` 已移除，可用 `np.asmatrix`（仍存在）或直接改用 ndarray。
- **行为与兼容**：  
  - NEP 50 类型提升规则变更，混合类型运算结果可能与 1.x 不同。  
  - `np.linalg.lstsq` 的 `rcond` 默认值变更；需旧行为时显式传 `rcond=-1`。  
  - `loadtxt`/`genfromtxt` 默认编码等行为有变，建议显式指定 `encoding`。  
- **建议**：若暂不升级 Python 或依赖链，可先升级到 **NumPy 1.26.x**（1.x 最后一代），再按 [NumPy 2.0 migration guide](https://numpy.org/doc/stable/numpy_2_0_migration_guide.html) 逐步适配 2.x。

### 2.2 TensorFlow 1.10 → 2.x

- **运行方式**：TF2 默认 Eager Execution，不再使用 `tf.Session`/`tf.placeholder` 的图与会话模式。
- **API 变更**：大量 `tf.*` 命名空间调整，部分移至 `tf.compat.v1`；`tf.contrib` 已移除，需用等价替代（如 Keras、TF Hub、单独库）。
- **依赖**：TF 2.20 要求例如 `protobuf>=5.28.0`、`numpy>=1.26.0`、`keras>=3.10.0`、`h5py>=3.11.0` 等，与当前 GameAISDK 的 protobuf 3.7、numpy 1.14 不兼容，需整体规划。
- **参考**：官方 [TF 迁移指南](https://www.tensorflow.org/guide/migrate) 与 [TF 2.0 升级脚本](https://www.tensorflow.org/guide/upgrade)。

### 2.3 PyTorch 1.3 → 2.x 与 torchvision

- **版本对应**：官方说明 torch 2.10 对应 torchvision **0.25**，且要求 **Python ≥3.10**；当前使用 1.3.0+0.4.1 为旧配对。
- **API**：多数常用 API 保持兼容，但部分废弃接口移除、参数默认值或行为微调，需结合 [PyTorch 发布说明与迁移说明](https://pytorch.org/docs/stable/index.html) 逐模块检查。
- **安装**：若继续使用 CPU 版，需从 [PyTorch 官方安装页](https://pytorch.org/get-started/locally/) 选择对应 Python 与平台命令（当前写法中的 `-f https://download.pytorch.org/whl/...` 可能已过时）。

### 2.4 OpenCV 3.4 → 4.x

- **C++/C API**：部分枚举、函数签名或返回值有变，若存在自研 C 扩展或旧教程代码需对照 [OpenCV 4 文档](https://docs.opencv.org/) 修改。
- **Python 绑定**：`cv2` 接口大多保留，但如 `cv2.CAP_PROP_*`、部分算法模块（如部分 contrib）可能有调整或移除，需跑一遍现有脚本与用例。

### 2.5 Protobuf 3.7 → 4.x/5.x/6.x

- **TensorFlow / gRPC**：实际可用的 protobuf 版本受 tensorflow、grpcio 等约束，需以 `pip install tensorflow==...` 后的依赖解析为准，避免单独将 protobuf 升至 6.x 导致 TF 报错。
- **API**：高版本对生成的 `*_pb2` 模块与运行时 API 有少量不兼容，建议在单独环境中先验证现有 proto 文件与读写代码。

### 2.6 ONNX 1.5 → 1.20

- **要求**：当前 PyPI 1.20.1 要求 **Python ≥3.10**，**numpy≥1.23.2**，**protobuf≥4.25.1**。
- **算子/opset**：新版本支持更高 opset，旧模型一般可读，但若涉及自定义算子或旧 opset，需在升级后做一次推理与导出回归。

### 2.7 Labelme 3.16 → 5.x

- **依赖**：新版本要求 **Python ≥3.10**，且依赖 `imgviz>=2.0`、`pyqt5>=5.14`、`osam` 等，与当前 SDKTool 的 PyQt5 5.12、Python 版本需一起考虑。
- **功能**：5.x 增加 AI 辅助标注等，API 与配置可能有变，若 SDKTool 深度集成 labelme，需对照 [labelme 文档](https://github.com/wkentaro/labelme) 做兼容与回归。

---

## 三、升级建议与优先级

1. **先统一 Python 版本**  
   若目标为使用 NumPy 2.x、TF 2.20、PyTorch 2.10、ONNX 1.20、Labelme 5.x，需至少 **Python 3.10**（部分建议 3.11）。当前基于 1.14/1.10/1.3 的依赖多面向 Python 3.5–3.7，与上述新包不兼容。

2. **分阶段升级，避免一次全换**  
   - **阶段一**：在维持 Python 3.8/3.9 的前提下，将 **numpy** 升至 **1.26.x**，**protobuf** 在满足 TF/grpcio 的前提下升至 4.x，**requests/urllib3/certifi** 等小版本升级，并跑通现有用例。  
   - **阶段二**：将 **PyTorch** 从 1.3 升至 2.x（如 2.2/2.4）+ 对应 **torchvision**，**opencv-python** 升至 4.x，**PyQt5** 升至 5.15，**labelme** 视集成程度升级或暂缓。  
   - **阶段三**：在 Python 3.10+ 环境下，将 **TensorFlow** 迁至 2.x，**NumPy** 迁至 2.x（若需要），**ONNX** 升至 1.20，并整体回归训练与推理流水线。

3. **依赖文件与环境隔离**  
   - 为 SDKTool 与 Rainbow 服务可考虑单独 `requirements_*.txt` 或约束文件，避免 UI 与训练栈互相拉高版本。  
   - 使用 venv/conda 并固定 `pip freeze` 或 `pip-compile` 生成锁文件，便于复现与回滚。

4. **必做校验**  
   - 训练脚本（含 TensorFlow/PyTorch/ONNX）在目标环境完整跑通。  
   - SDKTool 的 PyQt5、labelme、opencv 相关界面与标注流程回归。  
   - 与 core_node 主工程或其它子 app 的共用依赖（如 psutil、pyzmq）版本兼容性确认。

---

## 四、参考链接

- NumPy 2.0 发布说明与迁移：<https://numpy.org/doc/stable/release/2.0.0-notes.html>，<https://numpy.org/doc/stable/numpy_2_0_migration_guide.html>  
- TensorFlow 迁移：<https://www.tensorflow.org/guide/migrate>  
- PyTorch 与 torchvision 版本对应：<https://pypi.org/project/torchvision/> 描述中的版本表  
- ONNX 安装与版本：<https://pypi.org/project/onnx/>  
- OpenCV 文档：<https://docs.opencv.org/>  
- Labelme：<https://github.com/wkentaro/labelme>  
- 各包最新版本与 requires_python：<https://pypi.org/pypi/<包名>/json>  

---

## 五、升级步骤进度

每个包完成 3 步：**步骤 1** 是否改为 third_party 引用 → **步骤 2** 是否更新为最新包特性代码 → **步骤 3** 是否应用最新高级用法并更新 GameAISDK。每次对话只完成一个包的一个步骤。

| 包名 | 步骤 1：third_party 引用 | 步骤 2：最新包特性代码 | 步骤 3：最新高级用法 |
|------|--------------------------|------------------------|----------------------|
| psutil | ✅ 已完成 | ✅ 已完成 | ✅ 已完成 |
| mss | ✅ 已完成 | ✅ 已完成 | ✅ 已完成 |
| urllib3 | ✅ 已完成 | ✅ 已完成 | ✅ 已完成 |
| idna | ✅ 已完成 | ✅ 已完成 | ✅ 已完成 |
| chardet | ✅ 已完成 | ✅ 已完成 | ✅ 已完成 |
| requests | ✅ 已完成 | ✅ 已完成 | ✅ 已完成 |
| certifi | ✅ 已完成 | ✅ 已完成 | ✅ 已完成 |
| pyzmq | ✅ 已完成 | ✅ 已完成 | ✅ 已完成 |
| msgpack | ✅ 已完成 | ✅ 已完成 | ✅ 已完成 |
| Werkzeug | ✅ 已完成 | ✅ 已完成 | ✅ 已完成 |
| h5py | ✅ 已完成 | ✅ 已完成 | ✅ 已完成 |
| absl-py | ✅ 已完成 | ✅ 已完成 | ✅ 已完成 |
| protobuf | ✅ 已完成 | ✅ 已完成 | ✅ 已完成 |
| six | ✅ 已完成 | ✅ 已完成 | ✅ 已完成 |
| ultralytics (YOLO) | ✅ 已完成 | ✅ 已完成 | ✅ 已完成 |
| PyQt5 | ✅ 已完成 | ✅ 已完成 | ✅ 已完成 |
| opencv-python (cv2) | ✅ 已完成 | ✅ 已完成 | ✅ 已完成 |
| Pillow (PIL) | ✅ 已完成 | ✅ 已完成 | ✅ 已完成 |
| matplotlib | ✅ 已完成 | ✅ 已完成 | ✅ 已完成 |
| numpy | ✅ 已完成 | ✅ 已完成 | ✅ 已完成 |
| labelme | ✅ 已完成 | ✅ 已完成 | ✅ 已完成 |
| grpcio (grpc) | ✅ 已完成 | ✅ 已完成 | ✅ 已完成 |

**grpcio 步骤 3 说明**：对照 [gRPC Python 文档](https://grpc.github.io/grpc/python/) 高级用法：`grpc.aio` 异步 API（`grpc.aio.insecure_channel`、`grpc.aio.server`、async/await）、客户端/服务端拦截器（UnaryUnaryClientInterceptor、ServerInterceptor）、压缩（Compression.Gzip/Deflate）、认证（ssl_channel_credentials、metadata_call_credentials）、LocalConnectionType（UDS）、protos_and_services 等。GameAISDK 内无直接 `import grpc` 或调用 `get_third_package_grpc()` 的代码，grpcio 仅通过 tensorflow 等依赖间接使用，故无需在 GameAISDK 中应用上述高级用法。步骤 3 以「无适用改动」完成；若后续在 GameAISDK 内直接实现 gRPC 客户端/服务端，可经 `get_third_package_grpc()` 获取后采用 1.78 同步 API 或 `grpc.aio` 异步 API 及拦截器、压缩等。

**grpcio 步骤 2 说明**：对照 [gRPC Python 文档](https://grpc.github.io/grpc/python/)（当前 1.76/1.78）：同步 API（`grpc.insecure_channel`、`grpc.secure_channel`、`grpc.server()`、Channel/Server、StatusCode、RpcError 等）与 1.27 保持兼容；1.78 要求 Python ≥3.9，提供 `grpc.aio` 异步 API。GameAISDK 内无直接 `import grpc` 或调用 `get_third_package_grpc()` 的代码，grpcio 仅通过 tensorflow 等依赖间接使用；步骤 1 已不限定 third_party 版本，安装即用最新版。无需修改业务代码，步骤 2 以「无直接使用、满足最新包特性」完成。

**grpcio 步骤 1 说明**：在 `pycore.pyfoundations.third_party` 中新增 `grpc` 的 DEPENDENCY_MAP 条目（不限定版本，项目统一升级到最新；import 名为 `grpc`，PyPI 包名为 grpcio；当前 PyPI 最新 1.78.x，Python ≥3.9）与 `get_third_package_grpc()` 懒加载。GameAISDK 的 `requirements.txt` 中注释 `grpcio==1.27.2`，改为说明由 pycore third_party 提供（tensorflow 也可能拉取）。GameAISDK 内无直接 `import grpc` 的代码，grpcio 仅通过 tensorflow 等依赖间接使用，故本步无需改业务代码；若后续在 GameAISDK 中直接使用 gRPC 客户端/服务端，可经 `get_third_package_grpc()` 获取后使用。

**labelme 步骤 3 说明**：对照 [labelme 5.x 用法](https://github.com/wkentaro/labelme) 与 [安装文档](https://www.labelme.io/docs/install-labelme-terminal)：高级用法包括 CLI（`labelme`、`--output`、`--config`、`--labels`、`--nodata`）、配置 `~/.labelmerc` / `default_config.yaml`、VOC/COCO 导出、AI 辅助标注（SAM、YOLO-world 等）、多语言 `LANG=zh_CN.UTF-8 labelme`。GameAISDK 内无直接 `import labelme` 或调用 `get_third_package_labelme()` 的代码，标注相关逻辑使用 labelImg（yolo_label_lib）及自研 VOC/XML 流程，labelme 仅作为可选依赖供用户独立启动。无需在 GameAISDK 中应用上述高级用法，步骤 3 以「无适用改动」完成；若后续在 SDKTool 内集成 labelme（如子进程启动、读取 labelme JSON），可经 `get_third_package_labelme()` 获取并采用 5.x CLI/API。

**labelme 步骤 2 说明**：对照 [labelme 文档](https://github.com/wkentaro/labelme) 与 PyPI 5.11.3（Python ≥3.10）：5.x 依赖 imgviz≥2.0、PyQt5≥5.14、osam 等；CLI 仍为 `labelme` / `labelme --help`，首次运行生成 `~/.labelmerc`，完整配置见 `default_config.yaml`；支持 polygon/rectangle/circle/line/point、VOC/COCO 导出、AI 辅助标注等。GameAISDK 内无直接 `import labelme` 或调用 `get_third_package_labelme()` 的代码，labelme 仅作为 requirements_SDKTool 可选依赖供独立启动或命令行使用；步骤 1 已不限定 third_party 版本，安装即用最新版。无需修改业务代码，步骤 2 以「无直接使用、满足最新包特性」完成。

**labelme 步骤 1 说明**：在 `pycore.pyfoundations.third_party` 中新增 `labelme` 的 DEPENDENCY_MAP 条目（不限定版本，项目统一升级到最新；import 名为 `labelme`，PyPI 包名为 labelme；当前 PyPI 最新 5.11.3，Python ≥3.10）与 `get_third_package_labelme()` 懒加载。GameAISDK 的 `requirements_SDKTool.txt` 中注释 `labelme==3.16.7`，改为说明由 pycore third_party 提供。GameAISDK 内暂无直接 `import labelme` 的代码（labelme 多为独立启动或命令行使用），故本步无需改业务代码；若后续在 SDKTool 中通过代码调用 labelme，可经 `get_third_package_labelme()` 获取后使用。

**numpy 步骤 3 说明**：对照 [NumPy errstate](https://numpy.org/doc/stable/reference/generated/numpy.errstate.html) 与 2.0 迁移指南，推荐使用 `np.errstate` 上下文管理器替代全局 `np.seterr`，以限定浮点异常忽略范围且 2.0 起线程/asyncio 安全。在 `action_sampler.py` 中移除模块级 `np.seterr(divide='ignore', invalid='ignore')`，在 `_is_direction_equal` 内对 `np.sqrt`/除法/`np.arccos` 使用 `with np.errstate(divide='ignore', invalid='ignore'):` 包裹，应用 NumPy 2.x 推荐高级用法。`CfgParse.py` 中 seterr 为下游 Imitation Learning 浮点运算保留，后续可改为在训练入口使用 errstate。其余高级用法（如 `np.random.Generator`、`numpy.strings`、structured arrays）当前场景无强制需要，步骤 3 以「action_sampler 应用 errstate」完成。

**numpy 步骤 2 说明**：对照 [NumPy 2.0 migration guide](https://numpy.org/doc/stable/numpy_2_0_migration_guide.html) 与 [NumPy 2.4 API](https://numpy.org/doc/stable/)：二进制数据改用 `np.frombuffer(..., dtype=np.uint8)` 替代已弃用的 `np.fromstring(..., np.uint8)`；类型别名 `np.bool` 在 2.0 中移除，改用 `bool` 或 `.astype(bool)`；`np.str` 作为标量转换已移除，改用 Python `str()`。已修改：`AgentMsgMgr.py`、`agent_msg_mgr.py`、`server.py`（rainbow）、`MsgHandler.py`、`UIControlAPI.py`、`ImgDecode.py` 中 `np.fromstring` → `np.frombuffer`；`voc_eval.py` 中 `.astype(np.bool)` → `.astype(bool)`；`Network.py` 中 `np.str(trainIter)`/`np.str(indexAccValMax)` → `str(...)`。third_party 不限定 numpy 版本，安装即用最新版（当前 PyPI 2.4.x，Python ≥3.11）。

**numpy 步骤 1 说明**：在 `pycore.pyfoundations.third_party` 中保留 `numpy` 的 DEPENDENCY_MAP 条目，**移除版本约束**（由原 `numpy<2.3.0,>=2` 改为 `numpy`，与「不要在 thirdparty 中限定包版本」一致；opencv-python 等依赖的版本要求由 pip 在安装时自动解析）。GameAISDK 的 `requirements.txt`、`requirements_SDKTool.txt`、`Modules/server/rainbow/requirements.txt` 中注释 `numpy==1.14.5`，改为说明由 pycore third_party 提供（`get_third_package_numpy()`）。GameAISDK 内已通过 `get_third_package_numpy()` 获取 numpy（如 `train_node.py`、`explore_result.py`、`AppExploreAI.py`、`capture.py`、`action_sampler.py`、`AgentMsgMgr.py`、`agent_msg_mgr.py`、`utils.py`、`windowsDeviceAPI_backup.py`、`circle.py` 等），所有 import 与 getter 调用均在文件开头，无需改业务代码。

**matplotlib 步骤 3 说明**：对照 [matplotlib API](https://matplotlib.org/stable/api/index.html) 与推荐用法：官方提供两种接口——Axes 显式接口（fig, ax = plt.subplots() 后使用 ax.plot/ax.set_title 等）与 pyplot 函数式接口。GameAISDK 在 `train_node.py`、`explore_result.py`、`train_sample.py` 中使用 pyplot + plt.subplots() + plt.sca(ax) 切换子图，已满足当前需求且与 3.x 兼容；高级用法如 constrained_layout=True、plt.style.context、纯 OO 接口等适用于复杂布局或主题切换，当前场景无强制需要。步骤 3 以「无适用改动」完成；若后续希望统一为 OO 接口或启用 constrained_layout，可再改。

**matplotlib 步骤 2 说明**：对照 [matplotlib 文档](https://matplotlib.org/stable/) 与 [What's new 3.8+](https://matplotlib.org/stable/users/prev_whats_new/whats_new_3.8.0.html)（当前 PyPI 最新 3.10.x）：pyplot、figure、subplots、xlabel/ylabel/title、legend、tight_layout、bar、text、savefig、close、FontProperties、rcParams 等 API 在 3.0→3.8/3.10 保持兼容，无破坏性变更。GameAISDK 在 `train_node.py`、`explore_result.py`、`train_sample.py` 中仅使用上述接口，third_party 不限定 matplotlib 版本，安装即用最新版。无需修改业务代码，步骤 2 以「满足最新包特性」完成。

**matplotlib 步骤 1 说明**：在 `pycore.pyfoundations.third_party` 中新增 `matplotlib` 的 DEPENDENCY_MAP 条目（不限定版本，项目统一升级到最新；import 名为 `matplotlib`）与 `get_third_package_matplotlib()` 懒加载。GameAISDK 的 `requirements_SDKTool.txt` 中注释 `matplotlib==3.0.3`，改为说明由 pycore third_party 提供。GameAISDK 内 `train_node.py`、`explore_result.py`、`train_sample.py` 改为通过 `get_third_package_matplotlib()` 获取 matplotlib，使用 `matplotlib.pyplot`、`matplotlib.font_manager.FontProperties`，所有 import 与 getter 调用均在文件开头；`train_sample.py` 在 standalone 时 try/except ImportError 后 fallback 为直接 `import zmq`、`import matplotlib`，以支持无 pycore 运行。

**Pillow (PIL) 步骤 3 说明**：对照 [Pillow 高级用法](https://pillow.readthedocs.io/en/stable/handbook/image-file-formats.html) 与 Image.open/save、ImageDraw/ImageFont、Resampling、getbbox/textbbox、EXIF/ICC、多格式支持等。GameAISDK 内无直接 `import PIL` 或使用 `get_third_package_PIL_*` 的代码，Pillow 仅通过 labelme、matplotlib 等依赖间接使用，故无需在 GameAISDK 中应用上述高级用法。步骤 3 以「无适用改动」完成；若后续在 GameAISDK 内直接使用 PIL（如缩略图、格式转换、文字绘制），可经 `get_third_package_PIL_Image()` 等获取并采用 Pillow 10+/12.x 推荐 API（如 `Image.Resampling.LANCZOS`、`ImageDraw.textbbox()`、`Image.open(...).load(scale=...)` 等）。

**Pillow (PIL) 步骤 2 说明**：对照 [Pillow 文档](https://pillow.readthedocs.io/) 与 [Release notes](https://pillow.readthedocs.io/en/stable/releasenotes/index.html)（当前 PyPI 最新 12.1.1，Python ≥3.10；6.x→10.x/11.x/12.x 有 API 与弃用变更）。GameAISDK 内无直接 `import PIL` 或 `from PIL import Image` 等代码，Pillow 仅通过 labelme、matplotlib 等依赖间接使用；步骤 1 已不限定 third_party 版本，安装即用最新版。无需修改业务代码，步骤 2 以「无直接使用、满足最新包特性」完成。

**Pillow (PIL) 步骤 1 说明**：在 `pycore.pyfoundations.third_party` 中保留 `PIL` 的 DEPENDENCY_MAP 条目，**不限定版本**（由原 `Pillow<11,>=10` 改为 `Pillow`，与「不要在 thirdparty 中限定包版本」一致；tkhtmlview 0.3.2 要求 Pillow>=11,<13，pip 解析时兼容）。GameAISDK 的 `requirements_SDKTool.txt` 中注释 `Pillow==6.2.2`，改为说明由 pycore third_party 提供（`get_third_package_PIL` / `get_third_package_PIL_Image` 等）。GameAISDK 内通过 pycore 使用 PIL 处已为 third_party getter；若仍有直接 `import PIL` 或 `from PIL import Image`，后续步骤可改为 getter。本步仅完成 third_party 去版本限定与 requirements 注释。

**opencv-python 步骤 1 说明**：在 `pycore.pyfoundations.third_party` 中保留 `cv2` 的 DEPENDENCY_MAP 条目（不限定版本，项目统一升级到最新；import 名为 `cv2`，PyPI 包名为 opencv-python）。GameAISDK 的 `requirements.txt`、`requirements_SDKTool.txt` 中注释 `opencv-python==3.4.2.17`，改为说明由 pycore third_party 提供。GameAISDK 内已通过 `get_third_package_cv2()` 获取 cv2，所有使用处均在文件顶部引入，故本步无需改业务代码。

**opencv-python 步骤 2 说明**：对照 [OpenCV 4.x 文档](https://docs.opencv.org/4.x/) 与文档 2.4 节（3.4→4.x 部分枚举/C API 有变，Python 绑定 cv2 接口大多保留）。GameAISDK 中使用的 `cv2.imread`/`imwrite`/`imdecode`、`cvtColor`、`putText`、`FONT_HERSHEY_*`、`COLOR_*`、`THRESH_BINARY`、`IMREAD_COLOR`、`VideoWriter_fourcc`/`VideoWriter`、`LINE_AA`、`rectangle`/`circle`/`line` 等与 OpenCV 4.x 兼容，无需修改业务代码。third_party 不限定 opencv-python 版本，安装即用最新版（当前 PyPI 4.13.x）。

**opencv-python 步骤 3 说明**：对照 [OpenCV 4.x 文档](https://docs.opencv.org/4.x/) 高级用法：`cv2.data.haarcascades` 内置 Haar 级联路径、`cv2.samples.findFile` 查找示例文件、DNN 模块推理、以及显式调用 `VideoWriter.release()` 释放资源。GameAISDK 未使用 CascadeClassifier/Haar 级联（检测使用 YOLO/ultralytics/RefineNet）；`ResultManager` 与 `action_sampler` 中已在 `_FinishVideo`/`_finish_video` 中调用 `VideoWriter.release()`，符合推荐用法。无需引入 cv2.data/DNN/samples，步骤 3 以「无适用改动」完成；若后续使用 Haar 级联或 OpenCV DNN，可经 `get_third_package_cv2()` 获取后使用 `cv2.data.haarcascades` 或 `cv2.dnn`。

**PyQt5 步骤 2 说明**：对照 [PyQt5 5.15 文档](https://www.riverbankcomputing.com/static/Docs/PyQt5/) 与 [Incompatibilities](https://www.riverbankcomputing.com/static/Docs/PyQt5/incompatibilities.html)：5.12 起对 Python int→C++ 整型转换做溢出检查；5.11 起 sip 需通过 `from PyQt5 import sip` 使用。GameAISDK 未使用 sip 直接导入，现有 `from PyQt5.QtCore/QtGui/QtWidgets` 用法与 5.15 兼容。为使用 third_party 提供之 PyQt5，在 SDKTool 入口 `main.py` 中于任何 PyQt5 相关 import 之前调用 `get_third_package_PyQt5()`（当 pycore 可用时），从而在从 core_node 运行时由 third_party 初始化 PyQt5；standalone 时 try/except ImportError 跳过，仍使用环境已安装之 PyQt5。DEPENDENCY_MAP 已约束 `PyQt5>=5.15,<6`，满足最新包特性要求。

**PyQt5 步骤 3 说明**：对照 [PyQt5 5.15 参考](https://www.riverbankcomputing.com/static/Docs/PyQt5/) 与 Qt C++ API 命名：在 Python 3 下 PyQt5 推荐使用与 Qt 一致的 `exec()` 替代历史写法 `exec_()`（QApplication、QDialog、QMenu 等）。GameAISDK 中已统一替换：`main.py` 中 `tool_app.exec()`，`ui_canvas.py` / `ui_explore_node.py` / `op_tree.py` 中 `QMenu.exec(...)`，`project_rebuild_dlg.py` / `project_new_dlg.py` / `project_load_dlg.py` / `load_ui_dlg.py` / `label_text_dialog.py` 中 `QDialog.exec()`，以符合 PyQt5 5.15 推荐用法。

**PyQt5 步骤 1 说明**：在 `pycore.pyfoundations.third_party` 中新增 `PyQt5` 的 DEPENDENCY_MAP 条目（约束为 `PyQt5>=5.15,<6`，对应 PyPI 最新 5.15.11，import 名为 `PyQt5`；PyQt5-sip 由 PyQt5 依赖拉取，>=12.15,<13）与 `get_third_package_PyQt5()` 懒加载；GameAISDK 的 `requirements_SDKTool.txt` 中注释 `PyQt5==5.12.2` 与 `PyQt5-sip==12.7.1`，改为说明由 pycore third_party 提供。GameAISDK 内继续使用 `from PyQt5.QtGui` 等直接导入，只要环境中已安装 PyQt5（由 third_party 或 standalone 安装）即可，故本步无需改业务代码。

**Qt 版本说明**：pycore 使用 **PySide6**（Qt 6），见 `pycore.pyfoundations.third_party` 中 `PySide6` 及 `pycore.pyutils.native_ui.step5_main_ui.pyside6`；GameAISDK SDKTool 使用 **PyQt5**（见 `requirements_SDKTool.txt`），两者独立。

**ultralytics 步骤 1 说明**：pycore 已提供 `ultralytics` 的 DEPENDENCY_MAP 与 `get_third_package_ultralytics()` 懒加载；GameAISDK 未在 requirements 中固定 ultralytics 版本，由 third_party 提供。

**ultralytics 步骤 2 说明**：对照 [Ultralytics YOLO 文档](https://docs.ultralytics.com/modes/)（Predict/Train/Val/Export/Track/Benchmark）。在 `AppExploreAI.py` 中新增 ModelType `Ultralytics`：通过 `get_third_package_ultralytics()` 获取 ultralytics，使用 `YOLO(model_path)` 加载模型、`model.predict(image, conf=..., verbose=False)` 进行推理，将 `Results[0].boxes`（xyxy、conf、cls）与 `names` 转为与 Yolov3/RefineNet 一致的 `{'flag', 'bboxes'}` 格式；配置项为 `ButtonDetection.ModelPath` 或 `PtPath`（.pt 模型路径）、`Threshold`（置信度）。所有 import 在文件顶部，无在 catch 块中导入。

**ultralytics 步骤 3 说明**：对照 [Ultralytics 高级用法](https://docs.ultralytics.com/modes/predict/)（Results 的 plot/save、Export/Track/Benchmark 等）。在 `_RunUltralyticsDetector` 中应用 Results 高级用法：当 `Debug.ShowButton` 为 True 时，调用 `predictions[0].save(filename=...)` 将带框注的推理结果写入 `debug_ultralytics/latest.jpg`，便于调试；pycore 中 ultralytics 无版本约束，安装即用最新版（当前 PyPI 8.4.x，YOLO26 等）。

**protobuf 步骤 1 说明**：在 `pycore.pyfoundations.third_party` 中新增 `google.protobuf` 的 DEPENDENCY_MAP 条目（约束为 `protobuf>=3.7,<7`，对应 PyPI 最新 6.33.5，import 名为 `google.protobuf`；实际可用版本受 tensorflow/grpcio 约束，TF 2.20 要求 >=5.28.0，当前 TF 1.10.0 可能约束到较低版本）与 `get_third_package_google_protobuf()` 懒加载；GameAISDK 的 `requirements.txt`、`requirements_SDKTool.txt` 中注释 `protobuf==3.7.0`，改为说明由 pycore third_party 提供（tensorflow/grpcio 也可能拉取）。GameAISDK 内无直接 `import google.protobuf`，仅通过生成的 `*_pb2.py` 文件（如 `common_pb2`、`gameregProtoc_pb2`）间接使用，这些文件内部导入 `google.protobuf`，故无需改代码。

**protobuf 步骤 2 说明**：对照 [Protocol Buffers Python Generated Code](https://protobuf.dev/reference/python/python-generated/) 与 4.x/5.x/6.x 变更：生成的 `_pb2.py` 与 Message 接口（消息构造、字段读写、SerializeToString/ParseFromString、HasField/ClearField、repeated/map/oneof）在 3.7～6.x 间保持兼容。GameAISDK 仅通过 `common_pb2`、`gameregProtoc_pb2` 使用消息类与枚举，无直接调用 `google.protobuf` 顶层 API；步骤 1 已约束 `protobuf>=3.7,<7`，满足「最新包特性」要求，无需修改业务代码。

**protobuf 步骤 3 说明**：对照 [Protocol Buffers Python API](https://googleapis.dev/python/protobuf/latest/) 高级用法：`google.protobuf.json_format`（MessageToJson/Parse）、`text_format`、反射 API（Descriptor、FieldDescriptor）、Any.Pack/Unpack、Timestamp/Duration 等。GameAISDK 内无直接 `import google.protobuf`，仅通过生成的 `*_pb2` 做二进制序列化与消息字段访问，未使用上述高级模块。步骤 3 以「无适用改动」完成；若后续需 JSON/文本格式或反射，可经 `get_third_package_google_protobuf()` 获取后使用。

**six 步骤 1 说明**：在 `pycore.pyfoundations.third_party` 中新增 `six` 的 DEPENDENCY_MAP 条目（约束为 `six>=1.17.0`，对应 PyPI 最新 1.17.0，import 名为 `six`；six 是 Python 2/3 兼容库，主要用于向后兼容）与 `get_third_package_six()` 懒加载；GameAISDK 的 `requirements.txt`、`requirements_SDKTool.txt` 中注释 `six==1.14.0`，改为说明由 pycore third_party 提供（tensorflow/protobuf 等也可能拉取）。GameAISDK 内无直接 `import six`，仅通过 tensorflow/protobuf 等依赖间接使用，故无需改代码。

**six 步骤 2 说明**：对照 [six 文档](https://six.readthedocs.io/) 与 [PyPI six](https://pypi.org/pypi/six/)：当前最新为 1.17.0，API 保持稳定（`six.moves`、`six.string_types`、`six.integer_types`、`six.text_type`、`six.binary_type` 等）。GameAISDK 内无直接 `import six`，仅通过 tensorflow/protobuf 等依赖间接使用；步骤 1 已在 DEPENDENCY_MAP 中约束为 `six>=1.17.0`，满足「最新包特性」要求，无需改业务代码。

**six 步骤 3 说明**：对照 [six 文档](https://six.readthedocs.io/) 高级用法：`six.moves`（标准库重命名兼容）、`six.ensure_str`/`ensure_binary`/`ensure_text`、`six.with_metaclass`/`add_metaclass`、`six.raise_from`/`reraise`、`six.python_2_unicode_compatible`、unittest 断言别名等。GameAISDK 内无直接 `import six`，仅通过 tensorflow/protobuf 等依赖间接使用，故无需在业务代码中应用上述高级用法。步骤 3 以「无适用改动」完成；若后续需在 GameAISDK 中做 Py2/3 兼容或类型/异常封装，可经 `get_third_package_six()` 获取后使用。

**absl-py 步骤 3 说明**：对照 [Abseil Python 高级用法文档](https://abseil.io/docs/python/guides/)：`absl.app` 提供应用启动入口（`app.run(main)` 自动解析命令行参数）、`absl.flags` 提供分布式命令行标志系统（支持多种类型、验证器、从文件读取标志 `--flagfile`）、`absl.logging` 提供自定义日志模块（DEBUG/INFO/WARNING/ERROR/FATAL 级别）。GameAISDK 内无直接 `import absl`，仅通过 tensorflow 等依赖间接使用，故无需在业务代码中应用上述高级用法。若后续需直接使用（如将 `argparse` 迁移到 `absl.flags`、使用 `absl.logging` 替代标准 `logging`、使用 `absl.app.run()` 作为应用入口），可经 `get_third_package_absl()` 获取后使用。步骤 3 以「无适用改动」完成。

**absl-py 步骤 2 说明**：对照 [Abseil Python 文档](https://abseil.io/docs/python/) 与 PyPI 版本：2.x（当前最新 2.4.0）要求 Python ≥3.10，提供 app 启动、flags、logging、testing 等模块，与 0.9.x API 有部分差异。GameAISDK 内无直接使用 absl 的代码，仅通过 tensorflow 等依赖间接使用；步骤 1 已在 DEPENDENCY_MAP 中约束为 `absl-py>=2.0,<3`，满足「最新包特性」要求。若后续直接使用（如 `absl.app`、`absl.flags`、`absl.logging`），可经 `get_third_package_absl()` 获取并遵循 2.x API，无需改现有业务代码。

**absl-py 步骤 1 说明**：在 `pycore.pyfoundations.third_party` 中新增 `absl` 的 DEPENDENCY_MAP 条目（约束为 `absl-py>=2.0,<3`，对应 PyPI 最新 2.4.0，import 名为 `absl`；2.x 要求 Python ≥3.10）与 `get_third_package_absl()` 懒加载；GameAISDK 的 `requirements.txt` 中注释 `absl-py==0.9.0`，改为说明由 pycore third_party 提供（tensorflow 也可能拉取）。GameAISDK 内无直接 `import absl`，仅通过 tensorflow 等依赖间接使用，故无需改代码。

**h5py 步骤 1 说明**：在 `pycore.pyfoundations.third_party` 中新增 `h5py` 的 DEPENDENCY_MAP 条目（约束为 `h5py>=3.0,<4`，对应 PyPI 最新 3.x，import 名为 `h5py`；3.x 要求 Python ≥3.10）与 `get_third_package_h5py()` 懒加载；GameAISDK 的 `requirements.txt` 中注释 `h5py==2.9.0`，改为说明由 pycore third_party 提供（TF/Keras 也可能拉取）。GameAISDK 内无直接 `import h5py`，仅通过 tensorflow/Keras 等依赖间接使用，故无需改代码。

**h5py 步骤 2 说明**：对照 [h5py 3.x What's new](https://docs.h5py.org/en/stable/whatsnew/index.html)：3.0 有 breaking changes（File 需显式关闭、Group/Dataset/Datatype 构造变更、Unicode 对象名等）；3.x 要求 Python ≥3.10、numpy≥1.21.2，与 TF2/Keras 常用版本一致。GameAISDK 内无直接使用 h5py 的代码，仅通过 tensorflow/Keras 间接依赖；步骤 1 已在 DEPENDENCY_MAP 中约束为 `h5py>=3.0,<4`，满足「最新包特性」要求。若后续直接使用（如读写 HDF5 模型/权重），可经 `get_third_package_h5py()` 获取并遵循 3.x API（如 `h5py.File(..., "r")` 后显式 close 或使用 context manager），无需改现有业务代码。

**h5py 步骤 3 说明**：对照 [h5py 3.x 文档](https://docs.h5py.org/en/stable/quick.html) 与高级用法：File 作 context manager、Group/DataSet 字典式访问、create_dataset（chunks、compression）、attrs 元数据、visit/visititems 遍历、维度标尺等。GameAISDK 内无直接 `import h5py`，仅通过 tensorflow/Keras 间接使用，故无需在业务代码中应用上述高级用法。若后续需在 GameAISDK 内直接读写 HDF5（如模型权重、数据集），可经 `get_third_package_h5py()` 获取后使用 `with h5py.File(...) as f` 及 Group/Dataset/attrs API。步骤 3 以「无适用改动」完成。

**Werkzeug 步骤 1 说明**：在 `pycore.pyfoundations.third_party` 中新增 `werkzeug` 的 DEPENDENCY_MAP 条目（约束为 `Werkzeug>=3.0,<4`，对应 PyPI 最新 3.x，import 名为 `werkzeug`）与 `get_third_package_werkzeug()` 懒加载；GameAISDK 的 `requirements.txt` 中注释 `Werkzeug==1.0.0`，改为说明由 pycore third_party 提供（tensorboard 也可能拉取）。GameAISDK 内无直接 `import werkzeug`，仅通过 tensorboard 等依赖间接使用，故无需改代码。

**Werkzeug 步骤 2 说明**：对照 [Werkzeug 3.x 变更说明](https://werkzeug.palletsprojects.com/en/3.0.x/changes/)：3.0 移除已弃用 API、`generate_password_hash` 默认改用 scrypt、弃用 `__version__` 等；3.1 默认 `Request.max_form_memory_size` 500kB、弃用 OrderedMultiDict 等。GameAISDK 内无直接使用 werkzeug 的代码，仅通过 tensorboard 间接依赖；步骤 1 已在 DEPENDENCY_MAP 中约束为 `Werkzeug>=3.0,<4`，满足「最新包特性」要求。若后续直接使用，可经 `get_third_package_werkzeug()` 获取（如 `werkzeug.utils.secure_filename`、`werkzeug.serving.run_simple` 等），无需改现有业务代码。

**Werkzeug 步骤 3 说明**：对照 [Werkzeug 文档](https://werkzeug.palletsprojects.com/en/3.0.x/) 高级用法：Request/Response 包装、Map/Rule 路由、run_simple 开发服务器、Middleware（ProfilerMiddleware、SharedDataMiddleware 等）、secure_filename、generate_password_hash/check_password_hash、test Client 等。GameAISDK 内无直接 `import werkzeug`，仅通过 tensorboard 间接使用，故无需在业务代码中应用上述高级用法。若后续需在 GameAISDK 内直接使用（如本地调试服务、安全文件名、密码哈希等），可经 `get_third_package_werkzeug()` 获取后使用。步骤 3 以「无适用改动」完成。

**msgpack 步骤 1 说明**：在 `pycore.pyfoundations.third_party` 中新增 `msgpack` 的 DEPENDENCY_MAP 条目（约束为 `msgpack>=1.0,<2`，对应 PyPI 最新 1.x）与 `get_third_package_msgpack()` 懒加载；GameAISDK 的 `requirements.txt` 中注释 `msgpack==0.6.1`，改为说明由 pycore third_party 提供。在 `ZMQSocket.py`、`ResultManager.py`、`agent_msg_mgr.py`、`SocketThread.py`、`ActionMgr.py` 顶部改为通过 `get_third_package_msgpack()` 获取 msgpack（standalone 时 fallback 为 `import msgpack`），所有 import 保持在文件开头。msgpack-numpy 仍单独保留于 requirements。

**msgpack 步骤 2 说明**：对照 [msgpack 1.x 文档](https://msgpack-python.readthedocs.io/en/latest/) 与 PyPI 1.0 变更说明：Packer 的 `encoding` 已移除（始终 UTF-8），Unpacker 的 `encoding` 已移除（raw=False 时默认 UTF-8 解码为 str）。在 GameAISDK 中移除所有 packb/unpackb 的 `encoding='utf-8'` 参数：`ZMQSocket.py` 的 packb(source_server_id)、`SocketThread.py` 的 unpackb(object_hook=mn.decode)、`ResultManager.py` 的 unpackb(object_hook=mn.decode)、`agent_msg_mgr.py` 的 unpackb(object_hook=msgpack_numpy.decode)。packb 的 use_bin_type=True 在 1.x 中已是默认，现有调用保留该参数以保持意图明确。

**msgpack 步骤 3 说明**：对照 [msgpack 1.x Advanced usage](https://msgpack-python.readthedocs.io/en/latest/advanced.html) 与 API：高级用法包括 Packer(autoreset=False) 减少临时 bytes、Unpacker 流式解析多对象、datetime/timestamp 扩展类型、ext_hook/default 自定义类型。GameAISDK 当前为「每条 ZMQ/ socket 消息一帧」的 one-shot packb/unpackb，无连续流、无大 buffer 复用需求；unpackb 已由 len(packed) 限定解析范围，strict_map_key 默认 True 已防 hash DoS。不引入 Unpacker 流式或 Packer 复用，步骤 3 以「无适用改动」完成。

**pyzmq 步骤 1 说明**：在 `pycore.pyfoundations.third_party` 中新增 `zmq` 的 DEPENDENCY_MAP 条目（约束为 `pyzmq>=25,<28`，对应 PyPI 最新 27.x，import 名为 `zmq`）与 `get_third_package_zmq()` 懒加载；GameAISDK 的 `requirements.txt`、`requirements_SDKTool.txt` 中注释 `pyzmq==18.0.1` 与 `zmq==0.0.0`，改为说明由 pycore third_party 提供。在 `train_sample.py` 与 `ZMQSocket.py` 顶部改为通过 `get_third_package_zmq()` 获取 zmq（standalone 时 fallback 为 `import zmq`），所有 import 保持在文件开头。

**pyzmq 步骤 2 说明**：对照 [PyZMQ 27.x 文档与 changelog](https://pyzmq.readthedocs.io/en/latest/changelog.html)，18.x→25+/27 核心 API（Context、socket、bind/connect、recv/send、CONFLATE/IDENTITY/NOBLOCK、ZMQError）保持兼容。PyZMQ 24+ 建议显式关闭 socket 并调用 `context.term()`，避免依赖 GC 触发 `destroy()`（多线程下不安全）。据此：在 `train_sample.py` 中保留 `__zmq_context` 引用，在 `__delete_socket` 中关闭 socket 后调用 `self.__zmq_context.term()` 并置 None；在 `ZMQSocket.Finish()` 中关闭 socket 后调用 `self.__context.term()`。另修正 ZMQSocket 文档拼写 wheter→whether。

**pyzmq 步骤 3 说明**：按 [PyZMQ API](https://pyzmq.readthedocs.io/en/latest/api/zmq.html) 推荐，非阻塞收包应使用 `socket.poll(timeout)` 再 `recv()`，而非 `recv(flags=zmq.NOBLOCK)` 加固定 sleep。在 `train_sample.py` 的 `_recv_log` 循环中改为：先 `socket.poll(recv_poll_timeout_ms)`（1000 ms）检查是否有可读数据，若返回 0 则直接 continue 以定期检查 `exit_recv`/`__process_running`；若有事件再调用 `socket.recv()`（阻塞式，此时必有数据），并保留 `zmq.ZMQError` 处理。ZMQSocket 仅单 socket 阻塞收发，无多 socket 或异步需求，不引入 Poller/context manager 等额外用法；步骤 3 以「train_sample 应用 poll 高级用法」完成。

**certifi 步骤 1 说明**：从文档第四节「其他常用依赖」与 requests 相关依赖，在 `pycore.pyfoundations.third_party` 中新增 `certifi` 的 DEPENDENCY_MAP 条目（约束为 `certifi>=2024.2.0`，对应 PyPI 最新 2026.x）与 `get_third_package_certifi()` 懒加载；GameAISDK 的 `requirements.txt`、`requirements_SDKTool.txt` 中移除 `certifi==2019.11.28`，改为注释「由 pycore third_party 提供」。GameAISDK 内无直接 `import certifi`，仅通过 requests 间接使用，故无需改代码。

**certifi 步骤 2 说明**：对照 [certifi](https://github.com/certifi/python-certifi)（PyPI 最新 2026.x），API 仍为 `certifi.where()` 返回 CA bundle 路径，供 requests/urllib3 等验证 TLS。GameAISDK 内无直接使用 certifi 的代码，仅通过 requests 间接使用；步骤 1 已在 DEPENDENCY_MAP 中约束为 `certifi>=2024.2.0`，满足「最新包特性」要求，无需改业务代码。

**certifi 步骤 3 说明**：GameAISDK 内无直接 `import certifi`，仅通过 requests 间接使用，故无需在业务代码中应用 certifi 高级用法。certifi 仅提供 `where()` 返回 CA 路径，无其他高级 API；若后续需显式指定 CA 路径（如 `requests.get(..., verify=certifi.where())`），可经 `get_third_package_certifi()` 获取。步骤 3 以「无适用改动」完成。

**chardet 步骤 1 说明**：从文档第四节「其他常用依赖」倒序，idna 之后为 chardet。在 `pycore.pyfoundations.third_party` 中新增 `chardet` 的 DEPENDENCY_MAP 条目（约束为 `chardet>=5.0,<6`，对应 PyPI 最新 5.2.0）与 `get_third_package_chardet()` 懒加载；GameAISDK 的 `requirements.txt`、`requirements_SDKTool.txt` 中移除 `chardet==3.0.4`，改为注释「由 pycore third_party 提供」。GameAISDK 内无直接 `import chardet`，仅通过 requests 间接使用，故无需改代码。

**chardet 步骤 2 说明**：对照 [chardet 5.x 文档](https://chardet.readthedocs.io/)（当前 PyPI 5.2.0，Python ≥3.7）。5.x 主 API 仍为 `chardet.detect(bytes)` 返回 `{"encoding": str, "confidence": float}`；增量检测用 `UniversalDetector`。GameAISDK 内无直接使用 chardet 的代码，仅通过 requests 间接使用；步骤 1 已在 DEPENDENCY_MAP 中约束为 `chardet>=5.0,<6`，满足「最新包特性」要求，无需改业务代码。

**chardet 步骤 3 说明**：GameAISDK 内无直接 `import chardet`，仅通过 requests 间接使用，故无需在业务代码中应用 chardet 高级用法。若后续需直接检测编码，可经 `get_third_package_chardet()` 使用 chardet 5.x：`detect(bytes)` 单次检测、`UniversalDetector` 增量检测、根据 `confidence` 判断结果。步骤 3 以「无适用改动」完成。

**requests 步骤 3 说明**：GameAISDK 内无直接 `import requests`，仅通过依赖间接使用，故无需在业务代码中应用 requests 高级用法。若后续直接使用，可参考 [Requests 2.x Advanced Usage](https://requests.readthedocs.io/en/latest/user/advanced/)：使用 `requests.Session()` 做连接池与 cookie 保持、请求时显式传 `timeout`、用 `Response.raise_for_status()` 与 `requests.exceptions` 处理错误。步骤 3 以「无适用改动」完成。

**requests 步骤 2 说明**：GameAISDK 内无直接 `import requests`，仅通过依赖间接使用，故无需改业务代码。对照 [Requests 2.x 文档](https://requests.readthedocs.io/en/latest/)：2.x 建议请求时显式传 `timeout`、多请求用 `requests.Session()` 连接池。在 pycore `DEPENDENCY_MAP` 中将 requests 约束为 `requests>=2.28,<3`，保证通过 third_party 或依赖链获得 2.x，满足「最新包特性」要求。

**idna 步骤 1 说明**：从文档第四节「其他常用依赖」倒序，urllib3 之后为 idna。在 `pycore.pyfoundations.third_party` 中新增 `idna` 的 DEPENDENCY_MAP 条目与 `get_third_package_idna()` 懒加载；GameAISDK 的 `requirements.txt`、`requirements_SDKTool.txt` 中移除 `idna==2.9` / `idna==2.8`，改为注释「由 pycore third_party 提供」。GameAISDK 内无直接 `import idna`，仅通过 requests 间接使用，故无需改代码。

**idna 步骤 2 说明**：查阅 [PyPI idna](https://pypi.org/pypi/idna/json) 与官方说明，当前最新为 idna 3.11（Python ≥3.8）。idna 3.x 为 Python 3-only，支持 UTS 46 与 IDNA 2008，异常为 `idna.IDNAError` 及子类。GameAISDK 内无直接 `import idna`，仅通过 requests 间接使用；故在 third_party 的 DEPENDENCY_MAP 中将 idna 约束为 `idna>=3.0,<4`，确保通过 third_party 获得 3.x 特性，无需改 GameAISDK 业务代码。

**idna 步骤 3 说明**：idna 3.x 高级用法包括 UTS 46 兼容处理（`encode(..., uts46=True)`）、按标签的 `alabel`/`ulabel`、以及 `idna.IDNAError` 及其子类（如 `IDNABidiError`、`InvalidCodepoint`、`InvalidCodepointContext`）。GameAISDK 内无直接使用 idna 的代码，仅通过 requests 间接使用；若后续需直接处理国际化域名，可通过 `get_third_package_idna()` 获取 idna 并采用上述 API。无需修改现有业务代码，步骤 3 以文档说明完成。

**requests 步骤 1 说明**：pycore 已提供 `get_third_package_requests()` 与 DEPENDENCY_MAP。GameAISDK 内无直接 `import requests`，仅通过依赖间接使用。在 `requirements.txt`、`requirements_SDKTool.txt` 中注释 `requests==2.23.0`，改为说明「由 pycore third_party 提供」，与 urllib3/psutil 一致。

**mss 步骤 3 说明**：按 [python-mss Intensive Use](https://python-mss.readthedocs.io/usage.html) 推荐，将 MSS 实例保存为类属性并在多次截图中复用。在 `WindowsDeviceAPI` 中：`__init__` 设 `_mss_sct = None`；`Initialize` 中创建 `self._mss_sct = mss.mss()`；`DeInitialize` 中 `close()` 并置 `None`；`ScreenCap` 使用 `self._mss_sct.grab(monitor)`，避免每次截图都创建/销毁 MSS，更省资源且符合官方「save the MSS instance inside an attribute of your class」用法。

**mss 步骤 2 说明**：对照 [python-mss 10.x API](https://python-mss.readthedocs.io/api.html)，在 `windowsDeviceAPI_backup.WindowsDeviceAPI.ScreenCap` 中改用 `grab(monitor)` 的 monitor 字典形式 `{"left", "top", "width", "height"}`，与官方示例一致；对 `grab()` 返回的 ScreenShot 使用 `numpy.array(shot, dtype=numpy.uint8)[:, :, :3]` 显式取 BGR 通道供 OpenCV 使用。

**psutil 步骤 2 说明**：对照 [psutil 7.x 文档](https://psutil.readthedocs.io/en/latest/)，在 `_recursive_kill` 中对子进程在 `terminate()` 后增加 `wait(timeout=2)`，超时则 `kill()` 再 `wait(1)`，避免僵尸进程，符合当前推荐用法。

**psutil 步骤 3 说明**：在 `MonitorManager.MonitorThread.run()` 中改用 `process_iter(attrs=['pid', 'name', 'cmdline'])` 一次性快照 API，从 `proc.info` 读取 pid/name/cmdline，避免迭代过程中进程退出导致的 NoSuchProcess，并减少系统调用，符合 [psutil 7.x process_iter 与 one-shot 用法](https://psutil.readthedocs.io/en/latest/#process-oneshot)。

**urllib3 步骤 1 说明**：从文档第四节「其他常用依赖」最后一个包起倒序处理。在 `pycore.pyfoundations.third_party` 中新增 `urllib3` 的 DEPENDENCY_MAP 条目与 `get_third_package_urllib3()` 懒加载；GameAISDK 的 `requirements.txt`、`requirements_SDKTool.txt` 中移除 `urllib3==1.24.1`，改为注释「由 pycore third_party 提供」。GameAISDK 内无直接 `import urllib3`，仅通过 requests 间接使用，故无需改代码。

**urllib3 步骤 2 说明**：查阅 [urllib3 2.x 文档](https://urllib3.readthedocs.io/en/stable/) 与 v2 Migration Guide，2.x 提供新顶层 API（如 `urllib3.request("GET", url)`）、连接池与 TLS 等特性。GameAISDK 内无直接使用 urllib3 的代码（仅 `train_node.py` 使用标准库 `urllib.request`），故无需改业务代码。在 third_party 的 DEPENDENCY_MAP 中将 urllib3 约束为 `urllib3>=2.0,<3`，确保通过 third_party 安装或 requests 依赖链获得 2.x，满足「最新包特性」要求。

**urllib3 步骤 3 说明**：按 [urllib3 Advanced Usage](https://urllib3.readthedocs.io/en/stable/advanced-usage.html) 与 2.x 推荐用法，在 `train_node.py` 中将对录制进程的退出通知由 `urllib.request.urlopen(cmd)` 改为通过 `get_third_package_urllib3()` 使用 `urllib3.request("GET", url, timeout=2.0)` 并 `resp.close()`，兼顾 third_party 引用、2.x 顶层 API 与超时避免挂起；standalone 时回退到 `urllib.request.urlopen(cmd, timeout=2)`。

---

*文档基于当前仓库 requirements 与 PyPI 信息整理，具体升级时请以各包官方文档和 CI/本地测试为准。*
