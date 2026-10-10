import json, time
import numpy as np
from scipy.optimize import minimize
import handbuilt_fit as hf, handbuilt_shapes as hs

hs.SIGMA = 0.93
els = hs.sub_elements()
W = (355, 106, 585, 132)
S = hs.SHARED
def shared_fit():
    keys = ['yt', 'yb', 'w', 'alpha']
    x0 = np.array([S[k] for k in keys])
    def loss(x):
        for k, v in zip(keys, x): S[k] = v
        return hf.total_loss(els, W)
    r = minimize(loss, x0, method='Powell', options={'xtol': 1e-3, 'ftol': 1e-8})
    for k, v in zip(keys, r.x): S[k] = float(v)
print('init', hf.total_loss(els, W), S)
for rnd in range(3):
    for e in els:
        hf.fit([e], els, margin=3)
    shared_fit()
    print('round', rnd, hf.total_loss(els, W), S)
json.dump({'shared': S, 'els': {e.name: e.p.tolist() for e in els}}, open('/tmp/sub_fit.json', 'w'))
for e in els: print(e.name, np.round(e.p, 2).tolist())
