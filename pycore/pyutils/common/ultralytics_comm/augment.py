# -*- coding: utf-8 -*-
"""Image augmentation helpers (e.g. color jitter)."""

from pycore.pyfoundations.third_party.api import get_third_package_numpy



def color_jitter(img):
    """Random brightness/contrast jitter. Returns new (H,W,C) uint8 array."""
    np = get_third_package_numpy()
    out = img.astype(np.float64)
    if np.random.random() > 0.5:
        out = out * np.random.uniform(0.9, 1.1)
    if np.random.random() > 0.5:
        mean = out.mean()
        out = (out - mean) * np.random.uniform(0.9, 1.1) + mean
    return np.clip(out, 0, 255).astype(np.uint8)
