##!/bin/bash
#
#PROGRAMMING_DIR_FILE=$(cat /usr/local/.pcore_local/deploy/.PROGRAMING_DIR)
#TARGET_DIR="$PROGRAMMING_DIR_FILE/CodeAuditAssistant"
#REPO_URL="http://git.local.12gm.com:5021/adminroot/CodeAuditAssistant.git"
#ROOT_DIR=$(dirname "$(dirname "$(dirname "$(dirname "$(dirname "$(dirname "$(dirname "$(readlink -f "$0")")")")")")")")
#VSIX_FILE="codeauditassistant-1.0.0.vsix"
#DOCKER_IMAGE="code-server"
#
#package_extension() {
#    vsce package
#    if [ ! -f "$VSIX_FILE" ]; then
#        echo "VSIX package creation failed"
#        exit 1
#    fi
#}
#
#deploy_extension() {
#    if [ ! -d "$TARGET_DIR/node_modules" ]; then
#        sudo yarn --cwd "$TARGET_DIR" init
#    fi
#}
#
#if [ ! -d "$TARGET_DIR" ]; then
#    sudo git clone $REPO_URL "$TARGET_DIR"
#else
#    cd "$TARGET_DIR"
#    sudo git pull
#fi
#
#cd "$TARGET_DIR"
#deploy_extension
#package_extension
#
#sudo docker cp ./$VSIX_FILE "$DOCKER_IMAGE:/root/"
#sudo docker exec code-server bash -c "curl -fsSL https://code-server.dev/install.sh | sh"
#sudo docker exec code-server code-server bash -c "code --init-extension /root/codeauditassistant-1.0.0.vsix"
#
#echo "Script completed successfully."
