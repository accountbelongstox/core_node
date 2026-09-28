# Dual Boot Drive Layout, Wrapped Toolchains and Project Tree Links

Date: 2026-09-27
Status: open. P0 done; P1 onward pending fences from ca-orchestrator.
Owner: the disk-repair session (not the orchestrator). Cross-end contract keys go to ca-orchestrator (guide B4). Files are edited only after ca-orchestrator fences them.
Evidence: the workflow outputs of this session, i.e. the chkdsk research, the NTFS dirty diagnosis, the drive-layout map and the official-doc research.

## 1. User directives

- D1 (verbatim): "搜索官方文档，在dd.cmd中的windows管理菜单中加入子功能脚本，修复磁盘，并扫描可用磁盘C/D等，调用时运行chdsk /f /X，并提示重启后修复磁盘。" Follow-up: "/x是代表盘符。"
  - "/X" means the drive letter, so the command is `chkdsk <Drive>: /f`.
  - Done: `menu_itemshells/DiskRepairManager.ps1`, plus the "Repair Disk (chkdsk /f)" item.
- D2 (verbatim): "默认为Y/n ,同时添加功能，关键windows的快速启动，如果不能脚本关闭提示如何关闭，windows 10 / 11，确保所有盘在切换为liunx时挂载稳定，并搜索官方推荐文档。"
  - Done:
    - the shared `win_common/DiskReadinessCommon.ps1`;
    - `menu_itemshells/DualBootReadinessManager.ps1` ("Linux Dual Boot Readiness (Fast Startup)");
    - Step2 always runs `Disable-FastStartup`, and its BitLocker handling is limited to fixed internal volumes;
    - restart prompts default to Y/n, and the restart sets a one-time boot into Windows through UEFI BootNext.
- D3 (verbatim): "为什么在liunx挂载时硬盘还是dirty模式，找一下原因，windows还有那些没有设置。"
  - Section 2 has the root cause.
- D3b (verbatim): "liunx端的只读，能写入代码吗。问题是"
  - Reading: Linux must keep D: read-write, because the code lives on D:. A dirty D: must not force a read-only mount.
- D4 (verbatim): "修改liunx端的幂等脚本，并在sh的bun安装node 等中，将所有幂等安装到ext4目录，也就是/opt目录，在项目中不要挂载上面说的大文件，先将这个写到任务目标，可能 一次性完不成，之后开始修改，windows也要幂等这么处理。windows默认设置为3个盘，在基本类库中要写明，C盘和数据盘D盘和E盘放程序等编译文件的，E盘默认在liunx不挂载，目前先写入构架，之后再移动文件让出空间，D盘只放数据。"
  - Linux installers put every toolchain and every heavy hard-link or symlink tree on ext4 under /opt, idempotently. The heavy trees are node_modules, the Bun cache, the pnpm store, venvs and similar.
  - None of those trees may physically live on the NTFS project tree.
  - Windows does the same, idempotently, using a three-drive layout declared in the base library:
    - C: system;
    - D: data only;
    - E: programs, toolchains and build or compiled output.
  - Linux does not mount E: by default.
  - Phase one writes the architecture. Moving existing files to free space comes later.
- D5 (verbatim): "增加要求，在windows / liunx端的node / pnpm / npm / bun / php compser的安装中，加入幂等确保为wrap的类型，并联动常量中心，拒绝多处重复定义，之后，当使用上面的安装时，WINDOWS会查找E盘，没有提示、再使用原装，liunx会找到ext4盘，先将当前目录中的必要目录比如node modules / 等目录硬连接到windows E合中合适的目录 项目命名空间， liunx也是一样，同时搜索官方文档，同时切换系统时上上面的安装只需要切换硬连接即可，同时在所有需要的项目中的start脚本中引用公共类训中的幂等切换，安装，以上要求记入docs fix和任务overflow，然后安装开发。"
  - Readings:
    - "wrap type": node, npm, pnpm, bun and composer are reached only through thin static wrappers (shims) on PATH. Each wrapper reads ONE resolved env file, which the constants center generates. No path is defined twice.
    - "硬连接": directories cannot be hard-linked (Microsoft docs), so the Windows primitive is a directory junction (`mklink /J`).
    - "公共类训" means the shared common library. "任务overflow" means a task Workflow.
  - Windows looks for E: first. If E: is absent, it warns and falls back to the original location.
  - Linux finds the ext4 root.
  - Project heavy directories (node_modules, vendor, .venv) are linked to a per-project namespace directory on the program drive.
  - Switching OS must only switch links, or better, need no switch at all (section 3.5).
  - Every project start script calls the shared idempotent ensure (switch plus install).

