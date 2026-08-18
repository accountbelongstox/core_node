# Queue Center DIFF Segments

The queue discovery and delivery path now uses three bounded layers across Laravel, Pycore, and mcp-chrome:

- Persistent cursor metadata tracks revisions and high-water IDs.
- Persistent ID pages record discovered or claimed IDs without full rows.
- Full data segments are materialized only by a UI page request or worker claim and are compacted after consumption.

Laravel timer feeders share one DIFF base for word translation, word validity, word media, word audio, sentence audio, article audio, and library article audio. Priority promotion updates only the cursor and head-ID catalog. Queue page reads query IDs first and load full task records only for the requested page.

Pycore no longer performs background full-list polling for translation and sentence queue views. UI requests materialize the bounded list. Claimed task payloads are stored in a dedicated persistent segment file, recovered after restart, and removed after an accepted terminal result.

mcp-chrome applies the same lifecycle through the shared worker API client. Typed pulls stage claimed IDs and payloads, task promotion updates cursor/ID metadata, and terminal delivery or durable outbox ownership compacts the local payload segment.

The two UI surfaces use the same bounded contract. Laravel Manager and Pycore
Manager keep only cursor/head-ID context for priority changes and update the
visible page optimistically without a full queue reload. WordNew caps requested
sentence and word segments, limits concurrent sentence polling, and releases
the mapped data segment when playback data resolves or the request is retired.

Agent History remains a local-audio-first pipeline: Pycore synthesizes and saves
the complete article MP3 before uploading it with the article. Laravel stores
that audio and separately enqueues every parsed sentence into `sentence_audio`,
so QwenTTS fills sentence-level reader audio without replacing the complete
article recording.
