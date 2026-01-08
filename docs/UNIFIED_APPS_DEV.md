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