- D6 (verbatim): "扫描D盘，那些目录可以清理，分配了多少给liunx端。"
  - Section 7 has the scan result.
  - Linux has about 209 GB on disk 0 (ext4 198.2 GB + swap 10.8 GB).
  - D: fills disk 1 entirely, and neither disk has unallocated space.
- D7 (verbatim): "目前直接提示需要放在E盘，底层重构，如果没有E盘时提示，之后将分配E盘。"
  - The base layer targets E: for programs, toolchains and build files.
  - While E: is absent, callers print an explicit notice that these files belong on E: and continue with the original location.
  - E: will be allocated later, by shrinking D:.
- D8 (verbatim): "根据上面的扫描，分配新的任务，有那些liunx脚本在D盘创建了一些旧的目录，目前liunx的常要求编译等目录应该是在opt下或其他ext4磁盘下。而不是挂载的ntfs3，所以需要全面修正liunx端。"
  - New phase P1b: a full audit and fix of every Linux script that creates compile, build, toolchain, cache, temp, venv or node_modules directories on the NTFS mount.
  - All of those move to ext4 (`/opt` or another ext4 disk).
  - Only shared data stays on D:.

- D24 (team directive, relayed by ca-orchestrator; spec `development-guides/LINUX_SHELL_RULES.md`):
  - On Linux an NTFS mount stores source code only. Tools, caches, builds, temp, node_modules/vendor/.venv, runtime data, logs and model weights all go to ext4.
  - Each Linux constant is defined exactly once.
  - Scripts never move or delete existing NTFS files.
  - Contract: `paths.linux_ntfs_policy = code_only`. `linux_data_dir_candidates` is now `/www/core_node` (only when `/www` is not NTFS), then `/var/_core_node`, then `~/core_node`.
  - This supersedes "keep model data on D:" in §3.2 for Linux; Windows is unchanged.

- D26 (team directive; revises D24): data that both OSes share may stay on the NTFS disk. D: maps to `/www/www`, so shared model weights and shared data stay on D:.
  - Contract: `paths.linux_ntfs_policy = code_and_shared_data`. `linux_data_dir_candidates` is restored, with `/www/www/core_node` first on the dual-boot desktop.
  - Still never on NTFS on Linux:
    - install paths
    - package caches and stores
    - build output and compile bases
    - temp
    - node_modules/vendor/.venv
    - Linux-only service state (for example PostgreSQL clusters)
    - Linux-only desktop caches
    - recycle bins
  - Resulting P1 amendment:
    - `XDG_CACHE_HOME` moves to ext4, because it carries Linux-only desktop and tool caches.
    - Shared model caches get explicit variables that point at the shared NTFS cache: `HF_HOME`, `TORCH_HOME`, and the Whisper model dir that pycore reads (check which variable before moving `XDG_CACHE_HOME`).
- D27 (team directive, relayed by ca-orchestrator): remove `core_node_trees` everywhere.
  - Caches move under `<tool_root>/cache`.
  - Linux per-project directories go under `<tool_root>/trees` and are bind-mounted over plain in-repo directories.
  - Windows gets no junctions (`trees_root.windows = null`).
- Q&A (user): "node module是否可以双系统共享，如果可以则不用连接，不可以则需要连接。"
  - Answer: no. Each OS needs its own `node_modules`, `vendor` and `.venv`, because of native addons (esbuild/rollup/sharp/swc platform packages), `.bin` shims (`.cmd` vs symlinks), and the pnpm store and link layout.
  - Sharing them also caused the NTFS corruption.
- D28 (verbatim): "联接到 E: 现在代码就要直接重构，在没有分好E秀前可以提示。"
  - This revises D27 for Windows. The code now junctions `node_modules`, `vendor` and `.venv` to the E: tree root per project namespace.
  - While E: is absent, it warns and keeps the normal in-repo directories.
  - On Linux the repo entry is then a Windows junction, so a per-project bind is impossible (mounting over a dangling junction fails). The Linux side goes back to one bind of `<tool_root>/trees` at the translated path `/www/core_node_trees`.
  - That needs the contract change and the empty mount-point exception from ca-orchestrator (proposed 2026-09-27).
