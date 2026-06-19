# Singleton Busy State Control Example summary document 

to use HuTiGong <Singleton Busy State Control Example> JianMing summary . 

## structure 
- GaiShu , architecture Tu , San WanZhengShiLi (RPC ChuLi , ShuJuKuShiWu , ZhuXianChengShouDong ) , test step ( dual ZhongDuan ) , LiangZhongDanLiMoShi , API XiaoJie and JueCeLiuCheng , ZuiJiaShiJian , GuZhangPaiCha , summary . 

## key points 
- ** LiuCheng **: XinShiLiFaSong SHUTDOWN Yi have ShiLiJianCha THREAD_BUS.is_busy() busy ZeJuJue ( XinShiLiTingZhi ) , FouZeJieShou ( XinShiLiQiDong ) . 
- **THREAD_BUS**: set_busy(True/False), is_busy(), get_busy_reason(); RenYiXianChengKeDiao use . 
- **LauncherConfig**: singleton, shutdown_existing ( ChangShiTiHuan ) , force_launch ( HuLveYi have ShiLi ) . 
- ** ShiJian **: in try/finally in QingChu busy; TiGong have YiYi reason; Jin use at ZhenZhengGuanJianCaoZuo . 

## purpose 
note in DanLi + shutdown_existing ChangJingXia , use THREAD_BUS BiMian in GuanJianRenWuZhi line when by XinShiLiTiHuan , BaoZhengRenWu not in Duan . 
