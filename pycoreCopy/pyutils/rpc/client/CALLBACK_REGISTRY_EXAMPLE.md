# Event/Callback Registry (MCP Table) - Usage Examples

## Overview

The Event/Callback Registry (MCP Table) provides a unified way to manage event callbacks in the RPC client. All event callbacks must register in this table before use.

## Core Principles

1. **Register callbacks first**: All callbacks must be registered via `registerCallback()` before use
2. **Store only IDs**: localStorage stores only `callbackId` (NOT data or functions)
3. **Immediate data delivery**: Response data is passed immediately to callbacks (NOT stored)
4. **Default handler**: When no callback is registered, a helpful default handler runs

## Basic Usage

### 1. Simple Callback Registration

```javascript
const client = new UnifiedRpcClient('http://localhost:59000', {
    debug: true
});

await client.connect();

// Register a callback for TTS completion
client.registerCallback('tts_complete', (message) => {
    if (message.success) {
        console.log('TTS completed successfully!');
        console.log('Audio URL:', message.result.audio_url);
        playAudio(message.result.audio_url);
    } else {
        console.error('TTS failed:', message.error);
        showErrorNotification(message.error);
    }
});

// Send request with callback ID
const result = await client.call('tts',
    { text: '你好世界' },
    { callbackId: 'tts_complete' }
);
```

### 2. Multiple Callback Handlers

```javascript
// Register multiple callbacks for different operations
client.registerCallback('ui_update', (message) => {
    updateUIElements(message.result);
});

client.registerCallback('data_sync', (message) => {
    syncDataToServer(message.result);
});

client.registerCallback('notification_show', (message) => {
    showNotification(message.result.title, message.result.body);
});

// Use different callbacks for different requests
await client.call('get_data', {}, { callbackId: 'ui_update' });
await client.call('sync_data', {}, { callbackId: 'data_sync' });
await client.call('notify_user', {}, { callbackId: 'notification_show' });
```

### 3. Unregister Callbacks

```javascript
// Unregister when no longer needed
client.unregisterCallback('tts_complete');

// Or unregister all callbacks manually
['ui_update', 'data_sync', 'notification_show'].forEach(id => {
    client.unregisterCallback(id);
});
```

## Advanced Usage

### 1. Error Handling in Callbacks

```javascript
client.registerCallback('process_data', (message) => {
    try {
        if (message.success) {
            // Process successful result
            const data = message.result;
            processComplexData(data);
            updateDatabase(data);
            notifyUser('Success!');
        } else {
            // Handle error response
            console.error('Server error:', message.error);
            showErrorDialog(message.error);
            rollbackChanges();
        }
    } catch (error) {
        // Handle callback execution error
        console.error('Callback error:', error);
        reportErrorToMonitoring(error);
    }
});
```

### 2. Reusable Callback Factory

```javascript
// Factory function for creating similar callbacks
function createDataUpdateCallback(componentId) {
    return (message) => {
        if (message.success) {
            const component = document.getElementById(componentId);
            component.innerHTML = renderData(message.result);
        }
    };
}

// Register multiple similar callbacks
client.registerCallback('update_header', createDataUpdateCallback('header'));
client.registerCallback('update_sidebar', createDataUpdateCallback('sidebar'));
client.registerCallback('update_footer', createDataUpdateCallback('footer'));
```

### 3. Callback with State Management

```javascript
// Callback with closure for state management
let updateCount = 0;

client.registerCallback('incremental_update', (message) => {
    updateCount++;
    console.log(`Update #${updateCount}:`, message.result);

    // Update UI with cumulative count
    document.getElementById('update-counter').textContent = updateCount;

    // Apply incremental changes
    applyIncrementalUpdate(message.result, updateCount);
});
```

## Page Refresh Handling

### Scenario: User refreshes page during long-running task

```javascript
// app.js - Main application initialization

const client = new UnifiedRpcClient('http://localhost:59000', {
    debug: true
});

await client.connect();

// Check for callbacks that need re-registration
if (client.storedCallbackIds && client.storedCallbackIds.length > 0) {
    console.log('Re-registering callbacks from previous session...');

    // Re-register all callbacks
    registerAllCallbacks(client);
}

// Register callbacks function
function registerAllCallbacks(client) {
    // TTS callback
    client.registerCallback('tts_complete', (message) => {
        if (message.success) {
            playAudio(message.result.audio_url);
        }
    });

    // UI update callback
    client.registerCallback('ui_update', (message) => {
        updateUIElements(message.result);
    });

    // Data sync callback
    client.registerCallback('data_sync', (message) => {
        syncDataToServer(message.result);
    });
}
```

## Default Callback Handler

### When callback is not registered

If you send a request with a `callbackId` but haven't registered the callback, the default handler will run:

```javascript
// Forgot to register callback
await client.call('tts',
    { text: '你好' },
    { callbackId: 'my_tts_handler' }  // ← Not registered!
);