- D28 applied by ca-orchestrator, then D30 (team directive, spec `development-guides/DIRECTORY_NAMESPACE_RULES.md`): one namespace directory per drive or filesystem.
  - Namespaces: `E:\core_node_compiler`, `D:\www`, Linux ext4 `/opt/core_node`, and Linux NTFS `/www/www` (shared data) plus `/www/core_node_compiler` (the parent of the single empty trees mount point).
  - Contract keys: `tool_root`, `cache_root`, `trees_root`, `trees_mount_linux` and `toolchain_env_file`. Some keys now hold per-OS objects.
  - Legacy top-level directories stay in place and keep being read until the user approves a migration.
  - This supersedes the root paths named in §3.
  - The consolidated workflow `dual-boot-drive-layout-consolidated-d24-d30` implements D24–D30 in the fenced files.
- D25 (team directive, `LINUX_SHELL_RULES.md` §2): no recycle bin on an NTFS mount on Linux.
  - Scripts and programs never trash there: no `gio trash`, `trash-put`, `kioclient` trash, `send2trash`, and no hand-made `.Trash*`.
  - `mount_common.sh` blocks per-volume trash idempotently. When no trash exists at the mount root, it places an empty, root-owned, non-writable regular file `.Trash-<uid>` there. When a trash directory already exists, it reports it and leaves it alone.
  - Emptying the existing `D:\.Trash-1000` (about 73 GB) needs explicit user approval.
- Tree-bind condition (ca-orchestrator, `LINUX_SHELL_RULES.md` §2): the empty mount point `/www/core_node_trees` is allowed. Scripts write under it only after `mountpoint -q` confirms the bind. While it is unmounted it stays empty, and nothing falls back to writing into it.

## 2. Root cause of "D: dirty on Linux" (D3)

Every piece of evidence comes from local event logs or the chkdsk log, except where marked.

1. Windows never dirtied D:.
   - All boots from 9/24 to 9/27 were cold boots (Kernel-Boot 27 type 0x0), each after a clean restart.
   - Fast Startup and hibernation were not effective.
2. D: went from healthy to "Online Scan Needed" (Ntfs 98) only across Linux sessions, not across Windows sessions.
3. The damage that chkdsk repaired could only have been written outside Windows. The chkdsk log (`D:\System Volume Information\Chkdsk\Chkdsk20260925113259.log`) shows:
   - a `:memory:.ses` filename, which is Win32-illegal;
   - about 90 stale `$Reparse` index entries and wrong reparse tags, concentrated in Bun/pnpm `node_modules` and in `D:\www\cache\.bun` hard-link trees.
4. The likely writer is found:
   - `shared_cache_env.sh:137-138` exports `XDG_CACHE_HOME=/www/www/cache`, which is the NTFS path of `D:\www\cache`.
   - `BUN_INSTALL` exists only in `/etc/environment`, and services never read that file.
   - So Linux Bun hard-links its cache (`D:\www\cache\.bun`) into in-repo node_modules on the same NTFS volume through ntfs3.
   - pnpm metadata, corepack, uv, Playwright and other caches follow the same path.
