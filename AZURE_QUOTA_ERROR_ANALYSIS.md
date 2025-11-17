# Azure Speech Service Quota Error Analysis

**Date**: 2025-11-17
**Error**: `Recognition canceled: CancellationReason.Error - Connection was closed by the remote host. Error code: 1007. Error details: Quota exceeded.`

---

## 🔍 Error Analysis

### Error Details
```
[ERROR] Recognition canceled: CancellationReason.Error
- Connection was closed by the remote host
- Error code: 1007 (WebSocket Policy Violation)
- Error details: Quota exceeded
- Session ID: 26b8cd95bf3242e6a9f6870ea5c62c34
```

### Error Type
This is an **Azure Speech Service** error, NOT an RPC connection issue.

- **Service**: Azure Cognitive Services - Speech Recognition
- **Protocol**: WebSocket (between local app and Azure servers)
- **Cause**: API quota exceeded

---

## 📊 Root Causes

### 1. Azure Free Tier Limitations
The Azure Speech Service Free (F0) tier has strict limits:
- **5 audio hours per month**
- **20 concurrent requests**
- After limits exceeded, service returns error code 1007

### 2. Subscription Issues
- API key may be invalid or expired
- Subscription may have run out of credits
- Regional service may be unavailable

### 3. Excessive Usage
- Too many recognition requests in short time
- Long-running continuous recognition sessions
- Multiple concurrent recognition streams

---

## 🔧 Current Error Handling Analysis

### Code Flow

#### 1. Azure Provider Error Detection
**File**: `pycore/pyutils/speech_recognition/azure_provider.py:246-251`

```python
def canceled_handler(evt):
    """Cancellation handler"""
    if on_error:
        error_msg = f"Recognition canceled: {evt.result.cancellation_details.reason}"
        if evt.result.cancellation_details.reason == speechsdk.CancellationReason.Error:
            error_msg += f" - {evt.result.cancellation_details.error_details}"
        on_error(error_msg)
        sys.stdout.flush()
    self._is_recognizing = False  # ← Sets flag to False
```

**Issues**:
- ✅ Detects error correctly
- ✅ Calls `on_error` callback
- ✅ Sets `_is_recognizing` to False
- ❌ **No retry logic**
- ❌ **No fallback mechanism**
- ❌ **No quota monitoring**

#### 2. Transcription App Error Handling
**File**: `pycore/pyctl/speech/transcription_app.py:667-670`

```python
def on_error(self, error_msg: str):
    """Handle recognition error"""
    ColorPrint.red(f"[ERROR] {error_msg}")
    sys.stdout.flush()
```

**Issues**:
- ✅ Prints error message
- ❌ **Only logs - no recovery action**
- ❌ **No notification to user about quota**
- ❌ **No automatic fallback to local STT**
- ❌ **Session continues but recognition is dead**

#### 3. Main Loop Behavior
**File**: `pycore/pyctl/speech/transcription_app.py:1137-1146`

```python
try:
    while True:
        time.sleep(0.5)

        if duration and (time.time() - start_time) >= duration:
            ColorPrint.yellow("\n[INFO] Duration limit reached")
            break
except KeyboardInterrupt:
    ColorPrint.yellow("\n[INFO] Interrupted by user (Ctrl+C)")
```

**Issues**:
- ✅ Main loop continues running
- ❌ **Doesn't check if recognition is still active**
- ❌ **No detection that recognition stopped due to error**
- ❌ **User thinks it's recording but nothing is happening**
- ❌ **Wastes user time - silent failure**

---

## 🚨 Critical Problems Identified

### Problem 1: Silent Failure ⚠️
After quota error:
1. `canceled_handler` sets `_is_recognizing = False`
2. `on_error` only prints error
3. Main loop continues running
4. **User doesn't know recognition has stopped**
5. **Audio is captured but not recognized**

### Problem 2: No Fallback Mechanism ⚠️
When Azure quota exceeded:
- No automatic switch to local STT
- No retry with exponential backoff
- No user prompt to switch providers