// When response arrives, default handler runs:
// ═══════════════════════════════════════════════════
// [UnifiedRpcClient] Default Callback Handler
// ═══════════════════════════════════════════════════
// Callback ID: my_tts_handler
// Status: SUCCESS
//
// Received Data:
// {
//   "type": "response",
//   "id": "abc-123",
//   "success": true,
//   "result": { "audio_url": "..." }
// }
//
// ⚠️  No custom handler registered for this callback ID
//
// 📝 To register a custom handler, use:
//
//    client.registerCallback('my_tts_handler', (message) => {
//        // Your custom handler code here
//        console.log("Processing result:", message.result);
//        // Example: Update UI, save to database, etc.
//    });
//
// ═══════════════════════════════════════════════════
```

## Best Practices

### 1. ✅ DO: Register callbacks at application startup

```javascript
// Good: Register all callbacks when app starts
async function initializeApp() {
    const client = new UnifiedRpcClient(url);
    await client.connect();

    // Register all callbacks upfront
    client.registerCallback('callback1', handler1);
    client.registerCallback('callback2', handler2);
    client.registerCallback('callback3', handler3);

    return client;
}
```

### 2. ✅ DO: Use descriptive callback IDs

```javascript
// Good: Clear, descriptive IDs
client.registerCallback('tts_voice_synthesis_complete', handler);
client.registerCallback('user_profile_data_updated', handler);
client.registerCallback('payment_transaction_confirmed', handler);

// Bad: Unclear IDs
client.registerCallback('cb1', handler);
client.registerCallback('x', handler);
client.registerCallback('temp', handler);
```

### 3. ✅ DO: Handle both success and error cases

```javascript
// Good: Complete error handling
client.registerCallback('process_payment', (message) => {
    if (message.success) {
        showSuccessMessage(message.result);
        redirectToConfirmationPage();
    } else {
        showErrorMessage(message.error);
        enableRetryButton();
    }
});
```

### 4. ❌ DON'T: Store data in callback closures for long periods

```javascript
// Bad: Storing large data in closure
let allData = [];
client.registerCallback('accumulate_data', (message) => {
    allData.push(message.result);  // ← Memory leak risk
});

// Good: Store in proper data structure
client.registerCallback('accumulate_data', (message) => {
    database.insert(message.result);  // ← Proper storage
});
```

### 5. ❌ DON'T: Register callbacks inside loops

```javascript
// Bad: Registering in loop (overwrites)
for (let i = 0; i < 10; i++) {
    client.registerCallback('process_item', (message) => {
        console.log(i);  // ← Always prints 10
    });
}

// Good: Use unique IDs or callback factory
for (let i = 0; i < 10; i++) {
    client.registerCallback(`process_item_${i}`, (message) => {
        console.log(i);  // ← Correct value
    });
}
```

## Debugging

### Enable debug mode

```javascript
const client = new UnifiedRpcClient('http://localhost:59000', {
    debug: true  // ← Enable detailed logging
});

// You'll see logs like:
// [UnifiedRpcClient] Registered callback: tts_complete
// [UnifiedRpcClient] Saved 3 callback IDs to localStorage
// [UnifiedRpcClient] Loaded 3 callback IDs from localStorage
```

### Check registered callbacks

```javascript
// Check if callback is registered
console.log('Has callback:', client.callbackRegistry.has('my_callback'));

// List all registered callback IDs
console.log('All callbacks:', Array.from(client.callbackRegistry.keys()));

// Count registered callbacks
console.log('Total callbacks:', client.callbackRegistry.size);
```

## Integration with Promise API

The callback system works alongside the Promise API:

```javascript
// Both callback and Promise are supported
client.registerCallback('data_processor', (message) => {
    console.log('Callback executed:', message.result);
    updateUI(message.result);
});

// Promise also resolves with the same data
const result = await client.call('process_data',
    { data: 'input' },
    { callbackId: 'data_processor' }
);

console.log('Promise resolved:', result);
// Both callback and Promise handler will execute
```

## Migration from Old Code

### Before (storing route/params)

```javascript
// Old approach (DO NOT USE)
this.pendingRequests.set(requestId, {
    resolve,
    reject,
    route: 'tts',              // ❌ Stored but shouldn't be
    params: { text: '你好' },   // ❌ Stored but shouldn't be
});
```

### After (storing only callbackId)

```javascript
// New approach (CORRECT)
client.registerCallback('tts_complete', (message) => {
    playAudio(message.result.audio_url);
});

this.pendingRequests.set(requestId, {
    resolve,
    reject,
    callbackId: 'tts_complete',  // ✅ Only store ID
});
```

## Summary

**Key Takeaways**:

1. ✅ **Register callbacks first** - Use `registerCallback()` before making requests
2. ✅ **Only IDs in localStorage** - Functions and data are never stored
3. ✅ **Immediate data delivery** - Data is passed to callbacks immediately
4. ✅ **Default handler helps** - Provides guidance when callbacks are missing
5. ✅ **Re-register after refresh** - Callback functions need re-registration after page reload

**API Summary**:

```javascript
// Register callback
client.registerCallback(callbackId, callbackFunction)

// Unregister callback
client.unregisterCallback(callbackId)

// Make request with callback
await client.call(route, params, { callbackId: 'your_callback_id' })

// Check stored callback IDs (after page refresh)
console.log(client.storedCallbackIds)
```
