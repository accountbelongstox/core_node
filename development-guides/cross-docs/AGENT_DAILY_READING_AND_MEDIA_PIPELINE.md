# Agent Daily Reading, Playback, and Media — Functional Requirements

Status: PLANNED. This document records functional requirements only. It does not
define code structure, implementation steps, database schemas, or internal API
design.

## 1. Agent history monitoring

- `/pycore-manager/agent-history` must monitor every supported AI development
  tool found on the current machine.
- Supported tools include Agent, Claude, Codex, Cursor, Antigravity, Cline,
  Ark CLI, and Kimi. Existing supported tools may continue to be monitored.
- A tool is monitored only when its local history source exists. A missing tool
  must not cause an error or create meaningless work.
- Newly generated history must be detected continuously without repeatedly
  processing previously consumed content.
- The page must show which tools are detected, whether each listener is active,
  its latest activity, current processing state, and the latest error.
- Enabling the feature starts historical backfill and then continues live
  monitoring. Disabling it stops accepting new work without corrupting saved
  progress.

## 2. Short-article generation

- Agent-history content must be grouped into coherent source batches and turned
  into short reading articles.
- Each completed reading item must contain:
  - a Chinese title and article;
  - an English title and article;
  - playable English audio;
  - its source tools and generation time.
- Chinese audio is optional and is not required by default.
- OpenRouter generates the reference article. The requested `fredd` model means
  the available free-model route unless a specific model is configured later.
- OpenRouter usage has one shared limit of 1,000 accepted generation requests per
  day. The limit is shared across all monitored tools, not multiplied per tool.
- The management page must show used requests, remaining requests, reset time,
  selected model, and quota-exhausted state.
- When the daily limit is exhausted, pending content waits for the next reset. It
  must not be discarded or repeatedly charged.
- English generation or translation must use a local model when available.
- English audio must use local speech generation. Failure to upload or publish an
  already generated item must not regenerate it or consume another OpenRouter
  request.
- The same source batch must never create duplicate Daily Reading items.

## 3. Daily Reading updates

- Wordnew Daily Reading must receive the Chinese article, English article, and
  English audio produced from agent history.
- New and updated reading items must appear in wordnew in near real time from
  Pycore/Laravel updates.
- Reconnection must recover missed updates without duplicating articles or
  losing the user's reading position.
- If realtime delivery is temporarily unavailable, wordnew may refresh in the
  background until realtime delivery resumes.
- The home-page Daily Reading card and an already open article list must reflect
  the same latest state.

## 4. Article route and sorting

- The canonical reading route is `/wordnew#/article/:sort`.
- `/wordnew#/article` defaults to the latest-first view.
- Required sorting modes are latest, oldest, source, unread, and random.
- An unsupported sort value falls back to latest.
- Opening a reading item shows both languages, sentence boundaries, available
  audio, playback state, and reading progress.

## 5. Article and sentence playback

- Article reading and book reading must share consistent playback behavior.
- Required playback modes are:
  - play once;
  - repeat the current sentence;
  - repeat the entire reading queue;
  - sequential playback;
  - shuffled sentence playback.
- Users can select any sentence and continue playback from that sentence.
- Playback-driven sentence changes keep the active sentence visible. Manual page
  scrolling temporarily suppresses automatic scrolling.
- The following settings must be available and remembered:
  - playback mode;
  - whether words are played with each sentence;
  - new words, all words, or words not yet played on the current page;
  - number of plays per word;
  - number of plays per sentence;
  - whether the sentence is played once before its words;
  - delay between words and sentences;
  - existing voice, accent, speed, and audio-variant preferences.
- When sentence-first is disabled, selected words play the configured number of
  times before the sentence plays.
- When sentence-first is enabled, the sentence plays once, then its selected
  words play, followed by any remaining sentence repetitions.
- Missing word audio or sentence audio must enter the existing media workflow;
  playback should use an available fallback instead of silently skipping content.

## 6. Shared sentence word table

- Wordnew requires one global sentence-to-word function backed by Laravel.
- Given a sentence, it returns every word occurrence in reading order together
  with normalized spelling, translation, phonetic information, available audio,
  and learning/playback state.
- Repeated occurrences remain visible in sentence order while shared word data is
  reused.
