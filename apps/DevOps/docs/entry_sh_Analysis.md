### entry.sh：容器启动与应用管理脚本

`entry.sh` 是Docker容器启动时执行的核心脚本，它负责初始化环境、复制应用代码、安装依赖并最终启动目标应用。

```bash
#!/bin/sh
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Get the app name from the first argument or use default
APP_NAME=${1:-VoiceStaticServer}
echo "Starting app: $APP_NAME"

# Create necessary directories if they don't exist
mkdir -p /app/apps /app/ncore

# Copy project files from mounted volume to workspace
if [ -d "/source" ]; then
    echo "Copying project files from source..."
    cp -r "/source/apps/$APP_NAME" "/app/apps/"
    cp -r /source/ncore /app/
    cp /source/package.json /source/yarn.lock /app/
fi

# Get HTTP_PORT from .env file
if [ -f "/app/apps/$APP_NAME/.env" ]; then
    HTTP_PORT=$(grep HTTP_PORT "/app/apps/$APP_NAME/.env" | cut -d '=' -f2)
    echo "Using port from .env: $HTTP_PORT"
else
    HTTP_PORT=3000
    echo "No .env file found, using default port: $HTTP_PORT"
fi

# Export port for Docker
export PORT=$HTTP_PORT

# Install dependencies if node_modules doesn't exist
if [ ! -d "/app/node_modules" ]; then
    echo "Installing dependencies..."
    yarn install
fi

# Start the application
echo "Starting application: $APP_NAME on port $HTTP_PORT..."
cd "/app/apps/$APP_NAME"
yarn start
```

逐行分析：
*   `#!/bin/sh`: Shebang，指定脚本使用 `/bin/sh` 解释器执行。
*   **AI SPECIAL ATTENTION RULES**:
    *   这是一个非常独特且重要的部分，它为AI代理和所有开发者设定了严格的行为规范。这些规则旨在确保代码质量、一致性、可维护性，并明确了AI在开发过程中的职责边界。
    *   **1. Write all code in English only.**: 强制代码注释、变量名、函数名等使用英文，确保国际化协作和代码可读性。
    *   **2. Never execute, create, or modify test code.**: 明确AI不应干预测试代码，这可能意味着测试由人工或专门的测试自动化工具负责，或者测试代码的修改需要更严格的审查。
    *   **3. Never create or update documentation (*.md).**: 限制AI生成或修改Markdown文档，这可能意味着文档的准确性和风格需要人工严格控制，或者文档是项目的重要资产，不应由AI随意更改。
    *   **4. Never write summaries during development or thinking process.**: 禁止AI在开发或思考过程中生成总结，这可能旨在避免冗余信息，或确保最终的总结由人工完成并经过审查。
    *   **5. Declare all variables at the beginning of the file.**: 强制变量声明提前，提高脚本的可读性和维护性，避免变量作用域混乱。
    *   **6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).**: 针对PowerShell脚本的特定规范，强调路径处理的健壮性和避免字符串拼接可能带来的问题。虽然当前是shell脚本，但这些规则的出现表明项目对跨平台脚本的规范性有统一要求。
    *   **7. Do not modify these rules.**: 强调这些规则的不可侵犯性，确保其长期有效性。
    *   这些规则的存在，揭示了 `core_node` 项目对自动化工具（如AI）的集成有非常明确和严格的指导方针，旨在确保自动化效率的同时，不牺牲代码质量和项目控制。
*   `APP_NAME=${1:-VoiceStaticServer}`:
    *   获取传递给脚本的第一个参数作为 `APP_NAME`。如果未提供参数，则默认使用 `VoiceStaticServer`。这与 `Dockerfile` 中的 `CMD` 指令相呼应，提供了灵活的应用启动机制。
*   `echo "Starting app: $APP_NAME"`: 
    *   输出当前正在启动的应用名称，提供日志信息。
*   `mkdir -p /app/apps /app/ncore`:
    *   创建必要的目录 `/app/apps` 和 `/app/ncore`。`-p` 选项确保如果父目录不存在也会一并创建。这表明应用程序可能将不同的子应用放在 `/app/apps` 下，而 `/app/ncore` 可能是核心模块或共享库。
