#!/bin/bash
# huo qu jiao bensuo zai de jue dui mulu
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="/Users/hang/code/tencent/ai/chrome-mcp-server/app/native-server/dist/logs" # huo zhe ni xuan zede, queding you xie ru quan xian de mu

# huo qu dang qian shi jian chuo yongyu ri zhi wen jian ming, bi mian fu
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
WRAPPER_LOG="${LOG_DIR}/native_host_wrapper_${TIMESTAMP}.log"

# Node.js jiao bende shi ji lu
NODE_SCRIPT="${SCRIPT_DIR}/index.js"

# quebao ri zhi mulu cun zai
mkdir -p "${LOG_DIR}"

# ji lu wrapper jiao benbei diao yongde xin xi
echo "Wrapper script called at $(date)" > "${WRAPPER_LOG}"
echo "SCRIPT_DIR: ${SCRIPT_DIR}" >> "${WRAPPER_LOG}"
echo "LOG_DIR: ${LOG_DIR}" >> "${WRAPPER_LOG}"
echo "NODE_SCRIPT: ${NODE_SCRIPT}" >> "${WRAPPER_LOG}"
echo "Initial PATH: ${PATH}" >> "${WRAPPER_LOG}"

# dong tai chaNode.js ke zhi xing wen
NODE_EXEC=""
# 1. chang shiwhich (ta hui shi yongdang qian huanjingPATH, Chrome PATH ke neng bu wan
if command -v node &>/dev/null; then
    NODE_EXEC=$(command -v node)
    echo "Found node using 'command -v node': ${NODE_EXEC}" >> "${WRAPPER_LOG}"
fi

# 2. ru guo which zhaobu dao, chang shi yimacOS shang chang jian de Node.js an zhuang lu jing
if [ -z "${NODE_EXEC}" ]; then
    COMMON_NODE_PATHS=(
        "/usr/local/bin/node"            # Homebrew on Intel Macs / direct install
        "/opt/homebrew/bin/node"         # Homebrew on Apple Silicon
        "$HOME/.nvm/versions/node/$(ls -t $HOME/.nvm/versions/node | head -n 1)/bin/node" # NVM (latest installed)
        # ni ke yi genjuxu yao tianjia geng duo ni huanjing zhong ke neng cun zai de lu jing
    )
    for path_to_node in "${COMMON_NODE_PATHS[@]}"; do
        if [ -x "${path_to_node}" ]; then
            NODE_EXEC="${path_to_node}"
            echo "Found node at common path: ${NODE_EXEC}" >> "${WRAPPER_LOG}"
            break
        fi
    done
fi

# 3. ru guo hai shizhaobu dao, ji lu cuo wu bing tui
if [ -z "${NODE_EXEC}" ]; then
    echo "ERROR: Node.js executable not found!" >> "${WRAPPER_LOG}"
    echo "Please ensure Node.js is installed and its path is accessible or configured in this script." >> "${WRAPPER_LOG}"
    # dui yu Native Host, ta xu yao bao chi yun xing yi jie shou xiao xi, zhi jie tui chu ke neng bu shizui
    # dan ru guonode dou zhaobu dao, ye wu fa zhi xing mubiao jiao ben
    # zhe li ke yi kao lu shu chu yi ge fuNative Messaging xie yi de cuo wu xiao xigei kuozhan (ru guo ke yi de hua)
    # huo zhe jiu rang ta shi bai, Chrome hui baoNative Host Exited.
    exit 1 # Stop before the exec call below when the build artifact is missing.
fi

echo "Using Node executable: ${NODE_EXEC}" >> "${WRAPPER_LOG}"
echo "Node version found by script: $(${NODE_EXEC} -v)" >> "${WRAPPER_LOG}"
echo "Executing: ${NODE_EXEC} ${NODE_SCRIPT}" >> "${WRAPPER_LOG}"
echo "PWD: $(pwd)" >> "${WRAPPER_LOG}" # PWD ji lu yi xia, you shi you yong

exec "${NODE_EXEC}" "${NODE_SCRIPT}" 2>> "${LOG_DIR}/native_host_stderr_${TIMESTAMP}.log"
