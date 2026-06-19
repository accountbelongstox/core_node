# matchesStrictComparable - summary document 

to use HuTiGong `<content>` (matchesStrictComparable HanShu ) JianMing summary . 

## structure 
- JSDoc: @private, @param key, @param srcValue, @returns ( FanHuiXin spec HanShu ) ; ShiXian : `function matchesStrictComparable(key, srcValue)` FanHui `function(object)`; within BuPanDuan object == null Ze false, FouZe `object[key] === srcValue && (srcValue !== undefined || (key in Object(object)))`; export default. 

## key points 
- ** purpose **: for " YanGeXiang etc. " BiJiaoTiGongShuXingPiPeiQi , i.e. use `===` BiJiaoShuXingZhi . 
- ** LuoJi **: FanHui HanShu to to Ding object JianCha `object[key] === srcValue`; Dang srcValue for undefined when , EWaiYaoQiu key Cun in at object Shang ( QuFenShuXingQueShi and Zhi for undefined) . 
- ** DianXing use Fa **: lodash within Bu matchesProperty etc. , use at filter, find etc. XuYaoAnShuXingYanGePiPei ChangJing . 

## purpose 
in GongJuKu in TiGongJi at YanGeXiang etc. ShuXingPiPei spec HanShu , Gong matchesProperty, filter, find etc. use . 
