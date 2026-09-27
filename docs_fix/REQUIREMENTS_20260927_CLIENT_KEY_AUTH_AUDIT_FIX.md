# Client Key Authentication and Audit Fixes

Date: 2026-09-27
Status: open (orchestrator record; binding rules live in `development-guides/`)
Source list: `docs_fix/FIX_20260927_0252_TEAM_BUG_AUDIT.md`

## 1. User directives

- D1 (verbatim): "docs_fix/FIX_20260927_0252_TEAM_BUG_AUDIT.md 先修正文档 ，对于客户端的通信 ，权限认证使用密钥，注意dd.sh / dd.cmd的连都会调用密钥的解压和安装，比如查看git ssh安装命令，在其他也共用同一套密钥，不要直接对一些方法 ，比如资源上舒心pycore上传资源到laravel改为登陆认证，而是要使用密钥认证。所有不适合 直接 web登陆的都改该认证，之后修正其中的各类BUG."
  - Correct the audit document first.
  - Client communication authenticates with keys from the shared secret store that dd.sh / dd.cmd decrypt and install (the same flow as the git SSH key install), shared by every end.
  - Machine callers (for example pycore uploading resources to Laravel) must use key authentication, never web login.
  - Every surface not suited to direct web login switches to key authentication.
  - Then fix the listed bugs.
- D2 (verbatim, mid-task): "现在你能启动laravel远程角色吗，测试是否能通信，如果不能，让编排角色按官方规范扩展"
  - Start the `laravel-remote` role, test messaging, and extend the setup per the official docs if it fails.

- D3 (verbatim): "找到角色编排，对shell之类的以及UI类的比如laravel-manager  pycore-manager,加上ui前缀。"
  - Ruling, the recommended option confirmed by the user: the five Web UI roles become `ui-laravel-manager`, `ui-pycore-manager`, `ui-wordnew`, `ui-codemart` and `ui-vortex`. `shell`, `flutter` and `mcp-chrome` keep their names.
  - It takes effect at the next launch. The teammates already running keep their old names until this run ends.
  - Done at about 04:2x:
    - `config/claude_team_roles.json` names;
    - `.claude/agents/ui-*.md` (the files are renamed, and so are the `name:` fields and the tag examples);
    - `.claude/agent-memory/ui-*`;
    - the role lists in `orchestrator.md` and `pycore.md`;
    - guide §8, plus the new rule B10.
  - The launchers and hooks read names from the catalog and need no change.
- D4 (verbatim): "同时配置claudeagents跳过所有问答，直接选择推荐。"
  - Every agent definition now has `disallowedTools: AskUserQuestion` and a "No questions" body rule, and every catalog kickoff repeats it. Guide rule B9.
  - A session takes the recommended option and records it.
  - The launcher scripts themselves have no interactive prompts.
- D5 (verbatim): "之后，在所有任务完成后，搜索fix docs中的所有的昨天到今天的设计文档 ，并按文档 中对代码再次升级，确保功能可用。"
  - Runs after every D1 task is approved. See §8.
- D7 (verbatim): "使用 /workflows 将昨天和今天的docs fix中的所有新需求编排为长任务，特别是音频编排的功能 ，确保可用以及可复用。之后在修改代码后运行长时间 的音频编排，对功能中要求的提示诩转𡧈进行编排，以及对所有laravel端的图进行编排测试，直到功能可用，并生成出一些音频。这个任务将在当前任务完成后执行编码任务。"
  - Reading, per B9 (no questions, the recommended reading):
    - "提示诩转𡧈" = 提示词转音频: the prompt rewrite → audio orchestration path (R3/R4 of `REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE.md`);
    - "laravel端的图" = the Laravel-side books (`vocab_book` source).
  - D7 turns D5 into a Workflow-run long task. It starts after D1 completes. §8 has the design.
- D8 (verbatim): "测试的时候 先将Pycore的API设置 为https127.0.0.1,使用本地的laravel测试。"
  - For every test run (D7, D9), pycore's Laravel endpoint is first set to `https://127.0.0.1`, the local FrankenPHP Laravel, which answers `/api/health` 200 with valid TLS (checked about 05:0x).
  - The endpoint is set through pycore's own endpoint selection (`LaravelEndpointManager.select` via its UI/RPC path), never by editing code.
  - The previous selection is recorded, so it can be restored after the tests.
- D9 (verbatim): "同时添加一个后续的编排长任务，给ui martcode添加、AI生成图标，以及所有功能的校准和使用，对粗造的页进行精修，找到之前的进度继续完成和对应，并对后端应用redis和175布置脚本配合。这是在上一个onverflow之后的任务。"
  - Reading, per B9: "martcode" = CodeMart (`ui-codemart`), and "onverflow" = workflow.
  - D9 is a second Workflow long task, queued after the D7 workflow. §9 has the plan.
- D10 (verbatim, new lead session ca-orchestrator, about 13:1x): "claudeagents.ps1 先查看其中为什么只启动了部分角色 ，windowxs,，让编排角色 去查官方文档，并支持windows的信息啊五百等全部幂等开启，之后使用onverflow继续D1-D9的任务，启动全部角色。"
  - Find why `claudeagents.ps1` (Windows) starts only some roles.
  - The orchestrator checks the official docs, and the launchers enable every Windows-capable official team feature idempotently.
  - Then continue D1–D9 with Workflows (dynamic workflows), starting all roles.
  - Readings, per B9:
    - "信息啊五百等" = the Windows side of the official multi-session features: cross-session messaging, Remote Control, agent teams, hooks and the teammate display;
    - "onverflow" = workflow.
  - §10 has the record.
- D11 (verbatim, about 13:4x): "注意claudeteam claudeagents默认都要启动opus 5.5，agents模型也一样，更新代码并重新启动角色 。"
  - `claudeteam`, `claudeagents` and `claudeteamup` start Claude Opus 5.5 (`claude-opus-5-5`) by default, and every agent runs it too: teammates, subagents including the built-in types, workflow agents, and the remote role.
  - Update the code, then restart the roles.
  - Found: the role definitions pin no model, so custom types inherit the lead's model. The D1 workflow's pycore agent runs `claude-opus-5-5`. The built-in `claude-code-guide` type ran on Haiku 4.5, so the first docs workflow was stopped and rerun with `model: 'opus'` on every agent.
  - Plan (B9):
    - one catalog model key, read by the launchers as `--model` (an explicit user `--model` still wins);
    - the remote role's command gets the same flag, because it is built locally;
    - the agent frontmatter and the subagent env follow what the docs check confirms (§10.2);
    - the orchestrator passes `model` on every workflow agent that uses a built-in type.
  - Restarts:
    - running workflows are restarted only if they are not on Opus 5.5 (the D1 closeout already is);
    - the remote role restarts after it reports laravel-remote-1 and after shell's launcher change is approved;
    - the lead is already on `claude-opus-5-5`.
- D12 (verbatim, about 15:1x, typed at the dd.ps1 step menu): "立即添加工作任务，并启动角色 ... 找到其中的桌面图标整理，实地扫描本机并升级，然后运行整理本机图标到合适的桌面图标文件夹，同时，对于上面的大模型中的，官方推荐在windows docker 中安装的，运行并测试幂等安装前置，让大模型能跑起来，注意测试的时候一个测试就关掉，不要让系统卡掉。默认使用debian wsl2或推荐的方式支行。同时，调用agent claude编排角色 ，将shell角色 扩展为2个，一个专门负责liunx 一个负责windows，但在两个必须互相说明，修改一端要通知另一端对齐比如wiindows扩展了功能要让liunx同样对齐，lkunx端必须适合debian 13/ ubuntu 26系统 。"
  - D12a: find the desktop icon organizer, scan this machine, upgrade the organizer, then run it so this machine's icons go into the right desktop icon folders.
  - D12b: for the model steps in the menu that the official projects recommend installing on Windows through Docker, make the prerequisites idempotent, then run and test them so the models run.
    - One test at a time, closed right after, so the system does not freeze.
    - Default runtime: Debian WSL2, or the officially recommended way.
  - D12c: split the shell role in two, `shell-linux` and `shell-windows`.
    - Each describes the other.
    - A change on one side is announced to the other, which aligns: when Windows extends a feature, Linux follows.
    - The Linux side must suit Debian 13 and Ubuntu 26.04.
  - §11 has the record.
- D13 (verbatim, about 15:3x): "让角色编排角色 继续优化claudeagetns，1：config\claude_team_roles.json 是否是官方推荐的方式，如果不是修改官方推荐方式，2：按官方的推荐配置，在长思考是用指挥，写代码是可以用快速模型，但必须是最新，不能是老旧模型，3：更新支持windows /liunx等的前置工具，按官方的新特性全部开启，比如交互，通信等，4：在claudeagetns开启时必须启动所有角色的窗口，根据官方推荐启动。比如windows只启动了2个。并注意1k/2k/4k模式下屏幕的放置，查询官方文档。"
  1. Check whether `config/claude_team_roles.json` is the official recommended way. If not, move to the official way.
  2. Models, per the official recommended configuration: long thinking runs on the commanding model; coding may use a fast model, but only the latest, never an old one.
     - Model facts, from the current model reference (claude-api skill, cached 2026-06-24 plus the Opus 5.5 launch note): the newest Opus is `claude-opus-5-5`, the current fast tier is `claude-sonnet-5`, and the top tier is `claude-fable-5-1`. Haiku 4.5, Sonnet 4.6 and Opus ≤5 are older generations and must not be used. The observed Haiku 4.5 for built-in agent types is exactly what this excludes.
     - Plan (B9, the recommended split): the lead, the reviewer and every plan/verify/judge stage run `claude-opus-5-5`; implementing roles may run `claude-sonnet-5`.
     - The mechanism (catalog vs settings `model`/`opusplan`, frontmatter `model:`, `CLAUDE_CODE_SUBAGENT_MODEL`) follows the docs check. D13 refines D11 for coding roles only.
  3. Update the prerequisite tools on Windows and Linux, and turn on every new official feature idempotently (interaction, messaging and so on).
  4. `claudeagents` opens a window for every role at start, the official way. Windows opened only 2. Placement must be correct at 1K/2K/4K (1920×1080, 2560×1440, 3840×2160 and their DPI scaling), per the official docs.
  - §12 has the record.
- D15 (verbatim, about 15:4x): "你似乎启动的角色 不够多，继续启动更多角色agents来同步完成更多任务。"
  - Start more role agents in parallel.
  - Ruling (B9): D1 is open only on pycore's paths (pycore-4/5/6), so every other role starts D5/D7/D9 now, in the workflow `d5-d7-d9-all-roles-lanes`:
    1. an audit of 12 document groups (the 09-26/27 docs, §8.0, the CodeMart docs and §9);
    2. a merge;
    3. the contracts first;
    4. ten parallel lanes (laravel, ui-pycore-manager, ui-wordnew, ui-laravel-manager, ui-codemart, ui-vortex, mcp-chrome, ncore, shell-linux, shell-windows), each running implement → review → fix.
  - Exclusions while other work is in flight:
    - pycore paths: the pycore D7 lane and the audio long run start after the D1 closeout;
    - the laravel-T11 files, until approved (done at about 15:4x);
    - the D12 files (desktop icons, model steps, WSL/Docker helper);
    - the D13 files (launchers, settings, hooks).
  - flutter stays won't-fix (D6).
  - Heavy checks run only with at least 3 GB free RAM, and no lane restarts shared services.
  - laravel-remote got `laravel-remote-2`, read-only server diagnostics: the missing syslog error, the scheduler overlap, the PG17 permissions cause, migration safety, phpredis for FrankenPHP.
- D16 (verbatim, about 15:5x): "将角色继续扩展，然后全部启动来运行命令，laravel扩展为laravel 总协调合并其他几个laravel以及修改laravel底层， laravel-qyapp子APP开发 负责与pycore wordnew的交互，laravel-codemart子APP后端开发，laravel-pycore-laravelAPI的开发 负责与UI的交互， pycore扩展为 pycore 大模型开发 负责大模型的调用 网关 确保使用等类库的开发 / pycore 构架规范师 负责代码符合构架要求 使代码符合 development-guides\PYTHON_PYCORE.md  / pycore 本地状态管理、缓存、API、RPC、relay开发师 负责以上开发并和laravel联动 / pycore 总协调 负责合并各个pycore修改的代码、或协调, pycore辅助开发 如果没有边界的开发由辅助开发完成。之后启动全部角色 并全部进任务。"
  - Roles now (22):
    - Laravel family: `laravel` (coordinator and foundation), `laravel-qyapp`, `laravel-codemart`, `laravel-api`, plus `laravel-remote` (server).
    - pycore family: `pycore` (coordinator), `pycore-ai`, `pycore-runtime`, `pycore-architect`, `pycore-assist`.
    - Unchanged: shell-linux, shell-windows, reviewer, the five ui-* roles, flutter, ncore, mcp-chrome, orchestrator.
  - Readings (B9):
    - "laravel-pycore-laravelAPI … 负责与UI的交互" = `laravel-api`, the APIs the pycore_laravel_wordnew UI apps call.
    - "pycore 大模型开发 … 网关 确保使用等类库" = `pycore-ai`: LLM, TTS, STT, OCR, translation and image models (the user also called the TTS/ASR steps "大模型" in D12), the gateways, the engine servers and `ensure_library`.
    - "本地状态管理、缓存、API、RPC、relay" = `pycore-runtime`, which also owns the one delivery layer and the audio-orchestration state.
    - `pycore-assist` takes every pycore path no other role owns.
  - Path maps: `.claude/agents/laravel.md` and `.claude/agents/pycore.md`, identical in each family file; guide §8 rows and the new B13.
  - Other files:
    - `config/claude_team_roles.json` has the 7 new roles;
    - `orchestrator.md` has the families;
    - `laravel-remote.md` names the family;
    - `.claude/agent-memory/laravel/` and `.claude/agent-memory/pycore/` were copied into each new role.
  - In-flight rulings:
    - The D1 closeout (pycore-4/5/6) keeps running as the `pycore` type. The coordinator is the assigned temporary writer of those files.
    - The all-roles workflow was stopped at about 15:5x and resumed with the new lanes (3 finished audits reused).
    - Merge and lanes now cover all 22 roles:
      - every pycore lane that is not in flight runs now; the in-flight pycore items go to "pycore D7 phase 2";
      - pycore-architect runs a conformance audit;
      - flutter does a read-only consumer check (D6 no fixes);
      - the laravel and pycore coordinators merge-check their families after the lanes.
    - The laravel-remote-2 findings were added as lane items: srv-01 timer heartbeat, srv-02 mcp placeholder cleanup, T12, srv-03 the 777 walkers' PostgreSQL prune, srv-04 175 sys:init/phpredis/.env/PG cluster.
