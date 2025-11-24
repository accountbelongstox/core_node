OKX Price Monitor - Python Application
========================================

Architecture:
-------------
1. CoinProvider (Shared)
   - Fetches and caches coin list from OKX API
   - Cache TTL: 3600 seconds
   - API: https://www.okx.com/priapi/v5/public/coins

2. Mode 1: Price Monitor (IMPLEMENTED)
   - Monitors cryptocurrency prices in real-time
   - Calculates 24h price changes from trend data
   - API: https://www.okx.com/priapi/v5/market/batch-currency-trend
   - Displays: Currency, Current Price, 24h Change%, Data Points

3. Mode 2: Trading System (TODO)
   - Order placement functionality
   - Order management
   - Position tracking
   
4. TradingTimingAnalyzer (TODO)
   - Price trend analysis
   - Buy/sell signal generation
   - Risk assessment

Usage:
------
python pymain.py app=okx_price_monitor

RPC Integration:
----------------
- RPC Server: http://127.0.0.1:58000
- Uses ncore_module_caller browser API via RPC
- Browser manager handles tab reuse intelligently
- API requests injected into browser context

File Structure:
---------------
pyapps/okx_price_monitor/
├── lib/
│   ├── coin_provider.py        # Shared coin list provider
│   ├── mode1_price_monitor.py  # Price monitoring (IMPLEMENTED)
│   ├── mode2_trader.py         # Trading system (TODO)
│   └── __init__.py
├── okx_price_monitor_main.py   # Main entry point
└── __init__.py

Default Currencies Monitored:
------------------------------
FOXY, PERP, PSTAKE, ULTI, PIGGY, FLM, KDA, SAMO,
VISTA, SPURS, TRA, LOOKS, BUZZ, POR, MENGO, NC,
CKB, BETH, CATS, MAJOR, OKSOL, HOPPY, WHY, RIF, NS
