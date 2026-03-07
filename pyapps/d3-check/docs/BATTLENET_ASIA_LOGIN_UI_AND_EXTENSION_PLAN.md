# Battle.net Asia Login UI Variants and Login Library Extension Plan

## 1. Purpose

- Describe the **possible Battle.net Asia login UI structures** inferred from `docs/登陆后的战网元素.json` and `docs/登陆后的战网元素1.json`.
- Define a **development plan** to extend the Asia login library so it supports: (1) step-based flow (account → password), (2) optional single screen with both account and password, and (3) historical-account flow (password-only screen with “Welcome back”).

**Document only. No code changes.**

---

## 2. Data Sources

| File | Description |
|------|-------------|
| `docs/登陆后的战网元素.json` | Snapshot: **password step** (saved account; “Welcome back” + password + Log in). |
| `docs/登陆后的战网元素1.json` | Snapshot: **account step** (email/phone + Continue; first-time or no saved account). |

Both use the same window structure: `LoginWindow` → `loginWidgetContainer` → `stackedWidget` → `loginWidget` → `formFrame` / `createAccountFrame` → `login-wrapper`, `login-header`, and input/submit controls.

---

## 3. Battle.net Asia Login UI: Possible Variants

### 3.1 Variant A: Account step only (step 1)

- **When**: First-time use, or no saved account, or user chose “Switch account”.
- **Controls**:
  - `login-header`: e.g. “登入” (Log in) or “Battle.net 帳號登入”.
  - `accountName`: email/phone input (automation_id `accountName`).
  - Submit: “繼續” (Continue), automation_id `submit`.
  - Optional: “第一次使用 Battle.net 應用程式？” / “註冊”, “忘記電子郵件地址？”.
  - **No** password field in the visible tree (or not focusable).
- **User action**: Enter email/phone → click Continue → next step (password or combined).
- **Reference**: `登陆后的战网元素1.json` (accountName + submit “繼續”, login-header “登入”).

### 3.2 Variant B: Password step only (step 2, historical account)

- **When**: Client has a saved/historical account; UI skips account step and shows password directly.
- **Controls**:
  - `login-header`: “歡迎回來” (Welcome back).
  - Optional: displayed account (e.g. email text), “切換帳號” (Switch account).
  - `password`: password input (automation_id `password`).
  - Submit: “登入” (Log in), automation_id `submit`.
  - Optional: “忘記密碼？” (Forgot password?), “保持登入狀態” (Stay logged in).
  - **No** visible/focusable accountName for editing (account is pre-filled or shown as text).
- **User action**: Enter password → click Log in (or click “Switch account” to go back to Variant A).
- **Reference**: `登陆后的战网元素.json` (password + submit “登入”, “歡迎回來”, “切換帳號”).

### 3.3 Variant C: Combined single screen (account + password on one page)

- **When**: Some clients or regions may show both fields on one screen (no “Continue” step).
- **Controls** (assumed):
  - Both `accountName` and `password` present and editable.
  - Single submit: “登入” (Log in), automation_id `submit`.
  - Possibly same `login-wrapper` / `login-header` as other variants.
- **User action**: Fill email and password → click Log in once.
- **Note**: Not confirmed in the two provided JSONs; the plan should still support detection and handling if such a layout appears.

### 3.4 Summary table

| Variant | accountName | password | Submit label | login-header / hints |
|---------|-------------|----------|--------------|----------------------|
| A – Account step | visible, editable | not visible | 繼續 / Continue | 登入, 第一次使用…, 註冊 |
| B – Password step | not editable / not present | visible, editable | 登入 / Log in | 歡迎回來, 切換帳號 |
| C – Combined | visible, editable | visible, editable | 登入 / Log in | (to be confirmed) |

---

## 4. Current Implementation (Reference)

### 4.1 All UI states (variants) and detection

| State | How detected | Action |
|-------|--------------|--------|
| **C – Combined** | Both accountName and password in control tree | `perform_asia_combined_login(email, password)` |
| **B – Password step** | Password field + submit, **or** submit label is “登入”/“Log in” (not “繼續”) | `perform_asia_password_step(password)` |
| **A – Account step** | accountName + submit “繼續”, no password field | `perform_asia_email_step(email)` |
| (other) | Asia login markers but none of above | Re-poll next tick (BN_UI) |

Password step is checked **before** email step so that after clicking “繼續” the next tick is treated as password step (submit becomes “登入”; password control may appear slightly later and is retried after 0.5s in ops).

### 4.2 Detection (BattlenetRegionJudge)

- `is_asia_combined_login_ui()`: both accountName and password on same screen (Variant C).
- `is_asia_password_step()`: has password + submit, **or** submit name is “登入”/“Log in” (not “繼續”) so password step is detected even before password control is enumerated.
- `is_asia_email_step()`: has accountName + submit, **no** password field.
- `is_asia_password_step_with_switch_account()`: password step and control with “切換帳號” (Phase 3).
- `is_asia_login_ui()`: email step **or** password step **or** combined.

### 4.3 Constants and actions

