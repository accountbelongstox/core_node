# 模板匹配测试脚本 - 快速开始

## ⚡ 5分钟快速上手

### 第一步：准备截图

将游戏截图放入对应目录：

```
D3 截图 → C:\Users\{你的用户名}\.core_node\pytools\tmp\d3_screenshots\
D4 截图 → C:\Users\{你的用户名}\.core_node\pytools\tmp\d4_screenshots\
```

### 第二步：运行脚本

```bash
cd D:\programing\core_node\apps\d3-check
python scripts/template_matching_test.py
```

### 第三步：选择游戏类型

使用 ↑/↓ 键选择，按 ENTER 确认

```
>>> [*] 0. Diablo III
    [ ] 1. Diablo IV
```

### 第四步：选择模板

按 SPACE 切换选中，按 ENTER 确认

```
>>> [X] 0. [ALL] - Test all templates
    [ ] 1. Template 1
    [X] 2. Template 2
```

### 第五步：查看结果

结果保存在：
```
C:\Users\{你的用户名}\.core_node\pytools\tmp\multi_scale_result\
```

## 🎮 控制键说明

### 游戏类型菜单（单选）
- **↑/↓**: 移动光标
- **ENTER**: 确认选择
- **0-9**: 直接跳转

### 模板菜单（多选）
- **↑/↓**: 移动光标
- **SPACE**: 切换选中
- **ENTER**: 确认所有选择
- **ESC**: 取消并使用缓存
- **0-9**: 直接跳转

## 📊 输出文件

### 标注图像
- 文件名: `d3_screenshot_001_20250118_120000.jpg`
- 内容: 带标注的测试结果

### JSON 报告
- 文件名: `test_report_d3_20250118_120000.json`
- 内容: 详细的测试统计

## 🎨 结果图像说明

### 绿色标记 = 找到了
- 绿色边框 - 匹配区域
- 红色圆点 - 中心点
- 白色十字 - 准星
- 文字标签 - 模板名 + 置信度

### 红色文字 = 未找到
- 显示在图片顶部
- 列出所有未匹配的模板

### 左侧图片 = 模板
- 显示实际使用的模板图像
- 方便对比

## 💡 常见问题

### Q: 找不到截图？
A: 检查截图是否放在正确的目录

### Q: 所有模板都不匹配？
A: 检查游戏类型是否选对（D3/D4）

### Q: 菜单乱码？
A: 确保终端支持 UTF-8 编码

### Q: 缓存在哪里？
A: `C:\Users\{你的用户名}\.core_node\.scripts\template_test_cache.json`

## 📚 更多文档

- [完整使用说明](./TEMPLATE_TEST_README.md)
- [菜单功能详解](./MENU_FEATURES.md)
- [集成总结](./FINAL_INTEGRATION_SUMMARY.md)

## ✅ 快速检查

- [ ] 截图已放入正确目录
- [ ] 运行脚本无报错
- [ ] 菜单可以正常导航
- [ ] 结果图像已生成
- [ ] JSON 报告已生成

**搞定！开始测试吧！** 🚀
