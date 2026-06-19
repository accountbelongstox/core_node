# ZhuTi and YangShiKaiFa spec summary document 

this WenDang to use HuTiGong < ZhuTi and YangShiKaiFa spec > ZuoJianMing summary . 

## structure GaiLan 
- WenDang for Markdown, Han architecture GaiShu , HeXinYuanZe ( ZhuZhuTi / sub APP KuoZhanZhuTi / YeMianZuJian ) , YangShiWenJian structure , Nuxt config , BianLiang and LeiMingMing , AnSeZhuTi , XiangYingShi , BiXuZunShou GuiZe , QianYiJiuDaiMa step , CodeMart ShiLi , JianChaQingDan and summary . 

## key points 
- ** ZhuZhuTi ** (common/styles/theme-base.css) : DingYiSuo have GongGong CSS BianLiang ( YanSe , JianJu , char Ti etc. ) and Tong use GongJuLei ; sub APP JunJiCheng . 
- ** sub APP KuoZhanZhuTi ** (apps/app_*/styles_app_*/theme-*.css) : JiChengZhuZhuTi , JinDingYi sub APP ZhuanShuBianLiang and ZuJianLei ; not SuiYiFuGaiZhuZhuTiBianLiang . 
- ** YeMianZuJian **: JinZhi use `<style>`; JinTongGuo class Yin use ZhuTi in YiDingYiYangShi ; DongTaiYangShi use inline style + CSS BianLiang ; ZuJianDingBuJianYiJiaKaiFa spec ZhuShi . 
- ** MingMing **: ZhuZhuTi such as --primary-color, .container; sub APP such as --codemart-primary, .codemart-card. 
- ** AnSe **: ZhuZhuTi and sub APP JunZhiChi [data-theme='dark'] FuGaiBianLiang . 
- **Nuxt**: css ShuZuXianJiaZai theme-base.css, ZaiAn APP_ENTRY DongTaiJiaZai sub APP ZhuTi . 

## purpose 
for poly_apps/nuxt_main Duo sub APP TiGongTongYi ZhuTi and YangShi architecture spec , QueBaoYangShiKeWeiHu , KeZhuTiQieHuan and BiMianChongTu . 
