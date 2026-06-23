# AppFactory Multi-Role System - Feature Requirements
# 多角色系统功能需求清单

## 🔵 Admin Dashboard - 管理端必要功能

### 1. APP Generation & Management - APP生成与管理
#### 1.1 Daily APP Generation - 每日APP生成
- [ ] **APP生成表单** - APP Generation Form
  - 输入APP名称、类别、描述
  - 选择目标用户群体
  - AI自动生成功能建议（Gemini集成）
  - 选择技术负责人

- [ ] **批量生成** - Batch Generation
  - 一次生成多个APP
  - 使用模板快速创建
  - 预设配置保存

- [ ] **生成队列** - Generation Queue
  - 查看待生成APP列表
  - 实时生成进度
  - 预计完成时间
  - 生成历史记录

#### 1.2 APP List & Status - APP列表与状态
- [ ] **APP总览** - APP Overview
  - 所有APP列表（15+个）
  - 实时状态：Live, Pending, Generating, Failed, Idle
  - 快速筛选和搜索
  - 分类过滤（8个类别）

- [ ] **访问统计** - Visit Statistics
  - 每个APP的实时访问量
  - 今日访问 / 本周访问 / 本月访问
  - 访问趋势图表
  - 每日活跃用户(DAU)

- [ ] **状态管理** - Status Management
  - 一键上线/下线APP
  - 批量状态修改
  - 状态变更历史
  - 失败APP重新生成

#### 1.3 APP Details - APP详细信息
- [ ] **单个APP详情页** - Individual APP Detail Page
  - 完整统计数据
  - 访问量曲线图
  - 收入明细
  - 分配的客服列表
  - 技术负责人信息
  - 用户评分和反馈

- [ ] **APP配置** - APP Configuration
  - 修改APP描述
  - 更新功能列表
  - 调整目标用户群
  - 上传APP图标/截图

### 2. CS Team Management - 客服团队管理

#### 2.1 CS Assignment - 客服分配（多对多）
- [ ] **分配界面** - Assignment Interface
  - 拖拽式分配CS到APP
  - 一个APP可分配多个CS
  - 一个CS可管理多个APP
  - 批量分配功能

- [ ] **分配规则** - Assignment Rules
  - 自动负载均衡
  - 按经验分配
  - 按专长分配（类别匹配）
  - 分配历史记录

- [ ] **佣金设置** - Commission Settings
  - 为每个CS设置佣金比例（10%-20%）
  - 不同APP不同佣金率
  - 佣金计算规则配置
  - 佣金审核和发放

#### 2.2 CS Performance - 客服绩效
- [ ] **绩效排行榜** - Performance Leaderboard
  - 按收入排名
  - 按推广数量排名
  - 按客户满意度排名
  - 本周/本月/全年榜单

- [ ] **KPI监控** - KPI Monitoring
  - 每个CS的推广转化率
  - 平均响应时间
  - 客户满意度评分
  - 目标完成度

### 3. Revenue Management - 收益管理

#### 3.1 Revenue Overview - 收益总览
- [ ] **总体收益** - Overall Revenue
  - 今日/本周/本月/全年收益
  - 收益趋势图表
  - 收益同比增长
  - 收益预测

- [ ] **APP收益排名** - APP Revenue Ranking
  - Top 10 收益APP
  - 收益增长最快APP
  - 收益下降警报
  - 类别收益对比

#### 3.2 CS Revenue - 客服收益
- [ ] **CS佣金统计** - CS Commission Statistics
  - 每个CS的总佣金
  - CS推广收益明细
  - 佣金发放记录
  - 欠款提醒

- [ ] **APP-CS收益矩阵** - APP-CS Revenue Matrix
  - 查看每个APP的每个CS贡献
  - 推广成功次数
  - 推广转化率
  - 收益分配比例

### 4. System Analytics - 系统分析

- [ ] **Dashboard总览** - Dashboard Overview
  - 关键指标卡片（KPI Cards）
    - 总APP数量
    - Live APP数量
    - 总访问量
    - 总收益
    - 在线CS人数
    - 可用技术人员

- [ ] **趋势分析** - Trend Analysis
  - 访问量趋势（7天/30天/90天）
  - 收益趋势
  - 新增APP趋势
  - 用户增长趋势

- [ ] **数据导出** - Data Export
  - 导出收益报表（Excel/PDF）
  - 导出APP列表
  - 导出CS绩效报告
  - 自定义报表生成

### 5. Tech Team Management - 技术团队管理

- [ ] **技术人员列表** - Tech Member List
  - 查看所有技术人员
  - 在线状态（Available/Busy/Offline）
  - 专长领域（Frontend/Backend/Full Stack/DevOps）
  - 已生成APP数量

- [ ] **任务分配** - Task Assignment
  - 分配生成任务给技术人员
  - 工作负载查看
  - 任务优先级设置
  - 任务进度跟踪

