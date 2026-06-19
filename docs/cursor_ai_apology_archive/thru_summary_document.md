# thru HanShu - summary document 

to use HuTiGong `<content>` (lodash FengGe thru HanShu ) JianMing summary . 

## structure 
- JSDoc: @static, @memberOf _, @since 3.0.0, @category Seq, @param value, @param interceptor, @returns interceptor FanHuiZhi , @example LianShiShiLi . 
- ShiXian : `function thru(value, interceptor) { return interceptor(value); }`
- DaoChu : `export default thru`

## key points 
- and `_.tap` LeiSi , but FanHui is **interceptor FanHuiZhi ** (tap TongChangFanHuiYuan value) . 
- purpose is in method Lian in " TouChuan " and ** TiHuan in JianJieGuo **, and FeiJinZhi line FuZuo use . 
- QianMing : ChuanRu `value` and `interceptor`, FanHui `interceptor(value)`. 

## purpose 
in LianShiDiao use ( such as `_.chain().trim().thru(fn).value()`) in ChaRuZiDingYiZhuanHuan , Li such as Jiang char FuChuanBaoChengShuZu or Zuo in JianYingShe , Bian at in LianShi API in TiHuan in JianZhi and not in DuanLian . 
