# -*- coding: utf-8 -*-
"""Register stable non-UI TTS synthesis controllers on HTTP API."""

from pycore.callmodule.rpc_routes.route_names import TTS_SYNTHESIZE
from pycore.pyctl.tts.speech_synthesis_service import synthesize_speech


def register_tts_routes(server) -> None:
    """Register stable TTS synthesis routes backed by the TTS orchestrator."""

    server.post(path=TTS_SYNTHESIZE, handler=synthesize_speech)
