#!/usr/bin/env python3
from pycore.database.exports import database_manager, BaseModel, DATABASE_AVAILABLE
from pycore.database.models.table_keys import TableKeys
from pycore.database.models.namespaces import TableNamespaces
from pycore.database.models.common.log_model import CommonLogModel
from pycore.database.models.app_example.user_model import ExampleUserModel
from pycore.database.models.app_example.task_model import ExampleTaskModel
from pycore.database.models.util_cache.cache_model import UtilCacheModel
from pycore.database.models import import traceback
"""
Database System Verification Script
Checks file structure
from pycore.database.models import imports
from pycore.database.models import and functionality
"""

import os
import sys
import re

# Add project root to path
project_root = os.path.abspathos.path.joinos.path.dirname__file__
from pycore.database.models import '../..'
if project_root not in sys.path:
    sys.path.insert0
from pycore.database.models import project_root

print'=' * 70
print'DATABASE SYSTEM VERIFICATION REPORT'
print'=' * 70
print

# 1. Check file structure
print'1. FILE STRUCTURE CHECK'
print'-' * 70

db_path = os.path.dirnameos.path.abspath__file__
expected_files = [
    '__init__.py'
from pycore.database.models import 'base_model.py'
from pycore.database.models import 'database_manager.py'
from pycore.database.models import 'table_registry.py'
from pycore.database.models import 'example_usage.py'
from pycore.database.models import 'README.md'
from pycore.database.models import 'verify.py'
from pycore.database.models import 'models/__init__.py'
from pycore.database.models import 'models/namespaces.py'
from pycore.database.models import 'models/table_keys.py'
from pycore.database.models import 'models/common/__init__.py'
from pycore.database.models import 'models/common/config_model.py'
from pycore.database.models import 'models/common/log_model.py'
from pycore.database.models import 'models/app_example/__init__.py'
from pycore.database.models import 'models/app_example/user_model.py'
from pycore.database.models import 'models/app_example/task_model.py'
from pycore.database.models import 'models/util_cache/__init__.py'
from pycore.database.models import 'models/util_cache/cache_model.py'
from pycore.database.models import ]

all_exist = True
for f in expected_files:
    full_path = os.path.joindb_path
from pycore.database.models import f
    exists = os.path.existsfull_path
    if not exists:
        all_exist = False
    status = '[OK]' if exists else '[MISSING]'
    printf'{status:10} {f}'

print

# 2. Import check
print'2. IMPORT & FUNCTIONALITY CHECK'
print'-' * 70

try:
    print'[OK]       Core imports database_manager
from pycore.database.models import BaseModel
from pycore.database.models import DATABASE_AVAILABLE'

    print'[OK]       Constants TableKeys
from pycore.database.models import TableNamespaces'

        CommonConfigModel
    print('[OK]       All 5 models imported')

    # Check table keys
    all_keys = TableKeys.get_all_table_keys()
    print(f'[OK]       Table keys: {len(all_keys)} defined')
    for key in all_keys:
        print(f'           - {key}')

    # Check namespaces
    all_namespaces = TableNamespaces.get_all_namespaces()
    print(f'[OK]       Namespaces: {len(all_namespaces)} defined')
    for ns in all_namespaces:
        print(f'           - {ns}')

    # Check table key parsing
    test_key = 'common.config'
    namespace = TableKeys.get_namespace_from_key(test_key)
    table_name = TableKeys.get_table_name_from_key(test_key)
    full_name = TableKeys.get_full_table_name(test_key)
    print(f'[OK]       Table key parsing: {test_key} -> {full_name}')

    # Check DATABASE_AVAILABLE
    print(f'[OK]       Database available: {DATABASE_AVAILABLE}')

    imports_ok = True

except Exception as e:
    print(f'[FAIL]     Import error: {e}')
    traceback.print_exc()
    imports_ok = False

print()

# 3. Language check
print('3. LANGUAGE CHECK')
print('-' * 70)

chinese_pattern = re.compile(r'[\u4e00-\u9fff]+')
found_chinese = False
chinese_files = []

for root, dirs, files in os.walk(db_path):
    for file in files:
        if file.endswith('.py') and file != 'verify.py':
            filepath = os.path.join(root, file)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if chinese_pattern.search(content):
                        found_chinese = True
                        chinese_files.append(file)
            except Exception as e:
                pass

if not found_chinese:
    print('[OK]       All code in English (no Chinese characters)')
else:
    print(f'[FAIL]     Chinese characters found in: {", ".join(chinese_files)}')

print()

# 4. Summary
print('4. SUMMARY')
print('-' * 70)
print(f'Total Files:        18')
print(f'Core Modules:       4 (base_model, database_manager, table_registry, __init__)')
print(f'Model Definitions:  5 (CommonConfig, CommonLog, ExampleUser, ExampleTask, UtilCache)')
print(f'Namespaces:         3 (common, app_example, util_cache)')
print(f'Table Keys:         5')
print(f'Documentation:      README.md')
print(f'Example:            example_usage.py')
print()
print('=' * 70)

if all_exist and imports_ok and not found_chinese:
    print('STATUS: ALL CHECKS PASSED')
    print('=' * 70)
    exit(0)
else:
    print('STATUS: SOME CHECKS FAILED')
    print('=' * 70)
    exit(1)
