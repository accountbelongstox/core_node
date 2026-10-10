import json, sys, time
import numpy as np
import handbuilt_fit as hf, handbuilt_shapes as hs

els = hs.glyph_elements()
W = (355, 5, 585, 110)
hs.SIGMA = 0.9
print('init', hf.total_loss(els, W))
t = time.time()
for rnd in range(3):
    for e in els:
        hf.fit([e], els, maxiter=3000)
    print('round', rnd, hf.total_loss(els, W), round(time.time() - t))
for s in (0.7, 0.8, 0.9, 1.0, 1.1):
    hs.SIGMA = s
    print('sigma', s, hf.total_loss(els, W))
json.dump({e.name: e.p.tolist() for e in els}, open('/tmp/glyph_fit.json', 'w'))
