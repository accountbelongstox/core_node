# -*- coding: utf-8 -*-
import os
d = os.path.dirname(os.path.abspath(__file__))
p183 = os.path.join(d, '_batch_18309_200.txt')
p185 = os.path.join(d, '_batch_18509_200.txt')
with open(p183, 'r', encoding='utf-8') as f:
    s = f.read()
s = s.replace('一八三零九', '一八五零九')
with open(p185, 'w', encoding='utf-8') as f:
    f.write(s)
print('done')
