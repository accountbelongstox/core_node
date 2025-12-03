#!/bin/bash

echo "========================================="
echo "   HoloFortune React Native 启动脚本"
echo "========================================="
echo ""

# 检查 node_modules 是否存在
if [ ! -d "node_modules" ]; then
    echo "检测到 node_modules 不存在，开始安装依赖..."
    echo ""
    npm install
    echo ""
    echo "依赖安装完成！"
    echo ""
else
    echo "依赖已存在，跳过安装步骤。"
    echo ""
fi

# 显示菜单
echo "请选择模式:"
echo "1. 调试模式 (Debug) - 启动 Metro bundler 和开发服务器"
echo "2. 构建 Android Debug (Build Android Debug) - 构建 Android Debug APK"
echo "3. 构建 Android Release (Build Android Release) - 构建 Android Release APK"
echo "4. 仅启动 Metro (Start Metro Only) - 只启动 Metro bundler"
echo "5. 清理并重新安装 (Clean & Reinstall) - 清理并重新安装依赖"
echo ""

read -p "请输入选项 (1-5): " choice

case $choice in
    1)
        echo ""
        echo "启动调试模式..."
        echo ""
        npm start
        ;;
    2)
        echo ""
        echo "构建 Android Debug APK..."
        echo ""
        cd android && ./gradlew assembleDebug && cd ..
        ;;
    3)
        echo ""
        echo "构建 Android Release APK..."
        echo ""
        cd android && ./gradlew assembleRelease && cd ..
        ;;
    4)
        echo ""
        echo "启动 Metro bundler..."
        echo ""
        npm start
        ;;
    5)
        echo ""
        echo "清理并重新安装..."
        echo ""
        echo "删除 node_modules..."
        rm -rf node_modules
        echo "删除 package-lock.json..."
        rm -f package-lock.json
        echo "删除 iOS Pods..."
        rm -rf ios/Pods
        echo "重新安装依赖..."
        echo ""
        npm install
        if [ "$(uname)" == "Darwin" ]; then
            echo "安装 iOS 依赖..."
            cd ios && pod install && cd ..
        fi
        echo ""
        echo "清理完成！"
        echo ""
        ;;
    *)
        echo ""
        echo "无效选项，退出。"
        echo ""
        exit 1
        ;;
esac