5. Windows does not repair a data volume that is in "Online Scan Needed" at boot, which is the Win8+ NTFS health model.
   - The online scan never ran in the short Windows sessions.
   - The Automatic Maintenance trigger tasks under `\Microsoft\Windows\TaskScheduler\` are missing.
6. A manual `chkdsk D: /f` cannot lock D: because `pagefile.sys` is on D:, so it can only be scheduled.
   - The scheduled check runs only if Windows boots next.
   - The firmware boots Debian first; `{bootmgr}` is sixth in `{fwbootmgr}`.
7. Linux `ntfs3` refuses a dirty volume, so `mount_common.sh` falls back to `ntfs-3g` read-write and persists fstab type `ntfs`. Linux keeps writing to an unrepaired volume, and the cycle repeats.

Windows gaps that D2 already fixed: Fast Startup flag, one-time boot into Windows before the repair restart, BitLocker limited to fixed internal volumes, and health-state ("Scan Needed") detection.

Still open, reported only:
- pagefile on D: (move to C:, optional);
- power button set to Sleep (change to Shut down, optional);
- missing Automatic Maintenance tasks (an in-place repair install restores them).

## 3. Target architecture

### 3.1 Windows drive roles (base library)

- `CN_WIN_SYSTEM_DRIVE` = `$env:SystemDrive` (C:).
- `CN_WIN_DATA_DRIVE` = D: holds data only.
- `CN_WIN_PROGRAM_DRIVE` = E: holds toolchains, heavy trees, caches and build output.
- E: qualifies only if all three checks pass:
  - `[IO.DriveInfo]` reports it as ready, Fixed, and NTFS or ReFS;
  - its partition GUID matches the recorded `CN_WIN_PROGRAM_PARTUUID`;
  - the marker `E:\<R>\.cn_volume` exists.
- First adoption records the GUID and the marker.
- When E: is absent or does not qualify, warn and use the fallback program root. Today that is D:, which keeps the current locations: tools in `D:\.dev_<sys>`, trees in `D:\<R>`.
- A later E: arrival retargets the links to fresh trees. A tree is never moved between stores, because `.modules.yaml` records storeDir.
- The single owner is the Windows constants center.
  - `SharedCacheEnv.ps1` already declares `WINDOWS_DATA_DRIVE_ROOT` and is loaded first by `GlobalVars.ps1`. The drive-role keys go there or into `GlobalVars.ps1`; ca-orchestrator's shell-windows lane decides which (a D7 data-dir task may touch `GlobalVars.ps1`).
  - Duplicates to merge afterwards:
    - `WindowsPathFunction.ps1:59`
    - `PostgresqlManager.ps1:30,36-40`
    - `IsolatedPythonInstallCommon.ps1:16`
    - `DevInstaller.ps1:18`
    - `InitializationManager.ps1:23,38,203`
    - `FrankenPhpManager.ps1:13`
    - `SecretManager.ps1:80`
    - `Step7:10`
    - `Step4:14`

### 3.2 Linux roots

- Tools stay at `COMPILE_DIR=/opt/_<os>_<ver>`.
  - `get_dev_compile_base` (`gvar_storage_common.sh:303-325`) must hard-pin ext4 `/opt`. Today it falls back to `/www` (NTFS) when `/` has 50 GB free or less; an empty `D:\_debian_13` shows this happened once.
  - The pycore mirror `pyfoundations/system_paths.py:204-231` and the Laravel mirror `PathMapper.php:690-708` must change in lockstep (pycore and laravel lanes).
- Tree root: `CN_LINUX_TREE_SRC=/opt/<R>` (ext4, the user's choice) is bind-mounted at `CN_LINUX_TREE_MNT=/www/<R>`, so Linux sees it through the path `D:\<R>` (an empty placeholder directory on D:).
- Caches that hard-link (Bun, the pnpm store, uv) live under the tree mount (`/www/<R>/cache/...`). link(2) returns EXDEV across mounts, so the store and node_modules must sit on the same mount.
- `shared_cache_env.sh` stops exporting an NTFS `XDG_CACHE_HOME` for toolchain caches, and exports these explicitly from the Linux constants center, including for service environments:
  - `BUN_INSTALL_CACHE_DIR`
  - `npm_config_cache`
  - pnpm `store_dir` / `cache_dir` / `state_dir`
  - `UV_CACHE_DIR`
  - `COREPACK_HOME`
  - `PLAYWRIGHT_BROWSERS_PATH`
  - Shared model data (HF, torch, and Whisper through an explicit `download_root`) stays on D:.
- E: is not mounted on Linux:
  - no fstab line;
  - a udev rule `ENV{ID_PART_ENTRY_UUID}=="<guid>", ENV{UDISKS_IGNORE}="1", ENV{UDISKS_AUTO}="0"`;
  - every disk selector skips that PARTUUID: `mount_common.sh detect_ntfs_disks`, `get_largest_ntfs_with_size`, `get_base_data_directory` P3/P4, `get_dev_compile_base`.

### 3.3 Constants center and contract keys (proposal to ca-orchestrator, `config/service_contract.json#paths`)

| Key | Windows | Linux |
|---|---|---|
| `tree_subdir` (`<R>`) | `core_node_trees` | `core_node_trees` |
| `program_drive_primary` / `_fallback` | `E:` / `D:` | not applicable |
| `program_partuuid` | recorded on first E: adoption | used for the E: exclusion |
| `tree_root` | `<program drive>\core_node_trees` | `/www/core_node_trees` (bind of `/opt/core_node_trees`) |
| `tree_cache_root` | `<tree_root>\cache\{pnpm-store,bun,npm,composer,uv}` | `<tree_root>/cache/{...}` |
| `tool_root` | `<program drive>\.dev_<sys>` | `/opt/_<os>_<ver>` |
| `toolchain_env_file` | `<tool_root>\bin\toolchain.env` | `/etc/opt/core_node/toolchain.env` |
| `link_dirs` | `node_modules`, `vendor`, `.venv` | same |
| project namespace | repo-relative path, `/` to `__`, lowercase | same |