- **Constants** (app_constants.py): `ASIA_LOGIN_ACCOUNT_*`, `ASIA_LOGIN_PASSWORD_*` (incl. “密碼欄位”), `ASIA_LOGIN_SUBMIT_*`, `ASIA_LOGIN_CONTINUE_*`, `ASIA_LOGIN_HEADER_KEYWORDS`, `ASIA_LOGIN_SWITCH_ACCOUNT_KEYWORDS`.
- **Actions** (battlenet_asia_ops.py): focus → Ctrl+A → keyboard type; `perform_asia_email_step`, `perform_asia_password_step` (with 0.5s retry if password control not found), `perform_asia_combined_login`.

### 4.4 Flow order (BN_LoginAsia)

1. **Combined** → `perform_asia_combined_login`; then re-poll.
2. **Password step** → `perform_asia_password_step`; then re-poll.
3. **Email step** → `perform_asia_email_step`; then re-poll.
4. Else → re-poll (BN_UI).

- Not yet implemented (Phase 3): click “切換帳號” to force return to account step.

---

## 5. Development Plan (Extension of Login Library)

### 5.1 Phase 1: Clarify and document detection (no new automation yet)

1. **Naming**
   - Keep using “email step” and “password step” in code/comments.
   - In docs, refer to “account step” and “password step (including historical-account / Welcome back)” so both JSON variants are clearly covered.

2. **Constants**
   - Ensure `app_constants` (or equivalent) has:
     - Asia login markers, accountName, password, submit automation_ids and name keywords (already present).
     - Optional: keywords for “歡迎回來”, “切換帳號”, “繼續”, “登入” for documentation and future use (e.g. more robust detection or logging).

3. **Detection**
   - **Email step**: already defined (accountName + submit, no password). No change required for Variant A.
   - **Password step**: already defined (password + submit). Covers Variant B (historical account).
   - **Combined step (new)**:
     - Add a predicate, e.g. `is_asia_combined_login_ui()`: has Asia login markers **and** both accountName **and** password **and** submit (Log in). Prefer automation_id; fallback name.

### 5.2 Phase 2: Extend judge and actions

1. **BattlenetRegionJudge**
   - Add `is_asia_combined_login_ui()` as above.
   - Optionally add:
     - `is_asia_password_step_with_switch_account()`: password step **and** a control containing “切換帳號” (for future “force account step” or logging).
   - Keep `is_asia_login_ui()` = email step **or** password step **or** combined step (so flow still treats “on Asia login” as one group).

2. **BattlenetAsiaOps**
   - Add `perform_asia_combined_login(email, password)`:
     - SetValue(accountName), SetValue(password), click submit (Log in).
     - Same safety as today: only run when `is_asia_combined_login_ui()` is true.

3. **Flow (BN_LoginAsia)**
   - After obtaining credentials:
     - If **combined** → `perform_asia_combined_login(email, password)`; then transition as today (e.g. to BN_UI / re-poll).
     - Else if **email step** → `perform_asia_email_step(email)` (unchanged).
     - Else if **password step** → `perform_asia_password_step(password)` (unchanged).
   - Optional later: if on password step and we intentionally want to change account, click “切換帳號” then next tick treat as email step (Phase 3 or later).

### 5.3 Phase 3: Optional refinements (later)

1. **“Switch account”**
   - If we need to force the account step (e.g. user requested “use different account”):
     - On password step, find control by name/automation_id for “切換帳號”, click it; next tick will be email step, then perform email step.

2. **Robustness**
   - Prefer automation_id for all new controls; keep name keywords as fallback.
   - If a new client version changes labels (e.g. “Welcome back” / “登入”), extend constants only; detection logic stays the same.

3. **Snapshots**
   - When saving UI snapshots (e.g. BN_LoginAsia), keep using current filenames; optional: add a short comment in snapshot meta indicating “email_step” / “password_step” / “combined” when known, for debugging.

---

## 6. File and Constant Checklist (for implementation)

- **Docs**
  - `docs/登陆后的战网元素.json` – password step (Welcome back) reference.
  - `docs/登陆后的战网元素1.json` – account step (Continue) reference.
  - This document – UI variants and extension plan.

- **Detection (battlenet_region_judge + app_constants)**
  - Add combined-step predicate and, if needed, constants for “切換帳號” / “歡迎回來” (for clarity; detection can still rely on accountName/password/submit presence).

- **Actions (battlenet_asia_ops)**
  - Add `perform_asia_combined_login(email, password)`.

- **Flow (rosbot_flow_battlenet)**
  - In BN_LoginAsia, branch on combined vs email step vs password step and call the correct performer.

---

## 7. Summary

| Topic | Conclusion |
|-------|------------|
| **UI variants** | (A) Account step only, (B) Password step only (incl. historical “Welcome back”), (C) Combined account+password on one screen. |
| **Data sources** | 登陆后的战网元素.json = B; 登陆后的战网元素1.json = A. C to be handled when/if seen. |
| **Extension** | Add combined-step detection and `perform_asia_combined_login`; flow branches on combined / email / password; keep all imports at top and automation_id-first. |
| **Next step** | Implement Phase 1–2 (detection + actions + flow); Phase 3 (switch account, robustness) as needed. |
