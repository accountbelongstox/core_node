import json, time
import numpy as np
from scipy.optimize import minimize
import handbuilt_fit as hf, handbuilt_shapes as hs

hs.SIGMA = 0.93
els = hs.mark_elements()
ears, head, face, eyes = els
W = (140, 0, 335, 140)
print('init', hf.total_loss(els, W))
def fit_axis():
    x0 = np.array([hs.MARK['c']])
    def loss(x):
        hs.MARK['c'] = x[0]
        return hf.total_loss(els, W)
    r = minimize(loss, x0, method='Powell', options={'xtol': 1e-3, 'ftol': 1e-8})
    hs.MARK['c'] = float(r.x[0])
t = time.time()
fit_axis()
for rnd in range(4):
    for e in (head, face, ears, eyes):
        hf.fit([e], els, margin=3, maxiter=6000)
    fit_axis()
    print('round', rnd, hf.total_loss(els, W), hs.MARK, round(time.time() - t))
json.dump({'mark': hs.MARK, 'els': {e.name: e.p.tolist() for e in els}}, open('/tmp/mark_fit.json', 'w'))