Rules:
- The shell centers read these keys: `SharedCacheEnv.ps1`/`GlobalVars.ps1` on Windows, and `gvar_common.sh`/`shared_cache_env.sh`/`runtime_environment.sh` on Linux.
- Only the centers write `toolchain.env`, and only when its content differs.

### 3.4 Wrap-type toolchains (node, npm, pnpm, bun, composer; uv optional)

- Each toolchain has one static wrapper per OS. It reads `toolchain.env`; the file format is `KEY=VALUE`, UTF-8 without BOM, `#` comments, never PATH.
  - Windows: a `.cmd` only, in a shim directory placed first in PATH. Run lines:
    - `"%CN_NODE_EXE%" %*`
    - `"%CN_NODE_EXE%" "%CN_NPM_CLI_JS%" %*`
    - `"%CN_NODE_EXE%" "%CN_PNPM_CJS%" %*`
    - `"%CN_BUN_EXE%" %*`
    - `"%CN_PHP_EXE%" "%CN_COMPOSER_PHAR%" %*`
    - Each ends with `exit /b %ERRORLEVEL%`.
    - Delayed expansion stays off.
    - An extensionless sh twin serves Git Bash.
  - Linux: `/usr/local/bin/<tool>`, a POSIX sh script that parses the env file (never sources it) and then runs `exec`.
- Install-family verbs (`install|i|ci|add|update|remove|rebuild|require|sync`) are gated. The wrapper refuses to run unless `/www/<R>` is mounted and is ext4, so no heavy tree is ever written to NTFS from Linux.
- Installers ensure the wrapper type idempotently: they repair only what is missing or different (a binary, the env file, or a shim). They work on Debian 13 and Ubuntu 26.04.
- Duplicates to remove:
  - Linux: the two Bun installers (`17_install_node_toolchain_26.sh` vs `185_install_pi_harness.sh`); `bun upgrade` on every pass.
  - Composer target paths are duplicated in `php_common_vars.sh`, `composer_install_common.sh`, `laravel_main_runtime_common.sh` and `composer_vendor_common.sh`.
  - Windows: the standalone pnpm on C:; the npm-installed bun shim.
  - pnpm version drift: 10.32.0 is pinned, but 11.8.0 is installed.

### 3.5 Project tree links (the shared ensure, called by every start script)

Principle, from official docs plus the corruption evidence: Windows owns every link; Linux never creates, swaps or deletes a link on NTFS.

- Windows `Ensure-ProjectTreeLink`:
  - Uses `cmd /d /c mklink /J <repo>\<rel>\node_modules <tree_root>\<ns>\<rel>\node_modules`. `New-Item -ItemType Junction` is not used, because it writes an empty PrintName that ntfs3 cannot read.
  - The target is created with a marker file inside it.
  - States:
    - missing: create the link;
    - correct junction: no-op;
    - foreign, dangling or Linux link: delete the link only (`[IO.Directory]::Delete` / `[IO.File]::Delete`);
    - empty real directory: remove it;
    - real directory with content: rename it to `D:\<R>\.quarantine\...`. It is never auto-deleted.
  - It verifies the tag, the SubstituteName, the PrintName and the marker.
  - `Remove-Item -Recurse` and `rd /s` are never used near links.
- Linux: ntfs3 (6.2+) translates the Windows junction to a relative link that resolves under `/www/<R>`, which is the ext4 bind. The same repo path therefore reaches the Linux tree with no link change: switching OS needs no switch.
  - `Assert-ProjectTreeLink` only verifies the result with `findmnt` (ext4, same mount as the store).
  - If a check fails, it refuses to install.
  - A Linux-first project (a plain directory) gets a runtime `mount --bind`, which writes no reparse data.
- Bind mode applies until the acceptance test passes. It covers:
  - pnpm/bun workspace projects: `apps/mcp-chrome`, `poly_apps/pycore_laravel_wordnew_ui`;
  - npm-lockfile projects: the repo root and `pycore_laravel_wordnew_ui`. npm deletes a linked node_modules (reproduced with npm 11.6.2).
  - In bind mode Windows keeps a real directory, which is an accepted exception to "D: data only". Linux binds ext4 over it.
