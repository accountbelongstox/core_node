# process-on-spawn HuanJingBianLiangChuanDi module summary document 

this WenDang to use HuTiGong `<content>` ( Ji at process-on-spawn HuanJingBianLiangChuanDiLuoJi ) ZuoJianMing summary . 

## structure GaiLan 
- ** Yun line HuanJing **: Node.js, 'use strict'; YiLai `process-on-spawn`. 
- ** ShuJu **: `envToCopy` to Xiang ( XuChuanDi to sub JinCheng HuanJingBianLiang ) ; `copyAtLoad` ShuZu ( JiaZai when Cong process.env FuZhi BianLiangMingLieBiao ) . 
- ** DaoChu **: `updateVariable(envName)` HanShu . 

## key points 
- **copyAtLoad**: Han NYC_CONFIG, NYC_CWD, NYC_PROCESS_ID, BABEL_DISABLE_CACHE etc. ; module JiaZai when if process.env in Cun in to YingJian , ZeKaoBei to envToCopy. 
- **processOnSpawn.addListener**: in every Ci spawn when Zhi line `Object.assign(env, envToCopy)`, Jiang envToCopy He and Jin sub JinCheng env, Cong and BaXuanDing HuanJingBianLiangChuan to sub JinCheng . 
- **updateVariable(envName)**: JiangDangQianJinCheng process.env[envName] XieRu envToCopy, of Hou spawn sub JinChengHuiJiChengGaiBianLiang ; use at in Yun line when DongTaiTianJiaXuYaoChuanDi BianLiang . 

## purpose 
in YiLai sub JinCheng test or GouJianChangJing ( such as NYC FuGaiLv , Babel) in , BaoZhengGuanJianHuanJingBianLiang by ZhengQueChuanDi to sub JinCheng , BiMian config DiuShi or line for not YiZhi . 
