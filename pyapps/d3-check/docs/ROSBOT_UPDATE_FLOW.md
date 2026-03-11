# ROSBOT 更新流程说明

## 前置条件

- **战网区服已探测**：仅当 UI/状态中已显示战网为**亚服**或**国服**时执行更新检查；未探测到区服则**跳过**，不查 zip、不弹窗。
- **区服与版本对应**：**CN = 国服**（仅国服）；**Asia = 亚服 + 国际服**。版本号按区服分开：目录名为 `Asia_版本号` 或 `CN_版本号`，同一版本号在亚服与国服对应不同目录（如 `Asia_36.0129` 与 `CN_36.0129`）。
- 常量：`D:\applications\GameTools`（`ROSBOT_GAMETOOLS_BASE`），zip 大于 20M，匹配区服关键字（亚服/国服/asia/cn 等）。

## 流程概览

1. 检查战网区服（`game_interface_data.get_battlenet_region()`）：非 `asia`/`cn` 则跳过。
2. 在**下载目录**（Downloads）查找 zip：大于 20M、文件名匹配当前区服（亚服→亚服/asia，国服→国服/cn），按版本降序取「比当前新」的一个。
3. **是否更新**：必须**弹出对话框**「是否更新ROSBOT？」；用户选「是」才继续（若开启「自动使用最新 ROS」则可不弹窗直接更新）。
4. 创建目录、解压、找 exe、移动目录、更新 CONFIG。

## 目录命名与路径

- 在 `D:\applications\GameTools\` 下创建目录：**英文区服_版本号**  
  - 亚服 → `Asia_36.0129`  
  - 国服 → `CN_36.0129`  
- 版本号从 zip 文件名解析（如两段数字 `36.0129`）。

## 解压与查找 exe

- 将 zip **解压到上述目录**（如 `GameTools\Asia_36.0129\`）。
- 在该目录下**递归查找** `RoS-BoT.exe`（或 `ros-bot*.exe`），得到 exe 的完整路径。
- **只关心 exe 所在目录**，不管理该目录外的其他文件/子目录。

## 重命名并移动目录

- 将 **RoS-BoT.exe 所在目录** 重命名并移动到：  
  `D:\applications\GameTools\{区服}_版本号\RosBot\`  
- 即最终 exe 路径为：  
  `D:\applications\GameTools\Asia_36.0129\RosBot\RoS-BoT.exe`  
  或  
  `D:\applications\GameTools\CN_36.0129\RosBot\RoS-BoT.exe`  
- 「RosBot」为固定重命名后的目录名（`ROSBOT_FINAL_DIR_NAME`）。

## 配置与后续

- 复制旧 ROSBOT 目录下的 `RoS-BoT.ini` 到新目录（若存在）。
- 更新 **CONFIG**：`ros_settings.ros_directory` 设为新目录（即 `...\Asia_36.0129\RosBot` 或 `...\CN_36.0129\RosBot`）。
- 是否更新需**弹出对话框**确认（除非勾选自动使用最新 ROS，则按配置直接更新）。

## 与 E 块关系

- 点击「启动 ROSBOT」后、真正启动前执行上述检查（`do_login_check` 内）；若开启「自动使用最新 ROS」或在「Update ROSBOT」流程中，则 E3 分支会执行 E3a–E3f（找 zip、更新目录、再启动）。
- 流程图见 `ROSBOT_FLOW_MERMAID.md` 中 E 子图（E3a 下载目录找 zip，E3b 是否更新，E3c 解压到 GameTools，E3d 复制配置，E3e 更新路径，E3f 启动）。
