# IconGenerator - summary document 

to use HuTiGong `<content>` (IconGenerator Python Lei ) JianMing summary . 

## structure 
- Lei IconGenerator: __init__ ( Kong ) ; resize_image(size) use PIL Image.open + LANCZOS SuoFang ; create_icns(output_path) use 7 DangChiCunShengCheng ICNS; generate_icons(input_image) SheZhi self.input_image, An sizes char DianShengChengDuoWenJian to .icons_design_{timestamp}, ZuiHouDiao use create_icns ShengCheng icon.icns; __main__ ShiLi logo.png. 
- YiLai : os, PIL (Image, ImageOps, IcnsImagePlugin) , datetime. 

## key points 
- ** ShuRu **: by generate_icons(input_image) ChuanRu , Cun for self.input_image. 
- ** output directory **: .icons_design_%Y%m%d%H%M%S, not Cun in ZeChuangJian . 
- **sizes**: Han 128x128.png, 16x16.png, @2x, 256, 512, favicon, icon.ico, icon.png, Square*Logo, StoreLogo etc. , FuGaiChangJianPingTai and Store YaoQiu . 
- **ICNS**: 16/32/64/128/256/512/1024 QiDang , append_images XieRuDanWenJian . 
- ** ZhuYi **: resize_image in XunHuan in DuoCiDiao use HuiChongFu open TongYiWenJian , KeGai for ZhiDaKaiYiCiZaiDuoCi resize. 

## purpose 
CongDanZhangYuanTu batch LiangShengChengDuoChiCun PNG/ICO and macOS .icns, GongYing use TuBiao , WangZhan favicon, DuoPingTaiDaBao use . 
