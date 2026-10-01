# Notebook nodes (Colab/Kaggle), local-models-only policy and local AI translation (2026-10-01)

Scope: `pyservice.sh colab|kaggle`, the notebook launcher, secret handling on notebook VMs, prerequisite
skip/timeout, the local-models-only policy across every AI/cloud gateway, and the local AI translation runtime
(Ollama + TranslateGemma) with the translation gateway switch. Windows and Linux stay aligned.

## 1. Notebook platform layer
- Entry: `./pyservice.sh colab|kaggle` (Linux only; `pyservice.ps1` prints a notice). Implies mode 2 (outbound-only
  Relay agent to Laravel, Mercure SSE + HTTP), `--no-ui`, `--no-reload`. TPU runtimes have no pycore backend
  (JAX/XLA only); inference runs on CPU, GPU runtimes use CUDA.
- Launcher: `%run <repo>/pycore/pyutils/notebook_boot.py colab|kaggle` (stdlib only, never imports pycore). Prints a
  7-step setup flow (platform, repository, Python, internet, accelerator, Google Drive, secret password), mounts
  Drive on Colab, resolves the password (env `CORE_NODE_SECRET_PASSWORD` -> Colab/Kaggle notebook secret -> getpass),
  passes `NOTEBOOK_PLATFORM_DETECTED` / `NOTEBOOK_ACCELERATOR` and runs `bash pyservice.sh <platform>`; the password
  lives only in the child environment. Interrupting the cell sends SIGINT.
- The notebook never installs anything: every installer runs inside pyservice (`prepare_pycore_prerequisites.sh`).
- Detection: Kaggle only by `KAGGLE_KERNEL_RUN_TYPE` (Colab also creates `/kaggle/input`); Colab by
  `import google.colab` or `COLAB_*`.
- `scripts/shells/linux/common/notebook_runtime.sh` (central): persist root (Colab
  `/content/drive/MyDrive/core_node_notebook`, Kaggle `/kaggle/working/core_node_notebook`, override
  `NOTEBOOK_PERSIST_DIR`), `CORE_NODE_DATA_DIR` under it, `CORE_NODE_DATA_OWNER=root`, `PROMPT_TTY_DISABLED=1`,
  `NONINTERACTIVE=1`, toolchain caches (uv/npm), `HF_HUB_DISABLE_SYMLINKS`, `UV_LINK_MODE=copy`.
- Model cache: Drive FUSE lacks symlink/chmod semantics -> sync mode (local cache, rsync/tar copy-missing restore,
  periodic save every `NOTEBOOK_CACHE_SAVE_SECONDS=600`, final save on exit via `notebook_run_worker`; partial files
  `*.incomplete|*.lock|*.part|*.tmp` excluded). Kaggle uses link mode.
- Idempotency: VM marker `notebook_vm_ready` (first run on a VM always installs, `--no-install` ignored) and persist
  marker `.cache_initialized`; seeds from an earlier persist root when found.
- Launch summary (`notebook_print_summary`): platform, accelerator, persist root, data dir, cache state, installers,
  encrypted secrets left, Relay identity, Laravel API, AI services state.
- README holds the one-click cells (GitHub and Gitee clone, then `%run ... notebook_boot.py`).

## 2. Secrets on notebook VMs
- Encrypted store `.secret_keys/already_encrypted/*.js`, decrypted to `.secret_keys/.secret_ignore/` through
  `secret_password_runner.js` (password via stdin/env, never argv). Only still-encrypted files are decrypted, with a
  15 s heartbeat.
- Relay identity: secret `PYCORE_RELAY_DEVICE_IDENTITY_1` (base64) -> `$CORE_NODE_DATA_DIR/config/pycore_relay_identity.json`.
  Without it the VM enrolls as a new device; after claiming it in Laravel save it with
  `./pyservice.sh colab --export-identity` (main-password guarded) and commit the `.js`.
- Password split: names encrypted with a second password are tracked in `.secret_keys/password_mismatch.list`;
  the reference file excludes them, every encrypt path verifies the main password first
  (`secret_confirm_main_password` / `Confirm-SecretMainPassword` / `password_is_main`), and dd offers
  "re-encrypt from .secret_ignore" once (default yes); after re-encryption the names leave the list.

## 3. Prerequisite skip/timeout
- `prepare_pycore_prerequisites.sh`: a step that fails or exceeds `PYCORE_PREREQ_STEP_TIMEOUT_SECONDS`
  (`timeout --kill-after=30`; unset = unlimited) prints `[skip] ...` and is retried on the next run; a summary
  lists skipped steps. Notebook default 1800 s (`NOTEBOOK_PREREQ_STEP_TIMEOUT_SECONDS`).
- HF repo installs walk the catalog once (`install_hf_repo_flat`), not once per file.
- `ensure_pip_for_base`: `python<ver>-venv` for a system interpreter without ensurepip, then get-pip.py fallback.

## 4. Local-models-only policy (all gateways)
Goal: a notebook node never spends the stored third-party keys and never calls third-party AI/cloud services
(keyed or keyless); it only offers its local GPU/CPU models to api.si.12gm.com.

- Switch: `pycore/pyfoundations/notebook_policy.py` -> `local_models_only()` is true when `NOTEBOOK_PLATFORM` is
  colab|kaggle (exported by `notebook_runtime.sh`) or `PYCORE_LOCAL_MODELS_ONLY=1` (any host).
