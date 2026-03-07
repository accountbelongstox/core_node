# Google Translator Module — 总结文档 [i4Lndl]

对用户提供的 `<content>`（Google Translator 模块说明）的简明总结。

## 结构
标题与简介 → Features（列表）→ Cache Structure（目录树）→ Installation（pip install googletrans）→ Usage（CLI：单条、多目标、批量 config、--no-cache、--clear-cache；程序化：GoogleTranslator translate_single/translate_batch、translate_from_dict、translate_from_json_file）→ JSON Configuration Format → Supported Languages → Cache Management（MD5 键、命名空间、路径、clear_cache）→ Examples。

## 要点
- **功能**：Google Translate API、MD5 缓存（按 src/dest 对分目录）、单条/批量、语言检测、JSON 配置、CLI。
- **缓存**：键为 md5("{text}:{src}:{dest}")，路径为 {wwwroot}/pycore_db/translator_cache/{src}_to_{dest}/；支持按语言对或全部清空。
- **CLI**：--text、--src、--dest、--output；--dest 可多值；--config 批量；--no-cache、--clear-cache。
- **程序化**：async with GoogleTranslator()，translate_single/translate_batch；translate_from_dict(config)、translate_from_json_file(path)；clear_cache(src,dest) 或 clear_cache()。
- **JSON**：src（或 "auto"）、dest（字符串或数组）、texts（字符串或数组）。

## 用途
为 PyCore 提供带智能缓存的 Google 翻译工具，支持 CLI 与 Python 调用，用于单条或配置驱动的批量翻译。
