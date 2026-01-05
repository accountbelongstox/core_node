推荐组合方案
方案1：高性能组合
FFmpeg → faster-whisper → edge-tts → FFmpeg
(视频提取音频) → (语音转文字) → (文字转语音) → (合成视频)
FFmpeg → faster-whisper → edge-tts → FFmpeg(视频提取音频) → (语音转文字) → (文字转语音) → (合成视频)
方案2：高精度组合
FFmpeg → WhisperX → GPT-SoVITS → MoviePy
(单词级时间轴) → (高质量配音) → (视频合成)
FFmpeg → WhisperX → GPT-SoVITS → MoviePy(单词级时间轴) → (高质量配音) → (视频合成)
方案3：离线组合
FFmpeg → Vosk → pyttsx3 → MoviePy
(完全离线，无需网络)
FFmpeg → Vosk → pyttsx3 → MoviePy(完全离线，无需网络)
方案4：实时处理组合
FFmpeg → sherpa-onnx → edge-tts
(实时语音识别和合成)
FFmpeg → sherpa-onnx → edge-tts

scripts 在该目录下 写一个合适的目录，并在目录中创建方案1，方案2的代码，需求是：指定一个目录，自动在该目录的../下建白输出目录/${视频md5编码目录}，对每个视频 使用md5编码，得到视频压缩文件、音频压缩文件(md5编码)、字幕(md5编码)、字幕对应的句子集音频(../${输出目录}/${视频md5编码目录}/字幕句子子目录)、映射表。

编写一个共公库，自动安装必要的包。不要使用catch方法。而是确保存前置方法进行了安装。