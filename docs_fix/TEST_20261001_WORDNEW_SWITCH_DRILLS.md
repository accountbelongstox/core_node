# TEST: wordnew repeated-switch drills (pycore link, Laravel endpoint, orchestration continue)

Status: drills written, not yet run on a device (the phone was disconnected; headless Chrome on
debian-cpu does not load the dev page).
Design: docs_fix/REQUIREMENTS_20260930_WORDNEW_CLIENT_ORCHESTRATION.md sections 4.9-4.10.

## 0. Setup (phone over USB, live reload)

```bash
PID=$(adb shell pidof com.corenode.wordnew)
adb forward tcp:9333 localabstract:webview_devtools_remote_$PID
WS=$(curl -s http://127.0.0.1:9333/json | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['webSocketDebuggerUrl'])")
# eval.mjs: Runtime.evaluate(expression, awaitPromise, returnByValue) over $WS, prints the value
node eval.mjs "$WS" "<snippet>"
```

Every snippet starts with:
`const {wordNewPycoreLink:l}=await import('/apps/wordnew/integrations/WordNewPycoreLink.ts');`
Record the transitions with:
`const seen=[]; const un=l.subscribe(()=>{const s=l.getSnapshot(); const k=s.state+' '+s.selectedUrl; if(seen.at(-1)!==k) seen.push(k);});`

## 1. pycore link drills

| # | Drill | Snippet (after the prefix) | Expected |
|---|---|---|---|
| D1 | Failure storm | `await l.ensure(); for(let i=0;i<20;i++){l.reportFailure(); await new Promise(r=>setTimeout(r,200));} await new Promise(r=>setTimeout(r,10000));` | `seen` has at most one entry: same `online` URL, never `probing` or another URL |
| D2 | Background recheck | `await l.ensure(); await l.refresh(); await l.refresh();` | state stays `online` throughout (no `probing` flicker) |
| D3 | Rapid pin switching | `const [a,b]=l.getSnapshot().candidates.filter(c=>c.probe?.state==='up').map(c=>c.url); for(let i=0;i<10;i++){void l.choose(i%2?a:b);} await new Promise(r=>setTimeout(r,8000));` | final `pinnedUrl` and `selectedUrl` are `a` (the last click); no later flip |
| D4 | Pin during refresh | `const p=l.refresh(); await l.choose(B); await p; await new Promise(r=>setTimeout(r,8000));` | `selectedUrl === B` (the stale selection is discarded) |
| D5 | Temporary on / off x10 | `for(let i=0;i<10;i++){l.useTemporary(LAN); l.clearTemporary();} await new Promise(r=>setTimeout(r,8000));` | ends on the pinned / automatic entry, `temporaryUrl === ''` |
| D6 | Entry down | stop pycore on the selected machine (or turn Wi-Fi off), run `l.reportFailure()`, wait 12 s | switches only after the 8 s confirmation fails; another `up` entry or `offline` |
| D7 | Entry back | start it again, wait for the 5 min recheck or run `l.refresh()` | a pinned entry comes back; an automatic one stays on the working entry (no flip back) |

## 2. Orchestration continue drills (open a book task in the UI first)

| # | Drill | How | Expected |
|---|---|---|---|
| C1 | Reopen x10 | leave and open the task 10 times quickly | one run of the plan at a time; progress continues, never restarts at 0 |
| C2 | Reload x5 | press "reload resources" 5 times within 2 s | one forced run (debounce); Laravel inputs loaded once |
| C3 | Airplane mid-run | airplane mode during "resolve", wait for the run to end, then airplane off | the run ends with missing clips; on reconnect the open task resumes by itself and fetches only the missing ones; timeline stays on screen |
| C4 | Switch pycore mid-run | switch pycore in the progress panel during "resolve" | the run continues on the new entry; once it ends, one more pass fetches what failed on the old one; the API chip shows the new URL |
| C5 | Switch Laravel mid-run | switch the Laravel endpoint during "resolve" | same as C4 for Laravel |
| C6 | Edit plan mid-run | change the pattern while resolving | the old run aborts with no failure toast and no pycore re-selection; the new plan resolves; kept clips are not downloaded twice |
| C7 | Clear cache mid-run | Settings -> Cache -> clear the orchestration clips during "resolve" | runs abort, sessions reset; reopening starts clean |
| C8 | Parallel downloads | a book task with about 100 missing Laravel clips | the rate (`↓ …/s`) shows parallel downloads (4 at once), not one by one |

## 3. Pass criteria

- D1-D5: no unexpected transition; the last user action decides the selection.
- D6/D7: switching only after a confirmed failure.
- C1-C8: progress never resets to 0; no clip downloaded twice (clip store size equals the clip count times the average clip size); no stuck `resolving` task.
