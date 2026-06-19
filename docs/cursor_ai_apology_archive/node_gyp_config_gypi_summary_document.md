# node-gyp config.gypi summary document 

to use HuTiGong `<content>` (node-gyp in config.gypi JieXi and ShengChengLuoJi ) JianMing summary . 

## structure GaiLan 
- Node 'use strict' module ; YiLai fs (promises), log, path; DaoChu createConfigGypi, parseConfigGypi, getCurrentConfigGypi. 

## key points 
- **parseConfigGypi(config)**: QuDiao # ZhuShi , He and to ' JieWeiXu line Duo line char FuChuan , DanYinHaoGai for dual YinHaoHou JSON.parse, LuoJiLaiZi Node tools/js2c.py. 
- **getBaseConfigGypi**: DangCun in nodedir or disturl QieWeiZhiDing force-process-config when , DuQu nodeDir/include/node/config.gypi and JieXi ; ShiBai or item Jian not ManZu when FanHui process.config ShenKaoBei . 
- **getCurrentConfigGypi**: in base ShangBuQuan target_defaults, variables; QingKong defaults cflags/defines/include_dirs/libraries BiMianJiCheng it JiLuJing ; GenJu gyp.opts SheZhi default_configuration, target_arch, nodedir, python, standalone_static_library; Windows XiaSheZhi msbuild_toolset, msvs_windows_target_platform_version, arm64 when msvs_enable_marmasm, msbuild_path; Jiang gyp.opts in Wei in configDefs item to BianLiangXingShiXieRu ( JianMing in - Huan for _) . 
- **createConfigGypi**: Diao use getCurrentConfigGypi to config, JiangBuErZhiZhuan for char FuChuanHou JSON.stringify, XieRu buildDir/config.gypi, and JiaShangShengCheng note QianZhui . 

## purpose 
in node-gyp configure Jie segment ShengCheng or JieXi config.gypi, for YuanSheng module GouJianTiGong and DangQian Node, architecture , Python, VS etc. YiZhi GYP config . 