---

## 🟢 CS Dashboard - 客服端必要功能

### 1. Personal Overview - 个人总览

- [ ] **个人数据看板** - Personal Dashboard
  - 我的总收益
  - 本月收益
  - 今日推广次数
  - 我的佣金率
  - 在线状态切换

- [ ] **目标进度** - Goal Progress
  - 月度收益目标
  - 推广数量目标
  - 完成度百分比
  - 距离目标差距

### 2. My Apps - 我的APP

#### 2.1 Assigned Apps List - 分配给我的APP列表
- [ ] **APP卡片视图** - APP Card View
  - 显示我负责的所有APP（2-4个）
  - APP状态（Live/Pending/Idle）
  - 今日访问量
  - 今日收益
  - APP评分

- [ ] **APP筛选** - APP Filtering
  - 按状态筛选
  - 按类别筛选
  - 按收益排序
  - 按访问量排序

#### 2.2 APP Details - APP详情
- [ ] **访问统计** - Visit Statistics
  - 查看单个APP的访问趋势
  - 访问来源分析
  - 访客地域分布
  - 峰值时段分析

- [ ] **用户反馈** - User Feedback
  - 查看用户评价
  - 用户问题列表
  - 响应用户咨询
  - 满意度评分

### 3. Revenue & Commission - 收益与佣金

#### 3.1 My Revenue - 我的收益
- [ ] **收益明细** - Revenue Details
  - 每个APP的收益贡献
  - 我的佣金明细
  - 推广成功记录
  - 佣金计算说明

- [ ] **收益趋势** - Revenue Trends
  - 每日收益曲线
  - 每周/每月对比
  - 收益增长率
  - 收益预测

#### 3.2 Promotion Records - 推广记录
- [ ] **推广历史** - Promotion History
  - 我的所有推广记录
  - 推广渠道
  - 转化率统计
  - 成功/失败推广

- [ ] **佣金记录** - Commission Records
  - 已发放佣金
  - 待发放佣金
  - 佣金发放时间
  - 佣金明细账单

### 4. Performance Analytics - 绩效分析

- [ ] **我的排名** - My Ranking
  - 团队中的收益排名
  - 推广数量排名
  - 本月进步情况
  - 与团队平均对比

- [ ] **绩效报告** - Performance Report
  - 周报/月报
  - 关键指标总结
  - 改进建议
  - 历史绩效对比

### 5. Quick Actions - 快捷操作

- [ ] **推广工具** - Promotion Tools
  - 生成推广链接
  - 分享到社交媒体
  - 推广素材下载
  - 推广话术模板

- [ ] **客户管理** - Customer Management
  - 我的客户列表
  - 客户跟进记录
  - 客户标签分类
  - 客户互动历史

---

## 🟡 Tech Dashboard - 技术端必要功能

### 1. Work Overview - 工作总览

- [ ] **个人工作台** - Personal Workbench
  - 我的待办任务
  - 进行中的项目
  - 已完成APP数量
  - 我的专长领域
  - 在线状态切换

- [ ] **工作负载** - Workload
  - 当前任务数
  - 预计工作时间
  - 任务优先级列表
  - 紧急任务提醒

### 2. APP Generation Queue - APP生成队列

#### 2.1 Task List - 任务列表
- [ ] **待处理任务** - Pending Tasks
  - 分配给我的生成任务
  - 任务详情（名称、类别、要求）
  - 预计完成时间
  - 任务优先级

- [ ] **进行中任务** - In-Progress Tasks
  - 当前正在开发的APP
  - 完成进度百分比
  - 剩余工作量
  - 遇到的问题/阻塞

#### 2.2 Task Details - 任务详情
- [ ] **需求文档** - Requirements Document
  - APP功能需求
  - 目标用户群
  - 技术要求
  - UI/UX设计要求

- [ ] **AI生成建议** - AI Generated Suggestions
  - Gemini生成的功能建议
  - 推荐技术栈
  - 类似APP参考
  - 最佳实践建议

### 3. APP Development - APP开发

#### 3.1 Code Management - 代码管理
- [ ] **代码编辑器** - Code Editor
  - 在线代码编辑（如需要）
  - 代码模板库
  - 快速脚手架
  - 代码片段管理

- [ ] **版本控制** - Version Control
  - Git集成
  - 提交历史
  - 分支管理
  - 代码审查

#### 3.2 Build & Deployment - 构建与部署
- [ ] **构建管理** - Build Management
  - 一键构建APP
  - 构建日志查看
  - 构建错误提示
  - 构建历史记录

- [ ] **部署管理** - Deployment Management
  - 一键部署到测试环境
  - 一键部署到生产环境
  - 部署状态监控
  - 回滚功能

### 4. APP Monitoring - APP监控

