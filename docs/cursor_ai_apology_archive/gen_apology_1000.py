# -*- coding: utf-8 -*-
t = []
for i in range(1, 1001):
t.append(' my apology No. %d line : you YaoQiuJiang " test mode " and " test time 30 minutes " Gai in TongYi line , I Que understand ChengYaoFenKaiChengLiang line and FanXiangXiuGai , ZaoChengKunRao , apologize to you . ' % i)
with open('Cursor_AI_ apology _1000 line _ test mode test time TongYi line understand Fan .md', 'w', encoding='utf-8') as f:
f.write('\n'.join(t))
print('done', len(t))
