# History Processing Architecture

## Overview

This module provides a clean, layered architecture for parsing, aggregating, and formatting history.txt files from RoS-BoT.

## Directory Structure

```
d3utils/history/
├── __init__.py              # Unified public interface
├── base.py                  # Abstract base classes and interfaces
├── compat.py                # Backward compatibility layer
├── parser/                  # Parsing layer
│   ├── __init__.py
│   ├── parser_v1.py        # V1: TAB + content_indent (rosbot_history_parser)
│   ├── parser_v2.py        # V2: Multi-level indent enhanced
│   ├── parser_v3.py        # V3: Two-pass parsing
│   ├── parser_v4.py        # V4: State machine
│   ├── parser_v5.py        # V5: Regex + indent stack
│   └── parser_v6.py        # V6: Multi-level indent simplified
├── aggregator/              # Aggregation layer
│   ├── __init__.py
│   └── time_window_aggregator.py  # Time window aggregation
├── formatter/               # Formatting layer
│   ├── __init__.py
│   └── stats_formatter.py  # Stats formatting (14-line format)
└── organizer/               # High-level organizer layer
    ├── __init__.py
    ├── base_organizer.py    # Base organizer implementation
    ├── organizer_v1.py      # Organizer V1
    ├── organizer_v2.py      # Organizer V2
    ├── organizer_v3.py      # Organizer V3
    ├── organizer_v4.py      # Organizer V4
    ├── organizer_v5.py      # Organizer V5
    ├── organizer_v6.py      # Organizer V6
    └── registry.py           # Singleton registry and factory
```

## Architecture Layers

### 1. Parser Layer (`parser/`)

**Purpose**: Convert raw lines to structured blocks

**Interface**: `HistoryParser`
- `parse_lines(lines: List[str], max_lines: int = 0) -> List[BlockDict]`

**Implementations**:
- **V1**: Uses `rosbot_history_parser` for TAB + content_indent parsing
- **V2**: Multi-level indent with content_indent rules (based on approach2)
- **V3**: Two-pass parsing (boundaries then fields)
- **V4**: State machine with line type classification
- **V5**: Regex patterns + indent stack
- **V6**: Multi-level indent using `indent_key_to_level_history`

**Block Format**: Each block is a dict with:
- `head_time`: Optional[float] - Timestamp (epoch seconds)
- `head_kind`: str - "Session" or "Rift"
- `earned`: Dict[str, int] - Earned values

### 2. Aggregator Layer (`aggregator/`)

**Purpose**: Combine blocks into aggregated statistics

**Interface**: `HistoryAggregator`
- `aggregate(blocks: List[BlockDict], start_epoch: float) -> Tuple[EarnedDict, int, int, int, int]`

**Implementations**:
- **TimeWindowAggregator**: Aggregates blocks in time window [start_epoch, ...]
  - Finds last Session
  - Calculates baseline keys from previous Sessions
  - Aggregates last Session's earned + Rifts in window

**Returns**: `(earned_dict, game_count, total_duration_seconds, last_run_duration_seconds, baseline_keys)`

### 3. Formatter Layer (`formatter/`)

**Purpose**: Convert aggregated data to output lines

**Interface**: `HistoryFormatter`
- `format_stats_lines(earned, game_count, last_run_duration, boting_seconds, baseline_keys) -> List[str]`

**Implementations**:
- **HistoryStatsFormatter**: Produces 14-line stats format compatible with `APPROXIMATE_STATS_LINES`

### 4. Organizer Layer (`organizer/`)

**Purpose**: High-level interface combining parser + aggregator + formatter

**Interface**: `HistoryOrganizer`
- `get_log_path() -> str`
- `seek_to_end() -> int`
- `read_new_lines() -> Tuple[int, List[str]]`
- `get_latest_stats_as_lines(min_entry_ts: Optional[float] = None) -> List[str]`
- `poll_once_and_get_stats_lines() -> List[str]`

**Implementations**:
- **V1-V6**: Each combines corresponding parser + TimeWindowAggregator + HistoryStatsFormatter

**Registry**: `get_history_organizer(history_path, version="v1")` returns cached singleton

## Usage

### Basic Usage

```python
from d3utils.history import get_history_organizer, get_default_history_path

# Get organizer (default: v1)
org = get_history_organizer(get_default_history_path(), version="v1")

# Poll for latest stats
lines = org.poll_once_and_get_stats_lines()
for line in lines:
    print(line)
```

### Time Window Aggregation

```python
import time

org = get_history_organizer(history_path, version="v2")
start_epoch = time.time() - 3600  # Last hour
lines = org.get_latest_stats_as_lines(min_entry_ts=start_epoch)
```

### Using Specific Parser

```python
from d3utils.history.parser import HistoryParserV2
from d3utils.history.aggregator import TimeWindowAggregator
from d3utils.history.formatter import HistoryStatsFormatter

parser = HistoryParserV2()
aggregator = TimeWindowAggregator()
formatter = HistoryStatsFormatter()

# Parse
blocks = parser.parse_lines(lines)

# Aggregate
earned, game_count, total_dur, last_dur, baseline = aggregator.aggregate(blocks, start_epoch)

# Format
stats_lines = formatter.format_stats_lines(earned, game_count, last_dur, boting_seconds, baseline)
```

## Backward Compatibility

The `compat.py` module provides backward-compatible functions for existing code:

- `get_history_info_organizer()` → `get_history_organizer(version="v1")`
- `get_history_info_organizer_1()` → `get_history_organizer(version="v1")`
- `get_history_info_organizer_approach2()` → `get_history_organizer(version="v2")`
- `get_stats_lines_in_time_window_approach3()` → Uses v3 organizer
- etc.

## Migration from Old Code

Old code using:
- `history_info_organizer_1.py` → Use `get_history_organizer(version="v1")`
- `history_info_organizer_approach2.py` → Use `get_history_organizer(version="v2")`
- `history_info_organizer_3.py` → Use `get_history_organizer(version="v3")`
- `history_info_organizer_approach4.py` → Use `get_history_organizer(version="v4")`
- `history_info_organizer_approach5.py` → Use `get_history_organizer(version="v5")`
- `history_info_organizer_6.py` → Use `get_history_organizer(version="v6")`

## Benefits

1. **Clear Separation of Concerns**: Parser, aggregator, and formatter are independent
2. **Reusability**: Same aggregator/formatter can be used with different parsers
3. **Testability**: Each layer can be tested independently
4. **Extensibility**: Easy to add new parsers, aggregators, or formatters
5. **Consistency**: Unified interface across all versions
6. **Backward Compatibility**: Existing code continues to work via compat layer

## Future Improvements

1. Add more aggregators (e.g., block-level, session-level)
2. Add more formatters (e.g., JSON, CSV)
3. Optimize parsers for large files (streaming, incremental parsing)
4. Add caching layer for parsed blocks
5. Add validation layer for parsed data
