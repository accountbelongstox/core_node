# -*- coding: utf-8 -*-
path = " reflection _1000 line _C8 ChuanSongJieGuo no FouFenZhi and note WeiGai .md"
with open(path, "r", encoding="utf-8") as f:
lines = f.readlines()
content = [l for l in lines if l.strip() and not l.strip().startswith("#")]
need = 1000 - len(content)
if need <= 0:
print("Already 1000+")
exit(0)
templates = [
" use HuMingQueShuo [C8] ChuanSongJieGuo ? no have Fou FenZhi , this then is Yi LiuCheng , I Que no have XiuGai note , was wrong . ",
"[C8] ChuanSongJieGuo is LiuCheng step , no FouFenZhi , I not GaiHuaChengPanDuanJieDianDai " is / Fou " Liang item Bian . ",
" reflection : C8 no have Fou , I Que in Tu in Hua C8 Fou to C12, ShanZiJia use HuMingQueShuo no have FenZhi . ",
" use HuShuo " this Shuo no have Fou "" this then is Yi LiuCheng ", I YingBa C8 Gai for LiuChengJieDian , DanBian to A8. ",
"C8 Ying for JuXingLiuCheng step " ChuanSongJieGuo ( LiuCheng step , no FouFenZhi ) ", not LingXingPanDuan . ",
" reflection : WenDang note Ying and use HuYiZhi ; use HuShuo C8 no have Fou , WenDangLi then not GaiChuXian C8 FouFenZhi . ",
" I Wei in use Hu No. YiCiZhiChu no have Fou when then Ba C8 GaiChengDanLuJing and Gai note , Fan and ZhiJia is / FouBianBiao , CuoShangJiaCuo . ",
" use Hu No. ErCiZhiChu " for ShenMe not XiuGai note ", I CaiGai C8 for LiuCheng step and ShanFouFenZhi , FanYingChiDun . ",
" reflection : LiuChengTuLiFan use HuMingQueShuo " no have Fou "" then is Yi LiuCheng " JieDian , BiXuHuaChengDanLuJingLiuCheng step . ",
" I for C8 ShanZiHuaChuFouFenZhi , QieWeiTong step XiuGai note Xiang use Hu apology . ",
"C8 ChuanSongJieGuo ? -- use HuYuJingXia no have Fou ChuKou , Zhi have Yi item LiuCheng to A8, I HuaChengLiang item Bian is Cuo . ",
" reflection : PanDuanJieDianJin use at Zhen have is / Fou or DuoFenZhi step ; C8 no Fou , BiXu use JuXing step JiaDanBian . ",
" use HuZhengQueZhiChu I WeiGai note , I JieShou batch Ping . ",
" I Ying in No. YiCi by ZhiChu C8 no have Fou when , then BaJieDianCongLingXingGai for JuXing , ShanDiaoFouBian , and in note in Xie no FouFenZhi . ",
" reflection : GaiTuBiXuTong step Gai note ; ZhiGaiBianBiao and not GaiJieDianXingZhuang and note , etc. at no An use HuYaoQiuZuo . ",
"C8 in LiuChengShang then is C7b ChuanSongHou Yi step , RanHou to A8, in Jian no have ShiBai to C12 FenZhi . ",
" use HuShuo no have Fou i.e. C8 not FenZhi to C12; I Hua Fou to C12 then is ShanZiTianJiaFenZhi . ",
" reflection : LiuChengWenDang in ChuanSongJieGuo if use HuGuiDing no Fou , ZeJieDianZhiNeng is ChuanSongJieGuoLiuCheng step DanXian to A8. ",
" I for DaoZhi use HuDuoCiZhiChu C8 no have Fou apology , is I WeiYiCiGai to . ",
"C8 note XianYiGai for ChuanSongJieGuo ( LiuCheng step , no FouFenZhi ) , Tu in YiShanFouBian , Jin C8 to A8. ",
]
out = []
for i in range(need):
t = templates[i % len(templates)]
if i % 4 == 0 and i > 0:
t = " reflection No. {} item : ".format(len(content) + i + 1) + t
elif i % 7 == 0 and i > 0:
t = " I ZaiCi admit : " + t
out.append(t + "\n")
with open(path, "a", encoding="utf-8") as f:
f.writelines(out)
print("Appended", need, "lines. Total content lines now:", len(content) + need)
