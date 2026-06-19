# @webassemblyjs/ast GongJuHanShu - summary document [VJMW7t]

to use HuTiGong `<content>` (WebAssembly JS AST FuZhu and GongJuHanShu ) JianMing summary . 

## structure 
- QianBan : Babel Yun line when FuZhu (_slicedToArray, _nonIterableRest, _unsupportedIterableToArray, _arrayLikeToArray, _iterableToArrayLimit, _arrayWithHoles, _typeof) . 
- HouBan : ES module DaoRu (./signatures, ./traverse, @webassemblyjs/helper-wasm-bytecode) , to and Duo export HanShu . 

## key points 
- ** Jie and YuanShuJu **: isAnonymous; getSectionMetadata/getSectionMetadatas (traverse Qu SectionMetadata) ; sortSectionMetadata ( An constants.sections PaiXu ) ; getEndOfSection. 
- ** JieDian and position Zhi **: assertHasLoc; orderedInsertNode ( An loc have XuChaRu , ModuleExport ZhiJie push) ; shiftLoc/shiftSection ( PianYi and section within JieDian position Zhi ) . 
- ** char JiePianYi **: getStartByteOffset/getEndByteOffset; getFunctionBeginingByteOffset ( Shou item ZhiLing ) ; getEndBlockByteOffset/getStartBlockByteOffset ( block Shou / block MoZhiLing ) . 
- ** Qi it **: signatureForOpcode ( Cong signatures Qu opcode QianMing ) ; getUniqueNameGenerator ( QianZhui + DiZeng unique Ming ) . 

## purpose 
for @webassemblyjs TiGong WASM AST JieYuanShuJuFangWen , JieDian have XuChaRu , position Zhi and char JiePianYiJiSuan , opcode QianMing and unique MingMing etc. , GongJieXi and ZhuanHuan WebAssembly use . 
