---
name: contract-driven-paths
description: PathMapper/ServiceContract path rules, drift pitfalls, and lockstep ends for data dir and tool root
metadata:
  type: project
---
PathMapper reads every drive/www/data-dir name and the drive layout from config/service_contract.json#paths through ServiceContract (no path constants). The contract is edited live by the orchestrator (D24, D27, D28, D30), so re-read it before trusting a value.

**Why:** Deriving unrelated legacy paths (App Manager log roots under /opt) from `drive_layout.tool_root.linux` silently moved them when D30 changed the tool root to /opt/core_node. D30 says legacy top-level dirs stay until a user-approved migration.

**How to apply:**
- Derive only what the contract key actually names; keep legacy mirrors (gvar_common.sh / system_paths.py literals) literal until a contract key exists for them.
- The Linux data dir and tool root change only in lockstep with shell runtime_environment.sh / gvar_storage_common.sh and pycore core_node_dirs.py / system_paths.py; a PHP-only switch splits the global_var store on dual-boot Linux.
- The user's periodic `win0.0.1` commits land working-tree edits in HEAD; review against the assigned diff base, not HEAD.
- The Windows program drive is read from the var-center key WINDOWS_PROGRAM_DRIVE_ROOT (never probe E:); test it with a scratch CORE_NODE_DATA_DIR store.
