# Multi-Audio UI & Pipeline Specification

> **Source prompt (2026-07-11):** Book reader + library table must show live audio state
> (queued → processing → ready), support multiple clips per sentence/word with provider/accent/gender
> metadata, section-click play with smart auto-scroll, and unified pycore/Laravel/sys:init wiring.

## Goals

1. **Visual state machine** on every audio cell:
   - `queued` — Laravel priority bumped (amber `ArrowUpCircle`)
   - `processing` — `tts_status=processing` or worker leased (sky `Loader2`)
   - `ready` — file on disk / `has_audio` (emerald `Volume2`)
   - `playing` — active playback (indigo pulsing `Volume2`)
   - `missing` — no audio yet (fuchsia `VolumeX`)

2. **Multi-variant audio** — one sentence/word may have several MP3s:
   - Registry: `{prefix}_sentences_{lang}.audio_files` JSON
   - Fields: `variant_key`, `accent`, `gender`, `source`, `voice_type`, `provider`, `path`, `has_file`
   - DB `has_audio` = “at least one clip exists”; paths live in `audio_files` + disk

3. **Playback UX**
   - Click **section/row** → play from that node; auto-advance continues top→bottom
   - Click **another section** → switch current node and continue
   - **Auto-scroll** to center of active verse while playing; **pause scroll** for 2.5s after user wheel/touch; resume on explicit node pick

4. **Tool attribution** — pycore `tts_sentence_worker` reports `provider`, `accent`, `gender`, `source`, `voice_type` on upload

## Architecture

```
wordnew UI ──resolve/bump──► Laravel AppQyV1SentenceAudioService
                                ▲
pycore tts_sentence_worker ──report (multipart + metadata)──┘
```

### Laravel (`poly_apps/laravel_main`)

| Surface | Change |
|---------|--------|
| `GET /ai_tools/tts/sentence/audio` | Returns `tts_status`, `audio_files[]`, optional `?variant_key=` |
| `POST /ai_tools/tts/sentence/report` | Accepts `accent`, `gender`, `source`, `voice_type` → `audio_files` upsert |
| `AppQyV1MediaContentPublicController` | Verse `languages[lang]` includes `tts_status`, `audio_files` |
| `sys:init` | `MediaIngestTablesInitializer` ensures `audio_files` column (existing) |

### Pycore (`pycore/callmodule/services/tts_sentence_worker_service.py`)

- `_report()` sends full variant metadata mirroring `POST /media/audio`
- Task history records `variant_key`, `accent`, `gender`, `provider`

### wordnew UI

| File | Role |
|------|------|
| `utils/WfAudioCellState.ts` | State enum + `ttsStatusToCellState()` |
| `components/WfAudioStatusIcon.tsx` | Shared icon component |
| `components/reader/WfBookReaderVerseRow.tsx` | Per-lang icons + section click |
| `pages/WfNewBookReader.tsx` | Cell status map, smart scroll, `playFrom(verse, lang)` |
| `pages/WfNewLibraryPage.tsx` | Same icon states in table view |
| `services/WfBookReaderPlayback.ts` | `playFrom(verse, startLang?)` |

### pycore-manager

- Sentence queue / recent tasks show `provider`, `accent`, `gender` from task history detail

## API shapes

### Resolve response (extended)

```json
{
  "success": true,
  "exists": true,
  "url": "/static/app_qy_v1/sentence_sounds/en/abc123.mp3",
  "content_id": "abc123",
  "language": "en",
  "tts_status": "completed",
  "audio_files": [
    { "variant_key": "", "accent": "us", "gender": "female", "provider": "edge", "url": "..." },
    { "variant_key": "uk_f", "accent": "uk", "gender": "female", "provider": "edge", "url": "..." }
  ]
}
```

### Report payload (pycore → Laravel)

```
content_id, language, worker_id, success, provider, variant_key,
accent, gender, source=tts, voice_type=machine|neural, audio=<mp3>
```

## Future work

(Completed 2026-07-12 — see implementation report below.)

## Implementation report (2026-07-12)

| Layer | Status |
|-------|--------|
| Per-variant sentence claim (`missingVariantsForRow`, bump when partial) | ✅ Implemented |
| Word `audio_files` registry + migration + `GET /word/.../media` `audio_variants` | ✅ Implemented |
| FE `WfAudioVariantPicker` + `readerVariantByLang` playback resolve | ✅ Implemented |

## Implementation report (2026-07-11)

| Layer | Status |
|-------|--------|
| Laravel resolve/report/public read | ✅ Extended |
| Pycore worker metadata on report | ✅ Extended |
| Book reader icons + section play + scroll | ✅ Implemented |
| Library table icons + row play | ✅ Implemented |
| sys:init `audio_files` column (sentences) | ✅ Already in `MediaIngestTablesInitializer` |
| Per-variant claim/filter | ✅ Completed 2026-07-12 |

**Deploy:** restart pycore (`./pycore pyservice`), refresh wordnew UI, run `php artisan migrate` + `php artisan sys:init` on Laravel for `audio_files` on dictionary tables.
