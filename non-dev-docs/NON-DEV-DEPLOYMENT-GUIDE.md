# Deployment and Environment Setup Guide

This document provides instructions for setting up the development environment and deploying the application.

---

## 1. Initial Environment Setup

### For Windows 10/11 (Run as Administrator)

Use `curl` to download the `dd.cmd` script and then execute it.

```bash
curl -o dd.cmd https://gitee.com/accountbelongstox/core_node/raw/main/dd.cmd
dd.cmd
```

### For Linux (Debian-based)

Update your package list, install `dos2unix`, and then make the `dd.sh` script executable.

```bash
sudo apt update && sudo apt install dos2unix && sudo dos2unix ./dd.sh && sudo chmod +x ./dd.sh
```

Alternatively, you can use this one-liner to ensure `dos2unix` is installed and then execute the script:

```bash
(command -v dos2unix >/dev/null 2>&1 || (echo "Installing dos2unix..." && sudo apt-get update -qq && sudo apt-get install -y dos2unix)) && dos2unix dd.sh && chmod +x dd.sh
```

---

## 2. Application-Specific Dependencies

### DocumentOffline App

Install the required `iconv-lite` and `jsdom` packages for the `DocumentOffline` application.

```bash
yarn add iconv-lite jsdom
```

### Puppeteer (Browser Automation)

Install Puppeteer and its related packages for web automation tasks.

```bash
yarn add puppeteer puppeteer-extra puppeteer-extra-plugin-stealth @puppeteer/browsers user-agents
```

---

## 3. Server Management and Debugging

### Debugging Commands

Use these commands to stop the `VoiceStaticServer` service and run the application in different modes for debugging.

-   **Run as Client:**
    ```bash
    systemctl stop VoiceStaticServer-node.service && node /mnt/d/programing/core_node/main.js --app=VoiceStaticServer --client
    ```
-   **Run as Server:**
    ```bash
    systemctl stop VoiceStaticServer-node.service && node /mnt/d/programing/core_node/main.js --app=VoiceStaticServer --server
    ```
-   **Quick Restart:**
    ```bash
    cd /www/wwwroot/core_node && git pull && systemctl restart VoiceStaticServer-node.service
    ```

### Server Runtime Arguments

-   `--server`: Starts the application in server mode.
-   `--rebuildmaindb`: Rebuilds the main database.

### Running the Server

Use these commands to stop the service and run the application directly.

-   **Run in Server Mode:**
    ```bash
    systemctl stop VoiceStaticServer-node.service && node /www/wwwroot/core_node/main.js --app=VoiceStaticServer --server
    ```
-   **Run in Default Mode:**
    ```bash
    systemctl stop VoiceStaticServer-node.service && node /www/wwwroot/core_node/main.js --app=VoiceStaticServer
    ```

### Server Deployment

This command deploys the `VoiceStaticServer` as a service and restarts it.

```bash
# TODO:
node /www/wwwroot/core_node/main.js --app=VoiceStaticServer --service --server && systemctl restart VoiceStaticServer-node.service
```

---

## 4. External Services and Tools

### Brave Search API

-   **API Key:** [https://api-dashboard.search.brave.com/app/keys](https://api-dashboard.search.brave.com/app/keys)

### Cursor (AI-Powered Editor)

-   **Go Cursor Help:** [https://github.com/yuaotian/go-cursor-help](https://github.com/yuaotian/go-cursor-help)
-   **Cursor Free VIP:** [https://github.com/yeongpin/cursor-free-vip](https://github.com/yeongpin/cursor-free-vip)

### Xata.io Database

#### Connection Details

-   **PostgreSQL Endpoint:**
    ```
    postgresql://70e12j:xau_rK29jqtDRzMu9WWQLvi6w43yTbszJ6s91@us-east-1.sql.xata.sh/qianyuwords_xata:main?sslmode=require
    ```
-   **HTTP Endpoint:**
    ```
    https://accountbelongstox-s-workspace-70e12j.us-east-1.xata.sh/db/qianyuwords_xata:main
    ```
-   **API Key:**
    ```
    xau_rK29jqtDRzMu9WWQLvi6w43yTbszJ6s91
    ```

#### Xata CLI Usage

Install the Xata CLI and initialize your project to connect to the database.

1.  **Install Xata CLI:**
    ```bash
    npm install @xata.io/cli -g
    ```
2.  **Initialize Project:**
    ```bash
    xata init --db https://accountbelongstox-s-workspace-70e12j.us-east-1.xata.sh/db/qianyuwords_xata
    ```
3.  **Query a Record (Example):**
    ```javascript
    // Generated with CLI
    import { getXataClient } from "./xata";
    const xata = getXataClient();
    const record = await xata.db.tableName.read("rec_xyz");
    console.log(record);
    ```