# CoordinateMapper - summary document 

to use HuTiGong `<content>` (CoordinateMapper ZuoBiaoYingSheLei ) JianMing summary . 

## structure 
- Python Lei CoordinateMapper, JinJingTai method : map(x, y, from_width, from_height, to_width, to_height) FanHui (mapped_x, mapped_y); map_batch(points, from_*, to_*) to DuoDianDiao use map; reverse_map(x, y, from_*, to_*) JiaoHuan to/from Diao use map ShiXianNiXiang . YiLai typing Tuple, List. 

## key points 
- ** YingSheGongShi **: mapped_x = x * to_width / from_width, mapped_y TongLi ; ZaiBianJieCaiJian to [0, to_width-1] and [0, to_height-1]. 
- ** purpose note **: LiuLanQiZuoBiao to SheBeiZuoBiao , not TongFenBianLvShiPei , ZhiChiXuanZhuanChangJing ; ShiLi 7201280 14403120. 
- **reverse_map**: SheBeiZuoBiaoYingSheHuiLiuLanQiZuoBiao , i.e. map CanShu to Diao . 

## purpose 
in ZiDongHua , TouPing or test in JiangYiZhongFenBianLv ( such as LiuLanQiShiTu ) Xia ZuoBiaoZhuanHuan to LingYiZhongFenBianLv ( such as SheBeiPingMu ) , ShiXianDianJi / ZuoBiao KuaFenBianLv and XuanZhuanShiPei . 
