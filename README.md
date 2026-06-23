
# Welcome  

**Important:** Before you begin, please read the [DEVELOPMENT_GUIDE_THIS_FILE_NO_AI_EDIT.md](DEVELOPMENT_GUIDE_THIS_FILE_NO_AI_EDIT.md) for essential project information and setup instructions.

---

**AI Notice:** This file (`README.md`) is for informational purposes only and must not be modified by any AI assistant. All development guidelines are located in other documents.

---

**Developer Section (AI Ignore):** The content below this line is for human developers and should be ignored by AI assistants.

## Project Terminology

When reading requirements, interpret the following terms as defined below:

- **ncore**: The overall Node-based project. Its root (the `ncore dir`) is the top-level directory that contains this README, located at `D:\programing\core_node`.
- **ncore dir**: The top-level root directory, `D:\programing\core_node`.
- **script dir**: The `scripts` directory under the `ncore dir`.
- **poly app**: An app built on a different technology stack, located under the `poly_apps` directory.
- **poly app dir**: The root directory of a `poly app`.
- **app**: A Node-based app, located under the `apps` directory.
- **app dir**: The root directory of an `app`.
- **local mcp**: A service located under the `ncore\mcp_server` directory.

## Quick Setup

Run in Administrator Command Prompt to deploy development environment:

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

