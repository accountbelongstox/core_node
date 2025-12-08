完美！我已经完整分析了 QtScrcpy 项目的无线连接机制。现在给你详细的技术方案：

  📱 QtScrcpy 无线连接技术方案详解

  🔍 核心发现

  QtScrcpy 绕过 Android 11+ 配对要求的关键：先通过 USB 建立信任，再切换到 WiFi

  ---
  1️⃣ 无线连接核心流程

  关键代码位置: dialog.cpp:691-726 (on_wifiConnectBtn_clicked)

  void Dialog::on_wifiConnectBtn_clicked() {
      // 步骤1: 停止所有现有服务
      on_stopAllServerBtn_clicked();
      delayMs(200);

      // 步骤2: 更新设备列表（执行 adb devices）
      on_updateDevice_clicked();
      delayMs(200);

      // 步骤3: 查找第一个 USB 设备（非 IP:PORT 格式）
      int firstUsbDevice = findDeviceFromeSerialBox(false);
      ui->serialBox->setCurrentIndex(firstUsbDevice);

      // 步骤4: 获取设备 IP 地址
      // 执行: adb shell ifconfig wlan0
      on_getIPBtn_clicked();
      delayMs(200);

      // 步骤5: ⭐ 关键步骤 - 启动 TCP/IP 模式的 adbd
      // 执行: adb tcpip 5555
      on_startAdbdBtn_clicked();
      delayMs(1000);

      // 步骤6: 无线连接
      // 执行: adb connect 192.168.x.x:5555
      on_wirelessConnectBtn_clicked();
      delayMs(2000);

      // 步骤7: 再次更新设备列表
      on_updateDevice_clicked();
      delayMs(200);

      // 步骤8: 查找 WiFi 设备（IP:PORT 格式）
      int firstWifiDevice = findDeviceFromeSerialBox(true);
      ui->serialBox->setCurrentIndex(firstWifiDevice);

      // 步骤9: 启动 scrcpy 服务
      on_startServerBtn_clicked();
  }

  ---
  2️⃣ 绕过 Android 11+ 配对的技术原理

  关键命令对比：

  ❌ Android 11+ 新方式（需要配对）

  # 需要在手机上确认配对码
  adb pair 192.168.1.100:5555
  adb connect 192.168.1.100:5555

  ✅ QtScrcpy 使用的方式（无需配对）

  # 1. 先通过 USB 连接（已建立信任）
  adb devices
  # 输出: P7C0218510000537    device

  # 2. 通过已信任的 USB 连接启动 TCP/IP 模式
  adb -s P7C0218510000537 tcpip 5555
  # 输出: restarting in TCP mode port: 5555

  # 3. 直接连接，无需配对
  adb connect 192.168.1.100:5555
  # 输出: connected to 192.168.1.100:5555

  原理说明：

  - USB 连接已通过用户授权（开启 USB 调试时在手机上确认）
  - 通过 USB 执行 adb tcpip 5555 是可信命令，无需再次配对
  - 切换到 TCP/IP 模式后，WiFi 连接继承了 USB 的信任关系

  ---
  3️⃣ 多设备管理机制

  设备识别逻辑: dialog.cpp:668-689 (findDeviceFromeSerialBox)

  int Dialog::findDeviceFromeSerialBox(bool wifi) {
      // IP:PORT 格式的正则表达式
      QString regStr = "\\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}"
                       "(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)"
                       "\\:([0-9]|[1-9]\\d|[1-9]\\d{2}|[1-9]\\d{3}|"
                       "[1-5]\\d{4}|6[0-4]\\d{3}|65[0-4]\\d{2}|655[0-2]\\d|6553[0-5])\\b";

      QRegularExpression regIP(regStr);

      for (int i = 0; i < ui->serialBox->count(); ++i) {
          bool isWifi = regIP.match(ui->serialBox->itemText(i)).hasMatch();
          bool found = wifi ? isWifi : !isWifi;
          if (found) {
              return i;
          }
      }
      return -1;
  }

  设备列表示例：

  adb devices
  List of devices attached
  P7C0218510000537        device          # USB 设备
  192.168.1.100:5555      device          # WiFi 设备
  192.168.1.101:5555      device          # 另一台 WiFi 设备

  多设备连接流程：

  1. 通过 USB 连接多台设备
  2. 逐个获取 IP 并切换到 WiFi
  3. 断开 USB，所有设备保持 WiFi 连接
  4. 通过设备序列号（IP:5555）区分和控制不同设备

  ---
  4️⃣ scrcpy-server 调用机制

  服务启动代码: dialog.cpp:331-365 (on_startServerBtn_clicked)

  void Dialog::on_startServerBtn_clicked() {
      qsc::DeviceParams params;
      params.serial = ui->serialBox->currentText().trimmed();  // 设备序列号
      params.maxSize = videoSize;                               // 视频分辨率
      params.bitRate = getBitRate();                            // 比特率
      params.maxFps = Config::getInstance().getMaxFps();        // 帧率

      // ⭐ 关键路径配置
      params.serverLocalPath = getServerPath();                 // PC 上的 scrcpy-server
      params.serverRemotePath = "/data/local/tmp/scrcpy-server.jar";  // 设备上的路径

      // 调用 QtScrcpyCore 库连接设备
      qsc::IDeviceManage::getInstance().connectDevice(params);
  }

  scrcpy-server 路径配置: dialog.cpp:774-784

  const QString &Dialog::getServerPath() {
      static QString serverPath;
      if (serverPath.isEmpty()) {
          // 优先从环境变量读取
          serverPath = QString::fromLocal8Bit(qgetenv("QTSCRCPY_SERVER_PATH"));

          // 回退到应用目录
          if (serverPath.isEmpty() || !QFileInfo(serverPath).isFile()) {
              serverPath = QCoreApplication::applicationDirPath() + "/scrcpy-server";
          }
      }
      return serverPath;
  }

  服务器推送和启动过程（由 QtScrcpyCore 库处理）：

  # 1. 推送 scrcpy-server 到设备
  adb -s 192.168.1.100:5555 push scrcpy-server /data/local/tmp/scrcpy-server.jar

  # 2. 启动 scrcpy-server（简化示例）
  adb -s 192.168.1.100:5555 shell CLASSPATH=/data/local/tmp/scrcpy-server.jar \
      app_process / com.genymobile.scrcpy.Server \
      2.0 log_level=info max_size=1920 bit_rate=8000000

  ---
  5️⃣ 手机端适配要求

  ✅ 必需配置：

  1. 启用 USB 调试
    - 设置 → 开发者选项 → USB 调试
  2. 连接时授权
    - 首次 USB 连接时，手机会弹出"允许 USB 调试"对话框
    - 勾选"始终允许该计算机"并确认

  ⚠️ 特殊机型额外要求（小米等）：

  3. 启用 USB 调试（安全设置）
    - 开发者选项 → USB 调试（安全设置） → 允许模拟点击
    - 代码位置: FAQ.md:18-22

  ❌ 不需要：

  - ❌ Root 权限
  - ❌ OTG 功能
  - ❌ 安装额外 APP
  - ❌ 修改系统设置

  ---
  6️⃣ ADB 命令执行架构

  ADB 进程管理: dialog.cpp:48-106

  connect(&m_adb, &qsc::AdbProcess::adbProcessResult,
      this, [this](qsc::AdbProcess::ADB_EXEC_RESULT processResult) {

      QStringList args = m_adb.arguments();

      switch (processResult) {
      case AER_SUCCESS_EXEC:
          // 处理 adb devices 命令结果
          if (args.contains("devices")) {
              QStringList devices = m_adb.getDevicesSerialFromStdOut();
              ui->serialBox->clear();
              for (auto &item : devices) {
                  ui->serialBox->addItem(item);  // 添加到设备列表
              }
          }
          // 处理 adb shell ifconfig 命令结果
          else if (args.contains("ifconfig") && args.contains("wlan0")) {
              QString ip = m_adb.getDeviceIPFromStdOut();
              ui->deviceIpEdt->setEditText(ip);  // 显示 IP 地址
          }
          break;
      }
  });

  核心 ADB 命令封装:

  // 执行: adb devices
  m_adb.execute("", QStringList() << "devices");

  // 执行: adb -s <serial> shell ifconfig wlan0
  m_adb.execute(serial, QStringList() << "shell" << "ifconfig" << "wlan0");

  // 执行: adb -s <serial> tcpip 5555
  m_adb.execute(serial, QStringList() << "tcpip" << "5555");

  // 执行: adb connect <ip:port>
  m_adb.execute("", QStringList() << "connect" << addr);

  ---
  7️⃣ 技术方案总结

  完整的无线连接技术栈：

  用户点击"一键 WiFi 连接"
             ↓
  1. adb devices (查找 USB 设备)
             ↓
  2. adb shell ifconfig wlan0 (获取设备 IP)
             ↓
  3. adb tcpip 5555 (启动 TCP/IP 模式) ⭐ 关键步骤
             ↓
  4. adb connect 192.168.1.100:5555 (无线连接)
             ↓
  5. adb devices (验证 WiFi 设备已连接)
             ↓
  6. adb push scrcpy-server /data/local/tmp/
             ↓
  7. adb shell app_process ... (启动 scrcpy-server)
             ↓
  8. TCP 视频流传输 (设备 → PC)

  关键优势：

  ✅ 无需配对 - 利用 USB 信任关系
  ✅ 支持 Android 5.0+ - 无系统版本限制
  ✅ 无需 Root - 使用官方 ADB 协议
  ✅ 多设备支持 - 通过序列号区分管理
  ✅ 断开 USB - 切换到 WiFi 后可拔掉数据线

  ---
  8️⃣ 实际代码位置汇总

  | 功能                   | 文件路径                     | 行号      |
  |----------------------|--------------------------|---------|
  | 一键 WiFi 连接           | QtScrcpy/ui/dialog.cpp   | 691-726 |
  | 无线连接                 | QtScrcpy/ui/dialog.cpp   | 374-413 |
  | 启动 adbd (tcpip 5555) | QtScrcpy/ui/dialog.cpp   | 415-426 |
  | 获取设备 IP              | QtScrcpy/ui/dialog.cpp   | 459-497 |
  | 设备列表更新               | QtScrcpy/ui/dialog.cpp   | 322-329 |
  | 设备区分逻辑               | QtScrcpy/ui/dialog.cpp   | 668-689 |
  | 启动 scrcpy 服务         | QtScrcpy/ui/dialog.cpp   | 331-365 |
  | ADB 命令处理             | QtScrcpy/ui/dialog.cpp   | 48-106  |
  | 服务器路径配置              | QtScrcpy/ui/dialog.cpp   | 774-784 |
  | 配置文件                 | QtScrcpy/util/config.cpp | 全文件     |

  这就是 QtScrcpy 如何优雅地绕过 Android 11+ 配对要求，实现多设备无线连接的完整技术方案！🎉

