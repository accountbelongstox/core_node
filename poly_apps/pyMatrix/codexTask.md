连接与部署

  - 支持最多 1000 台设备并在 adb reverse 端口耗尽时自动回落到 adb forward，同时为新设备分配空闲端口
    27183+（poly_apps/qtscrcpy_tc/SmartMatrix/devicemanage/devicemanage.cpp:16, poly_apps/qtscrcpy_tc/
    SmartMatrix/devicemanage/devicemanage.cpp:34）。
  - 每台设备启动 scrcpy server 时可配置分辨率、码率、帧率、裁剪、方向锁定与常亮参数（poly_apps/
    qtscrcpy_tc/SmartMatrix/device/server/server.h:27, poly_apps/qtscrcpy_tc/SmartMatrix/device/
    device.cpp:304）。
  - 自适应多种连接场景：ADB 路径解析、设备列表/无线 IP 解析、端口转发、反向隧道、服务器推送、文件
    删除等命令封装（poly_apps/qtscrcpy_tc/SmartMatrix/adb/adbprocess.cpp:25, poly_apps/qtscrcpy_tc/
    SmartMatrix/adb/adbprocess.cpp:117, poly_apps/qtscrcpy_tc/SmartMatrix/adb/adbprocess.cpp:183,
    poly_apps/qtscrcpy_tc/SmartMatrix/adb/adbprocess.cpp:201, poly_apps/qtscrcpy_tc/SmartMatrix/
    adb/adbprocess.cpp:219, poly_apps/qtscrcpy_tc/SmartMatrix/adb/adbprocess.cpp:228, poly_apps/
    qtscrcpy_tc/SmartMatrix/adb/adbprocess.cpp:237）。
  - 设备级开关如自动息屏、保持唤醒、是否显示画面、无边框窗口、键位脚本等均可在连接参数中配置
    （poly_apps/qtscrcpy_tc/SmartMatrix/device/device.h:28）。

  视频与渲染

  - 建立 “Server → TCP 流 → FFmpeg 解码 → VideoBuffer → OpenGL 渲染” 的完整播放链路，并按配置决定
    是否写入录像（poly_apps/qtscrcpy_tc/SmartMatrix/device/device.cpp:32, poly_apps/qtscrcpy_tc/
    SmartMatrix/device/stream/stream.h:24, poly_apps/qtscrcpy_tc/SmartMatrix/device/device.cpp:55）。
  - 多设备画面自动插入主界面网格，列数由配置控制，可选无边框窗口与皮肤模式（poly_apps/qtscrcpy_tc/
    SmartMatrix/device/device.cpp:42, poly_apps/qtscrcpy_tc/SmartMatrix/device/device.h:44）。
  - 使用 QYUVOpenGLWidget 渲染并叠加绿色 FPS 指示器，可随时开关（poly_apps/qtscrcpy_tc/SmartMatrix/
    device/ui/videoform.cpp:36, poly_apps/qtscrcpy_tc/SmartMatrix/device/ui/videoform.cpp:151）。

  输入与控制

  - 设备信号涵盖全套系统按键、文本、剪贴板、文件推送、截图与触摸可视化开关，供工具栏和群控复用
    （poly_apps/qtscrcpy_tc/SmartMatrix/device/device.h:70）。
  - 控制层将上述信号转换为 scrcpy 控制消息，支持返回/主页/菜单/电源/音量、通知栏操作、屏幕电源模
    式、文本注入与剪贴板同步（poly_apps/qtscrcpy_tc/SmartMatrix/device/controller/controller.cpp:68,
    poly_apps/qtscrcpy_tc/SmartMatrix/device/controller/controller.cpp:112, poly_apps/qtscrcpy_tc/
    SmartMatrix/device/controller/controller.cpp:140, poly_apps/qtscrcpy_tc/SmartMatrix/device/
    controller/controller.cpp:168）。
  - 工具条为每个按钮绑定多机广播，例如截屏、音量、全屏、显示触摸、群控开关等（poly_apps/
    qtscrcpy_tc/SmartMatrix/device/ui/toolform.cpp:35, poly_apps/qtscrcpy_tc/SmartMatrix/device/
    ui/toolform.cpp:230, poly_apps/qtscrcpy_tc/SmartMatrix/device/ui/toolform.cpp:248, poly_apps/
    qtscrcpy_tc/SmartMatrix/device/ui/toolform.cpp:320, poly_apps/qtscrcpy_tc/SmartMatrix/device/
    ui/toolform.cpp:340）。
  - 支持普通与游戏两套输入转换，JSON 键位脚本可定义多点触控、延迟多击、拖拽、方向盘与鼠标视角模
    式，开启后自动锁定鼠标并映射到设备坐标（poly_apps/qtscrcpy_tc/SmartMatrix/device/controller/
    controller.cpp:43, poly_apps/qtscrcpy_tc/SmartMatrix/device/controller/inputconvert/
    inputconvertgame.cpp:14, poly_apps/qtscrcpy_tc/SmartMatrix/device/controller/inputconvert/keymap/
    keymap.h:38, poly_apps/qtscrcpy_tc/SmartMatrix/device/device.cpp:340）。

  多设备编组

  - 读取 deviceGroups.json 构建分组树，维护组内设备脚本、选中状态与存在性标记（poly_apps/qtscrcpy_tc/
    SmartMatrix/groupmanage/devicegroups/devicegroups.cpp:16, poly_apps/qtscrcpy_tc/SmartMatrix/
    groupmanage/devicegroups/devicegroups.cpp:55）。
  - 群控主机建立与所有客户端的工具栏信号链，并在输入事件时广播鼠标/键盘/滚轮操作（poly_apps/
    qtscrcpy_tc/SmartMatrix/devicemanage/devicemanage.cpp:122, poly_apps/qtscrcpy_tc/SmartMatrix/
    devicemanage/devicemanage.cpp:168, poly_apps/qtscrcpy_tc/SmartMatrix/devicemanage/
    devicemanage.cpp:230）。
  - 工具条可视化当前群控角色（自由/主机/客户端）并允许一键切换（poly_apps/qtscrcpy_tc/SmartMatrix/
    device/ui/toolform.cpp:68, poly_apps/qtscrcpy_tc/SmartMatrix/device/ui/toolform.cpp:340）。

  采集与录制

  - 录像支持 MP4/MKV，既可边显示边录，也可纯后台录制（poly_apps/qtscrcpy_tc/SmartMatrix/device/
    device.cpp:55, poly_apps/qtscrcpy_tc/SmartMatrix/device/recorder/recorder.h:19, poly_apps/
    qtscrcpy_tc/SmartMatrix/device/device.cpp:24）。
  - 支持 PNG 截图，文件名按时间戳与自定义标题生成，保存到用户设定目录（poly_apps/qtscrcpy_tc/
    SmartMatrix/device/device.cpp:365）。
  - 可远程开启/关闭设备触摸显示与 FPS 指示（poly_apps/qtscrcpy_tc/SmartMatrix/device/device.cpp:129,
    poly_apps/qtscrcpy_tc/SmartMatrix/devicemanage/devicemanage.cpp:82）。

  文件与剪贴板

  - ADB 文件推送与 APK 安装统一封装并向 UI 发出成功/失败状态（poly_apps/qtscrcpy_tc/SmartMatrix/
    device/device.h:88, poly_apps/qtscrcpy_tc/SmartMatrix/device/filehandler/filehandler.cpp:9,
    poly_apps/qtscrcpy_tc/SmartMatrix/device/filehandler/filehandler.cpp:20）。
  - 电脑与手机剪贴板双向同步，支持直接粘贴文本与触发复制/剪切命令（poly_apps/qtscrcpy_tc/SmartMatrix/
    device/controller/controller.cpp:112, poly_apps/qtscrcpy_tc/SmartMatrix/device/controller/
    controller.cpp:149, poly_apps/qtscrcpy_tc/SmartMatrix/device/controller/controller.cpp:162,
    poly_apps/qtscrcpy_tc/SmartMatrix/device/controller/receiver/receiver.cpp:39）。

  配置与用户偏好

  - userdata.ini 记录录像路径、分辨率档位、录像格式、反向连接、置顶、自动息屏、简单模式等启动偏好
    （poly_apps/qtscrcpy_tc/SmartMatrix/util/config.h:8, poly_apps/qtscrcpy_tc/SmartMatrix/util/
    config.cpp:64, poly_apps/qtscrcpy_tc/SmartMatrix/util/config.cpp:90）。
  - 全局配置提供标题、scrcpy 版本、最大帧率、OpenGL 模式、服务器/ADB 路径、编解码选项以及文件推送目录
    （poly_apps/qtscrcpy_tc/SmartMatrix/util/config.cpp:214, poly_apps/qtscrcpy_tc/SmartMatrix/util/
    config.cpp:230, poly_apps/qtscrcpy_tc/SmartMatrix/util/config.cpp:248）。
  - 为每台设备保存昵称与窗口坐标，并通过静态列数控制主界面网格布局（poly_apps/qtscrcpy_tc/SmartMatrix/
    util/config.cpp:200, poly_apps/qtscrcpy_tc/SmartMatrix/util/config.cpp:214, poly_apps/qtscrcpy_tc/
    SmartMatrix/util/config.cpp:61, poly_apps/qtscrcpy_tc/SmartMatrix/device/device.cpp:42）。
  - 记录已连接群组便于恢复状态（poly_apps/qtscrcpy_tc/SmartMatrix/util/config.cpp:240）。

  界面与平台

  - 主窗口使用自定义标题栏，提供最小化/最大化/重启/关闭按钮，并在关闭与重启前确认和安全断开设
    备（poly_apps/qtscrcpy_tc/SmartMatrix/mainwindow.cpp:52, poly_apps/qtscrcpy_tc/SmartMatrix/
    mainwindow.cpp:99, poly_apps/qtscrcpy_tc/SmartMatrix/mainwindow.cpp:184）。
  - 程序托盘图标与全局鼠标钩子提升用户体验及游戏模式鼠标捕获（poly_apps/qtscrcpy_tc/SmartMatrix/
    mainwindow.cpp:32, poly_apps/qtscrcpy_tc/SmartMatrix/main.cpp:95, poly_apps/qtscrcpy_tc/
    SmartMatrix/device/device.cpp:340）。
  - 启动时按配置选择 OpenGL 后端、加载统一 QSS 皮肤、设置无边框并最大化；退出前释放资源（poly_apps/
    qtscrcpy_tc/SmartMatrix/main.cpp:50, poly_apps/qtscrcpy_tc/SmartMatrix/main.cpp:99, poly_apps/
    qtscrcpy_tc/SmartMatrix/main.cpp:112, poly_apps/qtscrcpy_tc/SmartMatrix/main.cpp:124）。
  - 内置中英文翻译包，依据系统语言自动选择（poly_apps/qtscrcpy_tc/SmartMatrix/main.cpp:132）。

  这些要点覆盖了 qtscrcpy_tc 在设备连接、图像渲染、远程控制、群控协同、采集存储、文件分发、配置管理以
  及界面体验方面提供的全部核心功能。