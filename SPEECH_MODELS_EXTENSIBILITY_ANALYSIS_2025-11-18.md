# Speech Models Extensibility Analysis
**Date**: 2025-11-18  
**Location**: `pycore/database/models/util_speech/`  
**Scope**: Deep analysis of speech database models and extensibility issues

---
## Executive Summary
The current speech database models (`util_speech`) have significant extensibility limitations. The design is TTS-centric and lacks proper abstraction for other speech functionalities like STT, making it difficult to extend the system without substantial code duplication.

---
## Findings

1. **TTS-Only Design**  
   - Only `SpeechTTSCacheModel` and `SpeechTTSConfigModel` exist (`pycore/database/models/util_speech/tts_cache_model.py`, `pycore/database/models/util_speech/tts_config_model.py`).  
   - There are no STT counterparts (`SpeechSTTCacheModel`, `SpeechSTTConfigModel`).  
   - Table names are hard-coded to `util_speech_tts_*`, preventing reuse for STT (`tts_cache_model.py:33`, `tts_config_model.py:31`).

2. **No Abstract Base Layer**  
   - The cache model mixes file verification, statistics, CRUD, and logging in one class (~400 LOC).  
   - Adding STT would require duplicating the same logic (file verification `tts_cache_model.py:120-180`, statistics `tts_cache_model.py:264-360`, cache queries `tts_cache_model.py:116-210`).

3. **Schema Locked to TTS Semantics**  
   - Columns assume `text_md5`, `text`, and `file_path` (text → audio).  
   - STT needs `audio_md5`, `file_path`, `recognized_text` (audio → text), which the current schema cannot represent without new tables.

4. **Hard-Coded Table Names**  
   - `__full_table_name__ = "util_speech_tts_cache"` and `"util_speech_tts_config"` are embedded in the class definitions, with no mechanism for dynamic naming or schema reuse.

5. **Duplication with General Cache Concepts**  
   - The util cache models elsewhere are simpler, but there is no shared abstraction.  
   - The TTS cache reimplements generic behaviors (MD5, verification, stats) instead of layering on common utilities.

6. **Architecture Anti-Patterns**  
   - Violates single-responsibility (database access + filesystem checks + hashing + stats).  
   - Tightly coupled to TTS-specific terminology (`text_md5`, `provider`, logs referencing TTS).  
   - Encourages copy-paste when adding new speech modalities.

7. **High Maintenance Cost**  
   - To add STT, engineers would need to copy ~424 lines of cache logic and ~300 lines of config logic.  
   - Every bug fix or feature would need to be patched twice (TTS + STT) without a shared base.

---
## Impact Assessment
- **Extensibility**: Low — architecture cannot absorb STT without duplication.  
- **Maintainability**: Poor — fixes/features must be duplicated.  
- **Risk**: High — encourages inconsistent behavior and regressions.

---
## Recommendations
1. Introduce an abstract `SpeechCacheModelBase` with hooks for column definitions, key generation, file verification, and statistics.  
2. Split TTS-specific schema into a subclass and create a parallel STT subclass with its own columns (e.g., `audio_md5`, `recognized_text`).  
3. Decouple file-system logic into a helper service so both TTS and STT caches reuse the same verification/stats code.  
4. Replace hard-coded table names with namespace-aware builders or configuration so new speech modes can register their own tables without rewriting the model.

Implementing these steps will let us support STT (and future speech features) without duplicating the entire cache/config stack.