> 也就是每台机器都需要先USB连接一次对吗。

● 是的，完全正确！ 每台设备都需要先通过 USB 连接一次。让我详细说明：

  🔄 USB 首次连接的必要性

  ✅ 必须先 USB 连接的原因：

  ┌─────────────────────────────────────────────┐
  │  为什么必须先 USB 连接？                      │
  ├─────────────────────────────────────────────┤
  │ 1. 建立 ADB 信任关系                          │
  │    - 手机弹出"允许 USB 调试"对话框             │
  │    - 用户授权该电脑                            │
  │                                               │
  │ 2. 执行关键命令: adb tcpip 5555               │
  │    - 只能通过 USB 连接执行                     │
  │    - 将 adbd 从 USB 模式切换到 TCP/IP 模式    │
  │                                               │
  │ 3. 无法远程启动 TCP/IP 模式                   │
  │    - WiFi 模式下无法执行 tcpip 命令            │
  │    - Android 安全机制限制                     │
  └─────────────────────────────────────────────┘

  ---
  📋 详细使用场景

  场景 1: 首次使用新设备

  # 步骤
  1. 📱 在手机上启用 USB 调试
  2. 🔌 USB 数据线连接手机和电脑
  3. 📲 手机弹出授权对话框 → 点击"允许"（勾选"始终允许"）
  4. 💻 QtScrcpy 点击"一键 WiFi 连接"
  5. ✅ 成功后可以拔掉 USB 线
  6. 📡 后续使用 WiFi 连接

  场景 2: 设备重启后

  ❌ 设备重启 → adbd 恢复为 USB 模式
  🔌 需要再次通过 USB 连接
  💻 重新执行 "adb tcpip 5555"
  ✅ 恢复 WiFi 连接

  场景 3: 已配置的设备（未重启）

  ✅ 直接 WiFi 连接即可
  💻 QtScrcpy 点击"无线连接"
  📡 输入之前保存的 IP:5555
  ✅ 无需 USB

  ---
  🔍 代码验证

  让我查看 README 中的说明：

