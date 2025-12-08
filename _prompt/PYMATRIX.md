根据规范 development-guides\PYTHON_PYCORE.md ，扫描调用链。pyapps\matrix

C:\Users\accou\Downloads\matrixui.zip 复制这个目录 解压到 poly_apps/  ，/scripts/start.ps1 中写出，pnpm 自动安装，启动，编译，debug脚本。代码全英文，实时输入信息不要使用退出码检测、不要使用返回信息，所有都是依赖直接输出信息、以及结果检测，比如安装检测二进制，是否运行成功直接依靠运行方的输出。依赖文件自身定位相对路径，不要硬编码路径。最终要返回原始目录，目录切换来切换去。 安装是自动的，显示菜单，编译 多平台、DEBUG、使用adb自动摄像头编译后的app到手机测试，

找到其中是如何启动前端UI的。 有一个启动一个web项目，比如nuxt作为前端的代码，找到.

现在在 pycore/utils/ 中扩展启动 nuxt/react/vite/neust的类库，根据  development-guides\PYTHON_PYCORE.md 规范，启动一个项目时，有两种模式，开发模式直接使用端口启动。但要不停的阻塞，直到用http客户端请求到UI启动。生产模式进行编译，并提供静态目录，可以使用内置HTTP启动。也可以提供一个方法给外瓿调用用由外组织路由，这样不用在同一个系统 内启动两个HTTP服务。

无论是那种启动器，都自动先pnpm安装代码全英文，实时输入信息不要使用退出码检测、不要使用返回信息，所有都是依赖直接输出信息、以及结果检测，比如安装检测二进制，是否运行成功直接依靠运行方的输出。依赖文件自身定位相对路径，不要硬编码路径，生产模式还要判断是否要编译。

pycore\pyutils 查看这其中有没有专门的前端启动库。现在前端是 poly_apps\matrix_ui_react 找一下合适的库，并给出更好的解决方案。


pycore/pyutils/native_ui 扩展该库，当使用本地UI启动debug模式是，阻塞直到ui启动成功，自动安装pnpm 自动调用启动命令，使用单独线程启动。development-guides\PYTHON_PYCORE.md 按该规范，现在将   pycore/pyutils/frontend_launcher/ 作为 native_ui 的一个子类。

查看是否符合逻辑，设置为前端debug模式，直接启动热重载的调试，同时目前的 \dist 也没有实现
  预编译。注意该扩展那里扩展那里，要全局考量不要只改一个地方。

  查看是否符合要求，修正一致性，注意你要全面考虑而不是单独修正某一个文件。

e 1：所有的打印方法是否是都使用color printer 类库，将打印信息通过这个类，2：检测现在的Debug
Log 窗口先显示（Tkinter） 是否注册到了 color printer ，debug窗口是用来显示预加载信息的。因为实际 编译后没有黑框框窗口，3：Debug Log
在前端页面启动成功后自动关闭，由外部调用其关闭事件，当然事件是由thread bus处理的，所有thread禁止互相调用，全部由全局的thread
bus处理事件，同时你也要匹配之前的其他线程，比如前端UI线程。

查看全局为什么没有正确使用现在的thread bus，同时确保thread bus的注册机制有效，能正确的按顺序
通知到所有的线程关闭等活动。
````````````````````````````````````````````````````````````````````````````````````````````````````````

目前是只有一个debug窗口了，但这个窗口没有正确的注册到colore
printer，查看另一个debug的逻辑，修正，同是现在启动的debug窗口上有语言设置，查看整 个项目的UI端（非webview UI）
的多语言是否一致，之后使用thread bus和多语言的全局对象（注意多语言只有一个全局对象，启动即创建，可以在子app中调用扩展key
val），不要处处去new，因为这样没法全局生效。查看其中是一致，之后扩展现在的debug窗口上的多语言选择，使tray等窗口标题等(非webview)能实
时切换语言。同时代码中禁止硬编码、而是直接使用多语言。

修改为完全使用websockt的连接方式，之后，更新 pyapps\matrix\docs 其中的所有文件，同时合并文档，对过期或进多余的文档进行删除，现在主要保留端点文档。

请整合原来的所有路由为rpc v2，并由一个专门的文件管理main中只负责引入和组织变量，同时通过 pycore\pylauncher\launcher.py 其中传递变量启动 rpc v2.

管理工具依然放在原来的文件夹中 pyapps\matrix\api 中替换原来的，根目录只有一个文件 main。

找到这个项目是如何利用scrcpy 连接多台设备的，特是当有多个设备时，如果使用无线连接的，因为安卓在无线模式下需要手机pair,而该系统 可以直接连接，你需要查找到实际 代码，才能给出技术方案，推导根据该项目手机端做了什么适配，比如是否开启OTG，是否root等。
不用关闭c++部份，你只需要关注项目是如何 调用 scrcpy来完成上面的工作的，如果 你对 scrcpy 不哆了解，则调用MCP查询官方文档 https://github.com/Genymobile/scrcpy?tab=readme-ov-file

pyapps\matrix\docs\SCRCPY扫描到的代码逻辑.md 根据以上，扩展现在的接口， 先写出， 1:心跳系统根据局域网，得到可用的所有root设备，并自动设置为可用5555连接。2：心跳系统排查局域网是否添加了新设备（跳过稳定连接的），3：要维护一个设备表，添加，断开时要更新，4：心跳系统查看当前新接入的usb adb设备，并立即 设置允许  无线连接。之后转为无线连接。 注意，不要直接在 pycore\pythreadpool 进行硬编码，该类不引入任何子app类，而是在 pycore\pylauncher\launcher.py 其中注入心跳函数，供 pythreadpool 每次引用。 需要扩展的是 python .\pymain.py app=matrix 查看文档 development-guides\PYTHON_PYCORE.md