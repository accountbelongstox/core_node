# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

import sys
import os
import json
from typing import Dict, List, Any

project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
sys.path.insert(0, project_root)

from pycore.pyutils.nodejs_bridge import BridgeWrapper


class DataProcessor:
    """
    Advanced data processor with multiple operations
    """

    def __init__(self):
        self.bridge = BridgeWrapper()

    def process_data(self, data: List[Dict[str, Any]], operation: str) -> Dict[str, Any]:
        """
        Process data with specified operation
        """
        operations = {
            'filter': self._filter_data,
            'transform': self._transform_data,
            'aggregate': self._aggregate_data,
            'sort': self._sort_data
        }

        if operation not in operations:
            raise ValueError(f"Unknown operation: {operation}")

        result = operations[operation](data)
        return result

    def _filter_data(self, data: List[Dict]) -> Dict:
        """Filter data based on conditions"""
        filtered = [item for item in data if item.get('active', False)]
        return {
            'operation': 'filter',
            'original_count': len(data),
            'filtered_count': len(filtered),
            'data': filtered
        }

    def _transform_data(self, data: List[Dict]) -> Dict:
        """Transform data structure"""
        transformed = [
            {
                **item,
                'transformed': True,
                'timestamp': str(item.get('timestamp', ''))
            }
            for item in data
        ]
        return {
            'operation': 'transform',
            'count': len(transformed),
            'data': transformed
        }

    def _aggregate_data(self, data: List[Dict]) -> Dict:
        """Aggregate data statistics"""
        numeric_fields = {}

        for item in data:
            for key, value in item.items():
                if isinstance(value, (int, float)):
                    if key not in numeric_fields:
                        numeric_fields[key] = []
                    numeric_fields[key].append(value)

        aggregates = {}
        for field, values in numeric_fields.items():
            aggregates[field] = {
                'sum': sum(values),
                'avg': sum(values) / len(values),
                'min': min(values),
                'max': max(values),
                'count': len(values)
            }

        return {
            'operation': 'aggregate',
            'total_records': len(data),
            'aggregates': aggregates
        }

    def _sort_data(self, data: List[Dict]) -> Dict:
        """Sort data"""
        sorted_data = sorted(data, key=lambda x: x.get('id', 0))
        return {
            'operation': 'sort',
            'count': len(sorted_data),
            'data': sorted_data
        }


def main():
    """
    Main entry point
    """
    bridge = BridgeWrapper()

    try:
        params = bridge.get_params_from_stdin()

        data = params.get('data', [])
        operation = params.get('operation', 'filter')

        processor = DataProcessor()
        result = processor.process_data(data, operation)

        bridge.send_result(result)

    except Exception as e:
        import traceback
        bridge.send_error(str(e), traceback.format_exc())


if __name__ == '__main__':
    main()
