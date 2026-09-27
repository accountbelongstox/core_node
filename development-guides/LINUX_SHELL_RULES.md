# Linux shell rules (supplement to `DD_SHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md`)

These rules apply to every Linux script and every Linux path computation, in scripts, pycore, Laravel and ncore. Targets: Debian 13 and Ubuntu 26.04 first, Kali compatible. They add to the main shell guide and never replace it.

## 1. One definition per constant (user D24, 2026-09-27)
- Every Linux constant (paths, directory names, versions, ports, file modes, service names) is defined **once**, in the Linux constants library. The library is the gvar/runtime-environment common files under `scripts/shells/linux/common/`, fed from `config/*_contract.json` when the value is cross-end.
- Other scripts source the library and read the constant; they never re-declare it with a literal.
- A cross-end value (data-dir bases, drive layout, ports) lives in the contract (e.g. `config/service_contract.json#paths`), and the library reads it from there.
- A reviewer rejects a change that adds a second definition of an existing constant, including a local default that repeats the library value.

## 2. NTFS mounts hold code and shared data only (user D24 + D26, 2026-09-27)
- An NTFS mount on Linux (FSTYPE in `service_contract.json#paths.ntfs_fs_types`), for example `/www` when it is the dual-boot D: volume, stores only:
  - **source code**;
  - **data both OSes share** (user D26): the shared data dir `/www/www/core_node` = `D:\www\core_node` (the first entry of `linux_data_dir_candidates`), and any file both OSes must read. The D: ↔ `/www/www` mapping is intended.
- Never place any of these on an NTFS mount:
  - programming-language or tool install paths (Python/uv/venvs, Node/npm/pnpm/bun, PHP/Composer, Java, Go, Rust, .NET, Flutter/Dart, Android SDK, CUDA, model engines);
  - package caches and stores, build output, compile bases, temp directories, `node_modules`, `vendor`, `.venv`;
  - Linux-only runtime state that the other OS never reads: database clusters (PostgreSQL data dirs), Linux service state and sockets, Linux-only logs.
- Use ext4 instead:
  - tools: `/opt/...` per `service_contract.json#paths.drive_layout` (`tool_root`, `cache_root`, `trees_root`);
  - Linux-only state: ext4 paths such as `/var/_core_node` or the service's own ext4 dir. The shared data dir follows `linux_data_dir_candidates` (NTFS `/www/www/core_node` first on the dual-boot desktop).
- Detect NTFS with the contract rule (`linux_www_ntfs_root_rule` / `ntfs_fs_types`) through the library helper. Do not add a second detection.
- Allowed exception (user D28, which restores it after D27): the **single empty directory** `/www/core_node_compiler/trees` (`service_contract.json#paths.drive_layout.trees_mount_linux`, under the D30 namespace) on the NTFS share, used only as the mount point of the ext4 `<tool_root>/trees` bind. Windows junctions to the E: program drive then resolve to ext4 on Linux. A script writes under it only after `mountpoint -q` confirms the bind is active; while unmounted it stays empty, with no fallback writes. Linux creates no reparse point and writes nothing else on NTFS. See `trees_rule`.
- No recycle bin on an NTFS mount (user D25, 2026-09-27):
  - Scripts and programs never send files to a trash on an NTFS mount: no `gio trash`, `trash-put`, `kioclient move ... trash:/`, send2trash or a hand-made `.Trash*` directory there.
  - A delete a script legitimately performs on its own files there is a direct, scoped delete.
  - The mount setup keeps the desktop from creating a per-volume trash (`.Trash-<uid>` / `.Trash`) on NTFS mounts, idempotently. If no trash exists, place the standard blocker: an empty `.Trash-<uid>` regular file at the mount root, owned by root and not writable, so GIO deletes permanently instead. If a trash directory already exists, report it and leave it.
  - Second layer: NTFS fstab entries carry the `x-gvfs-notrash` option (GLib 2.66 and later refuses to trash on that mount). The existing single-entry fstab helper adds it idempotently.
  - One blocker helper in the constants/mount library covers every NTFS mount path, including the `/www` bind root when it is NTFS. The `.Trash-` name is defined once.
  - Emptying or deleting an existing NTFS trash (e.g. the dual-boot `.Trash-1000`) is irreversible and needs the user's explicit approval.
  - A script found creating an NTFS trash is corrected idempotently by its owner: it stops creating the trash, and removes only an empty trash directory that it created itself.
- Existing files already on an NTFS mount are neither moved nor deleted by a script. Copying them to ext4 is a separate step that needs the user's approval.

## 3. Idempotent ensure scripts
- Scripts repair or initialize only what is missing, skip whatever is already initialized, and never reset. An installed service is started, not reinstalled (user D17).
- Every step can be run alone: `--list-steps`, `--check` (report only), `--step <name>`.

## 4. Parity
- Every functional Linux change has its Windows counterpart, or a platform-only reason, recorded in the parity ledgers (`.claude/agents_shared/shell_parity/`; guide B11).

## 5. Directory namespaces
- Every directory a script creates lives under one namespace per filesystem (user D30): ext4 `/opt/core_node/`, and on the NTFS share `/www/www/` for shared data plus `/www/core_node_compiler/` as the mount-point parent. See `development-guides/DIRECTORY_NAMESPACE_RULES.md`.
