const DEBUGGER_PROTOCOL_VERSION = '1.3';

export async function withDebuggerSession<T>(
  tabId: number,
  operation: (target: chrome.debugger.Debuggee) => Promise<T>,
): Promise<T> {
  const target: chrome.debugger.Debuggee = { tabId };
  let attachedHere = false;
  let attachError: unknown = null;

  try {
    await chrome.debugger.attach(target, DEBUGGER_PROTOCOL_VERSION);
    attachedHere = true;
  } catch (error) {
    attachError = error;
  }

  try {
    return await operation(target);
  } catch (error) {
    if (attachError) throw attachError;
    throw error;
  } finally {
    if (attachedHere) {
      try {
        await chrome.debugger.detach(target);
      } catch {
        // The target may have closed or detached while the operation completed.
      }
    }
  }
}
