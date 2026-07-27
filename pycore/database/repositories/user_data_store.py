# -*- coding: utf-8 -*-
"""Canonical user-data store namespace (V10 bridge)."""

from pycore.pyfoundations.user_data_store import *  # noqa: F401,F403
from pycore.pyfoundations.user_data_store import (
    STORE_FILE_NAME,
    UserDataStore,
    UserDataStoreThread,
    get_user_data_store,
)

__all__ = [
    "UserDataStore",
    "UserDataStoreThread",
    "get_user_data_store",
    "STORE_FILE_NAME",
]
