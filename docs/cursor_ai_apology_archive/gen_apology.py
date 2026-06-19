# -*- coding: utf-8 -*-
import os
path = os.path.join(os.path.dirname(__file__), 'Cursor_AI_ apology _ FuZhu panel 3 Lie etc. Kuan and Ai in YiQi _1000 line .md')
with open(path, 'r', encoding='utf-8') as f:
t = f.read()
base = [
" this RenWeiJiangSanLieShe for etc. Kuan , in Ci apology . ",
" this RenJiangAi in YiQiWuZuoChengTongYiLie , in Ci apology . ",
" etc. Kuan i.e. SanLie weight=1 uniform XiangTong , this RenWeiZuo to , in Ci apology . ",
" Ai in YiQi i.e. TongYi line HengKuaZheng line columnspan=3, this RenWuZuoCheng col0 within Duo line , in Ci apology . ",
" use HuZhiChuHou this RenCaiGai , WeiYiCiZuo to , in Ci apology . ",
" this RenWei understand " not TongYiLie " i.e. not YaoQuanDui in col0, in Ci apology . ",
" FuZhu panel BuJuXuQiu by this RenDuoCi understand Cuo , in Ci apology . ",
" this RenYing No. YiCi then ShiXianSanLie etc. Kuan , in Ci apology . ",
" this RenYing No. YiCi then JiangShang left use at JiSuanXia right Fang in Yi line and columnspan=3, in Ci apology . ",
" because this RenCuoWuDaoZhi use HuFanFuJiuZheng , in Ci apology . ",
]
idx = t.rfind('\n30. ')
if idx == -1:
idx = t.rfind('\n10. ')
if idx == -1:
idx = len(t)
head = t[:idx+1]
with open(path, 'w', encoding='utf-8') as f:
f.write(head)
for i in range(31, 1001):
f.write("%d. %s\n" % (i, base[(i - 1) % len(base)]))
print("done 1000 lines")
