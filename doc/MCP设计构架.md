现在你先完成第一步调用 D:\programing\core_node\pycore\pylauncher 中配置启动rpc v2和心跳线程。

如果你发现RPC v2服务器中有缺失的，你可以先修正。

mcpctl 中要全面使用 rpc_v2 的构架，注明在 mcpctl中不要实现http服务器。

 pycore\pyutils\rpc_v2\client\unified_rpc_client.js 首先查看客户端， 对比v1的连接策略
pycore\pyutils\rpc\client\unified_rpc_client.js

 同时v2版本是从v1版本移置过来的，v1thcg本工作正常，pycore\pyutils\rpc 这是v1版本你作为参考 。

  t"D:\programing\core_node\pycore\pyutils\rpc_v2\FIX.md"
先全面扫描一下rpcv2这些问题在那里，全面修复数据一致性。注意 .ps1
不要写其他脚本配合，你先了解rpcv2的工作原理。
  
  [Pasted text #1 +13 lines] 大量的错误，动态端口是用来检测单例的，防止 有些端口被
  占用但不是本系统。所以使用协议交换，但现在为什么web也启动了一堆动火态端口。web的端口是固定 的。
  
  
  python .\pymain.py app=mcp 使用这个命令完整测试
 
 同时给web页扩展出完整的顶部菜单，左菜单，tab菜单，中间功能区，右菜单，底部菜单，全部为可扩展。包括js/基于rpc v2的客户端，以及后端的api全部可扩展。
 
 python .\pymain.py app=mcp 使用该命令完整测试，现在在后端默认使用 rpc
  v2的路由和html静态规范，起动一个web页，之后web页上将显示后端id启动时间
  等，以实时查看后端有没有被不同的mcp替换。虽然只启动一个页，但你扩展好后端的统一api接口规范，html
  /css鑫文件/js鑫文件。引入rpc v2的统一客户端通信。全面设计好，方便后面扩展。
    同时将你刚才的更新更新到文档，但每次只能有几句话更新重点   doc\PYCORE_UP.md
//--------------------------------------------------------------------------------------------------------------
 全面重构。 给 mcpctl 一个全局变量，当处理空闲时，如果有新的启动则旧的程序使用 pylauncher 中的 thread_bus 退出全部线程。如果正在处理归拒绝退出，则当前的启动不启动后台，而继续使用之前的单例后台。
 
 注意：我发现有多个后台测试进程还在运行。需要清理这些进程吗？

  根据之前的设计规范 ，你启动一个后不应该通知 前面的退出吗，为什么还有别的在后台。

pycore\pyctl\mcpctl\mcp_backend_main.py  pycore\pyctl\mcpctl\mcp_backend.py  pycore\pyctl\mcpctl\mcp_launcher.py 为什么还有多个文件，请改为只有一个入口文件，并建立文件建，写上路由注册系统系统 一系列文件。入口文件中的内容不能过长。多余的文件合并或不要了。
    同时将你刚才的更新更新到文档，但每次只能有几句话更新重点   doc\PYCORE_UP.md 


用户提到需要"先移植一个工具，参考 pyapps/mcp/main_backup_20251119_010805.py"。当前 get_file_info 是 mock
  实现，需要后续集成实际的 controller
来处理文件信息提取。继续完全部功能，但要对整个系统一致性做对称处理。之后更新  doc\PYCORE_UP.md

···pycore\pyctl\mcpctl\mcp_backend.py pycore\pyctl\mcpctl\mcp_backend_main.py pycore\pyctl\mcpctl\mcp_launcher.py···
  现在确认后端文件只有一个入口文件，同时不要直接引入fastapi，而是使用 pycore\pyutils\rpc_v2 编写路由，在 mcpctl 中创建多个路由注册，
  之后使用 pycore\pylauncher 来引入 pycore\pyutils\rpc_v2 ，确保有心跳线程启动，同时 rpc_v2 正确的注册入线程库。并使用 pycore\pyfoundations\thread_bus.py 通信。
  1：确保 mcpctl 使用了 pycore\pylauncher 单例，给 mcpctl 一个全局变量，当处理空闲时，如果有新的启动则旧的程序使用 pylauncher 中的 thread_bus 退出全部线程。
  2：先移置一个工具 ，参考 旧文件。 pyapps\mcp\main_backup_20251119_010805.py，
  直接工作，一步一步检测，并更新 到
    同时将你刚才的更新更新到文档，但每次只能有几句话更新重点   doc\PYCORE_UP.md 


方案4️⃣：代理架构

  客户端运行本地代理 → 代理转发到HTTP服务器：

  [Cursor] <--STDIO--> [本地代理] <--HTTP--> [共享MCP服务器]
                          ↓
                    本地文件访问

  ❌ 缺点：复杂度高，需要额外开发
我们来采取这种模式，现在先完成一个基本的服务，先分析  D:\programing\core_node\pycore\pyutils\rpc  D:\programing\core_node\pycore\pyheartbeat
我们现在设计一个简单的模式，就是先启动一个心跳线程，然后给rpc包装成启动（重复启动时跳过），停止，重启。之后在mcp会调用一个包装好的类库，直接启动心跳线程，然后由心跳线程一直启动mcp（实际启动
后就会跳过），这样就得到一个web进程，然后我们使用本进mcp作为代码，通地http先访问获得一个当前的心跳时间 。全面分析 先给出我文档 。

D:\programing\core_node\pycore\pylauncher 现在修改该启动管理器，在D:\programing\core_node\pycore\pyctl
中先实现mcp代理管理，直接启动心跳线程，注意这是中心服务器，需要单像例模式，扩展D:\programing\core_node\pycore\pylauncher
使用单例模式，有启动时发现启动则exit，发现启动则通知上一个exit，监听一个全局端口，如果端口被占就开始通信，如果能通信就是根据协议是否通知上一个exit
，D:\programing\core_node\pycore\pylauncher 在其中实现单例检测模块，注意 pylauncher 就是主线程。使用http通信上一个模块，之后在
D:\programing\core_node\pycore\pygvar 设计一个端口范围，不一定被占用的端口就是被占用，而是能协议通信的才是本项目。如果没有则继续递归增加，直到找到
一个存在的，或者没有找到，但有珍上可用的端口就是空。先完成这一部。然后测试单例启动模式是否成功。

 注意目前设计的这个单例模式是全局通用的，只是mcp调用了这个模式，稍候你将mcp的调用实现在pyctl中。同时你要全面更
  新 D:\programing\core_node\pycore\pylauncher\launcher.py 相当于现在 launcher.py现在就是主线程，通过
  launcher.py 就可以直接判断是否单例，而单儿的util则不再判断，在launcher注释这一点。
  
  MCP_SINGLETON_PORT_START
  这个也是全局的，而且是预定义的，当然可以在子app中传递端口范围修改，这样可以启动多个单例应用，注释并修改这一点。

 pycor \pygvar\constants.py y请不要在公共端口范围，MCP的端口范围在mcp的类库中定义。

pycore\pyutils\singleton_detector.py 这个类库是要放到 pycore\pylauncher 中，并声明作为 pylauncher的子类库。不引用任何外部类。代码全英文

你现在扩展  pycore\pylauncher\launcher.py ，分析其中的重复定义以及是否需要修正的地方，之后引入 pycore\pyutils\mcp ，通过控制变量，在launcher.py 中选择要启动的， pycore\pyheartbeat ，现在设置为默认启动pyheartbeat线程。之后在 pycore\pyctl\mcpctl\mcp_launcher.py 中通过参数变量，使用单例启动 pyheartbeat,并在 pyapps\mcp\main.py 中引用测试，反复启动查看是否成功，现在的启动模 式为，如果存在线程，则通知上一个线程退出。查看 pycore\pyfoundations\thread_bus.py 其中是否有全局的退出方法 ，给pycore\pylauncher 中的相关类库调用。

说了 pylauncher 不不启动mcp,只启动pyheartbeat,mcp的启动在pycore\pyctl\mcpctl中。pylauncher 中不要有任何MCP的配置，你使用pycore\pyctl\mcpctl传入。

注意  THREAD_BUS 的全局 shutdown 是一个队列系统 ，可以在里边加入栈事件，这样在有其他进程互动时，可以先关闭其他进程，最后退出主进程。
同时将你刚才的更新更新到文档，但每次只能有几句话更新重点   doc\PYCORE_UP.md

ython pyapps/mcp/现在切换到 python pyapps/mcp/主入口方法上，启动命令是 python .\pymain.py app=mcp 参考
  development-guides\PYTHON_PYCORE.md 注明是渐进式开发。

  不要写测试文档 ，而是从python .\pymain.py app=mcp这里边先解决单例问题，继续输出debug信息（设置一个debug全局变量）。之后声明 一个代理端和真正的mcp后端（后端是单例模式、代理端可以启动多个），现在真正的mcp后端放在pycore\pyctl\mcpctl 中，代理端放在pyapps\mcp
  代理端将通过localhost 端口向后端发送请求。先完成文件构架。创建文件，不要先写代码。同时将你刚才的更新更新到文档，但每次只能有几句话更新重点   doc\PYCORE_UP.md 


 先完成一个简单的功能，扩展每个后端使用一个ID，这样查看是否使用了单例模式。现在在前端使用标准
  输出后端的ID，在启动时查看，先移置一个工具 get file info with ocr and document parsing tool
  ，代理端给AI无感操作，让AI不知道其还有后端，照样传递路径
  等，但因为代理端和后端都在同一台机器，所以后端能直接操作同样的路径 。按这个方法 ，先完成一个模拟的 get file
  info with ocr and document parsing tool后端，真正的 get file info with ocr and document parsing
  tool稍候再接入。 返回hello ok!

launcher 重构。
现在launcher有点复杂，删掉所有代码全部重构， 改为 可以根据配置，一次性启动单个或多个任务 ，UI rpc v2,
sppech乖。pycore\pyheartbeat\thread_pool.py 具体查看  ···
D:\programing\core_node\pycore\pylauncher\launcher.py 现在继续其中的
  D:\programing\core_node\pycore\pylauncher\launcher.py pycore\pyfoundations\thread_bus.py  机制，加入
  pycore\pyutils\rpc_v2 可以在 launcher.py 配置启动，但当如果使用参数 启动 rpc v2时，将在
  thread_bus.py的退出，重启动除中加入先关闭rpc
，先全面分析。同时做出一个通用性的扩展，这样可以一直扩展更多线程类，同时默认pyheartbeat是默认启动的，其他都
需要配置，你可以要全面调整一下launcher.py和其他类的组合。这就是新的启动方式。
  同时将你刚才的更新更新到文档，但每次只能有几句话更新重点   doc\PYCORE_UP.md ···

  现在使用这个方案，开始修改
  同时将你刚才的更新更新到文档，但每次只能有几句话更新重点   doc\PYCORE_UP.md 

  MCPUnifiedserver
python D:/programing/core_node/pymain.py app=mcp
get file info with ocr and document parsing tool
Show less
上
New MCP Server 虽然目前显示，但 实际上AI调用不了 测试当前可用的MCP服务
测试你目前可以调用的MCP服务。
检查可用的 MCP 服务和资源。
º No resources found
No MCP resources available
当前未检测到可用的 MCP 服务或资源。可能原因:
1.未配置 MCP 服务器，查看旧的代码，以及代理层是否遵守了fastmcp2的规范，文档 pyapps\mcp\fastmcp2_doc

 backend_id。 这个不需要 传递，是后端返回给前端的，。用于判断后端是否是单例，明白吗？重新设计，全面分析。

 全面扩展一下  RPCv2版本，pycore\pyutils\rpc_v2pycore\pyutils\rpc_v2 pycore\pyutils\rpc_v2  整个文件全面扫描
  ，给出同时支持 同步的方案，注意其中的客户端注册机制和事件库系统。
    同时将你刚才的更新更新到文档，但每次只能有几句话更新重点   doc\PYCORE_UP.md 

确认两个工具是不是都是使用rpc
  v2调用，使用代理层调用。同时后是不是单例模式。全面再确认一遍。

