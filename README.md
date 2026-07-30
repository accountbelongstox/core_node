
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

update
