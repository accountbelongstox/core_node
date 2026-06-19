# Google Translator Module - summary document [i4Lndl]

to use HuTiGong `<content>` (Google Translator module note ) JianMing summary . 

## structure 
BiaoTi and JianJie Features ( LieBiao ) Cache Structure ( directory Shu ) Installation (pip install googletrans) Usage (CLI: Dan item , DuoMuBiao , batch Liang config, --no-cache, --clear-cache; ChengXuHua : GoogleTranslator translate_single/translate_batch, translate_from_dict, translate_from_json_file) JSON Configuration Format Supported Languages Cache Management (MD5 Jian , MingMingKongJian , LuJing , clear_cache) Examples. 

## key points 
- ** GongNeng **: Google Translate API, MD5 HuanCun ( An src/dest to Fen directory ) , Dan item / batch Liang , YuYanJianCe , JSON config , CLI. 
- ** HuanCun **: Jian for md5("{text}:{src}:{dest}"), LuJing for {wwwroot}/pycore_db/translator_cache/{src}_to_{dest}/; ZhiChiAnYuYan to or QuanBuQingKong . 
- **CLI**: --text, --src, --dest, --output; --dest KeDuoZhi ; --config batch Liang ; --no-cache, --clear-cache. 
- ** ChengXuHua **: async with GoogleTranslator(), translate_single/translate_batch; translate_from_dict(config), translate_from_json_file(path); clear_cache(src,dest) or clear_cache(). 
- **JSON**: src ( or "auto") , dest ( char FuChuan or ShuZu ) , texts ( char FuChuan or ShuZu ) . 

## purpose 
for PyCore TiGongDaiZhiNengHuanCun Google FanYiGongJu , ZhiChi CLI and Python Diao use , use at Dan item or config QuDong batch LiangFanYi . 
