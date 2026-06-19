# removePropertiesDeep module - summary document [XZykVm]

to use HuTiGong `<content>` (removePropertiesDeep ShiXian ) JianMing summary . 

## structure 
- "use strict"; Object.defineProperty(exports, "__esModule", { value: true }); exports.default = removePropertiesDeep. 
- DaoRu : _traverseFast (../traverse/traverseFast.js) , _removeProperties (./removeProperties.js) . 
- function removePropertiesDeep(tree, opts) { (0, _traverseFast.default)(tree, _removeProperties.default, opts); return tree; }
- MoWei //# sourceMappingURL=removePropertiesDeep.js.map

## key points 
- to AST tree Zuo traverseFast, in every JieDianShangYing use removeProperties(opts), Yuan XiuGaiHouFanHui tree. 

## purpose 
Babel etc. GongJu in ShenDuYiChu AST ShangZhiDingShuXing ( such as location, comments) , use at JianHua or spec HuaShu . 
