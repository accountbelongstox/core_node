# Pattern (glob Pian segment ShiTu ) - summary document [NgOsTl]

to use HuTiGong `<content>` (glob Ku in Pattern Lei ) JianMing summary . 

## structure 
- DaoRu GLOBSTAR (minimatch) , isPatternList/isGlobList, customInspect. 
- export class Pattern: Si have char segment #patternList, #globList, #index, #platform, #rest, #globString, #isDrive, #isUNC, #isAbsolute, #followGlobstar; constructor(patternList, globList, index, platform) within JiaoYan and in index===0 when spec Hua UNC/drive/absolute Gen ; method [customInspect], pattern, isString, isGlobstar, isRegExp, globString, hasMore, rest, isUNC, isDrive, isAbsolute, root, checkFollowGlobstar, markFollowGlobstar; MoWei sourceMappingURL. 

## key points 
- ** JueSe **: Ji at LiangShuZu and index not KeBianShiTu , BiaoShi " DangQianPian segment " and HouXu rest. 
- ** Gen spec Hua **: index for 0 when , UNC (''/''/host/share) He and for Dan segment Jia /; drive (C:) or absolute (/) JiangShou segment and WeiBuKong segment He and for p1+'/', and Tong step GengXin globList and length. 
- ** PanDuan **: isUNC (win32, pl[0]==='', pl[1]==='', pl[2]/pl[3] FeiKong char FuChuan ) ; isDrive (win32, pl[0] PiPei /^[a-z]:$/i) ; isAbsolute (pl[0]==='' Qie length>1, or isDrive, or isUNC) . 
- **rest**: hasMore when new Pattern(..., index+1), and JiCheng #isAbsolute/#isUNC/#isDrive; FouZe null. 
- **globstar**: checkFollowGlobstar, markFollowGlobstar KongZhi ** is FouGenSuiFuHaoLianJie . 

## purpose 
in glob/minimatch TiXi in BiaoShi and BianLiYiJieXi pattern and glob Pian segment , ZhiChi Windows UNC, PanFu and Unix Jue to LuJing and globstar FuHaoLianJieGenSuiKongZhi . 