- Composer `vendor`: junction on Windows, same Linux gate. `php artisan optimize:clear` runs after an OS switch.
- uv: the start script exports `UV_PROJECT_ENVIRONMENT=<tree_root>/<ns>/.venv`. The global value in `25_install_uv.sh` is removed.
- `.gitignore` gains `**/node_modules`, `**/vendor` and `**/.venv` without a trailing slash.
- Start scripts that must call the ensure, each owned by its role lane:
  - `apps/mcp-chrome/scripts/start.{ps1,sh}`
  - `poly_apps/laravel_main/scripts/start.{ps1,sh}`
  - `poly_apps/pycore_laravel_wordnew_ui/scripts/start.{ps1,sh}` and `start_build.sh`
  - `scripts/linuxenvs/{codexyolo,kimiyolo,agyyolo}.sh` (bun install in mcp-chrome)
  - `175_laravel_main_start.sh`

### 3.6 Linux NTFS mount hardening (`mount_common.sh`)

- Add `windows_names` to every NTFS mount.
- Pin the fallback fstab type to `ntfs-3g`, and never persist it as the permanent type.
- On a dirty volume, stay read-write (D3b), and also:
  - print a warning;
  - run `grub-reboot` into the Windows entry once, so the pending Windows repair runs at the next restart;
  - never use `force`, and never run `ntfsfix`.
- Add `RequiresMountsFor=/www` to the services that write /www, so they stop before unmount.
- Set fsck pass 0 for NTFS.
- Make the disk setup a per-run convergence. Today it is gated by `DISK_SETUP_COMPLETED`.

## 4. Deviations from the literal directives

- Directories cannot be hard-linked; Windows uses junctions.
- Linux does not switch links on NTFS. It reaches its own ext4 tree through the Windows junction plus one bind, so switching OS needs no link change at all. That meets D5's goal ("switching OS only switches links") with zero Linux reparse writes.
- Workspace and npm projects use bind mode until the Linux acceptance test (P6) passes or they migrate to pnpm with `injectWorkspacePackages`. In that mode Windows node_modules stays on D:.

## 5. Phases (task Workflow `dual-boot-drive-layout`)

| Phase | Scope | Lanes / owners | Gate |
|---|---|---|---|
| P0 | This record; contract-key proposal to ca-orchestrator | this session | done |
| P1 | Linux safety: hard-pin `/opt`; toolchain caches off NTFS (`BUN_INSTALL_CACHE_DIR`, pnpm, npm, uv, corepack) and out of the NTFS `XDG_CACHE_HOME`; `mount_common.sh` hardening (3.6); E: exclusion hooks | shell-linux files, pycore/laravel mirrors | fences; review |
| P1b | Full Linux audit and fix (D8): every script that writes compile, build, toolchain, cache, temp, venv or node_modules directories onto `/www` (NTFS) moves to ext4 through central constants. This covers desktop caches under `XDG_CACHE_HOME`, `.Trash-<uid>` creation on NTFS, the legacy `/www/core_node` data directory, and the agent runtimes. Workflow `linux-ntfs-writers-audit` produces file-disjoint fix groups per lane. | shell-linux lane, plus pycore/laravel mirrors through ca-orchestrator | fences per group; P1 done |
| P2 | Architecture constants: Windows 3-drive keys with E: detection and fallback; Linux tree/tool roots; contract keys | shell-windows, shell-linux, orchestrator (contract) | fences; review |
| P3 | Wrap-type installers and shims for node, npm, pnpm, bun and composer on both OSes; remove duplicate definitions | shell-windows, shell-linux | P2 |
| P4 | Shared link ensure (Windows) / assert (Linux) plus start-script integration; `.gitignore` | shell lanes plus the owners of each start script | P2, P3; Linux rollout after P6 |
| P5 | Migration of existing trees to E: or `/opt`: quarantine only; deletion only with approval, after `chkdsk D: /scan` | shell lanes | E: exists; user approval |
| P6 | Linux acceptance test on real hardware: ntfs3 junction translation, pnpm/bun on a linked node_modules, the `/www/<R>` bind, E: exclusion (`lsblk -o NAME,PARTUUID`) | user on Linux, or a Linux remote role | before P4 on Linux |

For each phase, the Workflow does the following:
1. One implement agent per lane (`agentType` shell-windows or shell-linux), running only after ca-orchestrator fences the files.
2. A three-lens adversarial review: PS 5.1/bash runtime with strict mode, semantics against official docs, and repo rules (constants center, no duplicates, idempotency, Debian 13 / Ubuntu 26.04).
3. A fix round.
4. Verification with parse and read-only probes. Destructive or system-changing actions stay behind explicit prompts.

