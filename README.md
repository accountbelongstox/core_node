
# AI Reading
Backend: `poly_apps/laravel_main`
Pycore: `./pyservice.sh` or `.ps1`, `./pycore`
UI: `poly_apps/pycore_laravel_wordnew_ui` (includes Pycore manager: http://localhost:13054/pycore-manager, Laravel manager: `/laravel-manager`, vocabulary app: `/wordnew`)
Ncore: `./main.js` and `./apps/`
Chrome extension: `./apps/mcp-chrome`
所有AI必须按项目规范修改代码，请先读AI规范和项目规范。

## Quick Setup
The commands below are for copy-paste only; AI agents do not need to read them.
```cmd
curl -L https://gitee.com/accountbelongstox/core_node/raw/main/dd.cmd -o dd.cmd
dd.cmd
```

```cmd
curl -L https://raw.githubusercontent.com/accountbelongstox/core_node/main/dd.cmd -o dd.cmd
dd.cmd
```

PowerShell version (run in Administrator PowerShell):

```powershell
Invoke-WebRequest -Uri "https://gitee.com/accountbelongstox/core_node/raw/main/dd.cmd" -OutFile "dd.cmd"
.\dd.cmd
```

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/accountbelongstox/core_node/main/dd.cmd" -OutFile "dd.cmd"
.\dd.cmd
```

Linux one-click deployment:

```bash
sudo mkdir -p /usr/tmp && sudo wget -O /usr/tmp/dd.sh https://gitee.com/accountbelongstox/core_node/raw/main/dd.sh && sudo chmod +x /usr/tmp/dd.sh && sudo bash /usr/tmp/dd.sh
```

```bash
sudo mkdir -p /usr/tmp && sudo wget -O /usr/tmp/dd.sh https://raw.githubusercontent.com/accountbelongstox/core_node/main/dd.sh && sudo chmod +x /usr/tmp/dd.sh && sudo bash /usr/tmp/dd.sh
```

Pycore on hosted notebooks (outbound-only Relay agent to Laravel; re-running the cell is idempotent):
add the notebook secret `CORE_NODE_SECRET_PASSWORD` (the `.secret_keys` password) or type it when asked. A pycore node on a notebook host assists the Laravel queue (audio lanes, translation) by default, with no UI toggle.

Each cell updates an existing clone, re-clones an incomplete one, and stops with the reason when the clone fails.

Google Colab (select a GPU runtime; Drive is mounted automatically and keeps caches and the Relay identity):

```python
!(test -d /content/core_node/.git && git -C /content/core_node pull --ff-only) || (rm -rf /content/core_node && git clone --depth 1 https://github.com/accountbelongstox/core_node.git /content/core_node)
import os; assert os.path.isfile("/content/core_node/pycore/bootstrap/notebook_boot.py"), "Clone failed: check the runtime network, then rerun this cell"; print("[SETUP] Repository ready; starting the setup flow")
%run /content/core_node/pycore/bootstrap/notebook_boot.py colab
```

Google Colab from Gitee:

```python
!(test -d /content/core_node/.git && git -C /content/core_node pull --ff-only) || (rm -rf /content/core_node && git clone --depth 1 https://gitee.com/accountbelongstox/core_node.git /content/core_node)
import os; assert os.path.isfile("/content/core_node/pycore/bootstrap/notebook_boot.py"), "Clone failed: check the runtime network, then rerun this cell"; print("[SETUP] Repository ready; starting the setup flow")
%run /content/core_node/pycore/bootstrap/notebook_boot.py colab
```

Kaggle (Settings: Internet on (phone-verified account), Accelerator GPU, Persistence "Files" to keep caches in `/kaggle/working`; secret via Add-ons > Secrets):

```python
!(test -d /tmp/core_node/.git && git -C /tmp/core_node pull --ff-only) || (rm -rf /tmp/core_node && git clone --depth 1 https://github.com/accountbelongstox/core_node.git /tmp/core_node)
import os; assert os.path.isfile("/tmp/core_node/pycore/bootstrap/notebook_boot.py"), "Clone failed: turn on Settings > Internet (phone-verified account), then rerun this cell"; print("[SETUP] Repository ready; starting the setup flow")
%run /tmp/core_node/pycore/bootstrap/notebook_boot.py kaggle
```

Kaggle from Gitee:

```python
!(test -d /tmp/core_node/.git && git -C /tmp/core_node pull --ff-only) || (rm -rf /tmp/core_node && git clone --depth 1 https://gitee.com/accountbelongstox/core_node.git /tmp/core_node)
import os; assert os.path.isfile("/tmp/core_node/pycore/bootstrap/notebook_boot.py"), "Clone failed: turn on Settings > Internet (phone-verified account), then rerun this cell"; print("[SETUP] Repository ready; starting the setup flow")
%run /tmp/core_node/pycore/bootstrap/notebook_boot.py kaggle
```

First run on a new device: claim it in Laravel, then save its identity once with `%run /content/core_node/pycore/bootstrap/notebook_boot.py colab --export-identity` (Kaggle: `/tmp/core_node/... kaggle --export-identity`) and add the produced `.secret_keys/already_encrypted/PYCORE_RELAY_DEVICE_IDENTITY_1.js` to the repository.

update
