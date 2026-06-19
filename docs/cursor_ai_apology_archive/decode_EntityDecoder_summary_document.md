# decode.js (EntityDecoder) summary document 

this WenDang to use HuTiGong `<content>` (HTML/XML ShiTiJieMa module ) ZuoJianMing summary . 

## structure GaiLan 
- ** YiLai **: `generated/decode-data-html.js`, `decode-data-xml.js` ( JieMa use trie) ; `decode-codepoint.js` (replaceCodePoint, fromCodePoint) . 
- ** ChangLiang and MeiJu **: CharCodes (# ; = 0-9 a-f x z A-F Z) , TO_LOWER_BIT, BinTrieFlags (VALUE_LENGTH/BRANCH_LENGTH/JUMP_TABLE) , EntityDecoderState (EntityStart, NumericStart, NumericDecimal, NumericHex, NamedEntity) , DecodingMode (Legacy, Strict, Attribute) . 
- ** HeXinLei **: EntityDecoder (decodeTree, emitCodePoint, errors; state, consumed, result, treeIndex, excess, decodeMode) ; method startEntity, write, stateNumericStart/Decimal/Hex, addToNumericResult, emitNumericEntity, stateNamedEntity, emitNotTerminatedNamedEntity, emitNamedEntityData, end. 
- ** FuZhu **: getDecoder(decodeTree) FanHui decodeWithTrie; determineBranch(decodeTree, current, nodeIndex, char) use at trie FenZhiChaZhao . 
- ** to Wai API**: decodeHTML, decodeHTMLAttribute, decodeHTMLStrict, decodeXML; and DaoChu htmlDecodeTree, xmlDecodeTree and decodeCodePoint XiangGuan . 

## key points 
- ShiTiJieXi for ZhuangTaiJi : `&` HouYu `#` JinRuShuZhiFenZhi ( ZaiFen x ShiLiuJinZhi / ShiJinZhi ) , FouZe for MingMingShiTi , use trie Zhu char FuPiPei . 
- write() KeDuoCiDiao use to ZhiChi not WanZhengShuRu ; FanHuiXiaoHao char FuShu , not WanZheng when FanHui -1; end() use at ShuRuJieShu when ShouWei and CuoWuBaoGao . 
- Strict YaoQiuShiTi to FenHaoJieWei ; Attribute MoShiXiaShuXing within to JieWei char Fu have XianZhi (isEntityInAttributeInvalidEnd) ; Legacy YunXu no FenHao . 
- MingMingShiTiTongGuo BinTrieFlags Cong trie JieDianQu valueLength, branchCount, jumpOffset, determineBranch ZhiChiDanFenZhi , TiaoZhuanBiao , char DianErFenSanZhongChaZhao . 

## purpose 
in HTML/XML JieXiQi in JieMa char FuYin use ( such as &amp; &#123; &#x7B; and MingMingShiTi ) , Gong htmlparser2 etc. Ku use , and QuFenWen this / ShuXing and YanGeMoShi . 
