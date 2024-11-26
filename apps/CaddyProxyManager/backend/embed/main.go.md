# embed/main.go

## 1. 功能描述
处理静态资源和模板文件的嵌入，使用Go 1.16+的embed功能将前端资源打包到二进制文件中。

## 2. API接口清单
不提供API接口，主要用于资源嵌入。

## 3. 方法清单
- `init()`: 初始化嵌入的静态资源
- `GetTemplates() *template.Template`：获取编译后的模板
- `GetStaticFiles() embed.FS`：获取静态文件系统

## 4. 文件调用关系
调用的其他文件：
- embed/caddy/host.hbs (模板文件)
- internal/config/config.go (配置信息) 