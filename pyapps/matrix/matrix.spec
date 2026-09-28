# -*- mode: python ; coding: utf-8 -*-
# Matrix Application PyInstaller Spec
# Entry: pymain.py app=matrix (actual call chain)

block_cipher = None

# Collected resources
added_files = [
    (r'D:/programing/core_node/pyapps/matrix/resources', 'resources'),
    (r'D:/programing/core_node/pycore', 'pycore'),
]

# Hidden imports (third-party packages used by matrix)
hiddenimports = [
    # Pycore modules
    'pycore',
    'pycore.pyfoundations',
    'pycore.pyfoundations.app_launcher',
    'pycore.pyutils',
    'pycore.pyutils.native_ui',
    'pycore.pyutils.rpc',
    'pycore.pyfoundations.pygvar',
    'pycore.pyheartbeat',
    'pycore.database',

    # Matrix app modules
    'pyapps.matrix',
    'pyapps.matrix.matrix_main',
    'pyapps.matrix.matrix_config',
    'pyapps.matrix.api',
    'pyapps.matrix.controller',
    'pyapps.matrix.adb_device_manager',

    # Third-party packages
    'fastapi',
    'uvicorn',
    'websockets',
    'PySide6',
    'PySide6.QtCore',
    'PySide6.QtGui',
    'PySide6.QtWidgets',
    'PySide6.QtWebEngineWidgets',
    'PySide6.QtWebEngineCore',
    'aiohttp',
    'requests',
    'psutil',
    'netifaces',
    'PIL',
    'cv2',
    'numpy',
    'adb_shell',
    'av',
    'sqlalchemy',
    'pystray',
]

a = Analysis(
    [r'D:/programing/core_node/pymain.py'],
    pathex=[r'D:/programing/core_node'],
    binaries=[],
    datas=added_files,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='Matrix',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=r'D:/programing/core_node/pyapps/matrix/resources/icon.ico' if True else None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='Matrix',
)
