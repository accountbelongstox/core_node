# Ubuntu 22.04 System Tray Icon Fix — 总结文档

对用户提供的 `<content>`（Ubuntu 22.04 系统托盘图标修复文档）的简明总结。

## 结构
- Markdown：问题根本原因（GNOME 不支持传统托盘、当前代码禁用 Linux 托盘、Qt QSystemTrayIcon 已知问题）→ 解决方案（安装 AppIndicator 扩展、启用 pystray、原生 AppIndicator3）→ 测试验证 → 技术细节（SNI/AppIndicator、Qt 实现）→ 当前状态与短/中/长期建议 → 相关资源与总结。
- 含代码块（bash、Python）、表格与链接。

## 要点
- **原因**：GNOME Shell 3.26+ 移除传统 System Tray，仅支持 SNI/AppIndicator；`callmodule_main.py:219` 中 `enable_tray=IS_WINDOWS` 导致 Linux 下托盘关闭；pystray 存在 D-Bus 会话问题；Qt 托盘在 GNOME 下有图标路径（/tmp）等 bug。
- **用户侧**：安装 `gnome-shell-extension-appindicator`，启用 `appindicatorsupport@rgcjonas.gmail.com`，注销/重登或 X11 下 Alt+F2 → r 重启 Shell。
- **代码侧**：短期可检测 AppIndicator 扩展是否可用后条件启用托盘；长期建议实现 AppIndicator3 原生后端（gi.repository.AppIndicator3、Gtk.Menu），并区分 Ubuntu/GNOME 用 AppIndicator3、Windows 用 PySide6、其他 Linux 用 pystray。

## 用途
供在 Ubuntu 22.04 (GNOME) 上恢复或实现系统托盘图标：理解原因、按文档安装扩展或改代码，并可选实现原生 AppIndicator3 后端。
