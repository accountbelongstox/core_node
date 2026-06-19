# Voice Subtitle API - HouDuanBaoGao - summary document 

to use HuTiGong `<content>` (Voice Subtitle API HouDuanBaoGao ) JianMing summary . 

## structure 
- Markdown BaoGao : JieLun ( HouDuan no XuXiuGai ) WenTiGaiShu (Remote MoShiXiaDuoGongNengShiXiao ) Gen this Yuan because ( QianDuanJiang this ZiYuanQingQiuFaWangYuanCheng ) HouDuan API YanZheng (queue/categories/audio test and XiangYingShiLi ) HouDuanShiXianYanZheng (/audio DuanDianDaiMaPian segment ) QianDuanXiuFu summary (api.js SanChu : getAudioUrl forceLocal, Code Sync forceLocal, addImage/addVoice JingGao ) Jin this / KeYuanCheng API FenLeiBiao ( Ge 13 ) test ChangJing and HouDuanJianYi summary Biao and XiangGuanWenDang . 

## key points 
- ** JieLun **: HouDuanShiXianZhengQue , no XuXiuGai ; WenTi by QianDuan in Remote MoShiXiaCuoWu use baseUrl DaoZhi , YiTongGuo forceLocal and JingGaoXiuFu . 
- ** HouDuan **: /voice-subtitle/queue, /categories, /audio line for conform to YuQi ; /audio use FileResponse An this path LiuShiFanHui ; DuiLieFanHui audio_path for this LuJing . 
- ** QianDuan **: getAudioUrl and Code Sync XiangGuan method Gai for forceLocal=true; addImage/addVoice ZengJia JSDoc and console.warn note Jin this LuJing have Xiao . 
- ** FenLei **: 13 Jin this API ( YinPin , JianTieBan , JieTu , Code Sync, WenJianLuJing ) ; 13 KeYuanCheng API ( DuiLie , FenLei , RenWu etc. ) . DangQian not XuYaoYuanChengBoFangYinPin HouDuanGaiDong . 

## purpose 
JiLu Voice Subtitle in Remote API MoShiXia WenTiGen because and QianDuanXiuFuFangAn , confirm HouDuan no XuGaiDong , Gong test and HouXuWeiHuCanKao . 
