调用npx react native 的create命令创建 react native 项目到 ./poly_apps/

C:\Users\accou\Downloads\wordflow-ai.zip 解压这个文件到 poly_apps/qy_original，之后将其中的代码转写为 poly_apps/react_native_qy 的react-native的版本，注意要建立统一的数据model中心，设置中心、状态中心（与storage联动）、api中心，使用react的差异化重构，但要按原来项目的页面、style细节1：1的模仿，使用mock数据中心，将api设置为禁用，之后页面在请求数据时直接得到mock数据。

在 react_native_qy/scripts/start.ps1 中写出，自动安装，启动，编译，debug脚本。代码全英文，实时输入信息
不要使用退出码检测、不要使用返回信息，所有都是依赖直接输出信息、以及结果检测，比如安装检测二进制，是否运行成功直接依靠运行方的输出。
依赖文件自身定位相对路径，不要硬编码路径。最终要返回原始目录，目录切换来切换去。 安装是自动的，显示菜单，编译 多平台、DEBUG、使用adb自动摄像头编译后的app到手机测试，

对qy_original改名，解压这个2.0版本到 解压这个文件到 poly_apps/qy_original ，1：1的对比现在页面和功能的差异，更新到 poly_apps/react_native_qy 的react-native的版本，注意要建立统一的数据model中心，设置中心、状态中心（与storage联动）、api中心，使用react的差异化重构，但要按原来项目的页面、style细节1：1的模仿，使用mock数据中心，将api设置为禁用，之后页面在请求数据时直接得到mock数据。 

poly_apps/qy_original 你仿的效果和原来的效果差距巨大 poly_apps/react_native_qy 再来去认真1:1处理页面细节，进行细节精细化的还原。只做react native的处理。

关于 tailwindlcss的转写，1：1使用 nativewind 自动调用pnpm安装包。https://www.nativewind.dev/docs/getting-started/installation 参考文档使用网页访问。注意不是使用expo。