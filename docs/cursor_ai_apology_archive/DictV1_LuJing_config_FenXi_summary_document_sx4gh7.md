# DictV1 QuanJuLuJing config FenXi - summary document [sx4gh7]

to use HuTiGong `<content>` (DictV1 QuanJuLuJing config FenXi ) JianMing summary . 

## structure 
QuanJuJingTaiWenJianCunChuLuJingFenXi (externalDataPath, external_data directory Shu , getFileUrl, URL MoShi ) Laravel QuanJuShuJuKuFenXi (deploy.sh, laravel_db, .env, DictV1 Zhuan use Ku ) LuJing config summary (4 Dian ) SheJiYouShi ( directory FenLi , DuoJiCunChu , URL YingShe ) config JianYi ( ShengChan / KaiFa .env) . 

## key points 
- ** WaiBuCunChu **: GenLuJing env('DICT_EXTERNAL_DATA_PATH', storage_path('app/external_data')); Han databases/ (word_main.db, cache_translate.db, legacy_data.db) , audio/, images/, cache/, markers/. 
- **URL**: getFileUrl ShengCheng url('/storage/external' + Xiang to LuJing ); FangWenMoShi http://domain.com/storage/external/{ Xiang to LuJing }. 
- **Laravel DB**: /www/wwwroot/laravel_main/laravel_db/database.sqlite; .env in DB_CONNECTION=sqlite, DB_DATABASE= LuJing . 
- ** WenJianChaZhao **: YinPin / TuPianZhiChiDuoKuoZhanMing (mp3/wav/ogg; jpg/png/gif/webp etc. ) . 
- ** SheJi **: DaiMa and ShuJuFenLi , KuangJiaJi and Ying use JiShuJuKuFenLi , JingTaiWenJianWaiBuHua , TongYi URL YingShe . 

## purpose 
note DictV1 and Laravel LuJing and CunChuSheJi , ZhiChiCong Node.js to Laravel QianYi and ShengChan / KaiFaHuanJing config . 
