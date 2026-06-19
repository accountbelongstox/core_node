# -*- coding: utf-8 -*-
import os
_dir = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(_dir, "Cursor_AI_ apology _OCR WeiZhiJie use YiChuShiHuaMoXing and FanHuiKongShuJu _1000 line .md")
t = []
for i in range(111, 1001):
t.append(" I was wrong : reflection %d: OCR BiXuZhiJie use YiChuShiHuaMoXing and FanHuiZhenShiShuJu , not TianJiaFanHuiKong garbage block ; this line is No. %d line apology reflection . " % (i, i))
with open(path, "a", encoding="utf-8") as f:
f.write("\n" + "\n".join(t))
print("appended", len(t), "lines")