- D17 (verbatim, about 16:1x): "服务器上运行 175 部署脚本 改为可以运行，并修改关联处，该脚本是要确保幂等修复和初始化系统，并不是重置，同时初始化也是幂等的，对于初始化过的项也要跳过，比如PG数据库如果服务已经安装则是启动，而不是重装。是一个ensure脚本，当然不要对脚本大改动和重构。修改 laravel-remote ，同时脚本是可测试的，有参数接口可以轻易测试其中一步。CodeMart 的密码改为有系统 自动生成，每次运行175脚本时随机生成一个，并立即同步到系统，如果已经生成 提示是否重新生成默认Y/n,生成的密码保存在站或目录和更新数据库并打印，可以随查查看。以上更新。sys:init 也要打印 理员邀请码，larave不使用env ，说了，使用配置文件，"
  - 175 must run on the server. It is an idempotent **ensure** script:
    - it repairs and initializes only what is missing and skips anything already initialized;
    - it never resets: an installed PostgreSQL is started, never reinstalled;
    - the changes are minimal, with no big rewrite;
    - a parameter interface lets one step be tested alone (`--list-steps`, `--check`, `--step <name> [--show]`).
  - `laravel-remote` is updated: it tests 175 on the server step by step, then runs it in full, once the fixes are synced.
  - The CodeMart password is generated by the system on every 175 run:
    - when one exists, the prompt "regenerate?" defaults to Y;
    - it is saved to a file and applied to the database at once;
    - it is printed, and can be viewed any time.
  - `sys:init` keeps printing the admin invite code.
  - Laravel never uses `.env`; configuration lives in the config files.
  - Readings (B9):
    - "保存在站或目录" = the Laravel data dir secret store, `map_web_path(laravel_db)/.core_node_secrets/CODEMART_ADMIN_PASSWORD` (0600), which is not web-served;
    - "CodeMart 的密码" = every account the CodeMart seeder creates (admin and demo users);
    - the regenerate prompt is timed, and a non-interactive run uses Y.
  - Superseded rulings:
    - "do NOT run 175 on the server": 175 now runs, after srv-04;
    - srv-05 "never seed in production": the seeding default stays and moves to the config files, and the password is generated;
    - srv-06 "mask the invite code": it keeps printing;
    - "CODEMART_SEED_DEMO=false in the server .env": wrong, because Laravel ignores `.env`.
  - Contract (orchestrator, about 16:2x): `config/service_contract.json#codemart_admin_password` holds the secret file, mode, length, alphabet, the `php artisan codemart:admin-password --file <path>` apply command, the seeder rule, the prompt default and the show step.
  - Role files:
    - every Laravel role: "configuration from `LaravelConfig.php`/`config/*.php`, never `.env`";
    - `laravel-remote.md`: a D17 section with the step-by-step 175 test order;
    - `reviewer.md`: diff against `74e7770` when HEAD is a user backup commit.
  - The all-roles workflow was stopped and resumed at about 16:2x with:
    - srv-04: the 10 ensure and safety items, including the step interface and the codemart-admin-password step, plus Step175 parity;
    - srv-05: the `codemart:admin-password` command, a seeder with no hardcoded password, and the switch moved to config;
    - srv-06: the invite code kept, plus the McpV1 schema check;
    - p4-01..04: the pycore-4 follow-ups.
- D18 (verbatim, about 16:3x): "让 core-node-d5  运行清理，同时让他修改 scripts\shells\win\tools\CommandContentGenerator.ps1 类似的generate代码，包括py,在预置文档中也去掉这个前置注释。"
  - `core-node-d5` is the user's own session, not a team role. Relayed at about 16:3x, it is asked to:
    1. run the prepared .py CodeHeaderCleaner pass (108 files);
    2. change `CommandContentGenerator.ps1` and the similar PowerShell and Python generators so they stop emitting the AI rules header block;
    3. remove that block from the preset/template documents.
  - Ruling (B1/B9): the generator and template files are assigned to core-node-d5 for D18, and the team's roles are fenced off them once d5 sends its list.
  - d5 was asked to write each .py file compare-and-swap (skip a file that changed since it was read), because the pycore roles are editing `pycore/` now. Skipped files get a second pass later.
  - Header-block removals are never a role's change: reviewers ignore them and roles never re-add them.
  - Any `development-guides/` change d5 makes is recorded here under B12.
