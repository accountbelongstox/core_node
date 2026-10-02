---
name: rpc-contract-json-shared
description: config/pycore_rpc_contract.json drives both the UI route table (typed keys) and pycore startup drift check, so the UI must not add route entries alone
metadata:
  type: project
---

`PYCORE_HTTP_ROUTES` is built from `config/pycore_rpc_contract.json`; keys are the path segments (no leading `ui`) in camelCase (`ui/terminal/backups/list` -> `terminalBackupsList`). Pycore's `report_contract_drift` fails startup when the JSON and the registered handlers differ, and `config/pycore_relay_contract.json` needs a matching route policy for relay mode.

**Why:** a UI-only JSON entry would break the live pycore (it runs the working tree).

**How to apply:** write UI code against the agreed key names, let pycore-lead land the JSON entries, then run tsc (type errors on missing keys until then). In relay policy exact matches beat the `/open` suffix deny.
