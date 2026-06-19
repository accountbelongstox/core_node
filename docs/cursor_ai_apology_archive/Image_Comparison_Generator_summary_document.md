# Image Comparison Generator Tool summary document 

to use HuTiGong `<content>` (Python TuXiang to BiPinTuShengChengGongJu ) JianMing summary . 

## structure GaiLan 
- Python 3 Jiao this , shebang, module docstring; YiLai argparse, pathlib, PIL (Image, ImageDraw, ImageFont) ; Lei ImageComparisonGenerator(target_directory); main() JieXi directory CanShu and Diao use generate_comparison(). 

## key points 
- ** ShuRu **: ZhiDing directory XiaZhiChi TuPian (.jpg/.jpeg/.png/.bmp/.gif/.tiff/.webp) , PaiChuWenJianMingHan _comparison_collage YiShengChengTu , AnWenJianMingPaiXu . 
- ** BiaoQian **: AnSuoYinShengCheng A, B, C..., ChaoGuo 26 Zhang use AA, AB.... 
- ** BuJu **: calculate_collage_size JiSuanWangGe ( ZuiDuo 4 Lie ) , SuoLveTu 300300, JianJu and BiaoQianGaoDu ; ZongHuaBuHanBianJu and BiaoTiQu . 
- ** HuiZhi **: BaiDi , BiaoTi "Image Comparison - N Images", every ZhangSuoLveTuBaoChiBiLiJu in ZhanTie , XiaFang "Image A" etc. BiaoQian and DuanWenJianMing ; JiaZaiShiBai when HuaHongSeZhan position and CuoWuXinXi . 
- ** output **: comparison_collage_N_images_comparison_collage.jpg, if YiCun in ZeTiShi is FouFuGai . 

## purpose 
Jiang directory within DuoZhangTuPianHeChengYiZhangDai A/B/C BiaoQian to BiTu , Bian at RenGong or AI Jin line TuXiang to Bi . 
