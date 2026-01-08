dd.sh >  Unified App Manager                    
  L - Launch this app
  R - Restart (if running)
  S - Stop (if running)
  K - Kill process on port
  V - View logs
  Enter - Return to menu
  C - Create systemd service
  D - Delete systemd service
  P - Create service with proxy

添加一个Build & Create  systemd service  以及 Build & Create service with 
proxy,注意,逻辑都同是一个,只不过build是要智能buil不同的项目,注意要使用很多B
UILD子类库,适配当前每种可能的build,并且build在目录的对应的文件夹中.同时Buil
d会替换普通服务,同时普通服务也会替换build服务.只能同时有一个服务.build也就
是相较于普通改用build前置build过程,并使用相应的官方推荐方法启动.先找到原来
的代码. 


  1. 更新unified_core.py调用generate_build_start_command时传递port参数
  2. 确保wrapper script中的working directory正确（对于build应该是build输出目录）

  让我先修复Python层调用：

使用多文件构架,分别使用生成服务器类库,生成build服务内容,生成普通调试服务内容,以及其他必要的工具类库.


Build & Create Service (选项'B') - 完整线路核对 ✅

  Python层测试结果:

  1. ServiceFileGenerator.create_build_service() ✅
    - 成功生成wrapper脚本: /var/_core_node/unified_manager/temp_scripts/web
  app-appfactory-master-dashboard-build.sh
    - 成功生成服务文件内容(字符串)
    - 正确返回服务名称: webapp-appfactory-master-dashboard-build
  2. 互斥服务列表生成 ✅
    - 正确识别需要移除的Normal服务:
        - webapp-appfactory-master-dashboard
      - nuxt-appfactory-master-dashboard
      - laravel-appfactory-master-dashboard
      - flutter-appfactory-master-dashboard
      - app-appfactory-master-dashboard
  3. 全局变量写入 ✅
    - BUILD_SERVICE_NAME: 已写入
    - BUILD_SERVICE_CONTENT: 已写入(多行内容)
    - SERVICES_TO_REMOVE: 已写入
    - ACTION: 已写入
    - STATUS: 已写入

  Shell层测试结果:

  1. 全局变量读取 ✅
    - 成功读取 BUILD_SERVICE_NAME
    - 成功读取 SERVICES_TO_REMOVE
    - 成功读取多行 BUILD_SERVICE_CONTENT
  2. Shell层职责:
    - 移除互斥服务: systemctl stop/disable/rm
    - 写入服务文件: echo "$service_content" > 
  /etc/systemd/system/xxx.service
    - 注册服务: systemctl daemon-reload/enable/start

  架构验证 ✅

  Python职责(复杂逻辑):
  - ✅ 项目构建 (BuildManager)
  - ✅ 命令生成 (generate_build_start_command)
  - ✅ Wrapper脚本生成 (写入temp_scripts目录)
  - ✅ 服务文件内容生成 (字符串,不写入系统目录)
  - ✅ 互斥服务列表生成

  Shell职责(系统命令):
  - ✅ 读取全局变量
  - ✅ 执行systemctl命令
  - ✅ 写入系统文件(/etc/systemd/system/)

  ##总结

  整条Build & Create Service功能线路已验证完成,所有组件正常工作!

