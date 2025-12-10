D:\programing\core_node\apps\mcp-chrome ss先查看其中包含了那些内容，有没有服务端和插件，通信是否正确。

 对该项目不需要使用 .git的依赖，因为已经置大项目。 同时代码全英文。

开始集成，但是API功能改为在 插件面板上集面，并可以保存到store。面板同时有，开启监听数据库并发送到API选项。

MCP 工具中有 监听一段语音（同时监听 麦克风）：1分钟，10分钟等时间，或者录制到当前音频结束  连30秒没有音频流。同时也有 chrome_audio_start  chrome_audio_stop chrome_audio_status chrome_during

 改进现有的 chrome_console 工具,默认是输出所有信息，包括error信息给ai 

也就是音频流可以由ai工具获取，也可以由 插件管理面板开启后推流给API服务器，并可以开启实时推流，推送录制文件。API 服务器可以设置多个。并可以对每个进行单独设计推流方式。