- The same function must be used by book reader, article reader, and sentence
  preview features so tokenization and word status remain consistent.
- By default, sentence playback selects words that have not previously been
  played in the user's Shelf/Default Vocabulary Group.
- Users may instead select all words or only words not played in the current page.
- A successfully played word must be marked in the current reading context and
  synchronized to Shelf and backend progress.
- Repeated or retried progress submissions must count a completed play only once.
- Progress made while temporarily offline must synchronize when connectivity
  returns.

## 7. Preview priority

- Previewing visible content must immediately move its unresolved work to the
  front of the appropriate Laravel queue.
- This behavior applies to:
  - word previews in `/wordnew#/library/`;
  - word previews and reading in `/wordnew#/shelf`;
  - sentence previews in `/wordnew#/book-reader`;
  - sentence and word previews in `/wordnew#/article/:sort`;
  - book/library covers visible on `/wordnew#/home`.
- Visible-page work has priority over background backfill.
- Repeated preview requests must not create duplicate work.
- A task already being processed finishes normally; priority changes affect work
  that has not started.
- Pycore processes only the queues whose corresponding features are enabled.
- Disabling one feature stops new claims for that feature without stopping other
  queues or cancelling in-progress work.
- Re-enabling a feature resumes with the highest-priority eligible item.

## 8. Book and library covers

- Every visible book/library on `/wordnew#/home` must have its cover checked.
- Missing or unverified covers must be handled by `apps/mcp-chrome` through search
  engines.
- Search should use book title, author, language, and cover-related context.
- Selected images must be relevant to the book and must be usable as covers.
- Existing covers remain displayable while replacement or verification is in
  progress.
- Laravel must distinguish covers submitted by mcp-chrome from legacy or other
  covers.
- Even when an entity already has a cover, mcp-chrome must process it if Laravel
  has no record that mcp-chrome previously submitted it.
- Once an accepted mcp-chrome submission is recorded, identical work must not be
  repeated unless the source information or search requirements change.

## 9. Word covers

- Word-cover search and acquisition move from Pycore to `apps/mcp-chrome`.
- Pycore must no longer generate or process word-cover images after the feature is
  transferred.
- Word-cover searches should use the word, its translation or definition, and
  varied contextual search terms.
- Results should not be restricted to one fixed theme.
- Text-only cards, dictionary screenshots, irrelevant logos, and unsuitable or
  visibly watermarked images should be rejected where detectable.
- Existing word images without an mcp-chrome submission record must still enter
  the mcp-chrome processing flow.

## 10. mcp-chrome Task controls

- The mcp-chrome Task Center must clearly label cover work.
- It must provide controls for:
  - all image and cover work;
  - book/library covers;
  - word covers.
- Only selected functions may claim their corresponding tasks.
- Book/library cover tasks and word-cover tasks must be visibly distinguishable.
- The task view must show pending, processing, submitted, and failed states, plus
  enough source information to understand the selected image.
- Failed tasks can be retried without creating duplicate successful submissions.

## 11. Data and initialization requirements

- Laravel initialization must support all new article, bilingual content, audio,
  playback progress, realtime update, and mcp-chrome submission state required by
  these features.
- Initialization must be repeatable and must preserve existing articles, media,
  progress, quota state, and cover provenance.
- Large audio and image content must remain managed media rather than being stored
  directly as database payloads.
- Existing installations must recognize legacy covers as not yet submitted by
  mcp-chrome until an accepted mcp-chrome result is recorded.

## 12. Acceptance requirements

- Every supported tool found locally is monitored; absent tools stay idle.
- Agent history produces Chinese and English short articles with playable English
  audio.
- OpenRouter usage cannot exceed 1,000 accepted requests in one configured day.
- Daily Reading updates arrive without duplicates and recover after reconnect.
- All required article sorting and playback modes work across article and book
  reading.
- Sentence word playback honors word and sentence repetition settings.
- The default new-word selection excludes words already played in Shelf.
- Completed word playback updates the current reading context, Shelf, and backend
  once.
- Visible previews move unresolved work ahead of background work.
- Queue feature switches affect only their corresponding work.
- All book/library and word covers are handled by mcp-chrome, not Pycore.
- A legacy cover without an mcp-chrome submission record is still processed.
