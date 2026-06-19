# InMemoryTransport - summary document 

to use HuTiGong `<content>` (InMemoryTransport Lei ) JianMing summary . 

## structure 
- ES class InMemoryTransport: constructor ChuShiHua _messageQueue; JingTai createLinkedPair() FanHuiYi to HuXiang _otherTransport ShiLi ; start() QingKongDuiLie and YiCi onmessage; close() QingKong _otherTransport and await other?.close(), onclose; send(message, options) if to Duan have onmessage ZeZhiJieDiao use FouZeRuDui , ZhiChi options.authInfo. MoWei sourceMappingURL. 

## key points 
- ** purpose **: TongYiJinCheng within Client/Server TongXin , no XuZhenShiWangLuo . 
- **createLinkedPair**: FanHui [clientTransport, serverTransport], FenBieChuan to Client and Server. 
- ** XiaoXiLiu **: send when to Duan have onmessage ZeTong step Diao use , FouZe push to _messageQueue; start when AnXuChuLiDuiLie in XiaoXi . 
- **close**: ZhiKong _otherTransport, to Duan close HouChuFa onclose, Bian at Cheng to GuanBi . 

## purpose 
in test or DanJinCheng architecture in TiGong within CunChuanShu , use at YanZhengRenZheng , XiaoXiXieYi etc. , no XuQiWangLuoFuWu . 
