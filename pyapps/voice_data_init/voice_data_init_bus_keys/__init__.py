#!/usr/bin/env python3
"""
Voice Data Init - BusKeys Registration
Simple event keys for voice data initialization
"""


class VoiceDataInitBusKeys:
    """
    Voice Data Init specific BusKeys

    All keys use 'voice_data_init.' prefix for namespace isolation
    """

    INIT_STARTED = "voice_data_init.init_started"
    INIT_COMPLETED = "voice_data_init.init_completed"
    INIT_FAILED = "voice_data_init.init_failed"

    WORD_IMPORT_STARTED = "voice_data_init.word_import_started"
    WORD_IMPORT_PROGRESS = "voice_data_init.word_import_progress"
    WORD_IMPORT_COMPLETED = "voice_data_init.word_import_completed"

    OLDDB_IMPORT_STARTED = "voice_data_init.olddb_import_started"
    OLDDB_IMPORT_PROGRESS = "voice_data_init.olddb_import_progress"
    OLDDB_IMPORT_COMPLETED = "voice_data_init.olddb_import_completed"

    VALIDITY_CHECK_STARTED = "voice_data_init.validity_check_started"
    VALIDITY_CHECK_PROGRESS = "voice_data_init.validity_check_progress"
    VALIDITY_CHECK_COMPLETED = "voice_data_init.validity_check_completed"

    SERVER_SYNC_STARTED = "voice_data_init.server_sync_started"
    SERVER_SYNC_PROGRESS = "voice_data_init.server_sync_progress"
    SERVER_SYNC_COMPLETED = "voice_data_init.server_sync_completed"
    SERVER_SYNC_FAILED = "voice_data_init.server_sync_failed"


def register_bus_keys():
    """
    Register all voice data init bus keys

    Note: This is a simplified implementation for standalone usage.
    In full integration with THREAD_BUS, implement proper registration.
    """
    pass


__all__ = ['VoiceDataInitBusKeys', 'register_bus_keys']
