# Battle.net "Attempting to reconnect" / "We couldn't log you in" UI features

## 1. File checked: `battlenet_analysis_buli.json`

- **This snapshot does NOT contain the reconnect/offline dialog.**  
  It was captured on the main logged-in UI (e.g. "Playing Now: Diablo III", "Battle.net News", "Chats and Groups").  
  To capture the **reconnect / couldn't log in** screen, trigger that state (e.g. disconnect network or wait for "Attempting to reconnect"), then run the same UI export that produced `battlenet_analysis_buli.json`.

## 2. Text to look for (reconnect / offline dialog)

- **"Attempting to reconnect"** – reconnecting state (often with a spinner).
- **"We couldn't log you in to Battle.net."** – login failed / offline.
- **"While you are offline, friends & chat will be unavailable, and you will have to login when playing games or accessing account management"** – long body text on the same dialog.

These may appear as:

- One or more **TextControl** `name` values (full or split across controls).
- Or inside a **GroupControl** / **DocumentControl** with child text nodes.

## 3. Spinner / “转圈” element

- In UI Automation, a loading spinner is often:
  - **ProgressBar** with **indeterminate** range (RangeValuePattern or legacy progress pattern).
  - Or an **ImageControl** / **CustomControl** used for an animated graphic (name/automation_id may be empty or generic).
- In `battlenet_analysis_buli.json` there is **no** `ProgressBar`; only `CustomControl`, `ImageControl`, `TextControl`, `GroupControl`, etc. So the reconnect snapshot may contain:
  - A **ProgressBar** (type + indeterminate) for the spinner, or
  - An **ImageControl** / **CustomControl** with small rect and no distinctive name (spinner asset).

When you capture a snapshot on the reconnect/offline screen, check for:

- `"type": "ProgressBar"` and, if available in your exporter, **indeterminate** or **RangeValue.IsReadOnly**.
- Small square/round **ImageControl** or **CustomControl** near the text (typical spinner size ~24x24 to 48x48).

## 4. Current code constants (for reference)

- **Connecting (reconnect in progress):**  
  `BATTLE_NET_CONNECTING_KEYWORDS = ("Connecting", "连接中")`  
  Used to set `connecting=True` and avoid treating as “normal available”.
- **Login failed / offline dialog (Continue Offline / Cancel):**  
  `BATTLE_NET_LOGIN_FAILED_KEYWORDS = ("Continue Offline", "继续离线", "Cancel", "取消")`  
  Used in `is_login_failed_screen()` (primary + secondary).
- **Disconnect (Retry):**  
  `BATTLE_NET_DISCONNECT_KEYWORDS = ("Retry", "重试")`  
  Used in `has_disconnect()`.

To detect the **“Attempting to reconnect” + spinner** state specifically, you can add keywords (e.g. `"Attempting to reconnect"`) and/or a ProgressBar indeterminate check and use them in the same flow that currently uses `BATTLE_NET_CONNECTING_KEYWORDS`.