### Problem 3: No Quota Monitoring ⚠️
- No tracking of Azure API usage
- No warning before quota limit
- No cache of quota status

### Problem 4: Poor User Experience ⚠️
- Error appears in terminal but easily missed
- No clear indication that recording stopped
- No suggestion for how to fix the issue

---

## 🔍 RPC Connection Analysis

### RPC vs Azure WebSocket
**Important Distinction**:
- **RPC Connection**: Local app ↔ Web UI (working fine)
- **Azure WebSocket**: Local app ↔ Azure servers (this failed)

The error is NOT in RPC system, but the RPC system should help notify the user.

### Current RPC Capabilities
**File**: `pycore/pyutils/rpc/server/websocket_handler.py`

The RPC WebSocket handler has:
- ✅ Connection management
- ✅ Reconnection support
- ✅ Client status tracking
- ✅ Inventory system for failed deliveries

**But**: Not used to notify UI about Azure errors

---

## 💡 Recommended Solutions

### Solution 1: Error Recovery Logic (HIGH PRIORITY)

#### A. Detect Recognition Stopped
```python
def on_error(self, error_msg: str):
    """Handle recognition error with recovery"""
    ColorPrint.red(f"[ERROR] {error_msg}")

    # Set error state
    self.has_error = True
    self.error_message = error_msg

    # Check if quota exceeded
    if "Quota exceeded" in error_msg or "1007" in error_msg:
        self.quota_exceeded = True
        ColorPrint.yellow("\n" + "="*70)
        ColorPrint.red("[CRITICAL] Azure Speech API Quota Exceeded!")
        ColorPrint.yellow("="*70)
        ColorPrint.yellow("Options:")
        ColorPrint.yellow("  1. Wait for quota reset (monthly)")
        ColorPrint.yellow("  2. Upgrade Azure subscription")
        ColorPrint.yellow("  3. Switch to local STT (offline)")
        ColorPrint.yellow("="*70)

        # Attempt fallback to local STT
        if self._try_fallback_to_local():
            ColorPrint.green("[INFO] Switched to local STT provider")
        else:
            ColorPrint.red("[ERROR] No fallback available - stopping session")
            self.should_stop = True
```

#### B. Monitor Recognition Status in Main Loop
```python
while True:
    time.sleep(0.5)

    # Check if recognition is still active
    if session.has_error:
        if session.quota_exceeded:
            ColorPrint.red("\n[CRITICAL] Session terminated due to quota exceeded")
            break
        elif session.should_stop:
            ColorPrint.red("\n[ERROR] Session stopped due to error")
            break

    # Check if duration limit reached
    if duration and (time.time() - start_time) >= duration:
        ColorPrint.yellow("\n[INFO] Duration limit reached")
        break
```

### Solution 2: Provider Fallback System (MEDIUM PRIORITY)

```python
class STTProviderFallback:
    """STT Provider with automatic fallback"""

    def __init__(self):
        self.providers = [
            ('azure', AzureSpeechRecognitionProvider()),
            ('local', LocalSpeechRecognitionProvider())
        ]
        self.current_provider_index = 0

    def handle_provider_error(self, error_msg: str):
        """Switch to next provider on error"""
        if "Quota exceeded" in error_msg:
            ColorPrint.yellow("[STT] Azure quota exceeded, switching to local STT...")
            return self.switch_to_next_provider()
        return False

    def switch_to_next_provider(self):
        """Switch to next available provider"""
        self.current_provider_index += 1
        if self.current_provider_index < len(self.providers):
            provider_name, provider = self.providers[self.current_provider_index]
            ColorPrint.green(f"[STT] Switched to {provider_name} provider")
            return True
        return False
```

### Solution 3: RPC Event Broadcasting (LOW PRIORITY)

Add RPC event to notify web UI:

