# Rust MCP 服务集成指南

## 概述

本文档描述如何修改现有的 Rust MCP 服务，使其通过 HTTP API 与 Node.js 中间层通信，而不是直接启动 Tauri 桌面应用。

## 修改策略

### 1. 保持现有结构
- MCP 协议处理逻辑保持不变
- 配置管理系统保持不变
- 只修改 UI 交互部分

### 2. 替换 Tauri 调用
- 将 Tauri 命令调用替换为 HTTP API 调用
- 移除 Tauri 应用启动逻辑
- 添加 HTTP 客户端依赖

## 依赖修改

### Cargo.toml 修改

```toml
[dependencies]
# 保持现有依赖
anyhow = "1.0"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1.0", features = ["full"] }
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1.0", features = ["v4"] }
log = "0.4"
env_logger = "0.10"

# 新增 HTTP 客户端依赖
reqwest = { version = "0.11", features = ["json", "rustls-tls"] }
url = "2.4"

# 移除或注释掉 Tauri 相关依赖
# tauri = { version = "2.0", features = ["shell-open"] }
# tauri-build = { version = "2.0", features = [] }

[build-dependencies]
# 移除 tauri-build
# tauri-build = { version = "2.0", features = [] }
```

## 核心修改

### 1. HTTP 客户端服务

**src/rust/http_client/mod.rs** (新增)
```rust
use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use url::Url;

use crate::mcp::types::PopupRequest;

#[derive(Debug, Clone)]
pub struct HttpBridgeClient {
    client: Client,
    base_url: Url,
}

impl HttpBridgeClient {
    pub fn new(base_url: &str) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()?;
        
        let base_url = Url::parse(base_url)?;
        
        Ok(Self { client, base_url })
    }

    /// 创建 MCP 弹窗请求
    pub async fn create_popup(&self, request: &PopupRequest) -> Result<String> {
        let url = self.base_url.join("/api/mcp/popup")?;
        
        log::info!("发送 MCP 弹窗请求到: {}", url);
        log::debug!("请求内容: {:?}", request);
        
        let response = self
            .client
            .post(url)
            .json(request)
            .send()
            .await?;
        
        if response.status().is_success() {
            let result: PopupResponse = response.json().await?;
            log::info!("收到 MCP 响应: {}", result.response);
            Ok(result.response)
        } else {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            anyhow::bail!("HTTP Bridge API 请求失败 [{}]: {}", status, error_text);
        }
    }

    /// 获取应用配置
    pub async fn get_config(&self) -> Result<serde_json::Value> {
        let url = self.base_url.join("/api/app/config")?;
        
        let response = self
            .client
            .get(url)
            .send()
            .await?;
        
        if response.status().is_success() {
            let config: serde_json::Value = response.json().await?;
            Ok(config)
        } else {
            anyhow::bail!("获取配置失败: {}", response.status());
        }
    }

    /// 更新应用配置
    pub async fn update_config(&self, config: &serde_json::Value) -> Result<()> {
        let url = self.base_url.join("/api/app/config")?;
        
        let response = self
            .client
            .post(url)
            .json(config)
            .send()
            .await?;
        
        if response.status().is_success() {
            Ok(())
        } else {
            anyhow::bail!("更新配置失败: {}", response.status());
        }
    }

    /// 健康检查
    pub async fn health_check(&self) -> Result<bool> {
        let url = self.base_url.join("/health")?;
        
        match self.client.get(url).send().await {
            Ok(response) => Ok(response.status().is_success()),
            Err(_) => Ok(false),
        }
    }
}

#[derive(Debug, Deserialize)]
struct PopupResponse {
    response: String,
}

impl Default for HttpBridgeClient {
    fn default() -> Self {
        Self::new("http://127.0.0.1:3000")
            .expect("Failed to create default HTTP bridge client")
    }
}
```

### 2. 修改弹窗处理器

