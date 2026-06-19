# Duo API URL QieHuanXiTong - architecture SheJiZhiNan - summary document 

to use HuTiGong `<content>` ( Duo API URL QieHuanXiTong architecture SheJiZhiNan ) JianMing summary . 

## structure 
- Markdown ZhiNan : XiTongGaiShu ( GaoKe use , GuZhangZhuanYi , XingNeng , DuoHuanJing ) HeXinYuanLi ( DuoDuanDian config , YouXianJi test LiuCheng , LianTongXingCeLve , ChiJiuHua localStorage) SanCeng architecture ( Ying use Ceng / GuanLiCeng / config Ceng ) ShiXian step (5 step : config , ApiManager, JiCheng , ChuShiHua , UI) ZuiJiaShiJian ( YouXianJi , Chao when , CuoWuChuLi , AnQuan ) AnLi (laravel_dashboard, wordflow-ai) to BiBiao and WuCeng summary CanKaoShiXian and Ban this . 

## key points 
- ** DuoDuanDian **: every DuanDianHan id, url, protocol, port, priority, isLocal, description; AnYouXianJiPaiXuHouBianLi test . 
- ** LianTongXing **: 2xx4xx Shi for Ke use ; Chao when Yue 1 Miao ; JiLuXiangYing when Jian ; use HuXuanZe > ZiDongJianCe > config YouXianJi . 
- **ApiManager**: initialize, checkEndpoint, autoDetect, setEndpoint, getCurrentBaseUrl; ChiJiuHua api_current_endpoint, api_auto_detected, api_user_modified. 
- ** TuiJianYouXianJi **: this (localhost) JuYuWangZhu / Bei YunDuan HTTPS; Chao when 1s, HouTaiJianCha 60s, ZhongShi 3 Ci . 

## purpose 
for QianDuanShiXianDuo API ZhiZiDongQieHuan and GaoKe use TiGong architecture and ShiXianZhiYin , Shi use at QiYe within Wang , DuoHuanJing and GaoKe use ChangJing ; KeCanKao laravel_dashboard, wordflow-ai ShiXian . 
