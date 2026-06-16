# `core/tasks` — global progress-state-persistence layer

A foundational, end-agnostic layer that lets ANY feature on ANY client-rendered
end keep a long-running task's progress state alive across **page navigation** and
a **full page reload**, by treating the **backend as the source of truth**.

It generalizes the original feature-specific
`apps/pycore-manager/PcVideoExtractContext` into a shell-wide service.

## The two persistence layers

1. **Provider-above-routes (survives navigation across ALL ends).**
   `<TaskPersistenceProvider>` is mounted in `shell/ShellApp.tsx` **above
   `<BrowserRouter>`**, so it never unmounts as the user moves between ends/pages.
   It holds a **registry** of live sessions — each session's `data`, `running`
   flag, persisted `saved` payload, and its **poll timer** — keyed by the hook
   `key`. A page (the VIEW) unmounting therefore never tears down a running task:
   the session keeps living in the provider, and the re-mounted page simply
   re-subscribes and reads the still-live `data`.

2. **localStorage re-attach (survives a FULL reload / UI restart).**
   `begin(saved)` persists a tiny record `{ key, saved }` via `StorageManager`
   (the `nexus_task_…` namespace). On provider **INIT** it enumerates the
   persisted keys and, for each, calls the hook's registered `reattach(saved)`
   **once** to restore `data` from the backend and resume polling if the work is
   still in flight. So a hard reload reconnects to work that is still running
   server-side. (Lazy-mounted pages: the provider sweeps a few times after init
   to catch a hook that registers its `reattach` slightly after mount.)

## The hook API (the contract)

```ts
usePersistentTask<T>(key: string, opts: {
  poll: () => Promise<T | null>;            // runs every intervalMs while running
  reattach?: (saved: any) => Promise<T | null>; // restore from backend on reload
  intervalMs?: number;                      // default 2000
}): {
  data: T | null;            // latest polled / pushed snapshot
  running: boolean;          // is a session live for this key
  begin: (saved?: any) => void; // register + persist {key, saved} + start polling
  end: () => void;           // stop polling + clear persistence
  set: (data: T) => void;    // push a value between polls (e.g. a WS event)
  saved: any;                // the persisted re-attach payload
}
```

Behavior:

- `begin(saved)` registers a live session, persists `{ key, saved }`, fires an
  immediate poll, then polls `poll()` every `intervalMs` into `data`.
- `end()` stops the timer and removes the persisted record.
- `set(data)` lets a WS push (or a manual refresh) update `data` between polls.
- **`poll()` returning `null` means "settle"**: the provider stops the timer but
  keeps `data` + the persisted record. Use this for a continuous task that has
  reached a terminal state but whose final snapshot should still survive a reload
  (e.g. a finished extraction). Returning `null` on a *transient* failure simply
  keeps the last good `data` (the next non-null poll resumes updates) — for a
  pure continuous-poll list, return the last list or `null` to avoid clobbering.
- On INIT, `reattach(saved)` is called once per persisted key. Return the backend
  task to restore `data`; return `null` if the backend no longer knows the task
  (the record is then cleared).

## How any end/feature adopts it

```ts
const job = usePersistentTask<MySnapshot>('myend.my-feature', {
  intervalMs: 2000,
  poll: () => api.getStatus(id).then(r => r.ok ? r.snapshot : null).catch(() => null),
  reattach: (saved) => api.getStatus(saved.id).then(r => r.ok ? r.snapshot : null).catch(() => null),
});

// start it once (idempotent if already running):
useEffect(() => { if (!job.running) job.begin({ id }); }, []);

// read live state:
job.data;          // survives navigation + reload
job.running;

// push a WS event between polls:
socket.on('tick', d => job.set(d));
```

Keep **page-only UI state local** (form inputs, selected rows, modals, transient
notices). Only the backend-owned snapshot belongs in the persistent task.

### Namespace — `task_{end}_{feature}`

The public hook key is the dotted form `{end}.{feature}` (e.g.
`pycore.video-extract`). `taskStorageKeys.ts` maps it to the localStorage key
`nexus_task_{end}_{feature}` (dots → underscores), layered on `StorageKeys`'
`nexus_` prefix. A single index key (`nexus_task__index`) holds the list of
registered keys so the provider can enumerate sessions to re-attach on reload
without scanning all of localStorage.

In-tree adopters:

| key | feature |
| --- | --- |
| `pycore.video-extract`        | `PcVideoExtractContext` (run + snapshot/mapping/sync) |
| `pycore.task-queue`           | `PcTaskQueuePage` (voice-subtitle task list)          |
| `pycore.translation-queue`    | `PcTranslationQueuePage` (Laravel queue snapshot)     |
| `pycore.code-sync`            | `PcCodeSyncPage` (peer-mesh self + peers)             |
| `laravel.task-center`         | `TaskCenter` shell (scheduler+queue aggregate poll)   |
| `laravel.octane-tasks`        | `TaskCenter` → SchedulerPanel (Octane timer status)   |
| `laravel.global-tasks`        | `TaskCenter` → Queue/WorkersPanel (global_tasks)      |
| `laravel.tts-queue`           | `VocabularyLearning` view (TTS queue stats poll)      |
| `wordflow.article-processor`  | `WfToolsArticleProcessorPage` (submit→poll task)      |

