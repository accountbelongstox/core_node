# node-gyp config.gypi 总结文档

对用户提供的 `<content>`（node-gyp 中 config.gypi 解析与生成逻辑）的简明总结。

## 结构概览
- Node 'use strict' 模块；依赖 fs (promises)、log、path；导出 createConfigGypi、parseConfigGypi、getCurrentConfigGypi。

## 要点
- **parseConfigGypi(config)**：去掉 # 注释、合并以 ' 结尾续行的多行字符串、单引号改为双引号后 JSON.parse，逻辑来自 Node 的 tools/js2c.py。
- **getBaseConfigGypi**：当存在 nodedir 或 disturl 且未指定 force-process-config 时，读取 nodeDir/include/node/config.gypi 并解析；失败或条件不满足时返回 process.config 的深拷贝。
- **getCurrentConfigGypi**：在 base 上补全 target_defaults、variables；清空 defaults 的 cflags/defines/include_dirs/libraries 避免继承他机路径；根据 gyp.opts 设置 default_configuration、target_arch、nodedir、python、standalone_static_library；Windows 下设置 msbuild_toolset、msvs_windows_target_platform_version、arm64 时 msvs_enable_marmasm、msbuild_path；将 gyp.opts 中未在 configDefs 的项以变量形式写入（键名中 - 换为 _）。
- **createConfigGypi**：调用 getCurrentConfigGypi 得到 config，将布尔值转为字符串后 JSON.stringify，写入 buildDir/config.gypi，并加上生成说明前缀。

## 用途
在 node-gyp configure 阶段生成或解析 config.gypi，为原生模块构建提供与当前 Node、架构、Python、VS 等一致的 GYP 配置。
