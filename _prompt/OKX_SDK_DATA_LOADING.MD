# OKX SDK Data Loading

## Overview

Program repeated runs will not simply discard old historical data and reinstall, but incrementally fill according to the following logic:

## Data Loading Logic

- Each coin first queries SQLite time range `get_time_range`, and performs duplicate check and deduplication on stored data.
- If data exists and covers `start_time` (default 3 days ago) to 1 hour before current time: considered "Up-to-date", only reload data from SQLite to Redis, no longer call OKX.
- If coverage is incomplete, pull according to gaps:
  - Only missing recent data: fill "gap" from latest time to current time.
  - Only missing early data: fill "gap" from start_time to earliest time.
  - Both early and recent missing: re-pull entire segment.
- Newly obtained candles first write to SQLite (INSERT OR REPLACE), then load required range to Redis. Redis is not persistent, but each startup loads from SQLite, so won't produce "blank history".
- Currently running uses memory fallback Redis; even so, history still comes from SQLite, won't miss segments. If want to reduce API calls, can directly satisfy startup requirements when SQLite data already covers.

**In summary**: After historical data loads successfully, on next startup, only time gaps will be filled, existing complete data will be directly reused.

## Code Verification

You need to actually scan code for omissions, because now it's only like this in process, but not necessarily complete. Simultaneously print debug, such as loading time gap, waiting, display actual loading situation. Historical data (count), current time gap that needs loading, total loading count, etc.

## Data Validation

Is it correct? After each fill, display and verify data in it. Write a validation method, verify if data exists in specified area and if connected. Print validation process. Note: Validation only randomly verifies one coin, only verifies once in one startup process, prevent taking too much time. Simultaneously use a global parameter to control whether to validate. Currently enable validation.

## Design Review

Check loading, callback, trading, mock data, if design is reasonable, coupling is not high.

## Real-time Data Loading

Why after startup there is no real-time continued data loading? After startup, should continue loading data in real-time. But loading speed should be less than OKX's rate limit. First set a global variable, how often to load in real-time, currently 0 (i.e., continuously load at maximum rate).

