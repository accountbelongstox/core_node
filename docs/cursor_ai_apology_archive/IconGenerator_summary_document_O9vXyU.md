# IconGenerator - summary document [O9vXyU]

to use HuTiGong `<content>` (IconGenerator Python Lei ) JianMing summary . 

## structure 
- Lei IconGenerator: __init__ ( Kong ) ; resize_image(size) use PIL Image.open + LANCZOS SuoFang ; create_icns(output_path) use 7 DangChiCunShengCheng ICNS; generate_icons(input_image) SheZhi self.input_image, An sizes char DianShengChengDuoWenJian to .icons_design_{timestamp}, ZuiHouDiao use create_icns ShengCheng icon.icns; __main__ ShiLi logo.png. YiLai os, PIL, datetime. 

## key points 
- ShuRu by generate_icons(input_image) ChuanRu ; output directory .icons_design_%Y%m%d%H%M%S; sizes Han 128x128, 16x16, @2x, icon.ico, icon.png, Square*Logo, StoreLogo etc. ; ICNS for 16/32/64/128/256/512/1024 QiDang . 

## purpose 
CongDanZhangYuanTu batch LiangShengChengDuoChiCun PNG/ICO and macOS .icns, GongYing use TuBiao , favicon, DuoPingTaiDaBao use . 
