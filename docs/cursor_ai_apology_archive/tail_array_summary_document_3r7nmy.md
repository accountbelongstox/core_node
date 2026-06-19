# tail (array) - summary document [3r7nmy]

to use HuTiGong `<content>` (Lodash FengGe tail HanShu ) JianMing summary . 

## structure 
- Cong `./_baseSlice.js` DaoRu baseSlice. 
- JSDoc: @static, @memberOf _, @since 4.0.0, @category Array, CanShu array, FanHuiZhi , ShiLi _.tail([1,2,3]) => [2,3]. 
- HanShu tail(array): length = array == null ? 0 : array.length; have length Ze return baseSlice(array, 1, length), FouZe return []. 
- export default tail. 

## key points 
- line for : FanHui " Chu No. Yi YuanSu of Wai " sub ShuZu , i.e. array.slice(1) etc. JiaShiXian . 
- KongZhi : array for null or undefined when FanHui []. 
- YiLai : baseSlice(array, start, end) FuZeShiJiQiePian . 

## purpose 
as Lodash FengGeGongJuHanShu , use at HuoQuShuZuWeiBu ( QuDiaoShouYuan ) , Bian at LianShi or HanShuShiXieFa . 