```python
def on_error(self, error_msg: str):
    """Handle recognition error"""
    ColorPrint.red(f"[ERROR] {error_msg}")

    # Broadcast error to RPC clients
    if hasattr(self, 'rpc_server') and self.rpc_server:
        self.rpc_server.broadcast_event({
            'type': 'stt_error',
            'error': error_msg,
            'quota_exceeded': "Quota exceeded" in error_msg,
            'timestamp': time.time()
        })
```

Then web UI can show alert dialog.

### Solution 4: Quota Usage Tracking (LOW PRIORITY)

```python
class AzureQuotaTracker:
    """Track Azure API usage to prevent quota exceeded"""

    def __init__(self):
        self.usage_file = Path.home() / '.azure_stt_usage.json'
        self.load_usage()

    def record_recognition_time(self, duration_seconds: float):
        """Record recognition duration"""
        today = datetime.now().strftime('%Y-%m-%d')
        if today not in self.usage:
            self.usage[today] = 0
        self.usage[today] += duration_seconds
        self.save_usage()

    def check_quota_available(self) -> bool:
        """Check if quota still available"""
        month_usage = self.get_month_usage()
        FREE_TIER_HOURS = 5.0
        return month_usage < (FREE_TIER_HOURS * 3600)

    def get_remaining_quota(self) -> float:
        """Get remaining quota in hours"""
        month_usage = self.get_month_usage()
        FREE_TIER_HOURS = 5.0
        remaining_seconds = (FREE_TIER_HOURS * 3600) - month_usage
        return max(0, remaining_seconds / 3600)
```

---

## 📋 Implementation Priority

### Critical (Do Immediately)
1. ✅ Add `has_error` and `should_stop` flags to session
2. ✅ Check error state in main loop
3. ✅ Stop session when critical error detected
4. ✅ Show clear error message to user

### High (Next Sprint)
1. Implement automatic fallback to local STT
2. Add quota exceeded specific handling
3. Add recovery suggestions in error messages

### Medium (Future)
1. RPC event broadcasting for UI notifications
2. Quota usage tracking
3. Provider health monitoring

### Low (Nice to Have)
1. Automatic retry with exponential backoff
2. Cloud provider rotation (Azure → Google → AWS)
3. Cost optimization recommendations

---

## 🎯 Quick Fix (Immediate)

**File**: `pycore/pyctl/speech/transcription_app.py`

Add after line 669:
```python
def on_error(self, error_msg: str):
    """Handle recognition error"""
    ColorPrint.red(f"[ERROR] {error_msg}")
    sys.stdout.flush()

    # NEW: Set error flags
    self.has_error = True
    if "Quota exceeded" in error_msg or "1007" in error_msg:
        ColorPrint.red("\n" + "="*70)
        ColorPrint.red("CRITICAL: Azure Speech API Quota Exceeded!")
        ColorPrint.yellow("Your Azure free tier limit has been reached.")
        ColorPrint.yellow("Session will be terminated.")
        ColorPrint.red("="*70)
        self.should_stop = True
```

Add to `__init__`:
```python
self.has_error = False
self.should_stop = False
```

Modify main loop (line 1138):
```python
while True:
    time.sleep(0.5)

    # NEW: Check error state
    if session.should_stop:
        ColorPrint.red("\n[TERMINATED] Session stopped due to critical error")
        break

    if duration and (time.time() - start_time) >= duration:
        ColorPrint.yellow("\n[INFO] Duration limit reached")
        break
```

---

## 📝 Summary

**The Issue**: Azure quota exceeded, but app doesn't handle it gracefully
**Root Cause**: Error handling only logs, doesn't stop or recover
**Impact**: User wastes time thinking it's recording when it's not
**Fix**: Add error state tracking + stop session on critical errors

**This is NOT an RPC issue** - RPC connections are working fine. The issue is Azure WebSocket connection being terminated by Azure servers due to quota limits.

---

**Recommendation**: Implement Critical priority fixes immediately to prevent user confusion and wasted time.