- [ ] **已完成APP** - Completed Apps
  - 我开发的所有APP列表
  - APP当前状态
  - APP性能指标
  - 用户反馈

- [ ] **性能监控** - Performance Monitoring
  - APP响应时间
  - 错误率
  - 崩溃报告
  - 资源使用情况

- [ ] **Bug追踪** - Bug Tracking
  - Bug列表
  - Bug优先级
  - Bug修复状态
  - Bug分配和跟进

### 5. Technical Tools - 技术工具

- [ ] **Gemini AI集成** - Gemini AI Integration
  - 使用AI辅助开发
  - 代码生成
  - Bug修复建议
  - 性能优化建议

- [ ] **模板管理** - Template Management
  - APP模板库
  - 组件库
  - 配置模板
  - 快速克隆

- [ ] **文档中心** - Documentation Center
  - 技术文档
  - API文档
  - 最佳实践
  - 常见问题解答

### 6. Team Collaboration - 团队协作

- [ ] **团队看板** - Team Board
  - 查看其他技术人员的任务
  - 任务分配情况
  - 团队进度
  - 寻求帮助

- [ ] **知识共享** - Knowledge Sharing
  - 技术文章
  - 代码分享
  - 问题讨论
  - 经验总结

---

## 🔄 Common Features - 通用功能（三端共享）

### 1. Authentication - 身份认证
- [ ] **登录系统** - Login System
  - 邮箱/密码登录
  - 记住登录状态
  - 自动登出（超时）
  - 密码重置

- [ ] **权限控制** - Permission Control
  - 基于角色的路由保护
  - 功能权限检查
  - 数据权限隔离
  - 操作日志记录

### 2. Notifications - 通知系统
- [ ] **实时通知** - Real-time Notifications
  - 新任务通知
  - 收益更新通知
  - 系统公告
  - APP状态变更通知

- [ ] **通知中心** - Notification Center
  - 未读通知数量
  - 通知历史
  - 通知筛选
  - 通知设置

### 3. Profile Management - 个人资料管理
- [ ] **个人信息** - Personal Information
  - 修改姓名、邮箱
  - 上传头像
  - 修改电话
  - 更新个人简介

- [ ] **安全设置** - Security Settings
  - 修改密码
  - 双因素认证
  - 登录历史
  - 设备管理

### 4. Settings - 设置
- [x] **语言设置** - Language Settings（已完成）
  - 中文/English切换
  - 即时生效

- [x] **主题设置** - Theme Settings（已完成）
  - Light/Dark模式
  - 跟随系统

- [ ] **通知设置** - Notification Settings
  - 邮件通知开关
  - 浏览器通知开关
  - 通知频率设置

---

## 📊 Priority Matrix - 优先级矩阵

### 🔴 High Priority - 高优先级（必须立即实现）

#### Admin端
1. APP生成表单 + Gemini AI集成
2. APP列表与状态管理
3. CS分配界面（多对多）
4. 收益总览和统计

#### CS端
1. 我的APP列表
2. 收益明细和佣金查看
3. 推广记录

#### Tech端
1. APP生成队列
2. 任务详情查看
3. 构建和部署功能

### 🟠 Medium Priority - 中优先级（核心功能）

#### Admin端
1. APP详情页
2. CS绩效排行榜
3. 数据导出
4. 技术团队管理

#### CS端
1. 访问统计和趋势
2. 我的排名
3. 推广工具

#### Tech端
1. 性能监控
2. Bug追踪
3. Gemini AI辅助开发

### 🟡 Low Priority - 低优先级（增强功能）

#### Admin端
1. 批量操作
2. 高级筛选
3. 自定义报表

#### CS端
1. 客户管理
2. 绩效报告

#### Tech端
1. 团队协作看板
2. 知识共享

---

## 🎯 Implementation Roadmap - 实施路线图

### Sprint 1 (Week 1-2): 基础架构
- [ ] 角色路由系统
- [ ] 三端Dashboard框架
- [ ] 基础布局和导航

### Sprint 2 (Week 3-4): Admin核心功能
- [ ] APP生成系统
- [ ] APP列表和管理
- [ ] CS分配功能

### Sprint 3 (Week 5-6): CS核心功能
- [ ] 我的APP列表
- [ ] 收益统计
- [ ] 推广记录

### Sprint 4 (Week 7-8): Tech核心功能
- [ ] 任务队列
- [ ] 构建部署
- [ ] 监控工具

### Sprint 5 (Week 9-10): 增强和优化
- [ ] 数据可视化
- [ ] 性能优化
- [ ] 用户体验优化

---

## 📝 Notes - 备注

- 所有功能支持中英文双语
- 所有数据实时更新，变更立即反映
- 支持Dark/Light主题切换
- 所有操作支持撤销
- 关键操作需要确认弹窗
- 数据定期自动保存到localStorage
- 支持数据导出和备份