● Read(pyapps\QtScrcpy\README.md)
  ⎿  Read 15 lines

● 完美！官方文档第 182 行明确说明：

  Note: it is not necessary to keep your Android device connected via USB after you start adbd.

  翻译：启动 adbd 后，不需要保持 USB 连接

  ---
  📊 完整使用流程图

  ┌─────────────────────────────────────────────────────────┐
  │                    第一次使用                              │
  ├─────────────────────────────────────────────────────────┤
  │ 1. 🔌 USB 连接手机                                         │
  │ 2. 📲 手机授权 USB 调试                                     │
  │ 3. 💻 QtScrcpy 执行: adb tcpip 5555                       │
  │ 4. 📡 QtScrcpy 执行: adb connect 192.168.x.x:5555        │
  │ 5. ✂️  拔掉 USB 线（可选）                                  │
  │ 6. ✅ 使用 WiFi 连接                                        │
  └─────────────────────────────────────────────────────────┘
                           ↓
  ┌─────────────────────────────────────────────────────────┐
  │              后续使用（设备未重启）                          │
  ├─────────────────────────────────────────────────────────┤
  │ 1. 📡 直接 WiFi 连接                                       │
  │ 2. ✅ 无需 USB                                             │
  └─────────────────────────────────────────────────────────┘
                           ↓
  ┌─────────────────────────────────────────────────────────┐
  │              设备重启后                                    │
  ├─────────────────────────────────────────────────────────┤
  │ ⚠️  TCP/IP 模式失效，adbd 恢复为 USB 模式                  │
  │ 🔌 需要再次通过 USB 执行 adb tcpip 5555                   │
  └─────────────────────────────────────────────────────────┘

  ---
  🔑 关键限制总结

  | 情况      | 需要 USB？ | 原因                  |
  |---------|---------|---------------------|
  | 首次连接新设备 | ✅ 必须    | 建立信任 + 启动 TCP/IP 模式 |
  | 设备重启后   | ✅ 必须    | TCP/IP 模式丢失，需重新启动   |
  | 切换电脑    | ✅ 必须    | 新电脑未被授权             |
  | 设备未重启   | ❌ 不需要   | TCP/IP 模式持续有效       |
  | 同一电脑重连  | ❌ 不需要   | 只要设备未重启             |

  ---
  💡 优化建议（如果想避免频繁插 USB）

  方案 1: 保持设备常开

  ✅ 不重启设备
  ✅ TCP/IP 模式持续有效
  ✅ 完全无线使用

  方案 2: 使用自动化脚本（需 Root）

  # 需要 Root 权限
  # 开机自动执行
  setprop service.adb.tcp.port 5555
  stop adbd
  start adbd

  方案 3: Android 11+ 配对方式（一次配对，永久有效）

  # 手机执行（开发者选项 → 无线调试）
  # 电脑执行
  adb pair 192.168.1.100:xxxxx  # 输入配对码
  adb connect 192.168.1.100:5555

  ✅ 配对后重启也有效
  ❌ 但 QtScrcpy 未实现此功能

  ---
  ✅ 结论

  是的，每台设备都需要先 USB 连接一次（或每次重启后），这是 Android ADB 的安全机制，不是 QtScrcpy 的限制。

  优点：
  - ✅ 安全：需要物理接触设备
  - ✅ 简单：无需复杂配置
  - ✅ 兼容：支持 Android 5.0+

  缺点：
  - ❌ 设备重启后需重新连接 USB
  - ❌ 无法完全无线初始化

  这就是为什么 QtScrcpy 能够"绕过配对"，但无法"绕过 USB 初始连接"的原因！

