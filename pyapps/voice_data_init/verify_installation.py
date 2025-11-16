#!/usr/bin/env python3
"""
Verify Voice Data Init Installation
Checks if all components are properly installed and importable
"""

from pycore.pyfoundations.color_print import ColorPrint


def verify_imports():
    """
    Verify all imports work correctly
    """
    ColorPrint.blue("=== Verifying Imports ===")

    try:
        from pycore.database.models import TableKeys, TableNamespaces
        ColorPrint.green("[OK] Database core imports")
    except ImportError as e:
        ColorPrint.red(f"[FAIL] Database core imports: {e}")
        return False

    try:
        from pycore.database.models import VoiceDictionariesModel, VoiceCacheDbDoneModel
        ColorPrint.green("[OK] Voice database models")
    except ImportError as e:
        ColorPrint.red(f"[FAIL] Voice database models: {e}")
        return False

    try:
        from pyapps.voice_data_init.service.word_init_service import WordInitService
        from pyapps.voice_data_init.service.olddb_import_service import OldDbImportService
        from pyapps.voice_data_init.service.word_validity_service import WordValidityService
        ColorPrint.green("[OK] Service modules")
    except ImportError as e:
        ColorPrint.red(f"[FAIL] Service modules: {e}")
        return False

    try:
        from pyapps.voice_data_init.controller.init_controller import InitController
        ColorPrint.green("[OK] Controller module")
    except ImportError as e:
        ColorPrint.red(f"[FAIL] Controller module: {e}")
        return False

    try:
        from pyapps.voice_data_init.voice_data_init_bus_keys import VoiceDataInitBusKeys, register_bus_keys
        ColorPrint.green("[OK] BusKeys module")
    except ImportError as e:
        ColorPrint.red(f"[FAIL] BusKeys module: {e}")
        return False

    try:
        from pyapps.voice_data_init import start, main
        ColorPrint.green("[OK] Main entry points")
    except ImportError as e:
        ColorPrint.red(f"[FAIL] Main entry points: {e}")
        return False

    return True


def verify_table_keys():
    """
    Verify table keys are registered
    """
    ColorPrint.blue("\n=== Verifying Table Keys ===")

    from pycore.database.models import TableKeys, TableNamespaces

    try:
        assert hasattr(TableNamespaces, 'APP_VOICE'), "APP_VOICE namespace not found"
        ColorPrint.green(f"[OK] APP_VOICE namespace: {TableNamespaces.APP_VOICE}")
    except AssertionError as e:
        ColorPrint.red(f"[FAIL] {e}")
        return False

    try:
        assert hasattr(TableKeys, 'VOICE_DICTIONARIES'), "VOICE_DICTIONARIES key not found"
        ColorPrint.green(f"[OK] VOICE_DICTIONARIES: {TableKeys.VOICE_DICTIONARIES}")
    except AssertionError as e:
        ColorPrint.red(f"[FAIL] {e}")
        return False

    try:
        assert hasattr(TableKeys, 'VOICE_CACHE_DB_DONE'), "VOICE_CACHE_DB_DONE key not found"
        ColorPrint.green(f"[OK] VOICE_CACHE_DB_DONE: {TableKeys.VOICE_CACHE_DB_DONE}")
    except AssertionError as e:
        ColorPrint.red(f"[FAIL] {e}")
        return False

    return True


def verify_database_available():
    """
    Verify database system is available
    """
    ColorPrint.blue("\n=== Verifying Database System ===")

    from pycore.database import DATABASE_AVAILABLE, database_manager

    if not DATABASE_AVAILABLE:
        ColorPrint.yellow("[WARNING] Database system not available")
        ColorPrint.yellow("This is normal if SQLAlchemy is not installed")
        return True

    ColorPrint.green("[OK] Database system available")

    try:
        database_manager.register_database("test_voice")
        ColorPrint.green("[OK] Database registration works")
    except Exception as e:
        ColorPrint.red(f"[FAIL] Database registration: {e}")
        return False

    return True


def verify_services_instantiation():
    """
    Verify services can be instantiated
    """
    ColorPrint.blue("\n=== Verifying Service Instantiation ===")

    try:
        from pyapps.voice_data_init.service.word_init_service import WordInitService
        service = WordInitService()
        ColorPrint.green("[OK] WordInitService instantiated")
    except Exception as e:
        ColorPrint.red(f"[FAIL] WordInitService: {e}")
        return False

    try:
        from pyapps.voice_data_init.service.olddb_import_service import OldDbImportService
        service = OldDbImportService()
        ColorPrint.green("[OK] OldDbImportService instantiated")
    except Exception as e:
        ColorPrint.red(f"[FAIL] OldDbImportService: {e}")
        return False

    try:
        from pyapps.voice_data_init.service.word_validity_service import WordValidityService
        service = WordValidityService()
        ColorPrint.green("[OK] WordValidityService instantiated")
    except Exception as e:
        ColorPrint.red(f"[FAIL] WordValidityService: {e}")
        return False

    try:
        from pyapps.voice_data_init.controller.init_controller import InitController
        controller = InitController()
        ColorPrint.green("[OK] InitController instantiated")
    except Exception as e:
        ColorPrint.red(f"[FAIL] InitController: {e}")
        return False

    return True


def main():
    """
    Run all verification checks
    """
    ColorPrint.blue("=" * 60)
    ColorPrint.blue("Voice Data Init - Installation Verification")
    ColorPrint.blue("=" * 60)

    all_passed = True

    all_passed = verify_imports() and all_passed
    all_passed = verify_table_keys() and all_passed
    all_passed = verify_database_available() and all_passed
    all_passed = verify_services_instantiation() and all_passed

    ColorPrint.blue("\n" + "=" * 60)
    if all_passed:
        ColorPrint.green("All verification checks PASSED!")
        ColorPrint.green("Voice Data Init is ready to use")
    else:
        ColorPrint.red("Some verification checks FAILED")
        ColorPrint.yellow("Please check the errors above")
    ColorPrint.blue("=" * 60)

    return all_passed


if __name__ == '__main__':
    import sys
    success = main()
    sys.exit(0 if success else 1)
