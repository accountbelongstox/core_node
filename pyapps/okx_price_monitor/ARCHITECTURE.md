# OKX Price Monitor - Architecture Documentation

## Project Structure

```
pyapps/okx_price_monitor/
├── lib/                          # Layer 1: Low-level library
│   ├── __init__.py              # Exports: OKXClient, create_okx_client, OKXAuth, parse_rpc_response
│   ├── okx_client.py            # Unified OKX API client (using python-okx)
│   ├── okx_auth.py              # OKX authentication helper (legacy)
│   ├── models.py                # Database models
│   └── rpc_utils.py             # RPC utility functions
├── core/                        # Layer 2: Core configuration
│   ├── __init__.py              # Exports: config, timestamp_ms
│   ├── config.py                # Central configuration class OKXAPIConfig
│   └── utils.py                 # Core utility functions
├── foundation/                  # Layer 3: Foundation services
│   ├── __init__.py              # Exports: CoinProvider, Printer
│   ├── coin_provider.py         # Coin data provider (uses OKXClient)
│   ├── database_handler.py      # Database handler
│   └── printer.py               # Output utilities
├── services/                    # Layer 4: Business logic
│   ├── __init__.py              # Exports: PriceMonitor, TradingStrategy, TradeExecutor, GridDisplay
│   ├── price_monitor.py         # Price monitoring service
│   ├── trading_strategy.py      # Trading strategy
│   ├── trade_executor.py        # Trade execution
│   └── grid_display.py          # Grid display
└── okx_price_monitor_main.py   # Main entry point
```

## Layer Dependencies (层级依赖)

```
Layer 4 (services)      depends on →  Layer 3 (foundation)
Layer 3 (foundation)    depends on →  Layer 2 (core) + Layer 1 (lib)
Layer 2 (core)          depends on →  pycore only
Layer 1 (lib)           depends on →  pycore + python-okx
```

**Rule**: Higher layers can import from lower layers, but NOT vice versa.

## Package Exports (包导出)

### lib/__init__.py
```python
from pyapps.okx_price_monitor.lib.okx_client import OKXClient, create_okx_client
from pyapps.okx_price_monitor.lib.okx_auth import OKXAuth
from pyapps.okx_price_monitor.lib.rpc_utils import parse_rpc_response

__all__ = [
    'OKXClient',          # Unified OKX client class
    'create_okx_client',  # Client factory function
    'OKXAuth',           # Authentication helper class
    'parse_rpc_response', # RPC response parser
]
```

### core/__init__.py
```python
from pyapps.okx_price_monitor.core.config import config
from pyapps.okx_price_monitor.core.utils import timestamp_ms

__all__ = [
    'config',       # Global configuration instance
    'timestamp_ms', # Timestamp utility function
]
```

### foundation/__init__.py
```python
from pyapps.okx_price_monitor.foundation.coin_provider import CoinProvider
from pyapps.okx_price_monitor.foundation.printer import Printer

__all__ = [
    'CoinProvider',     # Coin data provider
    'Printer',          # Output utilities
]
```

### services/__init__.py
```python
from pyapps.okx_price_monitor.services.price_monitor import PriceMonitor
from pyapps.okx_price_monitor.services.trading_strategy import TradingStrategy
from pyapps.okx_price_monitor.services.trade_executor import TradeExecutor
from pyapps.okx_price_monitor.services.grid_display import GridDisplay

__all__ = [
    'PriceMonitor',     # Price monitoring service
    'TradingStrategy',  # Trading strategy
    'TradeExecutor',    # Trade executor
    'GridDisplay',      # Grid display
]
```

## Import Order Standard

All Python files follow this import order:

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Module docstring"""

# 1. Standard library imports
import time
import json
from pathlib import Path
from typing import List, Dict, Optional

# 2. Third-party imports (pycore)
from pycore.pyfoundations.third_party import get_third_package_okx
from pycore.pyfoundations.pygvar import PROJECT_ROOT

# 3. Import third-party packages
get_third_package_okx()
import okx.MarketData as MarketData

# 4. Local imports
from pyapps.okx_price_monitor.lib import OKXClient
from pyapps.okx_price_monitor.core import config
```

## OKXClient Usage

### Basic Usage

```python
from pyapps.okx_price_monitor.lib import create_okx_client

# Create public API client
client = create_okx_client(use_auth=False)

# Get instruments
response = client.get_instruments(inst_type="SPOT")
instruments = response['data']

# Get tickers
response = client.get_tickers(inst_type="SPOT")
tickers = response['data']

# Get single ticker
response = client.get_ticker(inst_id="BTC-USDT")
ticker = response['data'][0]
```

### With Authentication

```python
# Create authenticated client
# Uses credentials from:
#   - API Key: .secret_keys/.secret_ignore/LOCAL_TEST_PASSWORD_1
#   - Secret Key: .secret_keys/.secret_ignore/LOCAL_TEST_API_KEY_1
#   - Passphrase: config.OKX_PASSPHRASE
client = create_okx_client(use_auth=True)

# Get account balance
balance = client.get_account_balance()

# Get positions
positions = client.get_positions(inst_type="SWAP")

# Place order
order = client.place_order(
    inst_id="BTC-USDT",
    side="buy",
    order_type="limit",
    size="0.001",
    price="90000"
)
```

## CoinProvider Usage

```python
from pyapps.okx_price_monitor.foundation import CoinProvider

# Create provider
provider = CoinProvider(inst_type="SPOT", use_auth=False)

# Fetch instruments (cached)
instruments = provider.fetch_instruments()

# Get coin list
coins = provider.get_coin_list()  # ['BTC', 'ETH', 'SOL', ...]

# Get trading pairs
usdt_pairs = provider.get_trading_pairs(quote_currency="USDT")

# Fetch tickers
tickers = provider.fetch_tickers()

# Fetch single ticker
ticker = provider.fetch_ticker("BTC-USDT")
```

## Key Design Principles

1. **All imports at file top**
   - NO imports inside functions
   - NO imports inside try-except blocks
   - Follow PYTHON_PYCORE.md standards

2. **Clear layer separation**
   - Each layer has specific responsibility
   - Lower layers have no knowledge of higher layers
   - All exports defined in `__init__.py`

3. **Dependency injection**
   - Services receive dependencies via constructor
   - No global state except config

4. **Single responsibility**
   - Each class has one clear purpose
   - Thin wrapper around python-okx library

5. **Auto-installation**
   - python-okx registered in third_party.py
   - Auto-installs on first use
   - Lazy loading for performance

## API Credentials

Credentials are stored in:
```
.secret_keys/.secret_ignore/
├── LOCAL_TEST_PASSWORD_1  → API Key
└── LOCAL_TEST_API_KEY_1   → Secret Key
```

Passphrase configured in: `core/config.py:OKX_PASSPHRASE`

## Testing

Run tests:
```bash
# Test OKXClient directly
python pyapps/okx_price_monitor/test_okx_client_simple.py

# Test full application
python pyapps/okx_price_monitor/okx_price_monitor_main.py
```

## References

- OKX API Documentation: https://www.okx.com/docs-v5/en/
- python-okx GitHub: https://github.com/okxapi/python-okx
- PYTHON_PYCORE.md: Development standards