**src/rust/mcp/handlers/popup.rs** (修改)
```rust
use anyhow::Result;
use std::time::Duration;
use tokio::time::timeout;

use crate::http_client::HttpBridgeClient;
use crate::mcp::types::PopupRequest;

/// 创建弹窗 - 通过 HTTP Bridge API
pub async fn create_popup(request: &PopupRequest) -> Result<String> {
    let client = HttpBridgeClient::default();
    
    // 首先检查 Bridge 服务是否可用
    if !client.health_check().await? {
        anyhow::bail!("HTTP Bridge 服务不可用，请确保 Node.js 服务正在运行");
    }
    
    // 创建弹窗请求
    client.create_popup(request).await
}

/// 带超时的弹窗创建
pub async fn create_popup_with_timeout(
    request: &PopupRequest, 
    timeout_secs: u64
) -> Result<String> {
    match timeout(Duration::from_secs(timeout_secs), create_popup(request)).await {
        Ok(result) => result,
        Err(_) => {
            log::warn!("MCP 弹窗请求超时: {} 秒", timeout_secs);
            Ok("TIMEOUT".to_string())
        }
    }
}

/// 批量创建弹窗（用于测试）
pub async fn create_multiple_popups(requests: &[PopupRequest]) -> Result<Vec<String>> {
    let client = HttpBridgeClient::default();
    let mut results = Vec::new();
    
    for request in requests {
        match client.create_popup(request).await {
            Ok(response) => results.push(response),
            Err(e) => {
                log::error!("弹窗创建失败: {}", e);
                results.push("ERROR".to_string());
            }
        }
    }
    
    Ok(results)
}

// 移除原有的 Tauri 相关函数
// - find_ui_command
// - test_command_available
// - is_executable
```

### 3. 修改应用入口

**src/rust/main.rs** (修改)
```rust
use anyhow::Result;
use std::env;

mod config;
mod http_client;
mod mcp;
mod utils;

use crate::http_client::HttpBridgeClient;
use crate::mcp::server::McpServer;
use crate::utils::auto_init_logger;

#[tokio::main]
async fn main() -> Result<()> {
    // 初始化日志系统
    if let Err(e) = auto_init_logger() {
        eprintln!("初始化日志系统失败: {}", e);
    }

    let args: Vec<String> = env::args().collect();

    match args.len() {
        // 无参数：显示帮助信息
        1 => {
            print_help();
        }
        // MCP 请求模式
        _ if args.len() >= 3 && args[1] == "--mcp-request" => {
            handle_mcp_request(&args[2]).await?;
        }
        // 其他参数
        _ => {
            match args[1].as_str() {
                "--help" | "-h" => print_help(),
                "--version" | "-v" => print_version(),
                "--test-bridge" => test_bridge_connection().await?,
                _ => {
                    eprintln!("未知参数: {}", args[1]);
                    print_help();
                    std::process::exit(1);
                }
            }
        }
    }

    Ok(())
}

/// 处理 MCP 请求
async fn handle_mcp_request(request_file: &str) -> Result<()> {
    log::info!("处理 MCP 请求文件: {}", request_file);
    
    // 检查 HTTP Bridge 连接
    let client = HttpBridgeClient::default();
    if !client.health_check().await? {
        log::error!("HTTP Bridge 服务不可用");
        log::error!("请确保 Node.js Bridge 服务正在运行: npm run dev");
        std::process::exit(1);
    }
    
    // 创建 MCP 服务器并处理请求
    let mcp_server = McpServer::new();
    mcp_server.handle_request_file(request_file).await?;
    
    Ok(())
}

/// 测试 Bridge 连接
async fn test_bridge_connection() -> Result<()> {
    println!("🔍 测试 HTTP Bridge 连接...");
    
    let client = HttpBridgeClient::default();
    
    match client.health_check().await {
        Ok(true) => {
            println!("✅ HTTP Bridge 连接正常");
            
            // 测试获取配置
            match client.get_config().await {
                Ok(config) => {
                    println!("✅ 配置获取成功");
                    println!("📋 配置预览: {}", 
                        serde_json::to_string_pretty(&config)?);
                }
                Err(e) => {
                    println!("⚠️  配置获取失败: {}", e);
                }
            }
        }
        Ok(false) => {
            println!("❌ HTTP Bridge 服务不可用");
            println!("💡 请启动 Node.js Bridge 服务: cd src/node_bridge && npm run dev");
        }
        Err(e) => {
            println!("❌ 连接测试失败: {}", e);
        }
    }
    
    Ok(())
}

/// 显示帮助信息
fn print_help() {
    println!("寸止 MCP 服务 - HTTP Bridge 版本");
    println!();
    println!("用法:");
    println!("  cunzhi-mcp                        显示此帮助信息");
    println!("  cunzhi-mcp --mcp-request <文件>    处理 MCP 请求");
    println!("  cunzhi-mcp --test-bridge          测试 HTTP Bridge 连接");
    println!("  cunzhi-mcp --help                 显示此帮助信息");
    println!("  cunzhi-mcp --version              显示版本信息");
    println!();
    println!("环境要求:");
    println!("  - Node.js Bridge 服务运行在 http://127.0.0.1:3000");
    println!("  - 启动命令: cd src/node_bridge && npm run dev");
}

/// 显示版本信息
fn print_version() {
    println!("寸止 MCP 服务 v{}", env!("CARGO_PKG_VERSION"));
    println!("HTTP Bridge 集成版本");
}
```

### 4. MCP 服务器修改

