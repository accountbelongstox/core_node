#!/usr/bin/env node

const { execSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function execCommand(command, options = {}) {
  try {
    console.log(`\n执行: ${command}\n`);
    execSync(command, { 
      stdio: 'inherit',
      ...options 
    });
  } catch (error) {
    console.error(`\n错误: ${error.message}`);
    process.exit(1);
  }
}

function checkNodeModules() {
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  return fs.existsSync(nodeModulesPath);
}

async function installDependencies() {
  if (!checkNodeModules()) {
    console.log('检测到 node_modules 不存在，开始安装依赖...\n');
    execCommand('npm install', { cwd: process.cwd() });
    console.log('\n依赖安装完成！\n');
  } else {
    console.log('依赖已存在，跳过安装步骤。\n');
  }
}

async function main() {
  console.log('========================================');
  console.log('   HoloFortune React Native 启动脚本');
  console.log('========================================\n');

  // 自动安装依赖
  await installDependencies();

  // 选择模式
  console.log('请选择模式:');
  console.log('1. 调试模式 (Debug) - 启动 Metro bundler 和开发服务器');
  console.log('2. 构建 Android (Build Android) - 构建 Android APK');
  console.log('3. 构建 iOS (Build iOS) - 构建 iOS 应用 (仅 macOS)');
  console.log('4. 仅启动 Metro (Start Metro Only) - 只启动 Metro bundler');
  console.log('5. 清理并重新安装 (Clean & Reinstall) - 清理并重新安装依赖\n');

  const choice = await question('请输入选项 (1-5): ');

  switch (choice.trim()) {
    case '1':
      console.log('\n启动调试模式...\n');
      execCommand('npm start');
      break;

    case '2':
      console.log('\n构建 Android 应用...\n');
      console.log('提示: 在另一个终端运行 "npm run android" 来启动应用\n');
      execCommand('cd android && ./gradlew assembleRelease', {
        env: { ...process.env, ANDROID_HOME: process.env.ANDROID_HOME || '' }
      });
      break;

    case '3':
      if (process.platform !== 'darwin') {
        console.log('\n错误: iOS 构建只能在 macOS 上运行\n');
        process.exit(1);
      }
      console.log('\n构建 iOS 应用...\n');
      console.log('提示: 在 Xcode 中打开 ios/holofortune.xcworkspace 进行构建\n');
      execCommand('cd ios && pod install', {
        env: { ...process.env }
      });
      break;

    case '4':
      console.log('\n启动 Metro bundler...\n');
      execCommand('npm start');
      break;

    case '5':
      console.log('\n清理并重新安装...\n');
      console.log('删除 node_modules...');
      if (fs.existsSync('node_modules')) {
        execCommand('rm -rf node_modules', { shell: true });
      }
      console.log('删除 package-lock.json...');
      if (fs.existsSync('package-lock.json')) {
        fs.unlinkSync('package-lock.json');
      }
      console.log('重新安装依赖...\n');
      execCommand('npm install');
      console.log('\n清理完成！\n');
      break;

    default:
      console.log('\n无效选项，退出。\n');
      process.exit(1);
  }

  rl.close();
}

main().catch(error => {
  console.error('发生错误:', error);
  rl.close();
  process.exit(1);
});

