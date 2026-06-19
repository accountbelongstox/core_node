# CommManager (tbus) - summary document 

to use HuTiGong `<content>` (GameAISDK CommManager Lei ) JianMing summary . 

## structure 
- Python WenJian : BianMa and GPLv3 ZhuShi ; sys.path JieXi ( XiangShangZhaoHan pycore directory , ZuiDuo 12 Ceng ) ; import configparser, tbus, ColorPrint, Define. Lei CommManager: __init__(runType), Initialize(configFile), SendTo, SendMsgToIOService, RecvMsg, Finish, _LoadTbusConfig ( JingTai ) . 

## key points 
- **Initialize**: _LoadTbusConfig Du [BusConf] Ge Addr; tbus.GetAddress selfAddr, IOAddr, Reg1/2, UI1/2, Agent1/2; RenYi for None ZeBaoCuo and return False; tbus.Init(selfAddr, configFile) HouAn runType SheZhi __recvAddrsSet, __recvAgentAddrsSet (UI_AI Han IO/Reg/UI/Agent, AI Han IO/Reg/Agent, UI Han IO/UI) . 
- ** ShouFa **: SendTo/SendMsgToIOService Diao tbus.SendTo; RecvMsg BianLi recvAddrsSet and recvAgentAddrsSet Diao tbus.RecvFrom. Finish Diao tbus.Exit. ZhuYi Reg2Addr DangQian use GameReg1Addr, Ying for GameReg2Addr. 
- ** purpose **: GameAISDK in FengZhuang tbus TongXinCeng , Gong MC and IO, GameReg, UI, Agent etc. ZuJianTongXin . 