**src/rust/mcp/server.rs** (修改)
```rust
use anyhow::Result;
use serde_json;
use std::fs;
use std::path::Path;

use crate::http_client::HttpBridgeClient;
use crate::mcp::handlers::popup;
use crate::mcp::types::PopupRequest;

pub struct McpServer {
    bridge_client: HttpBridgeClient,
}

impl McpServer {
    pub fn new() -> Self {
        Self {
            bridge_client: HttpBridgeClient::default(),
        }
    }

    pub fn with_bridge_url(bridge_url: &str) -> Result<Self> {
        Ok(Self {
            bridge_client: HttpBridgeClient::new(bridge_url)?,
        })
    }

    /// 处理 MCP 请求文件
    pub async fn handle_request_file(&self, file_path: &str) -> Result<()> {
        // 检查文件是否存在
        if !Path::new(file_path).exists() {
            anyhow::bail!("MCP 请求文件不存在: {}", file_path);
        }

        // 读取请求文件
        let content = fs::read_to_string(file_path)?;
        let request: PopupRequest = serde_json::from_str(&content)?;

        log::info!("处理 MCP 请求: {}", request.id);
        log::debug!("请求内容: {:?}", request);

        // 通过 HTTP Bridge 创建弹窗
        let response = popup::create_popup(&request).await?;

        // 输出响应到 stdout (MCP 协议要求)
        println!("{}", response);
        
        // 清理临时文件
        if let Err(e) = fs::remove_file(file_path) {
            log::warn!("清理临时文件失败: {}", e);
        }

        log::info!("MCP 请求处理完成: {}", request.id);
        Ok(())
    }

    /// 批量处理 MCP 请求
    pub async fn handle_multiple_requests(&self, requests: &[PopupRequest]) -> Result<Vec<String>> {
        let mut responses = Vec::new();
        
        for request in requests {
            match popup::create_popup(request).await {
                Ok(response) => {
                    responses.push(response);
                    log::info!("MCP 请求成功: {}", request.id);
                }
                Err(e) => {
                    log::error!("MCP 请求失败: {} - {}", request.id, e);
                    responses.push("ERROR".to_string());
                }
            }
        }
        
        Ok(responses)
    }

    /// 测试 MCP 服务
    pub async fn test_service(&self) -> Result<()> {
        // 创建测试请求
        let test_request = PopupRequest {
            id: "test-123".to_string(),
            message: "这是一个测试消息".to_string(),
            predefined_options: Some(vec![
                "选项1".to_string(),
                "选项2".to_string(),
                "取消".to_string(),
            ]),
            is_markdown: Some(false),
            timeout: Some(30),
            source: "test".to_string(),
        };

        log::info!("开始 MCP 服务测试...");
        
        let response = popup::create_popup_with_timeout(&test_request, 30).await?;
        
        log::info!("测试完成，响应: {}", response);
        println!("测试响应: {}", response);
        
        Ok(())
    }

    /// 获取 Bridge 客户端引用
    pub fn bridge_client(&self) -> &HttpBridgeClient {
        &self.bridge_client
    }
}

impl Default for McpServer {
    fn default() -> Self {
        Self::new()
    }
}
```

### 5. 配置管理修改

**src/rust/config/mod.rs** (修改)
```rust
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::PathBuf;

use crate::http_client::HttpBridgeClient;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpConfig {
    pub bridge_url: String,
    pub timeout_seconds: u64,
    pub retry_attempts: u32,
    pub log_level: String,
}

impl Default for McpConfig {
    fn default() -> Self {
        Self {
            bridge_url: "http://127.0.0.1:3000".to_string(),
            timeout_seconds: 300,
            retry_attempts: 3,
            log_level: "info".to_string(),
        }
    }
}

impl McpConfig {
    /// 从环境变量和配置文件加载配置
    pub fn load() -> Result<Self> {
        let mut config = Self::default();
        
        // 从环境变量覆盖
        if let Ok(bridge_url) = env::var("BRIDGE_URL") {
            config.bridge_url = bridge_url;
        }
        
        if let Ok(timeout) = env::var("MCP_TIMEOUT") {
            config.timeout_seconds = timeout.parse().unwrap_or(config.timeout_seconds);
        }
        
        if let Ok(retry) = env::var("MCP_RETRY_ATTEMPTS") {
            config.retry_attempts = retry.parse().unwrap_or(config.retry_attempts);
        }
        
        if let Ok(log_level) = env::var("RUST_LOG") {
            config.log_level = log_level;
        }
        
        // 尝试从配置文件加载
        if let Ok(config_path) = Self::get_config_path() {
            if config_path.exists() {
                let content = fs::read_to_string(&config_path)?;
                let file_config: McpConfig = serde_json::from_str(&content)?;
                config = file_config;
            }
        }
        
        Ok(config)
    }
    
    /// 保存配置到文件
    pub fn save(&self) -> Result<()> {
        let config_path = Self::get_config_path()?;
        
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent)?;
        }
        
        let content = serde_json::to_string_pretty(self)?;
        fs::write(&config_path, content)?;
        
        Ok(())
    }
    
    /// 获取配置文件路径
    fn get_config_path() -> Result<PathBuf> {
        let config_dir = if let Ok(config_home) = env::var("XDG_CONFIG_HOME") {
            PathBuf::from(config_home)
        } else if let Ok(home) = env::var("HOME") {
            PathBuf::from(home).join(".config")
        } else {
            PathBuf::from(".")
        };
        
        Ok(config_dir.join("cunzhi").join("mcp-config.json"))
    }
    
    /// 创建 HTTP Bridge 客户端
    pub fn create_bridge_client(&self) -> Result<HttpBridgeClient> {
        HttpBridgeClient::new(&self.bridge_url)
    }
    
    /// 验证配置
    pub async fn validate(&self) -> Result<()> {
        let client = self.create_bridge_client()?;
        
        if !client.health_check().await? {
            anyhow::bail!("无法连接到 HTTP Bridge 服务: {}", self.bridge_url);
        }
        
        Ok(())
    }
}
```

