# Plan: Ark CLI — numbered launcher (ark${index}.ps1 / .sh)

## Goal
Add a new **Ark CLI** tool type to the Special Software Environment Manager,
parallel to Claude AI / Codex CLI / Kimi Code CLI. Selecting it generates
numbered `ark1.ps1` / `ark1.sh` … launchers (via the existing v4 launcher path)
that run Claude Code against the Volcano Ark Coding Plan endpoint with:

- **glm-5.2** model forced everywhere (default; overridable per-slot)
- **bypass all permissions** by default (`--permission-mode bypassPermissions --dangerously-skip-permissions`)
- **team multi-agent** default ON (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` always)
- **prompt**: multi-agent teammate mode? `[Y/n]` → adds `--teammate-mode in-process`
- **prompt**: ultracode? `[y/N]` → adds `--effort ultracode` (canonical flag; avoids PS JSON quote-mangling, per `[[claudeteam-ultracode-launcher]]`)

## Official-doc facts (verified against working state; web search returned nothing)
Repo-documented in `claudevolc.ps1` + the existing `'Volcano Ark'` config, and
confirmed by the current session running on glm-5.2 via this gateway:
- Endpoint: `https://ark.cn-beijing.volces.com/api/coding` (Anthropic-compatible)
- Model id: `glm-5.2`
- Auth: Ark API key as Bearer → `ANTHROPIC_AUTH_TOKEN`

## How it plugs in (no menu/script-handler edits needed)
- `MenuHandler` auto-discovers configs from `ConfigManager` + sorts A→Z by
  `DisplayName` → adding the entry makes "Ark CLI" appear + get a submenu
  (Add Global Command / Set Env Vars / View Scripts / Restore). Item numbers
  auto-adjust.
- `CommandHandler.add_global_command` for a `UseV4Launcher:True` config:
  `generate_scripts_for_config` (full template, then discarded) →
  `regenerate_all_v4_launchers_for_config` **overwrites** with the v4 lean
  template. So the final `ark1.ps1/.sh` = our ark v4 template.
- `file_number_manager.list_existing_scripts('ark')` globs `ark*.ps1/.sh` — works.
- `_collect_secret_file_numbers` scans `ARK_API_KEY_*` etc. → finds `#1`
  (key already stored by the existing `'Volcano Ark'` encrypted-constant config;
  ark-cli reuses the same `ARK_API_KEY_1` — no duplicate secret).
- `MCPSupport.Enabled=False` (lean launcher, like claudevolc/claudeteam; also
  avoids `get_mcp_sync_script_path('ark')` looking for a non-existent
  `ark_sync_mcp_servers.py`).

## Changes

### 1. NEW `scripts/pytools/special_software_env_manager/script_sections/ark_launcher_section.py`
`ArkLauncherSectionGenerator` with `generate_ps1()` + `generate_sh()`.
Modeled on `claudevolc.ps1` + `claudeteam.ps1` + the v4 template
(`ScriptManager._generate_v4_*_template`). Each generated script:
- path-init + dot-source `WindowsPathFunction.ps1` (Win) / `BASH_SOURCE` resolve (Linux)
- `Read-SecretFile` (BOM-safe) — reused verbatim from v4 template
- load `ARK_API_KEY_{n}`, `ARK_BASE_URL_{n}` (opt), `ANTHROPIC_MODEL_{n}` (opt)
- map: `ANTHROPIC_BASE_URL=ARK_BASE_URL or default`; `ANTHROPIC_AUTH_TOKEN=ARK_API_KEY`;
  `ANTHROPIC_MODEL=override or glm-5.2`; force into `CLAUDE_CODE_SUBAGENT_MODEL` +
  `ANTHROPIC_DEFAULT_HAIKU/SONNET_MODEL`
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` always
- error+exit if `ARK_API_KEY` missing
- prompt multi `[Y/n]` (default Y) + prompt ultracode `[y/N]` (default N)
- args: `--model glm-5.2 --permission-mode bypassPermissions --dangerously-skip-permissions`
  always (Win); `--teammate-mode in-process` if multi; `--effort ultracode` if ultra
- Linux gates the bypass flags behind `EUID -ne 0` (matches v4 sh template)
- launch `& claude @args @args` (Win) / `exec claude "${args[@]}" "$@"` (Linux)

### 2. MODIFY `config/config_manager.py`
Add `'Ark CLI'` entry (placed right after `'Kimi Code CLI'` to group CLI tools):
`Common='ark'`, `DisplayName='Ark CLI (Volcano Ark / GLM)'`, `CommandPrefix='ark'`,
`WindowsCommand='claude'`, `LinuxCommand='claude'`, `UseV4Launcher=True`,
`Variables=[ARK_API_KEY(req), ARK_BASE_URL(opt), ANTHROPIC_MODEL(opt)]`,
`MCPSupport={Enabled:False}`, `SmartRecognition={Enabled:False}`.

### 3. MODIFY `managers/script_manager.py` (≈6 lines)
- import `ArkLauncherSectionGenerator`
- `self.ark_generator = ArkLauncherSectionGenerator()` in `__init__`
- in `generate_v4_launcher_for_config`: branch on `command_prefix.lower()=='ark'`
  → call `self.ark_generator.generate_ps1/generate_sh`; else existing v4 template.
  (script_manager.py is already 882 lines; only ~6 lines added — bulk goes in the
  new module to honor the modular rule.)

## Result
`dd.cmd`/`dd.sh` → Special Software Environment Variables → **Ark CLI** →
Add Global Command → Create #1 (press Enter on ARK_API_KEY to reuse the stored
key) → writes `scripts/winenvs/ark1.ps1` + `scripts/linuxenvs/ark1.sh`.
Running it: prompts multi + ultracode, then launches `claude` against Ark with
glm-5.2 forced + permissions bypassed + teams on. More slots = ark2, ark3…

## Rules honored
English-only code/comments/logs. No test code. No git. No commands run.
New file <800 lines; script_manager kept lean. Reused v4/claudevolc/claudeteam
patterns + existing `UseV4Launcher` infrastructure.

## Note
Overwrote the prior unrelated Laravel-plan content in this scratch file
(that plan lives on in memory `[[laravel-client-unified-gateway]]` + git history).
