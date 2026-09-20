# Project-managed Dockerfile for CosyVoice (official repo installs natively via
# conda python=3.10; no official image - https://github.com/FunAudioLLM/CosyVoice).
# CPU-only base; GPU is layered by compose.gpu.yml plus the TORCH_INDEX build arg.
FROM python:3.10-slim

ARG TORCH_INDEX=https://download.pytorch.org/whl/cpu
ARG TTS_DEVICE=cpu

RUN apt-get update \
    && apt-get install -y --no-install-recommends git git-lfs ffmpeg sox libsox-dev libsndfile1 build-essential pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/cosyvoice
RUN git clone --depth 1 https://github.com/FunAudioLLM/CosyVoice.git . \
    && git submodule update --init --recursive
# CPU image: drop GPU-only upstream pins (tensorrt-cu12* are stub sdists whose
# metadata build hangs; onnxruntime-gpu pulls the CUDA onnxruntime feed).
RUN if [ "$TTS_DEVICE" = "cpu" ]; then \
        sed -i -E -e '/^--extra-index-url .*aiinfra\.pkgs\.visualstudio\.com/Id' \
            -e '/^(tensorrt|onnxruntime-gpu)/Id' requirements.txt; \
    fi
COPY cosyvoice_build_constraints.txt ./
# pip upgrade first: PIP_BUILD_CONSTRAINT requires pip >= 25.1. The constraint
# pins setuptools<81 inside isolated build envs so legacy sdists pinned by the
# upstream requirements (e.g. openai-whisper==20231117, `import pkg_resources`
# in setup.py) still build.
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r cosyvoice_build_constraints.txt \
    && export PIP_BUILD_CONSTRAINT=/opt/cosyvoice/cosyvoice_build_constraints.txt \
    && pip install --no-cache-dir --index-url "$TORCH_INDEX" --extra-index-url https://pypi.org/simple/ torch torchaudio \
    && pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir fastapi "uvicorn[standard]" modelscope huggingface_hub onnxruntime

ENV MODELSCOPE_CACHE=/data/modelscope
# Upstream main's fastapi server preloads the prompt wav into a tensor and hands
# it to inference_zero_shot/cross_lingual/instruct2, but the current frontend
# expects a file-like it can load_wav() at several sample rates (load_wav(tensor)
# raises TypeError: Invalid file). A raw UploadFile stream is exhausted after the
# first read (soundfile: Format not recognised on the 2nd/3rd load), so persist
# the upload to a temp file and pass its path instead.
# Placed after the expensive pip layers so the patch keeps the build cache.
RUN sed -i \
    -e 's|prompt_speech_16k = load_wav(prompt_wav\.file, 16000)|_prompt_tmp = __import__("tempfile").NamedTemporaryFile(suffix=".wav", delete=False)\n    _prompt_tmp.write(await prompt_wav.read())\n    _prompt_tmp.close()\n    prompt_speech_16k = _prompt_tmp.name|' \
    runtime/python/fastapi/server.py
EXPOSE 50000
CMD ["python", "runtime/python/fastapi/server.py", "--port", "50000", "--model_dir", "iic/CosyVoice2-0.5B"]
