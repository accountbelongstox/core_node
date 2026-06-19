# regenerate char FuJiDaoChu - summary document [tPWsSm]

to use HuTiGong `<content>` (regenerate Liang segment MaDian and DaoChu ) JianMing summary . 

## structure 
- const set = require('regenerate')(); ChuangJianKong char FuJi . 
- set.addRange(0x0, 0x1F).addRange(0x7F, 0x9F); TianJiaMaDian U+0000U+001F (C0 KongZhi ) and U+007FU+009F (DEL and C1 KongZhi ) . 
- exports.characters = set; DaoChu for characters. 

## key points 
- FuGai ASCII/C1 KongZhi char FuQu , Chang use at Unicode ShuXing or ZhengZe in " KongZhi char Fu " JiHe . 

## purpose 
GongJi at regenerate Unicode or ZhengZeShengCheng use , BiaoShiKongZhi char FuJiHe , use at PiPei or PaiChu this XieMaDian . 