### laravel-manager adopters — why these and not the others

The laravel-manager dashboard switches views by a client-side `activeView`
state (not real routes), so a view **unmounts** when you switch away and its
local state is lost. The two genuinely *continuous-poll* views were migrated:

- **TaskCenter** (`laravel.task-center` + `laravel.octane-tasks` +
  `laravel.global-tasks`) — the unified page's shell polls the
  `/api/task-center/overview` aggregate while its Scheduler / Queue / Workers
  tab panels keep the two legacy keys; all three snapshots + loops live in the
  provider, so tab switches and leaving/returning stay warm.
- **VocabularyLearning** TTS queue (`laravel.tts-queue`) — polls
  `getTTSQueueStats()` every 5s under an auto-refresh toggle; same treatment.

Deliberately **skipped** (state is trivial/instant or not a client-side
continuous task): `ServerManager` (load-on-tab-switch + an Octane *restart* flow
that ends in a full `window.location.reload()`, so cross-nav persistence is
moot), `MediaBrowser` upload (single awaited POST, the progress bar is a faux
ticker with no backend poll), `FloatingTaskPlayer` (local audio-playback
simulation, no backend), and the orphan `SystemInfo.tsx` (not mounted by any
view). `VoiceSubtitleManager` has no client-side polling.

### wordflow adopter — why one, and why StorageCenter still covers the rest

wordflow (Capacitor/native) keeps settings/auth/preferences in `StorageCenter`
(Capacitor Preferences → localStorage), which already survives reload — the task
layer is **not** needed for those. The one place a *client-side long task*
exists is **WfToolsArticleProcessorPage** (`wordflow.article-processor`): submit
returns a `task_id`, then the page polls `/ai_tools/article/task/:id` every 2s
until `completed`/`failed`. Previously that `setTimeout` poll + the `task_id`
were lost on navigation. It now uses `usePersistentTask` with
`begin({ task_id })` (persists the id) and a `reattach` that re-polls on reload;
a terminal status pushes the final snapshot via `set` then returns `null` to
settle the loop while keeping the result visible. All other wordflow pages are
either pure config (StorageCenter) or instant fetches, so the hook was not
forced onto them.

## laravel_main (server-driven variant)

`poly_apps/laravel_main` is **server-driven** (Inertia + Reverb), so the
client-side `usePersistentTask` hook does **not** apply there — and shouldn't be
forced in. Navigation in an Inertia app re-requests the page from the server,
which means the page's data is **always re-hydrated from server state** on every
visit and on a full reload. The "survives navigation + reload" guarantee the
shell hook provides for client-rendered ends is, for laravel_main, simply a
property of the server being the source of truth. The analogous progress-
persistence pattern is therefore a three-part server/broadcast/page loop:

1. **The server tracks task/job progress.** Long work runs as a queued job
   (`php artisan queue:work` / Horizon). The job writes its progress to a
   durable store the page can read back — e.g. a `progress` / `status` column on
   the task's model row, or a cache entry (`Cache::put("task:{id}:progress", …)`).
   Because this lives server-side, a browser reload re-reads the *current* value;
   nothing is held in client `localStorage`.

2. **Reverb broadcasts push live updates.** The job (or an observer on the
   progress write) dispatches a broadcast event on a private/presence channel,
   e.g. `TaskProgressUpdated implements ShouldBroadcast` on
   `new PrivateChannel("tasks.{$task->id}")`, carrying `{ progress, status }`.
   Reverb (the first-party WebSocket server; see `config/reverb.php`) delivers
   it to subscribed clients without the page polling.

3. **An Inertia page subscribes via Echo (and/or partial-reload polls).** The
   page wires Laravel Echo — the project's existing `resources/js/echo.js`
   (Reverb broadcaster) — to listen on the task's channel and merge pushed
   `{ progress, status }` into local component state for a live bar:

   ```js
   // resources/js/echo.js already configures `window.Echo` (Reverb).
   Echo.private(`tasks.${taskId}`)
       .listen('TaskProgressUpdated', (e) => setProgress(e.progress));
   ```

   As a fallback (or where broadcasting is off), the page can use **Inertia
   partial reloads** to poll just the progress prop:

   ```js
   router.reload({ only: ['task'], async: true }); // on an interval
   ```

   Either way, on a hard reload the Inertia visit re-fetches the page with the
   server's current `task.progress`, so the progress UI is restored from the
   server — **no client store is needed**.

This is documented as the architectural counterpart for laravel_main; the actual
PHP job + broadcast event + Inertia/Echo page wiring is a **follow-up
implementation effort** in laravel_main and is intentionally not part of this
client-side foundation change.
