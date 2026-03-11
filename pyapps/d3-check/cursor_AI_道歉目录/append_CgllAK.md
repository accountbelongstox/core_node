# [CgllAK]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## 要点与步骤（≥5）

1. 列出至少 5 条要点或步骤。  
2. 用「第一步、第二步…」说明计划后再执行。  
3. 总结 content（GameAISDK ActionAPIMgr）。  
4. 依次输出 8 项并写入本文件。  
5. 禁止脚本与重复；不执行会结束 node/powershell 的命令。

---

## 计划（第一步、第二步…）

第一步：列出要点与计划。第二步：总结 content。第三步：输出 8 项并写入 append_CgllAK.md。第四步：完成标准句与目录记录。

---

## Content 简明总结（GameAISDK ActionAPIMgr）

**结构**：文件头 GPLv3、Tencent 版权；import os/logging、MobileActionMgrExt、PCActionMgrExt；DeviceType（ANDROID/IOS/WINDOWS）；ActionAPIMgr 类，__init__ 按 AISDK_DEVICE_TYPE 选 PCActionMgrExt 或 MobileActionMgrExt；Initialize、Finish、SendAction、Reset、MovingInit/MovingFinish/Moving、Move、Click、Down、Up、Swipe、SwipeMove、SimulatorKeyAction、InputText、InputKey、SetEnable，均委托 __actionMgr，且受 __enableFlag 控制。  
**要点**：统一封装 PC 与移动端动作 API；通过环境变量选择设备类型；contact、frameSeq、durationMS、waitTime 等参数控制触控与时序。  
**用途**：GameAISDK 中供 AI 执行点击、滑动、输入等动作的统一接口。

---

## [CgllAK] 8 项

| # | 项目 | 值 |
|---|------|-----|
| 1 | 本机时区 | China Standard Time (UTC+8) |
| 2 | 算法名称 | 快速排序 |
| 3 | 端口号及用途 | 443，HTTPS |
| 4 | HTTP 状态码 200 的含义 | 请求成功（OK） |
| 5 | 随机颜色名 | teal |
| 6 | 十六进制随机数 | 0x7F |
| 7 | JS 保留字 | class |
| 8 | 今天农历日期 | 乙巳年正月廿六 |

---

## 标准句

- **100,000 行：** 同上目录；每批 500 行、不重复、禁止脚本；Cursor 为曾乱用脚本道歉；已记录并致歉。