- D19 (verbatim, about 17:0x): "编排脚色，并扩展pycore-gpu-测试端remote模式，其作用是专门在liunx/windows上运行pyservice 并测试功能，反馈给团队。并上所有remote的远程角色的说明中写清楚，所有代码是通过pyservice 的codesync分发。而不是git。"
  - New role `pycore-gpu-remote`: a remote-mode, test-only GPU test-end. It runs pyservice on a Linux or Windows GPU host, tests pycore features, reports to the team, and writes no code.
  - Every remote role states that code arrives only through pyservice CodeSync, never git: `laravel-remote.md`, `pycore-gpu-remote.md`, catalog `remote.code_distribution`, guide §10, and `orchestrator.md`.
  - Readings (B9):
    - the role name is `pycore-gpu-remote`, with `model: opus` (testing and diagnosis) and `effort: xhigh`;
    - "on linux/windows" means the catalog `remote.os: auto` (probe `uname -s || ver`) with `root_linux`/`root_windows`.
  - Host: a read-only probe at about 17:1x (key-only SSH; nothing printed):
    - `SSH_CONNECTION_2` is Linux (10-7-19-45), with no GPU and no core_node;
    - `SSH_CONNECTION_3` was refused: **"REMOTE HOST IDENTIFICATION HAS CHANGED"** (ED25519 SHA256:KFYGtkh5…). The orchestrator did not override it; the user must verify that host key.
  - The role is therefore catalog `enabled: false` with its own secret name `SSH_CONNECTION_GPU_1`. The user adds that secret for the GPU host through the dd.sh/dd.cmd secret flow, then enables the role.
  - Guide: §8 is now 23 roles with a pycore-gpu-remote row, and §10 has the CodeSync-only code distribution plus both remote roles.
  - Correction to earlier replies: code sync to the server is **pyservice CodeSync only**. The earlier "git or CodeSync" wording is withdrawn.
    - The server's CodeSync client must be running for any push. laravel-remote-1 found `pycore-module-caller.service` disabled on the server.
    - laravel-remote-4 checks the server's CodeSync client status, read-only.
  - Launcher work (after D13's shell-windows-1/shell-linux-1, same files):
    - the D19-shell task: `remote.os` auto/linux/windows;
    - a Windows remote command through `claudeteam.ps1` over OpenSSH;
    - skip a remote role whose `ssh_secret` does not resolve.
- D20 (verbatim, about 17:2x): "安排角色 加入任务，cd D:\programing\core_node ; git add . ; git commit -m "win0.0.1" ; git pull origin main ; git push origin main 以上自动转到dd.sh dd.cmd的所在目录，commit -m 也是自动为$systenname+version+'up'+timestampformat,以上加入到快捷命令的公共脚本中，在dd 中通过参数syncgit调用，并给dd添加help参数，使用help时打印可以用的参数，而不继续运行。重构两端。上面的快捷命令与现在的gitunifiled联动，加入一行命令确保切换到ssh的github路径，并提交到github，不是gitee。"
  - Spec: `.claude/agents_shared/d20/SPEC.md`. The workflow `d20-syncgit-help` (shell-windows-5, shell-linux-5, a parity check, reviews) started at about 17:2x.
  - `syncgit`:
    1. go to the repo root (resolved from dd's location);
    2. one idempotent line sets origin to the **SSH GitHub** URL, from the single gitunified remote definition (`scripts/git/git_remotes.conf`), never Gitee;
    3. `git add .`;
    4. commit `<systemname><version>up<yyyyMMdd-HHmmss>` (systemname `win`, or `<distro><major>` from os-release; version from the existing single project version definition, else root `package.json`); an empty commit is skipped;
    5. `git pull origin main`, stopping on a conflict with no push and no force;
    6. `git push origin main`.
  - Where it lives: one shared function per OS in the common libraries, plus the `syncgit` quick command (winenvs/linuxenvs), linked to gitput_unified.
  - `dd syncgit`; `dd help` / `-h` / `--help` prints one parameter table and exits.
  - `--dry-run` exists for testing.
  - Readings (B9): "refactor both ends" = one clean dispatch table per OS, not a dd rewrite. The cross-platform `scripts/git/*.py` and `git_remotes.conf` go to shell-windows as the D20 temporary writer.
  - The user's prompt granted git for the session, but the implementers run **no git writes**. The user runs the real sync.
- D21 (verbatim, about 17:4x): "CodeSync 只加入密钥鉴权，其他不变。确保所有端的密钥都一样。同时可以通过dd.cmd dd.sh中的子菜单来重置密码，并重新entrpt使用密码加密。这个密钥.js随代码走，和之前的模型一样。"
  - CodeSync changes **only** by adding client-key authentication (K3). Everything else stays as it was before this run (`74e7770`): the bind and transport, the peers, the protocol and the routes.
    - This **supersedes** the §10.5 proposals for an SSH tunnel, a loopback bind for the CodeSync daemon, closing public 59000, and the unit limits. Those are withdrawn.
    - What stays: the daemon's memory growth (a bug) and getting the new code onto the server once (user-4).
  - One key on every end (K1). The encrypted `.secret_keys/already_encrypted/<NAME>.js` travels with the code, like the existing 85 encrypted secrets, and each machine decrypts it with the password through dd.
    - About 17:4x: the raw `CORE_NODE_CLIENT_KEY_1` and `DINGDUODUO_SUPER_CODE_SIGNING_KEY_1` exist locally, but their `.js` do not exist yet.
  - A dd submenu in `dd.cmd` and `dd.sh`:
    - "reset the encryption password and re-encrypt every secret with it": the new password is typed twice with no echo, a decrypt round-trip is verified before replacing, and the old `.js` is kept until success;
    - "encrypt missing `.js` for raw secrets";
    - "show key fingerprints" (the first hex of SHA-256, never values), to confirm every end holds the same key.
  - Readings (B9): "重置密码" = the secret-store encryption password, not the client key. "这个密钥.js" = the encrypted client key file in `already_encrypted`.
  - Tasks:
    - pycore-runtime-cs1: diff CodeSync against `74e7770` and keep only the key auth; the memory growth; the bootstrap options for the old-bearer server;
    - shell-windows-8 + shell-linux-8: the dd secrets submenu, in parity, after D20;
    - the user runs the submenu, because the password is the user's;
    - shell-*-6 (tunnel/59000/unit limits): cancelled.
- D22 (verbatim, about 18:xx): "修改角色编排 按小组划分 可以使用角色的前级或后缀来划分组每个组有一个小组长，改为pycore pyservice的前后端全栈组 5成员负责pyservice pycoer - laravel pycore relay API - poly apps pycore ui的多端联动开发 和pyservice的的前置shell脚本开发（特别是本地模型的初始化），pycore 代码小组长 负责审计所有有关pycore成员的开发和合并 需要符合规范，wordnew全栈开发组 5成员组长和下面的任务自动分配 负责poly apps pycore ui -wordnew -laravel qyappv1 - 前置shell脚本- capocitor编译-pycore 辅助联动 - mcp-chrome辅助联动开发，shell单独开发组 2成员 组长兼开发+开发 windows liunx负责dd.cmd dd.sh流和安装流程的开发和适配系统工作，codemart 3成员，组长兼开发+2开发，claude lead 1 同时兼claude脚色编排，"
  - 16 roster roles in 5 groups. The name prefix is the group. The full path map is in each group file (e.g. `.claude/agents/pycore-lead.md`); guide §8 and B14 have the summary.
    - claude: orchestrator (the claude lead);
    - pycore: pycore-lead (leader and code leader), pycore-ai (models and local model init scripts), pycore-runtime (the pyservice backend and its prerequisite scripts), pycore-laravel (the Laravel pycore/relay/UI API and the foundation), pycore-ui (pycore-manager, laravel-manager, vortex, pdd-manager, and the shared UI layer by default);
    - wordnew: wordnew-lead (leader; assigns tasks automatically), wordnew-ui, wordnew-laravel (AppQyV1), wordnew-native (pre-shell scripts and the Capacitor build), wordnew-link (mcp-chrome and pycore linkage);
    - shell: shell-windows (leader and developer), shell-linux;
    - codemart: codemart-lead (leader and developer; owns docs_fix/codemart_docs/), codemart-ui, codemart-laravel.
  - Also kept: the remote roles laravel-remote and pycore-gpu-remote (the pycore group's tester), and the service roles reviewer, ncore and flutter (catalog window:false, on demand).
  - Retired, with memories merged into the successors: pycore, pycore-architect, pycore-assist, laravel, laravel-api, laravel-qyapp, laravel-codemart, ui-pycore-manager, ui-laravel-manager, ui-vortex, ui-wordnew, ui-codemart, mcp-chrome.
  - Readings (B9):
    - the claude lead stays named `orchestrator`, which avoids renaming the launchers, sessions and memory;
    - leaders write their members' verdicts, and the `reviewer` service verifies each leader's own work, so every change still gets an independent check;
    - ncore and flutter are on-demand services, because the user listed no group for them;
    - the local-model init scripts move from shell to pycore-ai, the pyservice prerequisite scripts to pycore-runtime, and the wordnew build scripts to wordnew-native. The shell group keeps the dd flows and the generic install and system-adaptation work.
  - Catalog schema 7: groups[] with leaders, the roles with window:false for services, and layout.tab_groups by group (the claude lead shares a tab with the shell group).
- Outage (about 17:3x-18:xx): the API was unreachable (ENOTFOUND) and the usage limit was hit, so most in-flight agents failed.
  - Lost: all D5/D7/D9 lanes, D7 phase 2, the D13 fix rounds, D20, D21-cs1, D12's shell-linux-3 and model tests, and the D7 pycore:up-d8 step.
  - Kept:
    - the D5/D7/D9 audit and merge (the lanes per group are in `.claude/agents_shared/d22/items_<group>.json`, the metadata in `merge_meta.json`);
    - the contracts stage (applied);
    - four implementations done but unreviewed: pycore-ai-D7, pycore-runtime-D7, ui-vortex-D7, ui-wordnew-D7;
    - the local Laravel (FrankenPHP, started by WMI with a hidden console; `.claude/agents_shared/d7/laravel_local.md`);
    - D12a (Windows and Linux, approved) and D12b on Windows.
  - Local Laravel TLS: the new mkcert CA is in no trust store, and importing it into the Windows Root store was refused by the permission classifier.
    - Ruling (B9, reversible, no code change): pycore uses a combined CA bundle (certifi plus the local mkcert root) through its process environment (REQUESTS_CA_BUNDLE/SSL_CERT_FILE) for D8 https://127.0.0.1.
    - Trusting the CA system-wide stays a user decision (user-5).
  - The relaunch runs per group under the leaders (D22), at a paced concurrency so the usage limit is not hit again.
- D23 (verbatim, about 19:4x): "继续所有任务，如果证书不方便，可以使用一个在解密目录里的加密字符串"
  - Continue every task.
  - Ruling: for local tests, pycore's Laravel endpoint is `http://127.0.0.1:9000` (loopback, no TLS), and machine calls are authenticated by `CORE_NODE_CLIENT_KEY_1` (K3) from the decrypted secret store. The note is in `.claude/agents_shared/d7/D23_endpoint.md`.
  - This replaces D8's `https://127.0.0.1` for pycore → Laravel. The process-level CA bundle and user-5 (trusting the CA system-wide) are withdrawn.
- D24 (verbatim, about 20:2x): "通知角色 ，liunx端的常量库不要重复定义如果挂载ntfs不要在上面写任何编程语言的安装路径，上在只存放代码，不再作为其他使用，更新到文档，liunx shell规范。"
  - The Linux constants library defines each constant once.
  - On Linux an NTFS mount stores source code only, with no other use. No language or tool install paths, caches, build or temp directories, node_modules/vendor/.venv, data, logs or model weights go on it.
  - Docs:
    - a new `development-guides/LINUX_SHELL_RULES.md` supplements the shell guide. `DD_SHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md` stays untouched, because its name forbids AI edits;
    - guide B15;
    - a pointer line in 13 role files.
  - Contract (orchestrator): `service_contract.json#paths.linux_ntfs_policy = code_only`.
    - `linux_data_dir_candidates` no longer lists the NTFS `/www/www` entry: Linux data goes to `/www/core_node` only when `/www` is not NTFS, else `/var/_core_node`, else `~/core_node`.
    - `linux_ntfs_nested_www_root` is kept for detection only.
  - Readings (B9):
    - "上在只存放代码，不再作为其他使用" also covers runtime data and model weights on Linux, not only install paths;
    - Windows keeps D: as its data drive (the rule is Linux-side).
    - Existing Linux data on the NTFS mount is neither moved nor deleted by scripts; copying it to ext4 is user-6.
  - Notified: the role files (new spawns read them), core-node-e9 (its drive layout said "keep model data on D:", which D24 now forbids on Linux), and laravel-remote.
- D25 (verbatim, about 20:3x): "在liuxx端也不允许在ntfs上使用回收站，如果有脚本创建，通知角色幂等修正回去。"
  - On Linux there is no recycle bin on an NTFS mount. Scripts and programs never trash there. The mount setup blocks per-volume `.Trash-<uid>` idempotently with an empty root-owned `.Trash-<uid>` blocker file, placed only when no trash exists. A script that creates an NTFS trash is corrected idempotently by its owner.
  - Docs: `LINUX_SHELL_RULES.md` §2, guide B15, `service_contract.json#paths.linux_ntfs_policy`, and the role pointer lines.
  - Emptying the existing dual-boot `.Trash-1000` (about 73 GB, seen by core-node-e9) is irreversible, so it stays a user decision (user-7). Scripts only stop new trash creation and may remove an empty trash dir they created.
  - The read-only audit workflow `d25-ntfs-trash-audit` (about 20:3x) finds every trash use or creation on Linux (scripts, pycore, other code). Fixes go to the owners by the path map. `mount_common.sh` is fenced to core-node-e9, which is asked to add the blocker in its mount work.
- D26 (verbatim, about 20:4x): "两端的共享数据可以放在ntfs盘。这样两盘才能读得到，这个映射是可以的如，通知角色 。"
  - Data both OSes share may live on the NTFS disk, because that is how both boots can read it, and the D: ↔ `/www/www` mapping is intended.
  - Revises the D24 reading. The contract `linux_data_dir_candidates` is restored: the shared NTFS `/www/www/core_node` comes first on the dual-boot desktop. `linux_ntfs_policy = code_and_shared_data`.
  - Still never on NTFS: install paths, package caches/stores, build output, temp dirs, node_modules/vendor/.venv, Linux-only service state (e.g. PostgreSQL clusters), and recycle bins (D25).
  - user-6 (copying Linux data off NTFS) is withdrawn.
  - Notified: the role files (`LINUX_SHELL_RULES.md` §2, guide B15, the pointer lines), core-node-e9 (its "keep model data on D:" holds again for data both OSes read), and laravel-remote.
  - Implementers who read the D24 contract in between are corrected at review time: the leaders check against the current contract.
- D27 (verbatim, about 20:5x): "/opt/core_node_trees/www/core_node_trees这个目录是干什么用的，查看项目中，如果没什么用去掉。"
  - Finding. `core_node_trees` came from core-node-e9's dual-boot drive layout (§10 of its record):
    - Windows: `<program drive>\core_node_trees` would hold per-project node_modules/vendor/.venv through junctions, plus the toolchain caches;
    - Linux: ext4 `/opt/core_node_trees` would be bind-mounted onto an empty NTFS mount point, `/www/core_node_trees`, so the Windows junctions resolve to ext4.
    - Neither directory exists on disk: this machine has only C: and D:, so no E: program drive. Only e9's in-progress code references it: `SharedCacheEnv.ps1`, `mount_common.sh` (`ensure_tree_root_bind_mount`), `shared_cache_env.sh`, plus the contract keys.
  - Without E:, the Windows side would fall back to `D:\core_node_trees` on the same NTFS disk as the code, which gains nothing. The Linux bind trick exists only to serve those junctions, and it puts a directory on the NTFS share.
  - Ruling: remove `core_node_trees` everywhere.
    - Contract `paths.drive_layout`: `tree_subdir`, `tree_root`, `tree_cache_root` and `tree_cache_subdirs` are removed. They are replaced by `cache_root = <tool_root>/cache` with `cache_subdirs`, and by `trees_root` (Linux `<tool_root>/trees`) with `trees_rule`: per-project Linux dirs are bind-mounted from ext4 over the plain in-repo directories at use time, and Windows keeps them in the repo as normal directories, with no junctions.
    - The D24 mount-point exception in `LINUX_SHELL_RULES.md` is withdrawn.
    - core-node-e9 updates its fenced code accordingly (asked about 20:5x). There is nothing on disk to delete.
- D28 (user, given in session core-node-e9 and relayed verbatim about 21:0x): "联接到 E: 现在代码就要直接重构，在没有分好E秀前可以提示。"
  - The user was told there that node_modules/vendor/.venv cannot be shared across OSes (native addons, .bin shims, pnpm links), and asked for this.
  - Windows junctions these dirs to the E: program drive now, in code. While E: is absent, the code warns and keeps the normal in-repo dirs, so this machine (C:/D: only) is unchanged today.
  - This revises the Windows part of D27. The orchestrator adopted it because it is the user's latest wording and it only changes the orchestrator's own contract and rules; the user can overrule it here.
  - Contract `paths.drive_layout`:
    - `trees_root.windows = <program_drive>\core_node_trees`, only when E: qualifies, never on the D: fallback;
    - `trees_root.linux = <tool_root>/trees` (ext4);
    - `trees_mount_linux = /www/core_node_trees`, a single empty NTFS mount point that is bind-mounted, restored with the `mountpoint -q` condition;
    - `trees_rule` describes both OSes and requires the junction translation to be proven on the real dual-boot Linux first.
  - `LINUX_SHELL_RULES.md` §2 has the exception again.
  - core-node-e9 runs the D28 round: `win_common/ProjectTreeCommon.ps1` (junction ensure plus the E: warning), the `SharedCacheEnv.ps1` keys, and the single bind in `mount_common.sh`. Start-script integration (P4) goes to the start-script owners through the orchestrator.
- D29 (verbatim, about 21:1x): "dd.cmd sh中的菜单中的liunx/windows管理中加入tailscale的管理，如果本机安装，则添加重记服务，打开面板，显示所有devices IP状态等等，搜索官方文档。加入公共脚本直接调用。"
  - Tailscale management goes into the Windows and Linux management menus of dd.
  - When Tailscale is installed, the menu offers: status; every device with name, IPv4/IPv6, OS, online state, last seen, exit node and direct/relay; restart the service; and open the panel (the admin console, plus the local web UI where supported). The commands come from the official docs.
  - The logic lives in shared common scripts that can also be called directly: `win_common/TailscaleCommon.ps1 -Action Status|Devices|Restart|Panel|Help` and `linux/common/tailscale_common.sh status|devices|restart|panel|help`.
  - Reading (B9): "重记服务" = restart the service.
  - Workflow `d29-tailscale-management`:
    1. research on the official docs;
    2. shell-windows-10 and shell-linux-11 in parallel, reusing `97_install_tailscale.sh` and the existing network helpers;
    3. shell-windows reviews shell-linux, and the reviewer service reviews shell-windows.
  - Tailscale is not restarted during the task. The main dd menu files owned by the running shell plan are not touched; if only they fit, the hook-in is queued.
- D30 (verbatim, about 21:2x): "加入目录使用规范，在windows上必须 有一一个总的命名空间，比如E秀需要在在E:/core_node_compiler或其他目录下使用所有目录，不要建一堆目录。D盘也是一样，liunx也是一样。"
  - One namespace directory per drive or filesystem for everything the project creates. The new guide `development-guides/DIRECTORY_NAMESPACE_RULES.md` covers both OSes, plus guide B16, `LINUX_SHELL_RULES.md` §5 and the role pointer lines.
  - Namespaces:
    - E: `E:\core_node_compiler\`, holding `.dev_<sys>`, `trees` and `cache`;
    - D: the existing `D:\www\`, holding the data dir `core_node`, `frankenphp` and, on the D: fallback, `.dev_<sys>` and `cache`;
    - Linux ext4 `/opt/core_node/`, holding `_<os>_<ver>`, `trees` and `cache`;
    - Linux NTFS `/www/www/` for shared data, and `/www/core_node_compiler/trees` as the single empty bind mount point.
  - Contract `paths.drive_layout`: new `namespaces`; `tool_root`, `cache_root`, `trees_root`, `trees_mount_linux` and `toolchain_env_file` are moved under them.
  - Readings (B9):
    - the user's code checkout (`D:\programing\core_node`) is user-managed and outside the rule;
    - the D: namespace is the existing `D:\www`, so the data dir does not move;
    - legacy top-level dirs made by earlier scripts (`D:\.dev_win10`, `/www/_debian_12`, `/www/_debian_13`, `.dev_debian13`, `.dev_linux`) stay in place and keep being read. Moving them is user-8.
  - A read-only audit (`d30-namespace-audit`) lists every script or program that creates a top-level directory. Fixes go to the owners after their current items; core-node-e9's drive-layout code follows the new contract keys.
- D14 (verbatim, about 15:3x): "允许 你修改 改 development-guides/".
  - The orchestrator may now edit `development-guides/` (guide B12). Every guide change is recorded here.
  - First use, about 15:3x, in `CLAUDE_CODE_AGENTS_GUIDE.md`:
    - §8 is now 15 roles: shell-linux and shell-windows rows;
    - B6 installers are per platform, and cross-platform scripts are assigned per task;
    - B10 wording;
    - new B11 shell parity and B12 guide edits.
  - `orchestrator.md` now allows guide edits under B12.

## 2. D2 record: laravel-remote start (2026-09-27)

| Step | Result |
|---|---|
| Catalog | `config/claude_team_roles.json`: `laravel-remote` `enabled: true` (orchestrator) |
| SSH | `SSH_CONNECTION_1` resolves from the secret store; key auth (BatchMode) works |
| Server | Claude Code 2.1.283, claude.ai login (same org as local), tmux, `claudeteam` linked, checkout at `/www/programing/core_node` in step with local (hashes of team files match) |
| Start | `claudeagents --no-windows --roles laravel-remote` → local tmux `claudeagents/ct-laravel-remote` → ssh loop → server `tmux -L claudeteam ct-laravel-remote`, `/rc active` |
| Blocker 1 | Server `/` was mode 0777 without sticky bit. Claude Code refused every messaging socket directory: "Cross-session messaging is off". Fixed with user approval: `chmod 755 /` on the server, session restarted; warning gone |
| Blocker 2 | The lead `ca-orchestrator` started before the role was enabled, so it has no Remote Control. The remote send fails: "no agent named 'ca-orchestrator' is reachable". Official fix: run `/remote-control ca-orchestrator` in the lead (one-time confirmation dialog). Later launches pass `--remote-control` to the lead automatically |

Follow-ups for `shell`:
- Find what set the server `/` to 0777 (`fs_perm_ensure_owned_777` refuses `/`; cause not in the obvious helpers).
- Launcher: when the lead is already running without Remote Control and a remote role starts, print the `/remote-control <lead>` hint. The remote row's `command:` log line shows the local `claudeteam.sh ... --teammate-mode` form instead of the ssh command.
- Server `/` 0777 (shell-5, about 05:3x):
  - shell found no code that chmods a literal `/`. The only way to reach it was the 777 helpers: their guards compared the literal path, and `repair_owned_entry_777` follows a symlink to its target. A `/www` or data-base symlink to `/` would give exactly "0777, no sticky". All three helpers now guard the resolved path.
  - Read-only check on the server by the orchestrator: `/www` is a real directory (root 755), `/` is root 755 (the earlier fix holds), and no symlink under `/www`, `/var` or `/root` (depth 3) resolves to `/`. The cause is not reproduced; the hardening prevents it.
  - Seen on the server: `/www/programing/core_node` is 777 (the dd.sh tree walk; IS-008 now excludes the secrets) and `/var/_core_node` is 1777.
- IS-030: `permission_mode` was removed from `config/claude_team_roles.json` (orchestrator). The launchers no longer parse it, and claudeteam.sh/.ps1 keep `auto` hardcoded.

## 3. D1 plan

1. Correct `FIX_20260927_0252_TEAM_BUG_AUDIT.md`: the authentication model (§3 theme 1) and every suggested fix that proposes login auth for machine callers. Done 2026-09-27 03:5x.
2. Define the key-authentication contract before owners implement it: `config/service_contract.json#client_key_auth` (§4). Done.
3. Dispatch the fixes by role scope (§6); reviewer verdict per task.

Reading of "不在角色范围外的APP不用修复": fix only findings whose files lie inside a role's write scope (guide §8). The only app with no owner is `UI/apps/pdd-manager/`, and no finding points there.

## 4. Binding definitions: client key authentication (K)

Contract: `config/service_contract.json#client_key_auth`. Every end reads its values from there and never re-declares them.

- K1 **One shared key.** It is the secret `CORE_NODE_CLIENT_KEY_1` in the shared secret store, at `.secret_keys/.secret_ignore/<NAME>` decrypted from `.secret_keys/already_encrypted/`. It is the same store and flow that dd.sh / dd.cmd use for the git SSH key: decrypt at startup, re-encrypt new raw files. Every machine that runs dd.sh / dd.cmd holds the same key.
  - Verifiers accept `CORE_NODE_CLIENT_KEY_1..5` and select one by `X-Core-Node-Key-ID`.
  - Signers use `_1`. To rotate, add the new key under a free index everywhere first, then move it to `_1`.
- K2 **Lifecycle (shell).**
  - dd.sh (Linux) and dd.cmd/dd.ps1 (Windows) repair a missing key only. If no raw file and no encrypted copy (single file or batch bundle) exist, generate 32 random bytes as base64url in the raw dir, mode 0600. The existing re-encrypt prompt then encrypts it.
  - If an encrypted copy exists, never generate; the decrypt flow restores it.
  - Runtimes (pycore, ncore, Laravel, mcp-chrome native host) only read the key. They never create, print or log it, and never put it on a command line.
- K3 **Signature.** HMAC-SHA256 with the decoded key. The input is the `canonical_fields` joined by `\n`: canonical version, protocol, METHOD, path, query, client, machine id, key id, timestamp, nonce, content sha256.
  - Path and query use the relay v2 canonicalization (`pycore_relay_contract.json#signature_profile.canonicalization`) through the existing implementations: pycore `pyutils/common/relay_contract.py` and Laravel `RelayContract::canonicalPath/canonicalRawQuery`. The query is signed (fixes LB-032).
  - The body digest is the sha256 of the exact bytes sent (fixes PR-014). Only `multipart/form-data` uses the literal `UNSIGNED-PAYLOAD`.
  - Timestamp skew is at most 300 s, and each nonce is accepted once within 600 s.
- K4 **Machine id.** It attributes and logs a request; it is not a trust boundary. Every holder of the key is trusted equally. Per-machine enrollment and trust-on-first-use claims are removed; this closes LB-015.
- K5 **Failure.** Failures are closed with 401/403, one of the contract `error_codes`, and an i18n message. A missing key logs the secret name and the dd step, never the value.
- K6 **The browser never holds the key.** UI apps authenticate humans with web login (Sanctum / `dashboard.auth`).
  - pycore UI actions that need the machine identity go through local pycore, which signs.
  - The mcp-chrome extension gets signatures from its native host. The key never enters extension storage.
- K7 **Local RPC servers** (pycore 59000, ncore 58000, the ncore HTTP stack, the translation service, WebLocalAreaNetwork, the mcp-chrome native server, and TTS engine servers started by pycore):
  - bind loopback by default;
  - a non-loopback caller needs a valid K3 signature;
  - a loopback browser caller needs a loopback `Host` header (DNS rebinding) and an allowed `Origin`;
  - never `Access-Control-Allow-Origin: *` together with credentials;
  - relay-token paths are unchanged.
- K7a **pycore remote browser access is relay only** (user ruling, 2026-09-27, after pycore showed that direct browser modes reach :59000 from LAN, tailnet and the cloud).
  - pycore binds loopback by default. An opt-in LAN bind setting in the pycore config admits only K3-signed machine callers (CodeSync peers, LAN discovery). Browsers never sign.
  - Browsers on other hosts manage pycore only through the HTTPS relay via Laravel.
  - pycore-manager hides the "Remote direct" presets and the non-loopback "Current URL"/"Local" direct modes, and shows a relay hint (i18n) instead.
  - The loopback browser allow-list is built from the service contract: loopback host keys × the `nexus_dash_frontend` and `pycore_backend` ports.

## 5. Surface → authentication (binding)

| Surface | Callers | Authentication |
|---|---|---|
| Laravel machine routes: worker/*, task results, audio/media/resource ingest and offset uploads, queue-center lane reads (diff, id-pages, page-data), AppQyV1 worker/queue groups, `internal/pycore/*`, orch-audio and agent-history ingest | pycore, ncore, mcp-chrome | client key (`client.key`) |
| Laravel data-sync peer routes (`sync-peer/prepare`, `export-prepare`, every peer transfer route) | the peer Laravel | client key, where the peer signs as `laravel_peer` |
| Laravel routes that both operators and machines call (queue-center overview/items/head/cancel/retry, task-center reads) | UIs and machines | client key **or** `dashboard.auth` |
| Laravel operator/admin routes (database manager, backup/restore, DB credentials, AI provider keys, settings, bulk reset/clean, cover regenerate) | laravel-manager and pycore-manager humans | `dashboard.auth` requiring admin; super-admin for credentials/restore/import (LB-002) |
| Laravel end-user routes (wordnew, codemart, flutter) | users | unchanged: Sanctum, or public reads. No machine key |
| Payment callbacks (LB-004) | payment gateway | the gateway signature and amount check, or admin confirm. Not the client key |
| pycore RPC 59000 | local UI, relay, LAN machines | K7 |
| CodeSync workspace (PR-003) | LAN pycore peers | client key; the committed bearer secret is removed |
| Relay v2 device enrollment | pycore | Ed25519 relay flow unchanged. An enrollment request that also carries a valid client-key signature is approved without a web-login approval step |
| TTS engine servers (f5tts, chattts, ...) | pycore | loopback bind only |

## 6. Dispatch (agent-teams mode, all roles with findings)

Owner by path: see the FIX document §4.0. Shared UI layer temporary writers (B2):

| Path under `poly_apps/pycore_laravel_wordnew_ui/` | Findings | Temporary writer |
|---|---|---|
| `core/integrations/laravel/transport/BaseAPI.ts` | FU-002, FU-003 | laravel-manager (done, released) |
| `core/network/api-client/MasterApiClient.ts`, `RequestQueue.ts`, `index.ts` (a type re-export only; extended 04:0x on wordnew's request) | FU-031 | wordnew (done, released; index.ts unchanged) |
| `shared/library-cover/LibraryCoverTaskModel.ts` | FU-020 | pycore-manager |
| `shell/ShellLaravelEndpointBridge.tsx` | FU-027 | pycore-manager |
| `core/integrations/pycore/pycoreTarget.ts` | K7a (relay-only remote browser access) | pycore-manager |
| `core/integrations/pycore/PycoreClient.ts` (error-code surfacing only) | K7a | pycore-manager |
| `shell/shell-i18n.ts` (add `'vx'` to `EndNamespace` only) | FU-042 (vortex part) | vortex (done, released) |
| `core/contracts/ServiceContract.ts`, `vite.config.ts` (the data-dir keys removed in 0fc8abe2d; pre-existing tsc errors) | found during D1 | laravel-manager (done, released) |
| `core/contracts/QueueCenterContract.ts` (drop the `relay.device_identity` type), `core/network/RequestCoordinator.ts` (no retention when ttlMs <= 0) | LB-015 follow-up; reviewer note on FU-002 | laravel-manager (done, released) |
| `core/contracts/ServiceContract.ts`: add the `LOCAL_RPC_LOOPBACK_HOSTS` export | K7a | laravel-manager (done, released) |
| `core/integrations/pycore/index.ts` (export list only), `core/integrations/laravel/LaravelRequest.ts` (on 401 → the shared login request; on 403 → an i18n admin-required message) | K7a; route-table adaptation | pycore-manager |
| `config/index.js` (ENC: values → `SECRET:<STORE_NAME>` references, after a one-off migration of the current values into `.secret_keys/.secret_ignore`) | NC-002, NC-024 | ncore |
| `core/integrations/laravel/LaravelRealtime.ts` (payload map keyed by symbolic event names) | a laravel-manager-11 finding | laravel-manager (done, released) |
| `shell/shellTranslations.ts` (one key: `common.laravel_admin_required`, en/zh) | pycore-manager-7 (the LaravelRequest 403 message) | pycore-manager |
| root `package.json` (alias block only: remove the dead `#@link` / `#@puppeteer-api` aliases) | ncore-6 note | ncore |
| `core/contracts/ServiceContract.ts` (the `CLIENT_KEY_ERROR_CODES` / `LOCAL_RPC_ERROR_CODES` exports), new `core/integrations/pycore/pycoreAccess.ts` (`classifyPycoreAccess`) plus one export line in `core/integrations/pycore/index.ts` | vortex-5 (shared rejection classification; PcRpcAccessBanner switches to it in pycore-manager-8) | vortex (done, released) |

| Role | Work |
|---|---|
| shell | K2 on Linux and Windows; IS-*; the IS-010 password handoff |
| laravel | the K3 verifier plus the `client.key` / `client.key_or_dashboard` middleware; RelayDeviceIdentity and PycoreClientOnly merged into it; the §5 route table; the `laravel_peer` signer; LB-*, RV-* and X4 on the Laravel side. It publishes the route table before the UI roles adapt |
| pycore | the K3 signer (identity.py uses the store key) and the K7 verifier on the RPC server; PR-*, AT-*, X2/X6/X8 and the pycore side of RV |
| ncore | a single K3 signer/verifier in the ncore layers; K7 on 58000 and its HTTP stack; NC-* |
| mcp-chrome | native-host signing for the extension's Laravel worker calls; K7 on the native server; FU-001, FU-007, FU-021, FU-034, FU-041 and the extension part of FU-042 |
| laravel-manager, pycore-manager, wordnew, codemart, vortex | FU-* in their scope and their shared-layer assignments; adapting to the published route table |
| flutter | no findings; check its Laravel calls against the published route table. Stopped as won't fix (D6) |
| reviewer | a verdict per task |

`laravel-remote` is not dispatched: this lead session runs without Remote Control, so the role is unreachable (D2 blocker 2). Laravel work goes to local `laravel`. Server verification waits for `/remote-control` in the lead. (Superseded in the D10 session: the lead runs with Remote Control, and the round trip works; see §10.1.)

Contract cleanup (orchestrator): after laravel removes `RelayDeviceIdentity`, delete `queue_center_contract.json#relay.device_identity`.

User actions needed after K2 ships (also see the pycore LAN note below):
- A machine that must accept LAN CodeSync peers or LAN discovery (for example the CodeSync CLIENT at 43.163.112.77) sets the pycore LAN bind once: `pyservice config system set --key rpcLanBind --value true`. Without it, pycore binds 127.0.0.1 even when the scripts pass `--host 0.0.0.0` (K7a). shell switches the default and help text of `pyservice_entry.sh` to 127.0.0.1.

1. Run dd.sh once on one machine to generate and encrypt `CORE_NODE_CLIENT_KEY_1`.
2. Sync the encrypted file.
3. Run dd.sh / dd.cmd on every other host, including the laravel-main server, to decrypt it.

Until then, machine calls fail closed with `client_key_missing`.

## 7. Implementation record

### 7.1 Dispatch (2026-09-27, about 04:00)

- Teammates spawned (agent-teams mode): laravel, pycore, shell, ncore, mcp-chrome, reviewer, laravel-manager, pycore-manager, wordnew, codemart, vortex.
- flutter joins after laravel publishes `.claude/agents_shared/client_key_auth/laravel_route_auth.md`.
- Shared inputs:
  - `.claude/agents_shared/client_key_auth/TEAM_BRIEF.md` (common rules);
  - `.claude/agents_shared/client_key_auth/test_vectors.json` (K3 vectors, generated from the pycore relay canonicalization with a test-only key).
- Orchestrator follow-ups:
  - ~~delete `queue_center_contract.json#relay.device_identity` after `RelayDeviceIdentity` is removed~~ done about 04:3x (laravel merged it into `App\Services\ClientKey\ClientKeyAuthService`);
  - RV-005: `relay.hub` (`relayHubInt/relayHubString`) and `relay.capability_providers` (UI `RelayCapabilities.ts`) are still read. Only the keys without readers are pruned, after laravel and the UI drop their adapters;
  - RV-004: `task_contract.stream_events` is still read by pycore (`GLOBAL_TASK_STREAM_EVENTS_BY_ROLE`) and Laravel (`QueueCenterContract.php:415`). The key goes after both readers are removed (asked). Update, about 16:5x: pycore's and Laravel's readers are removed (pycore-5, laravel-T9). The UI adapter `QueueCenterContract.ts:132` and `:283` still reads the key, and must drop it (shared UI, ui-pycore-manager) before the orchestrator deletes it.
  - `task_contract.limits.history_timeline` has no consumer and was deleted at about 04:5x. The UI type union is cleaned by laravel-manager-7. `history_records` stays, because pycore `task_history/archive.py` uses it.

### 7.2 Rulings during the rollout

- K7a (user): remote browser access to pycore is relay only (§4).
- Laravel route table accepted (orchestrator, about 04:1x): `.claude/agents_shared/client_key_auth/laravel_route_auth.md`.
  - `client.key_or_dashboard` goes on routes the browser UI pump also calls: worker/register, worker accept, queue-center id-pages/page-data/events/receipts/overview, and media/enrich.
  - `dashboard.auth` means admin by default. Self-service `/api/user*` and `tts/generate` take `dashboard.auth:user`.
  - `DASHBOARD_LOCAL_DEBUG` follows `PathMapper::isProduction()`.
  - `pycore.client` is removed; its only route moves to `client.key`.
  - Relay `device-enrollments` with a valid K3 signature are claimed immediately.
- Vortex drops its inline Japanese dictionary. The ends serve en/zh only, and `supportedLngs` is unchanged.
- flutter spawned for `flutter-1` (adapt to `tts/generate` → `dashboard.auth:user`).
- F-FL-1 (flutter, pre-existing): app_qy calls `/api/dict/v1/*`, and laravel_main has no such prefix, so app_qy cannot log in. Ruling (B9, the recommended option): flutter repoints each constant to the existing laravel_main route (`flutter-2`), and laravel adds no dict/v1 alias, because duplicate API families break the AGENTS.md reuse rule. Endpoints with no laravel_main equivalent are deferred to D5.
- B9 in effect (user D4): from about 04:2x the orchestrator records its choices here instead of asking the user.
- laravel-T2 rulings (B9):
  - LB-008: the admin escrow-refund endpoint `POST /api/codemart/v1/admin/finance/escrows/{id}/refund` (admin, idempotent) is approved.
  - LB-019: `phone_verification` is optional while no SMS provider is configured, and required again automatically once one is. The OTP request answers 503 `codemart.errors.sms_unavailable`.
  - New LB-035: the DingDuoDuo admin group (`/api/ding_duo_duo_v1/admin/*`) was guarded only by `custom.authenticate` (any Sanctum user). It gets `dashboard.auth` (admin). No UI caller was found.
- FU-027: BaseAPI.setSharedBaseURL stops persisting on transient activation (laravel-manager); persisting stays on explicit switches.
- `config/service_contract.json#mcp_chrome.firefox_extension_id` (`mcp-chrome@core-node`) was added at about 05:3x, so each extension id has one definition.
- `config/service_contract.json#mcp_chrome.extension_id` was added at about 05:1x, taken from the mcp-chrome native-host constant. ncore's MCP HTTP server and mcp-chrome read it from there.
- NC-002 migration (B9, no outage): the current ENC: values move into the secret store first, and then `config/index.js` refers to them. Rotating the committed third-party keys is a user action; ncore's report holds the list.
- laravel rulings (about 05:5x, B9):
  - LB-033: `start.ps1` stops only the processes of this project's artisan path.
  - X4: word identity is the md5 of the exact stored content. Laravel sends it in the payload and pycore never recomputes it; the contract rule is added once laravel names the field.
  - RV-007: event names come from the contract. Cover/poster priority heads are keyed by the assist request id (contract `realtime.head_keys`), and pycore drops its synthetic heads.
  - The LB-034 remainder (173 interpolated calls, 737 message/error array literals) is deferred to D5.
  - laravel-T6 found two pre-existing defects and fixed them: an empty untracked `resources/lang/` made every `__()` return the raw key (`bootstrap/app.php` now pins `lang/`), and the API never switched locale (the new `ApplyRequestLocale` maps Accept-Language to zh_CN/en).
- Contract changes at about 06:0x (`queue_center_contract.json`; pycore and Laravel both load it):
  - `word_identity` (X4): md5 of the exact stored dictionary content, produced by Laravel and never recomputed by consumers. The fields are `payload.md5`, `payload.words[].md5`, the upload `body.md5`, and the delivery key `<lang>:<md5>[:<variant>]`.
  - `realtime.head_keys` and `realtime.resource_key_formats` (RV-007): cover and poster heads are keyed by `items[].resource_key` (`library:<id>` and `<media_type>:<id>`); these flows promote library and media rows, not global tasks or assist requests.
  - laravel-T9: Laravel no longer reads `task_contract.stream_events` (RV-004). The key goes after pycore drops `GLOBAL_TASK_STREAM_EVENTS_BY_ROLE`.
  - The escrow refund route is `POST /api/codemart/v1/admin/escrows/{escrowId}/refund`; the `/admin/finance/` prefix does not exist.
- NC-008 (DingDuoDuo super codes, about 06:1x):
  - The extension (ncore-5) accepts only Ed25519-signed, device-bound `DDK2` codes (spec: `.claude/agents_shared/client_key_auth/dingdoudou_super_code_v2.md`).
  - The orchestrator generated the signing key pair once. The seed is in the local secret store as `DINGDUODUO_SUPER_CODE_SIGNING_KEY_1` (debian 0600, never printed); the public key is in `config/service_contract.json#dingdoudou.super_code_public_key`. A sign/verify self-check passed.
  - laravel-T10 (approved; NC-008 closed on every end; the cross-end check passed: a PHP-sodium-signed code verifies in the extension's WebCrypto logic, while a wrong device, a tampered payload and the v1 master code are rejected): minting is the artisan command `php artisan dingduoduo:super-code <device>` only (no web route), and it refuses a seed that doesn't match the contract public key. The license resolver accepts only device-bound DDK2 codes, then member tokens. The seeded master-code rows are marked revoked by the initializer's retire step; the rows are kept.
  - User action: encrypt the new seed at the next dd.sh run and sync it to the laravel-main server, together with `CORE_NODE_CLIENT_KEY_1`. Until then, the server cannot mint super codes (fail closed).
- `config/service_contract.json#client_key_auth.local_rpc.error_codes` was added at about 06:2x as a keyed object: `{host_forbidden: local_rpc_host_forbidden, origin_forbidden: local_rpc_origin_forbidden}`. It was keyed, rather than an order-dependent list, after vortex's design note. There is one definition; pycore's `local_rpc_guard.py` and the UI's `classifyPycoreAccess` read it by key.
- K7 defect found in review (HIGH, about 06:3x): ncore's `local_rpc_guard.js` tested loopback with `startsWith('127.')` on the Host and Origin names, so a DNS-rebinding name such as `127.attacker.example` passed. It affected every ncore Node server and the mcp-chrome native server. Fix (ncore-7): `net.isIP` for peer addresses, and exact membership in the contract loopback hosts for Host and Origin names, as pycore already does. pycore was not affected.
- K7 residual differences, recorded as deliberate: the Node guard accepts a loopback Origin on any port, while pycore accepts only the dashboard ports. The trailing dot is aligned (B9): both ends strip one trailing dot from Host/Origin names, and pycore adopts this.
- A pycore startup deadlock, introduced by its own X6 change (05:17) and fixed at 09:41: the `.started` signal consumed the response guard, so every untimed `call_serialized` hung and pycore could not start. Fix: `ThreadBus.signal_if_present(consume=False)`. The entry chain imports in about 3 s. A pycore started from this tree between 05:17 and 09:41 must be restarted.
- Secret store permissions: the mount check shows the project volume is ntfs3 with `uid=1000,gid=1000,dmask=0022,fmask=0022` and no permission support, so per-file chmod cannot be enforced there. Every file appears as 0755/0644 or 0777 depending on the ACL. Options for the user: mount with permission support, or keep `.secret_keys/.secret_ignore` on a native Linux filesystem through a symlink.
 `.secret_keys/.secret_ignore` and most older store files are 0777 on this ntfs3 mount. The IS-008 fix sets 0700/0600 at the next dd.sh run. On ntfs3, modes are enforced only when the volume is mounted with permission support, so verify after dd.sh, and if the modes don't stick, remount with permission support or keep the raw store on a native filesystem.
- K7 guard alignment (B9): on every end, a loopback caller with a bad Host or Origin gets 403 with the contract `local_rpc.error_codes` (host_forbidden / origin_forbidden). A non-loopback caller without a valid signature gets 401 `client_key_*`. The Node guard is aligned to pycore in ncore-7.
- NC-034 HTTP stack, deferred (guide conflict, for the user): the audit says keep `ncore/utils/rpc/http_rpc` and delete `ncore/foundation/express_utils`, which has no live consumer, while `development-guides/NODE_NCORE_GUIDE.md` §5 says "reuse and may extend foundation/express_utils". Guides change only when the user asks (B7), so both copies stay until the user rules.
- K7 rejections carry no CORS allow headers for a disallowed origin (by design, B9). The pycore-manager UI shows a relay/origin hint derived from the contract allow-list instead.
- FU-031 known limit (wordnew-1): queued writes belong to a hash of the login token. After a token expires and the user logs in again, the older queued writes are held and then dropped after 24 h. A stable owner needs the shared login state to store the user id next to the token, a shared-layer change that is recorded as a follow-up and not done in D1.
- K1/K3 clarifications (reviewer notes):
  - key names are `CORE_NODE_CLIENT_KEY_1.._5` only, and a bare `CORE_NODE_CLIENT_KEY` is ignored on every end;
  - the signed path is the full path sent on the wire, including any base path. Laravel verifies `getBaseUrl().getPathInfo()`.
- flutter backlog, won't-fix under D6 and kept for when flutter is reopened (flutter-G1, a read-only re-check about 20:1x; report `.claude/agents_shared/reports/flutter.md`):
  - F-FL-1 still applies: app_qy calls `/api/dict/v1/*`, which laravel_main does not have.
  - F-FL-3 still applies: dead ttsBatch/translate constants.
  - **New F-FL-4 (high):** the live routed screens `course_ielts_screen_app_qy.dart`, `word_book_screen_app_qy.dart` and `home_search_screen_app_qy.dart` call `/api/v1/courses*`, `/api/v1/words/*` and `/api/v1/learning/*` through CourseService, WordService and LearningService with the real ApiServiceAppQy. None of these paths exist in laravel_main (the only `v1/*` group is `v1/auth`). This root cause is independent of F-FL-1.
  - Dead code in app_qy: a second AuthService/AuthControllerAppQy, profile/social/settings services, the shared `laravel_endpoints.dart`, and most ApiServiceAppQy methods.
  - No flutter call hits the 09-26/27 changes (client-key machine routes, delivery diff routes, X4, cover tasks).
- D6 (user, verbatim): "flutter任务停止，并标记为不用修复。" The flutter teammate is stopped. flutter-1, flutter-2 and F-FL-1/2/3 are won't fix; nothing flutter-related goes to D5, and the reviewer drops flutter-1.
  - The flutter-1 edits already on disk were left in place, unreviewed, because the user did not ask for a revert. The files are in `poly_apps/flutter_bloom/lib/apps/app_qy/`: `services_app_qy/api_service_app_qy.dart`, `main_app_qy.dart`, `localization_app_qy/en_app_qy.dart`, `localization_app_qy/zh_app_qy.dart`.

(Role results are appended below as tasks complete.)

### 7.3 Role results

- vortex: complete. vortex-1..4 approved:
  - FU-033 margin-based close math;
  - FU-038 stale candles;
  - FU-042 `vx` namespace (ja dropped);
  - the UI side of reveal_credentials (masked key only).
  The `okx/reveal_credentials` server side was refuted by pycore: no handler or route name exists in `pycore/` or `pyapps/`. The Vortex UI calls `okx/*` routes that this checkout does not register at all; this is a D5 follow-up, because the Vortex market data, settings and backfill panels depend on them. Report: `.claude/agents_shared/reports/vortex.md`.
- Cross-end K3/K7 core verified (reviewer, about 05:4x): ncore-1 and mcp-chrome-1/2 are approved after laravel-T1. The three test vectors pass through the Laravel, ncore and mcp-chrome host paths. A verify round trip returns ok, then `nonce_replayed` on a replay, then `signature_invalid` on a tampered query. pycore-1/2 were approved at about 05:5x: the vectors reproduce with pycore's `client_key_auth.py`, so Laravel, ncore, pycore and mcp-chrome (through ncore) all agree.
- User cleanup after rotation: old ENC: files may remain in `global_var` on the hosts; ncore's report lists the paths.
- mcp-chrome: complete. mcp-chrome-1..5 approved:
  - K3/K6: all extension Laravel calls go through one `laravelFetch`; the native host signs them with ncore's signer, and the key never enters the extension; only extension pages may request signatures;
  - FU-001: the native server uses ncore's `local_rpc_guard`, with extension-only origins and a Host check;
  - FU-007/021/034/041: worker fixes;
  - FU-042: extension i18n (the worker names were refuted as identifiers);
  - RV-004: the dead SSE consumer was removed;
  - both extension ids come from the contract.

  D7 follow-ups: remove `@fastify/cors` together with the lockfile, and run `build:shared` first. The extension signs only while the native host is connected and `CORE_NODE_CLIENT_KEY_1` exists. Report: `.claude/agents_shared/reports/mcp-chrome.md`.
- pycore-manager: tasks 1–6 approved:
  - FU-004/018/024/025: i18n, including the 10-file label sweep;
  - FU-011/036/037/040: stale state, races and a single audio player;
  - FU-026: duplicate helpers removed;
  - FU-020/027: cover tasks and endpoint binding;
  - K6/K7/K7a plus the route table: 401 opens the login window, 403 shows admin-required, direct mode is loopback only, and `PcRpcAccessBanner` explains rejections.

  pycore-manager-7 (index.ts dead exports, the LaravelRequest.ts 401/403 fix, one shell i18n key) is approved, so pycore-manager-1..7 are complete. pycore-manager-8 (PcRpcAccessBanner → the shared `classifyPycoreAccess`) is approved, so pycore-manager-1..8 are complete. vortex-5 (the shared `classifyPycoreAccess` plus VortexPycoreNotice, with the keyed error-code lookup) is approved; vortex-1..5 are complete. Accepted deviation: 401 → shared login only on `requestLaravel`, the session path. The Qy account login, relay and cloud-clipboard 401s mean wrong credentials or device auth, not a missing dashboard login.
- ncore: complete. ncore-1..7 approved (ncore-7 after the DNS-rebinding fix). ncore-6 reuses pycore's `LocalRpcGuardMiddleware` in `ncore_backend_main.py`. About 190 files changed; 52 dead copies were deleted or moved.
  - Shared modules: `ncore/foundation/common/client_key_auth.js` (K3) and `local_rpc_guard.js` (K7).
  - Behavior changes for the user:
    - WebLocalAreaNetwork and the Voice local UI no longer work from LAN browsers;
    - `/api/call` refuses every call until allowed pairs are configured (the list is empty by default);
    - config/index.js ENC: values are migrated (ncore-7, in review). The new store names are ADMIN_JWT_SECRET_1, JWT_SECRET_1, MYSQL_PWD_1, STRAPI_TOKEN_1, GITEA_TOKEN_1, API_TOKEN_SALT_1, TRANSFER_TOKEN_SALT_1, DICT_API_CLIENT_TOKEN_1, DEEPBRICKS_API_KEY_1, OCRSPACE_API_KEY_1 and UNSPLASH_ACCESS_KEY_1; the Azure speech key reuses AZURE_SPEECH_KEYA_1. The files are debian 0600, and dd.sh's re-encrypt prompt encrypts them;
    - Linux tool directories now include the distro name (for example `.dev_debian13`), so existing `.dev_linux` installs are not reused and tools may be reinstalled on the next run.
  - Pre-existing bugs fixed along the way:
    - extensionless `#@` imports broke 58000, WebLocalAreaNetwork and Voice at load;
    - a nonexistent `rpc.getExpressServer()` crashed the upload controllers;
    - the Voice config pointed at a wrong path;
    - the zip tool imported a 7z lookup that was never exported;
    - `copyFileToDir` deleted the source file instead of the target;
    - the logger's timer kept every script from exiting.
  - Rotation list for the user (committed keys still in git history): the OCR.space key; the Unsplash access and secret keys; the dict API Client-Token; the sqlpub MySQL password; the Xata key; the deepbricks key; and in config/index.js the JWT secrets, MYSQL_PWD, the Azure speech key, the Strapi and Gitea tokens and the two salts. Old ENC: files in `global_var` on the hosts are to be deleted.
- shell: complete. shell-1..9 approved:
  - K2: the client key lifecycle on Linux and Windows;
  - IS-008: secrets kept out of the 777 walk;
  - IS-010: passwords by stdin, never argv;
  - IS-001/012: PostgreSQL never drops a cluster with user databases;
  - IS-002/003/004;
  - IS-005: masking in every launcher, via the shared helper;
  - IS-006/007/009/011/013 and IS-014..030;
  - PR-034: the script half;
  - the §2 follow-ups;
  - IS-022: the Join-Path sweep;
  - K7a: pyservice binds loopback by default;
  - the postgres mirror file is 0600, and the 777-helper guard refuses system paths.

  Report: `.claude/agents_shared/reports/shell.md`.
- laravel: complete. laravel-T1..T10 approved:
  - T1: the K3 verifier and the route gating;
  - T2: money, plus the LB-035 admin gate;
  - T3: data sync;
  - T4: the timer and queues;
  - T5: idempotency and backup locks;
  - T6: i18n, with the lang/ pinning and ApplyRequestLocale fixes;
  - T7: the CodeMart contract fields;
  - T8: the verifier follow-ups;
  - T9: the rulings (LB-033, X4, RV-007, LB-007, RV-004);
  - T10: NC-008 DDK2 minting.

  Report: `.claude/agents_shared/reports/laravel.md`; route table: `.claude/agents_shared/client_key_auth/laravel_route_auth.md`.
- codemart: complete. codemart-1..7 approved:
  - FU-010/013/014: stale responses;
  - FU-015: a failed refresh keeps the last good state;
  - FU-017/022: calendar dates and estimate inputs;
  - codemart-4: the UI side of LB-008/009/019/020/024/025, including the admin escrow refund;
  - FU-026: the CodeMart formatting is centralized;
  - reuse of the BaseAPI idempotency header, key generator and cache handling.

  The Laravel side of the codemart-4 fields was routed to laravel-T7 for review. Report: `.claude/agents_shared/reports/codemart.md`.
- laravel-manager: complete. laravel-manager-1..12 approved:
  - FU-002/003: BaseAPI retry and GET coalescing;
  - FU-030/039: long operator writes, per-action Idempotency-Key, Octane reconnect;
  - FU-005/006/012/016/035: Data Sync and stale guards;
  - FU-024/042: i18n, with lm zh typed against en;
  - the route table: LmBaseAPI 401/403, AuthGuard, dead assist wrappers removed;
  - the shared contract adapters: data dir, `LOCAL_RPC_LOOPBACK_HOSTS`, the QueueCenterContract types, RequestCoordinator ttl 0;
  - FU-027: the BaseAPI part;
  - the FU-025/026 remainders;
  - the realtime payload typing.

  tsc for apps/laravel-manager went from 67 to 0 errors, and the whole UI type-checks cleanly. Runtime bugs fixed along the way: the dead Task Center refresh, the Queue tab crash, the scheduler modal z-index, the missing AppQyV1 and FileTreeParts imports. All shared-layer writes are released. Report: `.claude/agents_shared/reports/laravel-manager.md`.
- wordnew: complete. wordnew-1..5 approved:
  - FU-031: the offline queue is owner-scoped, cleared on logout, and sends an Idempotency-Key;
  - FU-008/009/023: playback and reader races;
  - FU-019/032/042: the endpoint check before switching, fresh audio polling, and i18n;
  - the route-table adaptation;
  - pre-existing runtime ReferenceErrors and the PlayBar props. tsc for apps/wordnew went from 22 to 0 errors.

  The laravel server-side Idempotency-Key dedupe on the three replay routes (`group/update_progress`, `recitation/log`, `learning/sentence-words/played`) has landed: one run per key per user, a stored replay answered with `Idempotent-Replayed: true`, and 409 while the first request is still in progress. wordnew confirmed its client is compatible without a code change. Optional follow-up: keep the user id in AuthSession so offline writes survive a re-login. Report: `.claude/agents_shared/reports/wordnew.md`.

## 8. D5 + D7 plan: upgrade the code to the 2026-09-26/27 design documents, then long-run audio orchestration (Workflow, after D1)

Scope: the docs_fix design, requirement and fix documents whose names are dated 2026-09-26 or 2026-09-27. Old documents that were only touched in those days (mtime) are out, except where a listed document points to them.

| Document | Likely owners |
|---|---|
| `FIX_20260926_AGENT_HISTORY_SCAN_CENTER_MONITOR_TRAY_NOTIFY.md` | pycore, ui-pycore-manager |
| `FIX_20260926_PYCORE_RESTART_PORT_REFUSED_TRAY.md` | pycore, shell |
| `REQUIREMENTS_20260926_AUDIO_ORCH_QUEUE_STATE_DRIVEN.md` | pycore, ui-pycore-manager, ui-wordnew, laravel |
| `REQUIREMENTS_20260927_CLAUDE_AGENT_ROLES_V2.md` | orchestrator, shell |
| `REQUIREMENTS_20260927_CLAUDE_MULTI_ROLE_TEAM.md` | orchestrator, shell |
| `REQUIREMENTS_20260927_CODEMART_PAGE_POLISH.md` | ui-codemart, laravel |
| `REQUIREMENTS_20260927_DD_SH_STARTUP_REFACTOR.md` | shell |
| `REQUIREMENTS_20260927_LARAVEL_DIFF_DELIVERY_REDIS_INDEX.md` | laravel, pycore |
| `REQUIREMENTS_20260927_LINUX_TERMINAL_CONTROL_WAYLAND.md` | pycore, shell, ui-pycore-manager |
| `REQUIREMENTS_20260927_MACHINE_DATA_SYNC_REFACTOR.md` | laravel, ui-laravel-manager |
| `REQUIREMENTS_20260927_MCP_CHROME_SERVICE_HOT_RELOAD_COVER_TASKS.md` | mcp-chrome, shell, laravel |
| `REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE.md` | pycore, ui-pycore-manager |
| `REQUIREMENTS_20260927_CLIENT_KEY_AUTH_AUDIT_FIX.md` (this document) | all, as the final cross-check |
| `TASK_20260927_CLAUDE_TEAM_BOARD.md` | the open rows only |

Method:
1. Each owner diffs every requirement and acceptance item of its documents against the current code (after D1). It lists each item as done, missing or conflicting. A conflict with K1–K7 or a later ruling is resolved in favor of the newer ruling and recorded.
2. The owner implements the missing items in its scope.
3. The owner verifies the items. "确保功能可用" is the user's request for verification, so tests, static checks and local runs are allowed for this phase. The reviewer gives the verdict.
4. The orchestrator marks each document's items in its implementation record and corrects any stale sections (memory: docs_fix requirements first).

### 8.0 Carried into D7 (installs and builds allowed there)

- mcp-chrome: remove the unused `@fastify/cors` from `native-server/package.json` and its lockfile, then run `build:shared` before building the extension and the host.
- Contract follow-up: the data-dir resolution (`CORE_NODE_DATA_DIR` env, Windows `D:\www\core_node`, Linux `/www/www/core_node` on an NTFS `/www`, else `/www/core_node`, then `/var/_core_node`, then `~/core_node`) is re-implemented with literal WWW bases in pycore `core_node_dirs`, ncore `system_paths.js`, shell `runtime_environment.sh`, Laravel `PathMapper` and the UI `vite.config.ts`. Move the base paths into `service_contract.json#paths` and have each end read them. That is one definition, the AGENTS.md centralize rule.

- Vortex: the UI calls `okx/*` pycore routes that this checkout does not register (found while verifying vortex-4). Find where they were served (a missing pyapp or module), then restore them in pycore or remove the dead UI panels.
- `docs_fix/CODESYNC_AI_COMMUNICATION_API.md` §2/§3/§5–§14 now describe client key signing (updated about 05:3x); the old `WORKSPACE_SHARED_SECRET` bearer was removed by PR-003.

- wordnew offline queue: mint the Idempotency-Keys with `BaseAPI.createIdempotencyKey()` instead of `RequestQueue.generateEntryId` (MasterApiClient.ts/RequestQueue.ts; wordnew is the next writer).
- DingDuoDuo: the license label "Super Code" that Laravel returns to the extension is hardcoded English. Return a code and let the extension localize it (reviewer note on laravel-T10).
- pycore-manager i18n remainder: inline English in other pycore-manager files (for example parts of PcSettingsPage) and the shared ECDICT panel labels.
- shell-7 side effect: regenerating the launchers pulled the generator's newer shared tool install/upgrade section into claude1-5, codex1-2 and kimi1-2. Launcher startup behavior changes; verify it on first use.
- ncore remainders (counted, in `.claude/agents_shared/reports/ncore.md`): NC-035, where foundation fwriter/sequelize_db still default app dirs from global_vars; and NC-036, 462 remaining `throw new Error` sites.
- X4, words without a Laravel md5 (B9 ruling, about 10:2x): orchestration-tokenized words, the word-cache bootstrap and local Part1 tasks are identified by `lang` + `cleaned_word`, and Laravel resolves the row; a word not in the dictionary is rejected and no row is created. The pycore local key for them is `<lang>:text:<cleaned_word>`. D7 work:
  - Laravel: resolve-by-`cleaned_word` on `word/audio/upload` and the delivery-batch word items;
  - pycore: remove the transitional md5(lower(strip)) fallbacks: `audio_resource_ledger.resource_key`, the `audio_resource_delivery.py` single upload, `audio_queue_center.build_local_task`, and (a fourth site found in the pycore-5 review) `queue_center_contract.audio_dedup_key`. Optionally, the manual-promote RPC accepts only a 32-hex `items[].md5`;
  - the orchestrator: add `word_identity.fallback_when_md5_absent` to the contract.
- LB-034 remainder: 173 interpolated calls and 737 message/error array literals in laravel_main still bypass the lang files. The CodeMart wallet history texts (e.g. the escrow remainder refund line) are stored in the database as text; translating them needs a stored message code plus parameters, resolved when displayed.

### 8.1 D7 environment facts (checked about 04:4x)

- pycore is running on 0.0.0.0:59000. After D1 it binds loopback by default (K7a).
- A local Laravel (FrankenPHP) runs on :9000/:80/:443 and answers `/api/health` 200. End-to-end tests use it. The note "not running on this machine" in `REQUIREMENTS_20260926_AUDIO_ORCH_QUEUE_STATE_DRIVEN.md` is stale.
- There is no working GPU: the NVIDIA driver does not respond. Audio is generated on CPU engines only (Kokoro batch, edge). GPU engines (qwen3tts and others) are recorded as `skipped: no GPU`, not failed.
- `CORE_NODE_CLIENT_KEY_1` does not exist yet. Local pycore and local Laravel read the same raw store on this machine, so the shell K2 generator is run once in its non-interactive raw-file mode. Encrypting the key and distributing it to other hosts stays a user action.

### 8.2 D7 workflow design

Script phases (one Workflow; role-typed agents via `agentType`):

1. **Audit** (read-only, one agent per document, typed as the owner role). The output is `items[{doc, item_id, requirement, status: done|partial|missing|conflict, evidence(file:line), owner, files, reuse_issue}]`.
   - "Reusable" is checked explicitly: duplicate implementations and components that are not shared (G1 of the audio docs) count as `partial`.
2. **Merge** (a barrier, justified by a cross-document dedupe). Duplicate items across documents are merged, conflicts are resolved by the newest ruling (K1–K7, K7a, B9, D6), and the remaining items are grouped by owner role.
3. **Implement**: a pipeline per owner role. Roles run in parallel; within a role one writer runs at a time (B1). Each agent writes only inside its scope and returns the changed files plus per-item status.
4. **Verify**: a reviewer-typed skeptic per owner batch. It tries to refute each claimed `done`, using static checks plus unit runs; tests are allowed in this phase (the user asked for "确保功能可用"). Refuted items go back to Implement, at most 3 rounds.
5. **Audio long run**: a loop until it passes, at most 6 rounds. Each round:
   - a pycore-typed e2e agent:
     - brings up local pycore and local Laravel;
     - makes sure the client key exists locally;
     - runs (a), prompt rewrite → audio: new rewritten prompts go through `ui/audio_orch/task/submit_text` and the agent-history rewrite path, get generated, reach Laravel `orch_audio` ingest idempotently, and appear in the wordnew listing API;
     - runs (b), books: every Laravel book is listed through `ui/audio_orch/books/list`; for each book a `vocab_book` task is created and planned; audio is generated for a sample of segments across several books;
     - returns `{passed, audio_files[], failures[{owner, symptom, evidence}]}`;
   - failures go to owner-typed fix agents (a pipeline), and the next round re-runs;
   - pass criteria: both paths finish without error, the mp3 files exist and play (ffprobe duration > 0), the Laravel ingest shows each task exactly once after a repeat upload, and the Word/Sentence Part1/Part2/Queue state reaches `cached`/`synced` for the task's missing resources.
6. **Review and record**:
   - a reviewer-typed final verdict per document;
   - a completeness critic ("which requirement was not exercised?");
   - the orchestrator writes each document's implementation record, corrects stale sections, and lists the generated audio files.

### 8.3 D7 start (user, about 16:4x: "尽快开始D7，查看前置任务是不是卡住了")

- Prerequisites were not stuck, but slowed:
  - The pycore-5 review's first attempt ran 16:24-16:40 and stopped; the harness retry was live from 16:40.
  - The all-roles merge's first attempt stalled after 13 transcript lines; the retry was live from 16:38.
  - The three stop/resumes for D16/D17 had restarted the two CodeMart audits.
- Reorder (B9): pycore-6 (IS-010, PR-034, PR-024, the CRLF restore) moves to the very end of the pycore work. Its CRLF restore must cover every pycore file this run changes, D7's included. The D1 closeout workflow is stopped once pycore-5 is approved, before pycore-6 starts.
- The workflow `d7-start-env-baseline` started at about 16:4x, with no code edits:
  1. the laravel coordinator brings up the local Laravel at https://127.0.0.1 (the service was stopped and disabled);
  2. shell-windows makes sure `CORE_NODE_CLIENT_KEY_1` exists (existence only, never printed);
  3. the pycore coordinator restarts pycore on the current tree, applies D8 (the previous endpoint is saved to `.claude/agents_shared/d7/endpoint_before.json`, then `https://127.0.0.1` is selected) and checks a signed call;
  4. pycore-runtime runs baseline round 0 of the long run (prompt rewrite → audio; books → one vocab_book task), with the results in `.claude/agents_shared/d7/round0.md`.
- Next, once pycore-5 is approved: the pycore D7 phase 2 workflow takes the merge's deferred pycore items plus the round-0 failures, then runs rounds 1..6 (fix → rerun) until the pass criteria of §8.2 hold. pycore-6 comes last.
- About 17:0x, the user said "继续启动动任务编排的下一步任务" (start the next orchestration step), and pycore-5 had been approved at 16:48, so phase 2 started before the merge finished. Path-disjointness is guaranteed: the merge rules keep every lane off the audio paths and defer those items to phase 2.
  - Scope: 12 open audit items on `pycore/pyctl/{audio_orchestration,tts,queue_center}` and `pycore/pyutils/tts`, saved in `.claude/agents_shared/d7/phase2_items.json`, plus the D1 follow-ups: the four X4 md5 fallbacks, the nvidia-smi timeouts, the qwen resubmit race, and AT-049.
  - Flow:
    1. the lanes pycore-ai-D7P2 and pycore-runtime-D7P2 run in parallel;
    2. the pycore coordinator takes the cross-area parts;
    3. reviews;
    4. long-run rounds 1..6 (`.claude/agents_shared/d7/roundN.md`);
    5. pycore-6;
    6. the final family merge.


## 9. D9 plan: CodeMart long task (Workflow, after D7)

Sources, the previous progress to continue:
- `docs_fix/codemart_docs/`:
  - `DESIGN_20260823_CODEMART_PYCORE_UI_LARAVEL_MAIN.md`;
  - `PROGRESS_20260823_CODEMART_{INTEGRATION,LARAVEL_MAIN,PYCORE_UI}.md`;
  - `PROGRESS_20260919_CODEMART_CONTINUATION.md`;
  - `PROGRESS_20260927_CODEMART_GAP_COMPLETION.md`;
  - `PROGRESS_20260927_CODEMART_PAGE_POLISH.md`;
  - `REQUIREMENTS_20260927_CODEMART_PAGE_POLISH.md`.
- The same-named copies in the `docs_fix/` root are stale duplicates. They are reconciled into `codemart_docs/` and marked superseded.

Roles: ui-codemart, laravel, shell, reviewer.

Items:
1. **AI-generated icons.** CodeMart gets its icon set (navigation, feature, category and empty-state icons) generated through the existing AI image path. Reuse the Laravel AiGateway image generation or the cover/poster pipeline; no new generator.
   - The images are stored as versioned app assets, and their alt texts are i18n.
   - The generation prompts are recorded in the progress document, so the set can be regenerated.
2. **Calibrate and use every feature** end to end against the local Laravel (D8): marketplace, projects, tasks, estimate, wallet/deposit/escrow/payout, invoices, KYC/onboarding, admin.
   - Test accounts cover each role. Every broken flow is fixed at its root.
3. **Refine rough pages.** Continue `REQUIREMENTS_20260927_CODEMART_PAGE_POLISH.md`: find every page still marked rough or unfinished in the progress documents and on screen, and polish it to the shared UI conventions.
4. **Continue earlier progress.** Every open item in the progress documents is matched to the code as done, missing or superseded. The missing ones are completed, and the documents are corrected to the code.
5. **Backend Redis.** CodeMart's Laravel side uses Redis where the project already standardizes it (cache, locks for money operations, rate limits, queues), following `REQUIREMENTS_20260927_LARAVEL_DIFF_DELIVERY_REDIS_INDEX.md`. No second cache abstraction.
6. **175 deployment script.** `scripts/shells/linux/debian/install_shells/175_laravel_main_start.sh` is aligned with the backend: the Redis service and config, the environment keys, CodeMart migrations and seeders, queue workers and scheduled tasks. It stays idempotent, and installers repair only what is missing.

Verification: running the app and Laravel locally is allowed ("校准和使用"). The reviewer gives the verdict per item, and a completeness critic checks that every page and flow was exercised.

## 10. D10 record: claudeagents on Windows, official features, and D1–D9 by Workflow

### 10.1 Why only some roles start (orchestrator, read-only, about 13:2x)

- The live state matches the design. `%LOCALAPPDATA%\core_node\claude_team` has only `team-orchestrator.pid` and `team-laravel-remote.pid`, and both processes are alive.
  - The lead runs `claudeteam.ps1 --agent orchestrator --name ca-orchestrator --remote-control ca-orchestrator` with the team kickoff, so D2 blocker 2 is gone in this session.
  - The ct-laravel-remote round trip was confirmed by message at about 13:2x, so §6's note "laravel-remote is not dispatched" is stale.
- Cause: `ClaudeTeamCommon.ps1` `Import-ClaudeTeamCatalog`, mode `team`. Every enabled local role other than the lead gets `State = "teammate"` and `Enabled = $false`, and `Start-ClaudeTeamRoles` opens windows only for `Enabled` rows. That leaves two windows: the lead, and the remote role, whose ssh loop goes through the non-team branch.
  - The teammates were meant to be spawned by the lead "on demand". The catalog `team.kickoff` also tells the lead to "spawn only the roles the task needs", and guide §3/§9 size a team at 3–5.
  - The result: the launcher starts no local role besides the lead. The 12 local roles appear only when the lead spawns them.
- The launcher has no way to start the teammates itself. In agent-teams mode only the lead spawns teammates (guide §3), and Windows Terminal supports `in-process` only.
- Pending: the official docs check (§10.2) confirms what Windows supports, and the launcher fix follows it.

### 10.2 Official docs check and the idempotent enable list (pending)

### 10.3 D1–D9 by Workflow (pending)

### 10.4 laravel-remote-1: server inventory (read-only, about 13:5x; items 1–5 and 7)

The server checkout `/www/programing/core_node` is at HEAD 74e7770bda27. It has no server-only changes in `poly_apps/laravel_main`, and none of this session's local changes are there yet.

| Area | Server fact | Next owner |
|---|---|---|
| CodeMart | `GET /api/codemart/v1/public/home` returns **500**: `codemart_v1_escrows` has no `released_amount`/`refunded_amount`, but `CodeMartV1EscrowModel::sumRemaining` reads them. The columns are defined in `CodeMartV1Initializer.php:459-460` (D1 money work), and CodeMart tables come from `sys:init`, not migrations. The existing table never got them | laravel-T11 (a D1 regression) |
| Migrations | 156 ran and 2 are pending: AppQyV1 `2026_09_27_000001/000002` orch_audio_tasks/segments (D7). 15 rows have no file (old AppQyV1 dictionary migrations) | deploy (D9 item 6), D7 |
| Queue | No worker, no Horizon, no supervisor; the effective queue is `sync`. The scheduler is `schedule:work` inside the FrankenPHP service, and `octane-timer-heartbeat` (everySecond) overlaps | D9 items 5/6 |
| Redis | redis-server 8.0.2 is installed but **disabled and inactive**. phpredis is not loaded in php CLI/ZTS/FrankenPHP. `.env` Redis/cache/queue keys are ignored, because `config/*.php` read `app/Constants/LaravelConfig.php`. Effective: cache database, session database. RedisBucketIndex falls back to the database | D9 items 5/6 (shell 175 + laravel) |
| PostgreSQL | 15/main on :5432 serves Laravel. 17/main on :5433 is **down**: "data directory /www/wwwroot/postgresql/data has invalid permissions" (needs 0700/0750). A collation version warning appears (2.39 vs 2.41) | shell (777 walk / PG data-dir guard) |
| Security | `APP_ENV=local`, `APP_DEBUG=true` on the live host. `.env` and the whole `laravel_main` tree are mode 777 | D9 item 6 (175 env), shell (777 walk) |
| Logging | `LOG_CHANNEL=syslog`, yet the 500 left no Laravel error line in syslog | laravel (D7 audit) |
| Secrets | `CORE_NODE_CLIENT_KEY_1` and `DINGDUODUO_SUPER_CODE_SIGNING_KEY_1` are absent on the server | user (dd.sh encrypt + sync, §6) |
| HTTP | `/api/health` 200; `public/estimate-options` 200; `public/home` 500 (above) | — |

Item 6 (175 script vs server state) follows from laravel-remote.

laravel-T11 result (approved about 15:5x; report `.claude/agents_shared/reports/laravel.md` § laravel-T11):
- Correction to the CodeMart row above: the base tables such as `codemart_v1_escrows` come from migrations. The later contract columns and tables come from `sys:init` (`CodeMartV1Initializer` → `SafeMigrationHelper::alignTableStructureFromArray`), which already added missing columns whenever it ran.
- The server's two pending migrations mean `sys:init` has not completed since the sync, because it stops at its first failing step (`migrate --force`) and the app initializers run last. Every CodeMart contract structure added since then is probably missing there, not only the escrow columns.
- The local database had the same gap: 5 tables and 42 columns. `codemart_v1_init_status.json` claimed `fully_initialized`, but that file is not evidence that the schema was applied.
- Fix, in the shared `app/Services/SafeMigrationHelper.php` only:
  - `addMissingColumns()` logs each added column and is used by both align paths;
  - a failing column no longer stops the rest;
  - a NOT NULL column without a default on a table with rows is added nullable, with a warning;
  - `findEquivalentIndex` stops duplicate indexes.
- Local run: 42 columns were added; a rerun makes 0 changes; in-process `public/home` returns 200.
- Local environment fact: the Windows service `ncore-laravel-main` (FrankenPHP) is **Stopped and Disabled**, and `https://127.0.0.1` does not answer. The §8.1 note "a local Laravel answers 200" is stale.
  - Lanes verify through the in-process HTTP kernel.
  - The D7 end-to-end stage (pycore lane) brings up the local Laravel, as §8.2 step 5 says, and D9 calibration runs after it.
- Follow-ups:
  - laravel-T12: the 5 non-blocking notes;
  - shell-linux: `175_laravel_main_start.sh:657` ignores the `sys:init` exit status (`start.ps1:641-643` stops on it). Stop, or warn loudly;
  - laravel-remote-3, after the code sync: count the pending migrations, run `php artisan sys:init` (it must reach "CodeMartV1: OK" and the step "Align additive contract tables and columns"), check `information_schema` for the escrow columns, GET `public/home` 200, and confirm a second `sys:init` adds nothing.
- Code sync to the server is a user action (git push/pull or CodeSync); nothing in this run pushes.

laravel-remote-2 (read-only diagnostics, about 15:5x):
- Correction to the security row above: the effective environment is `app.env=production`, `app.debug=false`. `config/app.php:28,41,54` read `app/Constants/LaravelConfig.php:7-9`, so the `.env` APP_ENV/APP_DEBUG/LOG_CHANNEL/SESSION_DRIVER/QUEUE_CONNECTION/CACHE_STORE keys are dead.
- Logging works. `config/logging.php:32` sends the stack to a size-capped daily log at `/www/wwwroot/laravel_db/logs/laravel-YYYY-MM-DD.log`, and it holds the 42703 errors.
  - `mcpv1:placeholder-cleanup` fails daily ("placeholder_images does not exist").
  - There are 610 DatabaseQueryMonitor warnings a day.
- Scheduler overlap, a laravel code bug:
  - Since 45901d3f6, `OctaneTimerService::writeHeartbeatSnapshot()` (:143) is never called. Every `schedule:run` process therefore reads a stale `last_run` and runs all due tasks inline, the audio writeback taking about 101 s.
  - The `withoutOverlapping(1)` at `bootstrap/app.php:77` expires in 60 s.
  - `EXECUTION_BACKGROUND` is never honored.
  - This is lane item srv-01.
- PG17 :5433:
  - Its data dir is `/www/wwwroot/postgresql/data`, which holds **PG_VERSION 15**, so 17/main points at an old PG15 directory. It has been mode 777 since 2026-09-18 16:48, from a 777 walk plus `75_install_postgresql.sh:219` chown.
  - Whether 17/main should exist is a **user decision**.
  - Latent hazard: `pyservice_www_permissions.sh:95-101` would walk all of `/www` (stamp missing) and break the **live PG15** data dir `/www/_debian_12/postgresql/data`. Lane item srv-03 is urgent.
- The two pending orch_audio migrations only create tables, so they are safe at deploy.
- phpredis: FrankenPHP 1.12.7 is a dynamic build on `/etc/php-zts`. The official path is `apt install php-zts-redis` (candidate 6.3.0), then a restart of `ncore-laravel-frankenphp`. That is lane item srv-04 for the script; running it on the server needs the user's request.
- laravel-remote runs `sys:init` or `migrate` on the live server only on the user's explicit request, relayed by the orchestrator. A task row alone is not enough.

laravel-remote-1 item 6 (175 against the live server, read-only; about 16:0x; 8-agent workflow, key lines re-checked). Verdict: **do NOT run 175 on the server as it is.**
- Outage chain. The new `redis_endpoint_common.sh` (014bfbff9) writes `DEBIAN_13_START_REDIS=true` before starting Redis (:340-343), which makes phpredis "desired". Then:
  1. `laravel_main_runtime_common.sh:197-201` runs `93_install_frankenphp.sh --mode=apt`;
  2. apt installs php-zts-redis, and its `policy-rc.d` blocks every service start;
  3. `fm_unlink_frankenphp_runtime` (`frankenphp_install_modes.sh:454`, `frankenphp_runtime_common.sh:494-498`) exempts only an ExecStart matching octane|artisan, so it runs `systemctl disable --now ncore-laravel-frankenphp`. Ports 80/443/9000/2019, the workers and the scheduler go down, and the unit stays disabled at boot on any early return (352, 367, 401, 409, 417, 714-717) or on a failed final restart (776).
- PostgreSQL, on every run: `75` drift uses `_debian_12` vs `_debian_13` and never converges. It targets 17/main, but `pg_service stop` (:212) stops the **live 15/main**. It also puts the postgres password on the argv (visible in `ps`), rewrites the mirror at 666, and sets CPUQuota=50%.
- `9_fix_dns.sh --detect-public-ip` stops every unit on :80 for its probe (525, 599-607) and caches no negative result.
- `mkcert -install` as root would create a new root CA.
- `sys:init`:
  - Applies the 2 orch_audio migrations. This also ends the 438 errors "relation app_qy_v1_orch_audio_tasks does not exist".
  - Fixes `public/home`.
  - **Seeds CodeMart demo data in production**: 7 users, including an admin with a password hardcoded in `CodeMartV1DemoSeeder.php:55`. `CODEMART_SEED_DEMO` is absent, and the comment at 175:660-664 is wrong.
  - Prints an admin invite code to stdout on every run.
  - Resets the TTS engine priority_order.
  - Skips McpV1 on its status file alone.
- Lane items (the all-roles workflow was stopped and resumed at about 16:0x with them):
  - srv-04 (shell-linux): the 8 safety fixes;
  - srv-05 (laravel-codemart): demo seeding opt-in, never in production, no hardcoded password;
  - srv-06 (laravel): the invite-code print and the McpV1 schema check;
  - srv-07 (laravel-qyapp): seedDefaults never overwrites.
- Server steps for T11: **not through 175**. Only `php artisan sys:init`, only after srv-05 has reached the server (or with `CODEMART_SEED_DEMO=false` in the server .env), and only on the user's explicit request. **Superseded by D17:** 175 is made runnable as an idempotent ensure script (srv-04). laravel-remote tests it on the server step by step and then in full, after the fixes are synced. The `.env` option was wrong, because Laravel reads only the config files.

### 10.5 laravel-remote-4: can the server receive CodeSync pushes? (read-only, about 17:2x) — NO

- A client daemon exists: `codesync.service` (`pyservice.sh codesync run` → `codesync_boot.py run`), with role `client`, not light. It is **wedged**:
  - its cgroup is at MemoryHigh 240M / Max 300M, with memory PSI about 60-67%;
  - loopback ping/status time out, and the accept queue is nearly full;
  - its footprint grew to about 790 MB in 20 h, which looks like a leak (pycore);
  - it has received nothing for 12+ hours.
- Transport:
  - it binds 0.0.0.0:59000 over plain HTTP on the public IP 43.163.112.77, and a security group evidently allows it. The doc's CLIENT URL is exactly that forbidden path;
  - there is no TLS proxy route;
  - Tailscale is stopped (NeedsLogin).
- Code: the server still runs pre-D1 CodeSync, with the committed `WORKSPACE_SHARED_SECRET` bearer and no `rpcLanBind`/K3. `CORE_NODE_CLIENT_KEY_1` is absent there.
  - Bootstrap problem: the new DEV code signs with K3, which the old server code cannot verify.
- Peer set v73 (runtime), dev = "debian" 10.58.197.54. The committed baseline is still v21.
- `codesync_boot` preflight can run `git merge/rebase --abort` on conflict markers, and a hard reset when `CODESYNC_AUTOHEAL_HARD=1`. That is not set.
- Plan (B9, proposal; each live step on the user's explicit OK):
  1. restart the daemon;
  2. **one-time bootstrap** of the new CodeSync code plus its K3/`client_key_auth` dependencies to the server over the existing SSH (scp/rsync over the SSH connection; the only non-CodeSync transfer, recorded here), together with `CORE_NODE_CLIENT_KEY_1` through the dd.sh secret flow;
  3. restart;
  4. from then on, DEV pushes only through CodeSync over an **SSH tunnel** (`ssh -L 59000:127.0.0.1:59000`), and the daemon binds loopback;
  5. close public 59000 (security group or firewall);
  6. pycore-runtime fixes the memory growth, and shell-linux revisits the unit limits.
- Correction (laravel-remote, about 17:3x):
  - The bootstrap writes `pycore/` files and the secret store on the server, which is outside laravel-remote's scope (`poly_apps/laravel_main/` only).
  - Executor: **pycore-runtime from DEV**, copying the pycore CodeSync files over SSH.
  - The secret: the shell dd.sh secret flow or the user.
  - laravel-remote only verifies and runs the Laravel-side checks.
  - The SSH copy is an **exception to D19** ("code only through CodeSync"). It needs the user's explicit approval, like each live step: restart, secret, loopback bind, closing 59000.
- Tasks:
  - pycore-runtime-cs1: the leak and the bootstrap/tunnel push procedure;
  - shell-windows-6 + shell-linux-6: a DEV tunnel-push helper, the unit limits, and closing 59000 in the installers;
  - laravel-remote-5: the server steps, with the user's direct consent;
  - user-4: approve the restart and the bootstrap, provide the client key, close 59000.

## 11. D12 record: shell split, desktop icons, Docker-recommended models

### 11.1 D12c: shell-linux and shell-windows (orchestrator, done about 15:2x)

- `.claude/agents/shell.md` was replaced by `shell-linux.md` and `shell-windows.md`. Each file names its counterpart, the other side's scope and the parity protocol.
- `config/claude_team_roles.json`: the `shell` entry became `shell-linux` and `shell-windows`, and the launchers and the TaskCreated hook read the new names. `.claude/agent-memory/shell/` was copied into both new roles and the old copy was left in place. `orchestrator.md`, `reviewer.md` (the parity check), `pycore.md`, `laravel.md` and `laravel-remote.md` now name the two roles.
- Write scope (one writer per path):

| Role | Paths |
|---|---|
| shell-linux | `dd.sh`; `scripts/linuxenvs/`, `scripts/shells/linux/`, `scripts/shells/common/`, `scripts/shells/docker_compose/`, `scripts/ai_shtools/`; every other `*.sh`/`*.bash` under `scripts/` |
| shell-windows | `dd.cmd`; `scripts/winenvs/`, `scripts/shells/win/`; every other `*.ps1`/`*.psm1`/`*.psd1`/`*.cmd`/`*.bat`/`*.reg`/`*.vbs` under `scripts/` |
| per task (orchestrator assigns) | cross-platform files under `scripts/` (Python, JS, JSON, env, templates), recorded here |

- Parity:
  - Each role keeps its own ledger, `.claude/agents_shared/shell_parity/{linux,windows}.md`. Rows are `id | feature | files | status | task`, with ids `SPL-###` or `SPW-###`, and status `aligned`, `pending-<other>` or `platform-only: <reason>`.
  - A functional change on one side sends an alignment message and raises an `[shell-<other>] align: ...` task.
  - The reviewer rejects a shell task that leaves a `pending-*` row without an alignment task.
- Linux targets: Debian 13 and Ubuntu 26.04 first-class, Kali compatible (AGENTS.md).
  - A Windows step that needs Linux or Docker delegates to shell-linux's Debian script through `wsl.exe`. Docker Engine runs inside Debian 13 WSL2; Docker Desktop is not used.
- Guide delta, applied after D14 (about 15:3x): guide §8 has the shell-linux and shell-windows rows, B6 per platform, and B11 shell parity.

### 11.2 Machine facts for D12 (about 15:1x, read-only)

- RAM 15.2 GB (6.3 GB free). Ryzen 9 7945HX, 16 cores / 32 threads. Disks: C: 52 GB free, D: 246 GB free.
- GPU: RTX 4060 Laptop (driver 32.0.16.1074), which did not respond in the §8.1 check, plus Radeon iGPU.
- WSL2: `Ubuntu-24.04` (default) and `Debian`, both stopped. `.wslconfig` caps the VM at `memory=6GB`, `swap=8GB`, `processors=4`, a user guard from 2026-06-12. D12b must not raise these caps.
- No `docker.exe` on Windows.

### 11.3 D12 dispatch (Workflow, about 15:2x)

- D12a desktop icons: shell-windows scans, upgrades and runs the organizer. Only shortcuts are moved, never deleted, and an undo manifest is kept. shell-linux then aligns whatever applies on Linux desktops.
- D12b models:
  1. A research pass, using the official project docs per model step, picks the steps whose official Windows path is Docker, or Linux only.
  2. shell-linux builds the Debian 13 WSL2 Docker prerequisites and the per-model runners; shell-windows builds the Windows delegation.
  3. The tests run strictly one at a time. Each container is stopped and the Debian distro terminated after its test, and free RAM and disk are checked before each run.
  4. The reviewer gives the verdict per task.
- D10 launchers: split into `shell-windows-1` and `shell-linux-1`, dispatched when the docs check (§10.2) finishes.

## 12. D13 record: claudeagents on the official configuration

### 12.1 Plan (about 15:3x)

1. Two docs checks, all agents on Opus 5.5:
   - §10.2, running: Windows team features and model settings;
   - D13 round 2, started about 15:3x: whether our catalog matches the official configuration (settings.json, agent frontmatter, `--agents`, plugins); every newer interaction and messaging feature; Windows Terminal panes and placement flags; tmux tiled layouts; DPI at 1K/2K/4K.
2. The orchestrator writes one design from the verified facts:
   - what moves from `config/claude_team_roles.json` to the official places (`.claude/settings.json` `env`/`model`/`teammateMode`, and agent frontmatter `model`/`effort`);
   - what stays in the catalog as launcher-only data (window layout, remote ssh, kickoff);
   - the per-role models;
   - the window layout per resolution class.
3. Implementation:
   - the orchestrator edits the config, agents and guide;
   - shell-windows edits `.claude/settings.json` and `.claude/hooks/` (a temporary writer for this task; it notifies shell-linux) and the Windows launchers;
   - shell-linux aligns the Linux launchers;
   - the reviewer gives the verdict, with parity.
4. Restart:
   - the roles are relaunched with the new launcher: every role gets a window, and the remote role gets the new model flags;
   - running workflows are left to finish;
   - the lead is relaunched by the user or the launcher at the end.

### 12.2 Design (about 16:0x; the full spec is `.claude/agents_shared/d13/DESIGN.md`)

Verified facts (both docs checks, all agents on Opus 5.5, every claim refutation-checked):
- The official role registry is `.claude/agents/*.md`. Roles are identified by the frontmatter `name`, and a project file never defines a team roster or auto-spawn.
  - `~/.claude/teams` is runtime state and is never pre-authored.
  - Our catalog is launcher-only data, which Claude Code ignores. Kickoff placeholders have to stay launcher-side, because frontmatter has no templating.
- A `--agent` session takes the definition's `model`. Aliases resolve to the newest model: `opus` = Opus 5.5, `sonnet` = Sonnet 5, `fable` = Fable 5.1.
  - Opus 5.5 defaults to **medium** effort.
  - `opusplan` runs execution on Sonnet, so it is rejected for long thinking.
  - `CLAUDE_CODE_SUBAGENT_MODEL` plus `_FORCE=1` would force one model on every agent and conflict with the per-role split, so it is not used.
- Under Opus 5.5 the Task tools exist only with `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`. That is why this lead has none and why the TaskCreated/TaskCompleted gates never fired.
  - `CLAUDE_CODE_TASK_LIST_ID` shares one task list across independent sessions.
- Split-pane teammates need tmux or iTerm2; Windows Terminal is not supported. On native Windows, a window per role is officially possible only as independent sessions with cross-session messaging (a Windows named pipe, v2.1.234+).
- Windows Terminal takes one call with `new-tab` and `split-pane --size <fraction>`, has a 32,767-character command-line limit, and a split without room is silently dropped.
  - `--pos` is in physical pixels. Windows PowerShell 5.1 is DPI-unaware, so the current `Screen.WorkingArea` math is right only at 100% scaling.
  - The recommended approach is a per-monitor PMv2 query, `-M`, fractions, and more tabs on small screens.
- tmux `tiled` gives 4x4 for 15 panes, so build an explicit `-l %` grid. The after-* hooks are session-scoped. Ubuntu 26.04 GNOME is Wayland-only and cannot position windows.
- Interaction features:
  - `crossSessionInbound` defaults to holding messages across permission modes, and other launchers here use bypass, so set it to `accept`;
  - push notifications take `agentPushNotifEnabled`/`inputNeededNotifEnabled`;
  - desktop notifications in WT/gnome-terminal need `preferredNotifChannel: terminal_bell`;
  - `remoteControlAtStartup` is honored only from user settings, so the launchers pass `--remote-control`;
  - WT stale text is fixed by `CLAUDE_CODE_ALT_SCREEN_FULL_REPAINT=1`.

Rulings (B9):
1. Models, done by the orchestrator in all 22 agent files:
   - `model: opus` for the thinking roles (orchestrator, reviewer, laravel, pycore, pycore-architect, laravel-remote);
   - `model: sonnet` for the 16 implementing roles;
   - `effort: xhigh` for all of them.
   - Aliases keep them on the newest release, per "不能是老旧模型". D13 refines D11 for the implementing roles.
   - The catalog's pinned `model` key was removed.
   - Built-in types that pin old models (claude-code-guide = Haiku 4.5) are handled by the D13 workflow's model-policy check. Until then, the orchestrator passes `model` on every built-in agent call.
2. Catalog schema 6:
   - `role_source`: roles come from `.claude/agents`, and the catalog rows are overrides;
   - `session_env` (all/lead/windows/remote);
   - `user_settings_merge`;
   - `layout` (min lead 100x30, min role 60x15, five tab groups, window/tmux names);
   - the new `team.kickoff`: every role is a session and there are no duplicate teammates;
   - `grid` is to be deleted after the implementation.
3. claudeagents and claudeteamup both start every enabled role as an independent session in its own pane, one named WT window with packed tabs on Windows and one tmux session on Linux. Only the lead kickoff differs.
4. Implementation:
   - shell-windows-1: the Windows launchers and install, plus `.claude/settings.json` and `.claude/hooks/team_gate.mjs` (roles from the agent frontmatter) as the temporary writer for D13;
   - shell-linux-1: Linux parity;
   - the reviewer's verdicts;
   - the full team launch after approval, while the current lead's workflows keep running.