- Layer 1, secrets (`secret_manager._secret_allowed`): only the client key (`client_key_auth.secret_key_base`,
  `CORE_NODE_CLIENT_KEY*`) resolves; every other secret, including OS-environment keys, resolves empty. Covers AI
  providers, balance checks, image providers, ai_cluster clients, Azure Speech, StreamElements, Forvo, TMDB/OMDB,
  SerpAPI.
- Layer 2, boot registry (`model_boot`): every manifest entry with `cloud=True` gets a `blocked` verdict with code
  `model_local_models_only` (`model_reasons.py`; UI text in `PcAiHubLocales.ts` en/zh), also before boot ran.
  `model_boot.policy_reason(id, category)` and `third_party_block_reason(service)` are the shared helpers;
  `ThirdPartyServiceBlocked` is raised by blocked clients.
- Bypass paths closed:
  - `ai_balance.balance_one` returns the coded reason.
  - TTS per-engine test `synthesize_engine` refuses cloud engines.
  - Edge TTS client: synth, live probe and background probe are gated in the client.
  - googletrans: `GoogleTranslator` / `Romanizer` raise; the worker chain skips google.
  - Fish Audio cloud: `fishspeech_engine.fish_api_key()` is the single reader; the class-C server gets `FISH_API_KEY`
    cleared.
  - Startup AI probe (`warm_startup_probe`) is skipped.
- Text generation: `ai_gateway.generate_text` routes to the local LLM orchestrator (ollama -> lmstudio -> llamacpp)
  with each engine's default model.
- Verified: colab mode 0 third-party secrets readable, client key readable, 36/36 cloud entries blocked, 0 local
  entries blocked; normal mode unchanged (all secrets readable, nothing policy-blocked).

## 5. Local AI translation runtime
- Choice (2026 survey): Ollama (most popular local runtime, ~181k GitHub stars; GPU/CPU) + Google TranslateGemma
  (January 2026, Gemma 3 based, 55 languages; `translategemma:4b` = 3.3 GB, fits a T4 and runs on CPU). Colab has
  no built-in Ollama feature; Google's Gemma Cookbook and Kaggle community notebooks run the official `install.sh`
  plus a background `ollama serve` (root on Colab, no systemd needed). NLLB-200/Qwen2.5 installers exist but are
  not wired into pycore (the NLLB tester path `pytools/aitools/...` no longer exists).
- Single source: `config/service_contract.json` `local_ai`:
  `install_env=PYCORE_LOCAL_AI_INSTALL`, `ollama_port=11434`, `ollama_models_subdir=ollama/models`,
  `translate_model=translategemma:4b`. Shell reads it with `sc_get` (node -> php -> python3 fallback for fresh VMs),
  PowerShell with `Get-ServiceContractValue`, Python with `service_contract.value`.
- Installers (idempotent; keep binary/model, repair the missing part; pull resumable):
  - Linux `scripts/shells/linux/debian/install_shells/117_install_ollama.sh`: curl + zstd, official `install.sh`,
    temporary `ollama serve` when none answers, `ollama pull <translate_model>`.
  - Windows `scripts/shells/win/install_powershells/Step66_InstallOllama.ps1`: `winget install Ollama.Ollama`
    (user scope), same serve/pull logic; failures mark the step pending.
  - Model store: `OLLAMA_MODELS`, else `<shared cache>/ollama/models` (synced to Drive on Colab). A running system
    Ollama keeps its own store.
- Prerequisite entry `ollama` with install mode `local_ai` (Linux `PREREQ_ENTRIES`, Windows
  `PycorePrerequisitesList.ps1`; skip with `OLLAMA_SKIP=1`): runs only with `PYCORE_LOCAL_AI_INSTALL=1` or an
  explicit include (`./pyservice.sh --only -- --include ollama`, `.\pyservice.ps1 -Only -InstallInclude ollama`).
  `notebook_prepare_environment` sets it to 1 by default (caller wins).
- pycore: `llm_engines` reads port/model from the contract; ollama's default model is the translate model;
  `ollama_start_command` returns `(cwd, argv, env)` with `OLLAMA_MODELS` / `OLLAMA_HOST`.

## 6. Translation gateway
- `pycore/pyutils/translator/local_ai_translator.py`: provider `local_ai`; TranslateGemma prompt template (two blank
  lines before the text; `zh` -> `zh-Hans`; auto source guessed by script) through `llm_orchestrator.chat(engine=
  "ollama", model=translate_model, temperature=0)`; `unavailable_reason()`, `translate()`, `translate_many()`.
- Task chain (`task_capability_chains`): default `google -> local_ai -> ecdict -> wordnet -> ai`; on
  local-models-only nodes the effective chain is `local_ai` first and never google. Worker handler adds the
  `local_ai` branch.
- `manual_translation_service` (gateway): `translate_single`, `translate_batch`, `translate_ai` answer from local AI
  on local-models-only nodes (same response shape, `provider: local_ai`); `status()` reports `local_ai`
  availability and whether it is the gateway default.
- `ai_batch_translate.translate_chunk` and the worker label use local AI line by line on those nodes.
- UI settings default chain shows `google, local_ai, ecdict, wordnet, ai`.

## 7. Open items
- Not yet run end to end on Colab/Kaggle (Ollama install, pull, translation).
- General AI prompts on notebook nodes use TranslateGemma (translation-specialized); a general local model can be
  added to the contract when needed.
- NLLB-200 integration needs its tester/translator scripts restored first.
- faster-whisper/whisper are skipped by the free-disk policy on Colab; Drive free tier is 15 GB.
- 12 secrets in `password_mismatch.list` wait for the dd re-encryption on Windows.
