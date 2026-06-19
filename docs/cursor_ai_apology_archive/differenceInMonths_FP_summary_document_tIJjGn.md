# differenceInMonths FP module - summary document [tIJjGn]

to use HuTiGong `<content>` (differenceInMonths FP FengZhuang ) JianMing summary . 

## structure 
- ZhuShi : this WenJian by scripts/build/fp.ts ZiDongShengCheng , QingWuShouGai . 
- DaoRu : differenceInMonths as fn (../differenceInMonths.js) , convertToFP (./_lib/convertToFP.js) . 
- export const differenceInMonths = convertToFP(fn, 2); export default differenceInMonths (fallback for modularized imports) . 

## key points 
- use convertToFP(fn, 2) JiangLiangCanShuHanShuZhuan for FP FengGe ( TongChang for KeLiHua or CanShuShunXuGuDing ) , Bian at AnXuYin use and tree-shaking. 

## purpose 
as date-fns etc. Ku in differenceInMonths FP sub LuJingDaoChu , GongHanShuShiBianChengFengGeDiao use . 
