# IconGenerator Python Jiao this - summary document [THXbOa]

to use HuTiGong `<content>` (IconGenerator Lei ) JianMing summary . 

## structure 
- DaoRu : os, PIL (Image, ImageOps, IcnsImagePlugin) , datetime. 
- IconGenerator: __init__ no Can . resize_image(self, size): Image.open(self.input_image), resize(size, Image.Resampling.LANCZOS), FanHui . create_icns(self, output_path): sizes for 7 Zhong (16,32,64,128,256,512,1024), XunHuan resize to LieBiao , icon_images[0].save(output_path, format='ICNS', append_images=icon_images[1:]). generate_icons(self, input_image): self.input_image = input_image; sizes char Dian ( Jian for WenJianMing such as 128x128.png, icon.ico, StoreLogo.png etc. , Zhi for ( Kuan , Gao )) ; DangQian when Jian strftime('%Y%m%d%H%M%S'), output directory .icons_design_{current_time}; mkdir Hou to every (filename, size) resize and BaoCun ; ZuiHou create_icns(icon.icns). __main__: input_image="logo.png", ShiLiHuaHou generate_icons(input_image). 

## key points 
- DuoChiCun PNG/ICO and DanWenJian ICNS; Han favicon, Windows Store etc. MingMingYueDing ; output directory Dai when JianChuoBiMianFuGai . 

## purpose 
CongDanZhangTu batch LiangShengChengDuoPingTaiTuBiao ( Han .ico, .icns, favicon, Store TuBiao ) , GongZhuoMianYing use or WangYe use . 
