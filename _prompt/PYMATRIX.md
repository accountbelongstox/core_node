根据规范 development-guides\PYTHON_PYCORE.md ，扫描调用链。pyapps\matrix

C:\Users\accou\Downloads\matrixui.zip 复制这个目录 解压到 poly_apps/  ，/scripts/start.ps1 中写出，pnpm 自动安装，启动，编译，debug脚本。代码全英文，实时输入信息不要使用退出码检测、不要使用返回信息，所有都是依赖直接输出信息、以及结果检测，比如安装检测二进制，是否运行成功直接依靠运行方的输出。依赖文件自身定位相对路径，不要硬编码路径。最终要返回原始目录，目录切换来切换去。 安装是自动的，显示菜单，编译 多平台、DEBUG、使用adb自动摄像头编译后的app到手机测试，

找到其中是如何启动前端UI的。 有一个启动一个web项目，比如nuxt作为前端的代码，找到.

现在在 pycore/utils/ 中扩展启动 nuxt/react/vite/neust的类库，根据  development-guides\PYTHON_PYCORE.md 规范，启动一个项目时，有两种模式，开发模式直接使用端口启动。但要不停的阻塞，直到用http客户端请求到UI启动。生产模式进行编译，并提供静态目录，可以使用内置HTTP启动。也可以提供一个方法给外瓿调用用由外组织路由，这样不用在同一个系统 内启动两个HTTP服务。

无论是那种启动器，都自动先pnpm安装代码全英文，实时输入信息不要使用退出码检测、不要使用返回信息，所有都是依赖直接输出信息、以及结果检测，比如安装检测二进制，是否运行成功直接依靠运行方的输出。依赖文件自身定位相对路径，不要硬编码路径，生产模式还要判断是否要编译。

pycore\pyutils 查看这其中有没有专门的前端启动库。现在前端是 poly_apps\matrix_ui_react 找一下合适的库，并给出更好的解决方案。


pycore/pyutils/native_ui 扩展该库，当使用本地UI启动debug模式是，阻塞直到ui启动成功，自动安装pnpm 自动调用启动命令，使用单独线程启动。development-guides\PYTHON_PYCORE.md 按该规范，现在将   pycore/pyutils/frontend_launcher/ 作为 native_ui 的一个子类。

查看是否符合逻辑，设置为前端debug模式，直接启动热重载的调试，同时目前的 \dist 也没有实现
  预编译。注意该扩展那里扩展那里，要全局考量不要只改一个地方。