> 那么如果设备root了呢，如何直接就使用wireless连接。

● 非常好的问题！如果设备已 Root，完全可以绕过 USB 连接限制，直接使用无线连接。 让我给你详细的技术方案：

  🔓 Root 设备直接无线连接方案

  方案 1: 手机端直接启动 ADB over TCP/IP

  方法 A: 使用终端模拟器（Termux/Terminal Emulator）

  # 在手机终端执行（需要 Root）
  su
  setprop service.adb.tcp.port 5555
  stop adbd
  start adbd

  # 验证
  getprop service.adb.tcp.port
  # 输出: 5555

  方法 B: 通过 ADB 命令直接在设备上执行

  # 如果有一台已经通过 USB 连接的其他设备
  adb shell su -c "setprop service.adb.tcp.port 5555"
  adb shell su -c "stop adbd"
  adb shell su -c "start adbd"

  ---
  方案 2: 开机自动启动（最佳方案）

  使用 Magisk 模块 - ADB Enabler

  这是最简单的方法：

  1. 📱 安装 Magisk Manager
  2. 📦 安装 "ADB & Fastboot for Android NDK" 模块
     或 "Wireless ADB Switch" 模块
  3. 🔄 重启设备
  4. ✅ ADB over TCP/IP 自动在端口 5555 启动

  手动创建 Magisk 模块

  创建文件 /data/adb/service.d/adb_wifi.sh:

  #!/system/bin/sh
  # 等待系统启动完成
  sleep 30

  # 启动 ADB over TCP/IP
  setprop service.adb.tcp.port 5555
  stop adbd
  start adbd

  设置权限：
  chmod 755 /data/adb/service.d/adb_wifi.sh

  ---
  方案 3: 修改系统配置文件（永久生效）

  修改 build.prop

  # 挂载系统分区为可写
  mount -o remount,rw /system

  # 编辑 build.prop
  vi /system/build.prop

  # 添加以下行
  service.adb.tcp.port=5555
  persist.adb.tcp.port=5555

  # 保存后重启
  reboot

  或者使用 init.d 脚本

  创建 /system/etc/init.d/99adbwifi:

  #!/system/bin/sh
  setprop service.adb.tcp.port 5555
  stop adbd
  start adbd

  ---
  方案 4: 使用第三方 App（无需命令行）

  推荐 App：
  - ADB WiFi (需要 Root)
  - WiFi ADB - Debug Over Air
  - ADB Wireless (Root)

  操作步骤：
  1. 📱 安装 App
  2. 🔘 点击"启用无线 ADB"
  3. 📡 显示设备 IP 和端口
  4. ✅ 电脑端直接连接

  ---
  💻 电脑端连接方式

  获取设备 IP 地址

  方法 1: 手机查看
  设置 → 关于手机 → 状态信息 → IP 地址
  或
  设置 → WLAN → 当前连接的网络 → IP 地址

  方法 2: 路由器管理界面
  登录路由器 → 已连接设备列表 → 查找手机 IP

  电脑端直接连接

  # 直接连接（无需先 USB 连接）
  adb connect 192.168.1.100:5555

  # 验证连接
  adb devices
  # 输出:
  # List of devices attached
  # 192.168.1.100:5555    device

  # 使用 QtScrcpy
  # 在 IP 输入框输入: 192.168.1.100
  # 在端口输入框输入: 5555
  # 点击"无线连接"

  ---
  🔧 QtScrcpy 修改建议

  如果你想让 QtScrcpy 支持 Root 设备的直接无线连接，可以添加以下功能：

  添加"启用无线调试（Root）"按钮

  在 dialog.cpp 中添加新函数：

  void Dialog::on_enableWifiAdbRootBtn_clicked()
  {
      if (checkAdbRun()) {
          return;
      }

      QString serial = ui->serialBox->currentText().trimmed();
      if (serial.isEmpty()) {
          outLog("error: no device selected", false);
          return;
      }

      outLog("Enabling WiFi ADB via Root...", false);

      // 执行 Root 命令启用 TCP/IP
      QStringList adbArgs;
      adbArgs << "shell";
      adbArgs << "su";
      adbArgs << "-c";
      adbArgs << "setprop service.adb.tcp.port 5555 && stop adbd && start adbd";

      m_adb.execute(serial, adbArgs);

      // 延迟后获取 IP
      QTimer::singleShot(2000, this, [this]() {
          on_getIPBtn_clicked();
      });
  }

  或者添加"远程启用 ADB（Root）"功能

  如果已知设备 IP，但 ADB 未启用：

  void Dialog::on_remoteEnableAdbBtn_clicked()
  {
      QString ip = ui->deviceIpEdt->currentText().trimmed();
      if (ip.isEmpty()) {
          outLog("error: device IP is null", false);
          return;
      }

      // 通过 SSH 或其他方式连接设备
      // 需要手机安装 SSHDroid 等 SSH 服务器
      QString sshCommand = QString("ssh root@%1 \"setprop service.adb.tcp.port 5555 && stop adbd && start
  adbd\"").arg(ip);

      QProcess::execute(sshCommand);

      // 然后连接
      QTimer::singleShot(2000, this, [this]() {
          on_wirelessConnectBtn_clicked();
      });
  }

  ---
  📊 完整 Root 方案流程图

  ┌─────────────────────────────────────────────────────────┐
  │              Root 设备首次配置                            │
  ├─────────────────────────────────────────────────────────┤
  │ 选项 1: 安装 Magisk 模块                                  │
  │   📱 安装 "Wireless ADB Switch"                          │
  │   🔄 重启                                                 │
  │   ✅ 永久启用 TCP/IP 模式                                  │
  │                                                           │
  │ 选项 2: 手动执行命令                                       │
  │   📱 终端执行: su -c "setprop service.adb.tcp.port 5555" │
  │   🔄 重启 adbd                                            │
  │   ⚠️  每次重启需重新执行                                   │
  │                                                           │
  │ 选项 3: 修改 build.prop                                   │
  │   📝 添加: persist.adb.tcp.port=5555                      │
  │   🔄 重启                                                 │
  │   ✅ 永久生效                                              │
  └─────────────────────────────────────────────────────────┘
                           ↓
  ┌─────────────────────────────────────────────────────────┐
  │              电脑端直接无线连接                            │
  ├─────────────────────────────────────────────────────────┤
  │ 1. 📡 确保手机和电脑在同一局域网                            │
  │ 2. 🔍 获取手机 IP 地址                                     │
  │ 3. 💻 电脑执行: adb connect 192.168.1.100:5555            │
  │ 4. ✅ 直接连接成功！                                        │
  │ 5. 🎮 QtScrcpy 点击"启动服务"                              │
  └─────────────────────────────────────────────────────────┘
                           ↓
  ┌─────────────────────────────────────────────────────────┐
  │              后续使用                                      │
  ├─────────────────────────────────────────────────────────┤
  │ ✅ 完全无线                                                │
  │ ✅ 无需 USB                                                │
  │ ✅ 开机自动启用（如果配置了永久方案）                         │
  │ 📡 直接: adb connect 192.168.1.100:5555                  │
  └─────────────────────────────────────────────────────────┘

  ---
  🎯 最佳实践推荐

  推荐方案：Magisk 模块 + 自动化脚本

  1. 手机端配置（一次性）

  # 安装 Magisk 模块或创建脚本
  # 文件: /data/adb/service.d/adb_wifi.sh

  #!/system/bin/sh
  # 等待网络就绪
  until [ "$(getprop sys.boot_completed)" = "1" ]; do
      sleep 1
  done

  # 等待 WiFi 连接
  until [ "$(getprop wlan.driver.status)" = "ok" ]; do
      sleep 1
  done

  # 启动 ADB over TCP/IP
  setprop service.adb.tcp.port 5555
  stop adbd
  start adbd

  # 记录日志
  echo "ADB WiFi enabled on port 5555" >> /data/adb/adb_wifi.log

  2. 电脑端脚本（自动发现和连接）

  #!/bin/bash
  # auto_connect_adb.sh

  # 扫描局域网中的 ADB 设备
  echo "Scanning for ADB devices on network..."

  # 获取本机 IP 段
  LOCAL_IP=$(ip route get 1 | awk '{print $7}' | head -1)
  SUBNET=$(echo $LOCAL_IP | cut -d. -f1-3)

  # 扫描端口 5555
  for i in {1..254}; do
      IP="$SUBNET.$i"
      timeout 0.2 bash -c "echo >/dev/tcp/$IP/5555" 2>/dev/null && {
          echo "Found ADB device at $IP:5555"
          adb connect $IP:5555
      } &
  done
  wait

  echo "Scan complete!"
  adb devices

  3. QtScrcpy 集成

  在 dialog.cpp 添加自动扫描功能：

  void Dialog::on_scanWifiDevicesBtn_clicked()
  {
      outLog("Scanning for WiFi ADB devices...", false);

      // 获取本机 IP 段
      QString localIP = getLocalIP();
      QString subnet = localIP.section('.', 0, 2);

      // 扫描 5555 端口
      for (int i = 1; i <= 254; i++) {
          QString ip = QString("%1.%2").arg(subnet).arg(i);

          QTcpSocket *socket = new QTcpSocket(this);
          socket->connectToHost(ip, 5555);

          QTimer::singleShot(200, this, [this, socket, ip]() {
              if (socket->state() == QTcpSocket::ConnectedState) {
                  outLog(QString("Found ADB device at %1:5555").arg(ip), true);

                  // 自动连接
                  QStringList adbArgs;
                  adbArgs << "connect" << QString("%1:5555").arg(ip);
                  m_adb.execute("", adbArgs);
              }
              socket->deleteLater();
          });
      }
  }

  ---
  ⚠️ 安全注意事项

  Root + WiFi ADB 的安全风险

  ⚠️  风险:
  1. 局域网内任何设备都可以连接你的手机
  2. 可以执行任意命令（包括安装/卸载 App）
  3. 可以访问文件系统

  ✅ 防护措施:
  1. 仅在可信网络启用
  2. 不使用时关闭 TCP/IP 模式
  3. 使用防火墙限制端口访问
  4. 考虑使用 VPN 隔离

  关闭 WiFi ADB

  # 手机端执行
  su -c "setprop service.adb.tcp.port -1"
  su -c "stop adbd"
  su -c "start adbd"

  # 或者电脑端执行
  adb shell su -c "setprop service.adb.tcp.port -1 && stop adbd && start adbd"

  ---
  📝 总结对比

  | 方案                | 需要 Root | 需要 USB | 重启后有效 | 复杂度 |
  |-------------------|---------|--------|-------|-----|
  | 标准方式              | ❌       | ✅      | ❌     | 简单  |
  | Root + 临时启用       | ✅       | ❌      | ❌     | 中等  |
  | Root + build.prop | ✅       | ❌      | ✅     | 中等  |
  | Root + Magisk 模块  | ✅       | ❌      | ✅     | 简单  |
  | Android 11+ 配对    | ❌       | ❌      | ✅     | 中等  |

  ---
  ✅ 结论

  如果设备已 Root，完全可以实现"完全无线"连接：

  1. 最简单: 安装 Magisk 模块（一键启用，开机自动）
  2. 最灵活: 手动执行 setprop 命令（随时开关）
  3. 最持久: 修改 build.prop（永久生效）

  推荐使用 Magisk 模块方案，配合自动扫描脚本，可以实现：
  - ✅ 完全无线
  - ✅ 开机自启
  - ✅ 多设备管理
  - ✅ 无需 USB

  这样 QtScrcpy 就可以真正做到"即开即用"的无线投屏体验！🎉