# Screenshot Router — 总结文档 [FnBMkW]

对用户提供的 `<content>`（Screenshot Router 代码）的简明总结。

## 结构
单文件，UTF-8；顶部导入 `get_third_package_fastapi` 取得 FastAPI，以及 `ScreenshotController`、`ScreenshotRequest`、`ScreenshotResponse`；创建 `APIRouter(prefix="/api/local/screenshot", tags=["Local Processing - Screenshot"])` 与 `ScreenshotController()` 实例；定义一条 POST 路由。

## 要点
- 路由前缀：`/api/local/screenshot`，标签：Local Processing - Screenshot。
- 唯一端点：`POST /capture`，请求体 `ScreenshotRequest`，响应模型 `ScreenshotResponse`；文档字符串注明「Capture screenshot with optional OCR and upload」。
- 实现：异步处理函数将请求直接交给 `controller.capture(request)`，无额外逻辑。

## 用途
为本地处理提供截图 API（支持可选 OCR 与上传），供前端或其它服务通过 POST 调用。
