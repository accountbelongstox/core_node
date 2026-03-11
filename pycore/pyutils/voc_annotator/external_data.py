# -*- coding: utf-8 -*-
# Deprecated: use patch_data (补丁图) instead. Project-level patch images, multi-source.
# This module delegates to patch_data for backward compatibility.

from . import patch_data

EXTERNAL_DATA_FILENAME = patch_data.EXTERNAL_DATA_FILENAME

def load_external_data(config_path):
    return patch_data.load_patch_data(config_path)

def save_external_data(config_path, base_dir, items):
    return patch_data.save_patch_data(config_path, base_dir, items)

def load_external_dir(directory):
    return patch_data.load_patch_dir(directory)