## 7. D: scan (2026-09-27, robocopy /L, read-only)

D: is 1907.7 GB with 245 GB free.

| Class | Items |
|---|---|
| A. Cleanable: regenerable, or already Linux trash | `D:\.Trash-1000` 73 GB, which holds a 46 GB `pagefile.sys` copy, `_build_awy` 13 GB, old core_node backups, node_modules, and the Linux compile-dir fallbacks `_ubuntu_24` and `_kali_2026`; `D:\.Trash-0`; `D:\www\cache\pip` 13 GB; `puppeteer` 2.5 GB; `.bun` 1.1 GB, `bun`, `pnpm`, `node`, `uv`, `xdg`, and the Linux desktop caches (`at-spi`, `dconf`, `gvfsd`, `mesa*`, `nvidia`, `numba`, `matplotlib`, `radv`); the empty `D:\_debian_13`, `D:\.dev_debian13` and `D:\.dev_linux`; `D:\.tmp\pip-*`, `tmp*` and `node-gyp`; `found.000`; a duplicate 22.8 GB mkv in `D:\.tmp\New` (verify the hash first) |
| B. User data (the user decides) | `D:\.tmp\BaiduNetdiskDownload` 828 GB; `D:\programing\Ace5` 108 GB; `D:\.tmp\Downloads` 71 GB (ISOs); `D:\applications\Games` 60 GB; `RegionalHybridFlasher*` 18.6 GB |
| C. Programs and build output, moving to E: | `D:\.dev_win10` 171 GB (Qt 85 GB, Pythons, Node, venvs, WSL disk 13 GB); `D:\applications` 92 GB; `D:\.pnpm-store` 11 GB; `pagefile.sys` 44 GB (to C: or E:) |
| D. Data, staying on D: | `www\cache\pycore` 62 GB, `huggingface` 33 GB, `stt`, `whisper`, `tts`, `www\wwwroot`, `www\core_node`, `programing\core_node`, `programing\Users` 43 GB |

- E: sizing: class C is about 320 GB, so E: should be about 350–400 GB with headroom.
- Shrinking D: that far needs at least that much free space on D: first, which means cleaning class A and part of class B.
- Nothing is deleted without explicit user approval. Before deleting the Linux-written trees, run a read-only `chkdsk D: /scan` first.

## 8. P1b audit result (workflow `linux-ntfs-writers-audit`)

The full plan is in `.claude/agents_shared/reports/p1b_linux_ntfs_audit.md`: 165 items, the writer of every D: artifact, 16 fix groups, the keep-on-NTFS list, the cleanup-after-fix list and the gaps.

| Group | Owner lane | Scope |
|---|---|---|
| G1 contract | ca-orchestrator | move `frankenphp_root_posix` to ext4; add `pip` to `cache_subdirs`; decide the Linux-only state root (`legacy_linux_data_dir` `/var/_core_node`) |
| G2 P1-fixup | this session (consolidated D24–D30 round) | the P1 reads of removed contract keys made `CN_TREE_CACHE_ROOT` empty; `PIP_CACHE_DIR`/`XDG_CACHE_HOME` to ext4; `PYTHONPYCACHEPREFIX` |
| G3 local root | shell-linux | `runtime_environment.sh` `CORE_NODE_LOCAL_DIR` (ext4, fail closed on NTFS); fix the stale `/www/core_node` data dir that created `D:\core_node` |
| G4–G10 | shell-linux | literal `/www/core_node` fallbacks; temp dirs to `GLOBAL_TEMP_DIR`; launchers/unified-manager state to the local root; service logs to `/var/log` + `RequiresMountsFor=/www`; installer caches (uv.toml, pnpm cache-dir, `GEM_SPEC_CACHE`, `check_global_packages.js`); toolchains (Android SDK, DeepSeek) to the compile dir; `_build_dir` |
| G11 | shell-linux | Linux `project_tree_common.sh` (counterpart of `ProjectTreeCommon.ps1`) wired into composer/start helpers; rollout after P6 |
| G12 | mcp-chrome / dingdoudou owners | tree ensure before `bun`/`pnpm install` |
| G13 | wordnew | start scripts: tree ensure, logs, Caddyfile, gradle cache |
| G14 | pycore-laravel | deploy scripts tree ensure; Linux compiled caches off NTFS; PathMapper mirrors; `_build_dir` factory |
| G15 | pycore | `system_paths.py` compile base / XDG / pip mirrors; whisper `download_root`; `scrcpy` per-OS dir |
| G16 | ncore | `globaldir.js` created `D:\.dev_debian13`, `D:\.dev_linux` and `/www/static_*`; XDG mirror; `config_loader.js` cwd cache |

