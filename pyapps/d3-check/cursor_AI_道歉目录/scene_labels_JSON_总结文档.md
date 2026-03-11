# 场景/标签 JSON — 总结文档

对用户提供的 `<content>`（含 scene、labels、fileName 的 JSON）的简明总结。

## 结构
- 根对象含：scene（字符串，可为空）、labels（对象数组）、fileName（如 "group0_scene1.jpg"）。
- 每个 label 含：x、y、w、h（位置与尺寸）、name、label（类别名）、nextUI（下一张 UI 文件名，可为空）、clickNum（点击次数）。

## 要点
- **scene**：当前为空，可表示场景标识。
- **labels**：多组矩形区域，描述界面上的可点击或可识别区域；部分 nextUI 指向下一张图（如 "group3_scene0.jpg"），多数为空；clickNum 记录点击次数；本例中 name/label 均为 "other"。
- **fileName**：当前场景图文件名，与 group/scene 命名对应。

## 用途
用于 UI 自动化或场景标注（如游戏/应用界面）：记录每张图上的区域位置、尺寸、跳转目标与点击计数，供脚本定位、点击或测试使用。
