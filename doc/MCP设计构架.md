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

  D:\programing\core_node\pycore\pylauncher\launcher.py 现在继续其中的
  D:\programing\core_node\pycore\pylauncher\launcher.py pycore\pyfoundations\thread_bus.py  机制，加入
  pycore\pyutils\rpc_v2 可以在 launcher.py 配置启动，但当如果使用参数 启动 rpc v2时，将在
  thread_bus.py的退出，重启动除中加入先关闭rpc ，先全面分析。同时做出一个通用性的扩展，这样可以一直扩展更多线程类，同时默认pyheartbeat是默认启动的，其他都需要配置，你可以要全面调整一下launcher.py和其他类的组合。这就是新的启动方式。
  同时将你刚才的更新更新到文档，但每次只能有几句话更新重点   doc\PYCORE_UP.md 

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