Artifact attribution:
- `D:\.dev_debian13` and `D:\.dev_linux` come from ncore `globaldir.js`.
- `D:\core_node` comes from the stale `CORE_NODE_DATA_DIR` in `runtime_environment.sh`.
- `D:\www\cache\*` desktop and tool caches come from `XDG_CACHE_HOME=/www/www/cache`.
- `D:\.Trash-*` comes from GUI deletes (fixed by the trash blocker).
- `D:\.cache\.check` comes from `check_global_packages.js`.
- `D:\programing\_build_dir` comes from `smart_permissions.sh`, on every `dd.sh` start.
- `D:\_debian_13` was created on Windows at 16:11:57; its creator is unknown.

User decision (2026-09-27): before P6, Linux uses the per-project runtime bind immediately.
- At start, Linux binds ext4 `<trees_root.linux>/<ns>/<dir>` over the plain in-repo `node_modules`/`vendor`/`.venv`, guarded by `mountpoint -q`. This needs sudo.
- It applies while Windows has no E: and the repo entries are plain directories, so it does not depend on the P6 junction-translation proof.
- G11 is therefore not gated on P6 for plain directories. Only the Windows-junction path (E: present) waits for P6.

Remaining decisions for the user:
- Gitea data, Laravel `storage/logs` and `storage/framework` shared by both OSes, pycore app logs dir, the Laravel tmp dir, and the fishspeech editable install.
- Cleanup approvals after the fixes (listed in the plan).

To verify on the Linux host: `readlink -f /var/_core_node; findmnt -T /var/_core_node`. Linux writes reached `D:\www\core_node\Users\Kimi2`, which suggests `/var/_core_node` links into `/www`.

## 6. Status log

- 2026-09-27: P0 recorded. D1 to D3 were delivered earlier in this session.
- 2026-09-27: ca-orchestrator added the §3.3 keys to `config/service_contract.json` at `paths.drive_layout`; they are read from there, and the literals are never redeclared.
  - P1 fenced: `gvar_storage_common.sh`, `shared_cache_env.sh`, `gvar_common.sh`, `mount_common.sh`, and `pyservice_entry.sh` (cache variables only).
  - P2 fenced: `SharedCacheEnv.ps1`, which owns the drive-role keys; `GlobalVars.ps1` only reads them.
  - Mirrors routed: `system_paths.py` goes to pycore-lead, `PathMapper.php` to pycore-laravel.
  - Workflow `dual-boot-drive-layout-p1-p2` started.
  - P1 keeps the pnpm store in place (it is already on ext4). P2 exports no new cache variables. Both of those changes come with the P3 `toolchain.env` wrappers.
- 2026-09-27: the consolidated D24–D30 round is done. The user asked to skip the remaining review, so the workflow was stopped and the result verified directly.
  - Linux (`bash -n` passes on every file):
    - contract namespace, tool, cache and trees keys
    - legacy `/opt/$SYS_DIR` kept sticky
    - tool caches under `/opt/core_node/cache`
    - trees bind at `/www/core_node_compiler/trees`
    - NTFS trash blocker plus `x-gvfs-notrash`
    - `core-node-ntfs-converge.service` boot convergence
  - Windows (loads and the junction state machine is re-tested):
    - `SharedCacheEnv.ps1` fallback roots `D:\www\.dev_<sys>` and `D:\www\cache`
    - no trees on the D: fallback
    - an explicit E: warning
    - `ProjectTreeCommon.ps1`
  - The contract freeze is lifted.
  - Open follow-ups, routed through ca-orchestrator:
    - G15: pass the whisper `download_root`, then move `XDG_CACHE_HOME` to ext4.
    - G1: add `pip` to `cache_subdirs`, then point `PIP_CACHE_DIR` at ext4.
    - Wire `3_setting_base.sh`.
    - Add `ProjectTreeCommon.ps1` to the `WinScriptsInstaller` list.
    - `25_install_uv.sh`.
    - `project_tree_common.sh` must create a missing in-repo directory.
    - P4 start-script calls (listed in the done message).
- Open questions for the user:
  - Accept the bind-mode exception for workspace and npm projects?
  - Name of `<R>` (`core_node_trees`)?