*   **文件复制逻辑**:
    *   `if [ -d "/source" ]; then ... fi`: 检查 `/source` 目录是否存在。
    *   `echo "Copying project files from source..."`: 输出复制信息。
    *   `cp -r "/source/apps/$APP_NAME" "/app/apps/"`: 将特定应用的代码从 `/source/apps/$APP_NAME` 复制到容器内的 `/app/apps/`。
    *   `cp -r /source/ncore /app/`: 复制 `ncore` 目录到 `/app/`。
    *   `cp /source/package.json /source/yarn.lock /app/`: 复制 `package.json` 和 `yarn.lock` 到 `/app/`。
    *   **重要意义**: 这段逻辑是理解该DevOps容器工作方式的关键。它表明容器在运行时，宿主机上的项目代码（或至少是部分代码）被挂载到容器的 `/source` 目录。然后，脚本将这些代码复制到容器的 `/app` 工作目录。这种模式在开发环境中非常常见，允许开发者在宿主机上修改代码，并通过卷挂载实时同步到容器中，实现快速迭代和热重载。在生产环境中，通常会直接在 `Dockerfile` 中 `COPY` 代码，而不是通过运行时复制。因此，这个 `entry.sh` 脚本更像是为开发或CI/CD构建阶段设计的。
*   **端口提取逻辑**:
    *   `if [ -f "/app/apps/$APP_NAME/.env" ]; then ... fi`: 检查特定应用的 `.env` 文件是否存在。
    *   `HTTP_PORT=$(grep HTTP_PORT "/app/apps/$APP_NAME/.env" | cut -d '=' -f2)`: 使用 `grep` 查找 `HTTP_PORT` 行，然后使用 `cut` 提取等号后面的值。这是一种在Shell脚本中解析环境变量的常见方法。
    *   `echo "Using port from .env: $HTTP_PORT"`: 输出从 `.env` 文件中读取的端口。
    *   `else HTTP_PORT=3000; echo "No .env file found, using default port: $HTTP_PORT"`: 如果 `.env` 文件不存在，则使用默认端口 `3000`。这提供了健壮的默认行为。
*   `export PORT=$HTTP_PORT`:
    *   将 `HTTP_PORT` 的值导出为名为 `PORT` 的环境变量。许多Node.js框架（如Express）默认会读取 `PORT` 环境变量来确定监听端口。这是Node.js应用配置端口的常见约定。
*   **依赖安装逻辑**:
    *   `if [ ! -d "/app/node_modules" ]; then ... fi`: 检查 `/app/node_modules` 目录是否存在。
    *   `echo "Installing dependencies..."`: 输出安装信息。
    *   `yarn install`: 使用 `yarn` 包管理器安装项目依赖。`yarn` 是Node.js生态系统中流行的包管理器，与 `npm` 类似，但通常在性能和缓存方面有优势。
    *   **重要意义**: 这种条件安装依赖的方式，意味着如果 `node_modules` 已经存在（例如，在构建镜像时已经安装过，或者在开发环境中通过卷挂载），则跳过安装步骤，从而加快容器启动速度。这再次印证了脚本对开发和CI/CD场景的优化。
*   **应用启动**:
    *   `echo "Starting application: $APP_NAME on port $HTTP_PORT..."`: 输出最终的应用启动信息。
    *   `cd "/app/apps/$APP_NAME"`: 切换到特定应用的目录。
    *   `yarn start`: 执行 `package.json` 中定义的 `start` 脚本。这是Node.js应用程序的标准启动命令。

**`entry.sh` 在DevOps流程中的作用：**
`entry.sh` 脚本是这个DevOps容器的“大脑”，它实现了：
*   **通用应用启动器**: 能够根据参数启动不同的Node.js应用。
*   **环境准备**: 创建必要目录，动态配置端口。
*   **代码同步**: 支持从挂载卷复制代码，方便开发迭代。
*   **依赖管理**: 确保应用依赖正确安装。
*   **标准化启动**: 通过 `yarn start` 统一应用启动方式。

这个脚本的灵活性和自动化程度，使其成为一个理想的DevOps工具，用于在容器环境中管理和部署多个Node.js微服务。
