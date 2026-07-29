#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Check RPC v2 implementation consistency"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

print("=" * 70)
print("RPC v2 Consistency Check Report")
print("=" * 70)

# 1. Check sync route implementation
print("\n1. Checking WebSocket handler logic...")
fastapi_server_file = PROJECT_ROOT / "pycore" / "pyutils" / "rpc_v2" / "server" / "fastapi_server.py"

with open(fastapi_server_file, 'r', encoding='utf-8') as f:
    content = f.read()

    # Check return statements
    if 'return  # ✅ Sync route completed, exit handler' in content:
        ColorPrint.green("  [OK] Sync route success branch has return statement")
    else:
        ColorPrint.red("  [FAIL] Sync route success branch missing return statement")

    if 'return  # ✅ Sync route failed, exit handler' in content:
        ColorPrint.green("  [OK] Sync route failure branch has return statement")
    else:
        ColorPrint.red("  [FAIL] Sync route failure branch missing return statement")

    # Check notify_callback=None
    if 'notify_callback=None  # No callback for sync routes' in content:
        ColorPrint.green("  [OK] Sync routes use notify_callback=None")
    else:
        ColorPrint.yellow("  [WARN] Sync route notify_callback may be incorrect")

# 2. Check endpoint registration
print("\n2. Checking endpoint registration...")
api_main_file = PROJECT_ROOT / "pyapps" / "matrix" / "api" / "main.py"

with open(api_main_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

sync_routes = []
async_routes = []

for line in lines:
    if 'rpc_server.route(' in line:
        # Extract route name and sync parameter
        if "sync=True" in line:
            route_name = line.split("'")[1]
            sync_routes.append(route_name)
        elif "sync=False" in line:
            route_name = line.split("'")[1]
            async_routes.append(route_name)

print(f"\n  Sync routes (sync=True): {len(sync_routes)}")
for route in sorted(sync_routes):
    print(f"    - {route}")

print(f"\n  Async routes (sync=False): {len(async_routes)}")
print(f"    (Total {len(async_routes)} async routes)")

# 3. Check problematic routes
print("\n3. Checking potentially problematic routes...")
problematic_routes = [
    "device.batch_configure",
    "group.tree",
    "group.tree_update",
    "config.full",
    "config.global",
    "config.global_update",
]

for route in problematic_routes:
    if route in sync_routes:
        ColorPrint.blue(f"  {route}: Sync route [OK]")
    elif route in async_routes:
        ColorPrint.yellow(f"  {route}: Async route (should be sync?)")
    else:
        ColorPrint.red(f"  {route}: NOT FOUND!")

# 4. Summary
print("\n" + "=" * 70)
print("Summary")
print("=" * 70)
print(f"Total endpoints: {len(sync_routes) + len(async_routes)}")
print(f"Sync routes: {len(sync_routes)}")
print(f"Async routes: {len(async_routes)}")
print("=" * 70)