## 构建和测试

### 1. 构建脚本

**scripts/build-rust.sh**
```bash
#!/bin/bash

set -e

echo "🦀 构建 Rust MCP 服务..."

cd src/rust

# 检查依赖
echo "📦 检查 Rust 工具链..."
rustc --version
cargo --version

# 清理之前的构建
echo "🧹 清理构建缓存..."
cargo clean

# 构建 Debug 版本
echo "🔨 构建 Debug 版本..."
cargo build

# 运行测试
echo "🧪 运行测试..."
cargo test

# 构建 Release 版本
echo "🚀 构建 Release 版本..."
cargo build --release

echo "✅ Rust MCP 服务构建完成!"
echo "📁 Debug 版本: target/debug/cunzhi-mcp"
echo "📁 Release 版本: target/release/cunzhi-mcp"
```

### 2. 测试脚本

**scripts/test-integration.sh**
```bash
#!/bin/bash

set -e

echo "🧪 运行集成测试..."

# 确保 Node.js Bridge 正在运行
if ! curl -f http://localhost:3000/health >/dev/null 2>&1; then
    echo "❌ Node.js Bridge 服务未运行"
    echo "💡 请先启动: cd src/node_bridge && npm run dev"
    exit 1
fi

# 测试 Bridge 连接
echo "🔍 测试 Bridge 连接..."
cargo run --bin cunzhi-mcp -- --test-bridge

# 创建测试请求文件
echo "📝 创建测试请求..."
cat > /tmp/test-mcp-request.json << EOF
{
  "id": "integration-test-$(date +%s)",
  "message": "这是一个集成测试消息\n\n请选择一个选项来完成测试。",
  "predefined_options": ["测试通过", "测试失败", "取消测试"],
  "is_markdown": false,
  "timeout": 60,
  "source": "integration-test"
}
EOF

echo "🚀 发送测试请求..."
timeout 65 cargo run --bin cunzhi-mcp -- --mcp-request /tmp/test-mcp-request.json

echo "✅ 集成测试完成!"
```

### 3. 开发工作流

**scripts/dev-rust.sh**
```bash
#!/bin/bash

echo "🦀 启动 Rust MCP 服务开发模式..."

cd src/rust

# 监听文件变化并自动重新构建
cargo watch -x "build" -x "test" -s "echo '✅ 构建完成'"
```

## 部署配置

### 1. 环境变量配置

**.env.example**
```bash
# HTTP Bridge 配置
BRIDGE_URL=http://127.0.0.1:3000

# MCP 配置
MCP_TIMEOUT=300
MCP_RETRY_ATTEMPTS=3

# 日志配置
RUST_LOG=info

# 开发模式配置
NODE_ENV=development
```

### 2. 系统服务配置

**cunzhi-mcp.service** (systemd)
```ini
[Unit]
Description=Cunzhi MCP Service
After=network.target
Requires=cunzhi-bridge.service

[Service]
Type=notify
User=cunzhi
Group=cunzhi
WorkingDirectory=/opt/cunzhi
ExecStart=/opt/cunzhi/bin/cunzhi-mcp
Environment=BRIDGE_URL=http://127.0.0.1:3000
Environment=RUST_LOG=info
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

这个集成指南提供了完整的 Rust 服务改造方案，确保与 Node.js 中间层的无缝集成。
