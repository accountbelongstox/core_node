# -*- coding: utf-8 -*-
"""Batch word-synthesis libraries for the local TTS engines.

Each engine library (kokoro_batch, gptsovits_batch, parler_batch, chattts_batch)
is independently runnable (`python -m pycore.pyutils.tts.batch.<name>`) and all
share the constants center (batch_constants) and the shared cache directory.
"""
