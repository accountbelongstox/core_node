<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Learning;

use Illuminate\Routing\Controller as BaseController;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Validator;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1DailyRecitationLogModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1GroupWordProgressModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1LanguageStudyGroupService;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1PersonalDictionaryQueryBasePublicController as PDQBasePublic;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1PersonalDictionaryProcessPublicController as PDProcessPublic;
use App\Traits\ApiResponse;

class AppQyV1DailyRecitationController extends BaseController
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     *
     * Daily recitation backend. The per-day recitation log
     * (app_qy_v1_daily_recitation_logs) is APPEND-ONLY and exists for
     * day-scoped reporting (today summary, streaks, plan exclusion).
     * Long-lived per-word learning state stays in the EXISTING
     * personal_dicts JSON items {read, weight, learned, reviewed,
     * last_read_time, review_time}, driven exclusively through the
     * existing AppQyV1PersonalDictionaryProcessPublicController helpers.
     *
     * Action -> personal-dict counter mapping:
     *   read           -> read+1, last_read_time=now
     *   learn          -> learned+1
     *   review_correct -> reviewed+1, review_time=now
     *   review_wrong   -> reviewed+1, review_time=now, weight+1
     * (weight is the existing "needs attention" counter - the same
     * plus-1 semantics AppQyV1WordWeightController applies; struggling
     * words accumulate weight.)
     */

    private const MAX_WORDS_PER_CALL = 200;
    private const DEFAULT_DAILY_GOAL = 20;
    private const STREAK_WINDOW_DAYS = 35;

    /**
     * Spaced-repetition due curve, keyed by the item's reviewed count:
     * the word becomes due again N days after its last recite
     * (max(review_time, last_read_time)). reviewed >= 4 uses 30 days.
     */
    private const DUE_CURVE_DAYS = [0 => 1, 1 => 3, 2 => 7, 3 => 14];
    private const DUE_CURVE_MAX_DAYS = 30;

    // ------------------------------------------------------------------
    // POST /recitation/log
    // ------------------------------------------------------------------

    public function logRecitation(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $validator = Validator::make($request->all(), [
            'words' => 'required|array|min:1',
            'words.*.word' => 'required|string|max:255',
            'words.*.action' => 'required|string|in:read,learn,review_correct,review_wrong',
            'language' => 'nullable|string|max:16',
            'session_id' => 'nullable|string|max:64',
            'batch_id' => 'nullable|string|max:64',
        ]);
        if ($validator->fails()) {
            return $this->error('Validation failed: ' . $validator->errors()->first(), 422);
        }

        $items = $request->input('words');
        if (count($items) > self::MAX_WORDS_PER_CALL) {
            return $this->error('Too many words: max ' . self::MAX_WORDS_PER_CALL . ' per call', 400);
        }

        $language = $this->resolveLanguage($request);
        $goal = $this->resolveDailyGoal($user);

        $sessionId = $request->input('session_id');
        $batchId = $request->input('batch_id');

        // Idempotency for the FE offline queue: a batch_id that was already
        // logged for this user is a replay - return the stored day's summary
        // and write nothing, so replays never double-count.
        if ($batchId !== null && $batchId !== '') {
            $existingBatch = AppQyV1DailyRecitationLogModel::where('user_id', $user->id)
                ->where('batch_id', $batchId)
                ->orderBy('id')
                ->get(['date']);
            if ($existingBatch->count() > 0) {
                $batchDate = (string) $existingBatch->first()->date;
                return $this->success([
                    'logged' => $existingBatch->count(),
                    'date' => $batchDate,
                    'replayed' => true,
                    'today' => $this->buildDaySummary($user->id, $batchDate, $goal),
                ], 'Recitation batch already logged');
            }
        }

        $today = Carbon::today()->toDateString();
        $now = Carbon::now();

        $rows = [];
        $wordsByAction = [
            'read' => [],
            'learn' => [],
            'review_correct' => [],
            'review_wrong' => [],
        ];
        foreach ($items as $item) {
            $word = trim($item['word']);
            if ($word === '') {
                continue;
            }
            $action = $item['action'];
            $rows[] = [
                'user_id' => $user->id,
                'date' => $today,
                'word' => $word,
                'language_code' => $language,
                'action' => $action,
                'session_id' => $sessionId,
                'batch_id' => $batchId,
                'created_at' => $now,
                'updated_at' => $now,
            ];
            $wordsByAction[$action][] = $word;
        }

        if (count($rows) === 0) {
            return $this->error('No valid words provided', 400);
        }

        AppQyV1DailyRecitationLogModel::insert($rows);

        // Drive the EXISTING personal_dicts counters (single source of
        // long-lived per-word state). Missing words are auto-wrapped by
        // the helpers via DictWrap.
        $readWords = array_values(array_unique($wordsByAction['read']));
        $learnWords = array_values(array_unique($wordsByAction['learn']));
        $reviewWords = array_values(array_unique(array_merge(
            $wordsByAction['review_correct'],
            $wordsByAction['review_wrong']
        )));
        $wrongWords = array_values(array_unique($wordsByAction['review_wrong']));

        if (count($readWords) > 0) {
            PDProcessPublic::updateReadPDByWords($readWords);
            PDProcessPublic::updateLastReadPDByWords($readWords);
        }
        if (count($learnWords) > 0) {
            PDProcessPublic::updateLearnedPDByWords($learnWords);
        }
        if (count($reviewWords) > 0) {
            PDProcessPublic::updateReviewedPDByWords($reviewWords);
        }
        if (count($wrongWords) > 0) {
            // A wrong review still counts as a review (handled above), but
            // ALSO bumps weight: struggling words weigh more in selection.
            PDProcessPublic::updateWeightPDByWords($wrongWords);
        }

        return $this->success([
            'logged' => count($rows),
            'date' => $today,
            'replayed' => false,
            'today' => $this->buildDaySummary($user->id, $today, $goal),
        ], 'Recitation logged');
    }

    // ------------------------------------------------------------------
    // GET /recitation/today-plan
    // ------------------------------------------------------------------

    /**
     * Deterministic plan selection:
     *  (a) DUE first - personal_dicts items whose last recite
     *      (max(review_time, last_read_time)) is older than the spaced
     *      curve interval for their reviewed count (never-recited items
     *      have last recite 0 and are maximally overdue). Words already
     *      recited today (any log row) are excluded. Ordered most-overdue
     *      first, word ASC as the deterministic tie-break.
     *  (b) FILL remaining slots with NEW words from the user's
     *      language-default group (legacy gwords text first, in stored
     *      order, then group_words pivot entries in pivot id order) that
     *      are not in personal_dicts and not recited today.
     */
    public function todayPlan(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $language = $this->resolveLanguage($request);
        $goal = $this->resolveDailyGoal($user);

        $limit = (int) $request->input('limit', $goal);
        if ($limit < 1) {
            $limit = $goal;
        }
        if ($limit > self::MAX_WORDS_PER_CALL) {
            $limit = self::MAX_WORDS_PER_CALL;
        }

        $today = Carbon::today()->toDateString();

        $recitedToday = AppQyV1DailyRecitationLogModel::forUserDate($user->id, $today)
            ->distinct()
            ->pluck('word')
            ->all();
        $recitedSet = array_fill_keys($recitedToday, true);
        $doneToday = count($recitedToday);

        // (a) DUE words from personal_dicts.
        $queryResult = PDQBasePublic::queryPersonalDictionary(false, false, false);
        $personDict = $queryResult['data'];

        $nowTs = time();
        $dueCandidates = [];
        $personalWordSet = [];
        foreach ($personDict as $key => $item) {
            if (is_array($item)) {
                $word = (string) $key;
            } else {
                // Legacy plain-list entry: value is the word itself.
                $word = (string) $item;
                $item = [];
            }
            if ($word === '') {
                continue;
            }
            $personalWordSet[$word] = true;
            if (isset($recitedSet[$word])) {
                continue;
            }

            $reviewed = 0;
            if (isset($item['reviewed'])) {
                $reviewed = (int) $item['reviewed'];
            }
            $reviewTime = 0;
            if (isset($item['review_time'])) {
                $reviewTime = (int) $item['review_time'];
            }
            $lastReadTime = 0;
            if (isset($item['last_read_time'])) {
                $lastReadTime = (int) $item['last_read_time'];
            }
            $lastRecite = max($reviewTime, $lastReadTime);

            $intervalDays = self::DUE_CURVE_MAX_DAYS;
            if (isset(self::DUE_CURVE_DAYS[$reviewed])) {
                $intervalDays = self::DUE_CURVE_DAYS[$reviewed];
            }
            $overdueSeconds = ($nowTs - $lastRecite) - ($intervalDays * 86400);
            if ($overdueSeconds <= 0) {
                continue;
            }

            $read = 0;
            if (isset($item['read'])) {
                $read = (int) $item['read'];
            }
            $learned = 0;
            if (isset($item['learned'])) {
                $learned = (int) $item['learned'];
            }

            $dueCandidates[] = [
                'word' => $word,
                'overdue' => $overdueSeconds,
                'personal' => [
                    'read' => $read,
                    'learned' => $learned,
                    'reviewed' => $reviewed,
                    'review_time' => $reviewTime,
                ],
            ];
        }

        usort($dueCandidates, function ($a, $b) {
            if ($a['overdue'] !== $b['overdue']) {
                return $b['overdue'] <=> $a['overdue'];
            }
            return strcmp($a['word'], $b['word']);
        });

        $planWords = [];
        $selectedSet = [];
        foreach ($dueCandidates as $candidate) {
            if (count($planWords) >= $limit) {
                break;
            }
            $entry = $this->lookupDictionaryEntry($language, $candidate['word']);
            $planWords[] = [
                'word' => $candidate['word'],
                'source' => 'due',
                'personal' => $candidate['personal'],
                'translation' => $entry['translation'],
                'phonetic' => $entry['phonetic'],
            ];
            $selectedSet[$candidate['word']] = true;
        }

        // (b) FILL with NEW group words.
        if (count($planWords) < $limit) {
            $groupWords = $this->collectGroupWordsInOrder($user->id, $language);
            foreach ($groupWords as $word) {
                if (count($planWords) >= $limit) {
                    break;
                }
                if (isset($personalWordSet[$word])) {
                    continue;
                }
                if (isset($recitedSet[$word])) {
                    continue;
                }
                if (isset($selectedSet[$word])) {
                    continue;
                }
                $entry = $this->lookupDictionaryEntry($language, $word);
                $planWords[] = [
                    'word' => $word,
                    'source' => 'new',
                    'personal' => [
                        'read' => 0,
                        'learned' => 0,
                        'reviewed' => 0,
                        'review_time' => 0,
                    ],
                    'translation' => $entry['translation'],
                    'phonetic' => $entry['phonetic'],
                ];
                $selectedSet[$word] = true;
            }
        }

        return $this->success([
            'date' => $today,
            'goal' => $goal,
            'done_today' => $doneToday,
            'words' => $planWords,
        ], 'Today plan retrieved');
    }

    // ------------------------------------------------------------------
    // GET /recitation/summary
    // ------------------------------------------------------------------

    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $date = $request->input('date');
        if ($date === null) {
            $date = Carbon::today()->toDateString();
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return $this->error('Invalid date format, expected YYYY-MM-DD', 400);
        }

        $goal = $this->resolveDailyGoal($user);
        $summaryData = $this->buildDaySummary($user->id, $date, $goal);

        $rows = AppQyV1DailyRecitationLogModel::forUserDate($user->id, $date)
            ->orderBy('id')
            ->get(['word', 'action']);
        $wordActions = [];
        foreach ($rows as $row) {
            if (!isset($wordActions[$row->word])) {
                $wordActions[$row->word] = [];
            }
            $wordActions[$row->word][] = $row->action;
        }
        $words = [];
        foreach ($wordActions as $word => $actions) {
            $words[] = [
                'word' => (string) $word,
                'actions' => $actions,
            ];
        }

        return $this->success([
            'date' => $date,
            'unique_words' => $summaryData['unique_words'],
            'actions' => $summaryData['actions'],
            'goal' => $summaryData['goal'],
            'goal_met' => $summaryData['goal_met'],
            'words' => $words,
        ], 'Recitation summary retrieved');
    }

    // ------------------------------------------------------------------
    // GET /recitation/streak
    // ------------------------------------------------------------------

    public function streak(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        // One grouped query over the log table: distinct active days with
        // their unique-word counts, ordered by day.
        $rows = AppQyV1DailyRecitationLogModel::uniqueWordsByDate($user->id);

        $dayList = [];
        foreach ($rows as $row) {
            $dayList[] = [
                'date' => Carbon::parse((string) $row->date)->toDateString(),
                'unique_words' => (int) $row->unique_words,
            ];
        }

        $longestStreak = 0;
        $runLength = 0;
        $previousDay = null;
        foreach ($dayList as $dayEntry) {
            $currentDay = Carbon::parse($dayEntry['date']);
            if ($previousDay !== null && (int) $previousDay->diffInDays($currentDay) === 1) {
                $runLength++;
            } else {
                $runLength = 1;
            }
            if ($runLength > $longestStreak) {
                $longestStreak = $runLength;
            }
            $previousDay = $currentDay;
        }

        // Current streak: consecutive days ending today or yesterday.
        $currentStreak = 0;
        $dayCount = count($dayList);
        if ($dayCount > 0) {
            $lastDay = Carbon::parse($dayList[$dayCount - 1]['date']);
            $gapToToday = (int) $lastDay->diffInDays(Carbon::today());
            if ($gapToToday <= 1) {
                $currentStreak = 1;
                for ($i = $dayCount - 1; $i > 0; $i--) {
                    $prev = Carbon::parse($dayList[$i - 1]['date']);
                    $curr = Carbon::parse($dayList[$i]['date']);
                    if ((int) $prev->diffInDays($curr) === 1) {
                        $currentStreak++;
                    } else {
                        break;
                    }
                }
            }
        }

        $windowStart = Carbon::today()->subDays(self::STREAK_WINDOW_DAYS - 1)->toDateString();
        $windowDays = [];
        foreach ($dayList as $dayEntry) {
            if ($dayEntry['date'] >= $windowStart) {
                $windowDays[] = $dayEntry;
            }
        }

        return $this->success([
            'current_streak' => $currentStreak,
            'longest_streak' => $longestStreak,
            'days' => $windowDays,
        ], 'Recitation streak retrieved');
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    private function resolveLanguage(Request $request): string
    {
        $language = $request->input('language');
        if (!is_string($language)) {
            return 'en';
        }
        $language = strtolower(trim($language));
        if ($language === '') {
            return 'en';
        }
        return $language;
    }

    /**
     * Per-user daily goal: the 'daily_goal' key of the users.preferences
     * JSON column (settable via PUT /user/preferences), default 20 -
     * the same source AppQyV1ProfileController::getStatistics reads.
     */
    private function resolveDailyGoal($user): int
    {
        $preferences = $user->preferences;
        if (!is_array($preferences)) {
            $preferences = [];
        }
        $goal = self::DEFAULT_DAILY_GOAL;
        if (isset($preferences['daily_goal'])) {
            $goal = (int) $preferences['daily_goal'];
        }
        if ($goal < 1) {
            $goal = self::DEFAULT_DAILY_GOAL;
        }
        if ($goal > 500) {
            $goal = self::DEFAULT_DAILY_GOAL;
        }
        return $goal;
    }

    private function buildDaySummary(int $userId, string $date, int $goal): array
    {
        $rows = AppQyV1DailyRecitationLogModel::forUserDate($userId, $date)
            ->get(['word', 'action']);

        $uniqueWords = [];
        $actions = [
            'read' => 0,
            'learn' => 0,
            'review_correct' => 0,
            'review_wrong' => 0,
        ];
        foreach ($rows as $row) {
            $uniqueWords[$row->word] = true;
            if (isset($actions[$row->action])) {
                $actions[$row->action]++;
            }
        }
        $uniqueCount = count($uniqueWords);

        return [
            'unique_words' => $uniqueCount,
            'actions' => $actions,
            'goal' => $goal,
            'goal_met' => $uniqueCount >= $goal,
        ];
    }

    /**
     * Dictionary lookup for translation/phonetic - the same canonical
     * tts_cache_{lang} table getDailyWords/lookup reads, via
     * AppQyV1LangDictionaryModel::findByContent. Nulls when absent.
     */
    private function lookupDictionaryEntry(string $language, string $word): array
    {
        $row = AppQyV1LangDictionaryModel::findByContent($language, $word);
        if ($row === null) {
            return ['translation' => null, 'phonetic' => null];
        }

        $translation = $this->normalizeTranslation($row->translations);
        if ($translation === '') {
            $translation = null;
        }

        $phonetic = $row->us_phonetic;
        if (!$phonetic) {
            $phonetic = $row->uk_phonetic;
        }
        if (!$phonetic) {
            $phonetic = null;
        }

        return ['translation' => $translation, 'phonetic' => $phonetic];
    }

    /**
     * Normalize a translations value (json column) into a display string.
     * Mirrors AppQyV1WordQueryController::normalizeTranslation (recursive,
     * depth-agnostic for the PG jsonb shape).
     */
    private function normalizeTranslation($value): string
    {
        if (is_string($value)) {
            return $value;
        }
        if ($value === null) {
            return '';
        }
        if (is_array($value)) {
            $parts = [];
            foreach ($value as $item) {
                if (is_array($item)) {
                    $nested = $this->normalizeTranslation($item);
                } else {
                    $nested = (string) $item;
                }
                if ($nested !== '') {
                    $parts[] = $nested;
                }
            }
            return implode('; ', $parts);
        }
        return (string) $value;
    }

    /**
     * All word texts of the user's language-default group, in group order:
     * legacy gwords JSON first (stored order), then the group's
     * group_word_progress JSON map keys (canonical aa-then-word_id order)
     * resolved against the per-language dictionary (map keys are
     * tts_cache_{language_code} ids). Falls back to the first group of
     * that language when no default group exists. Batched lookups via
     * resolveDictionaryRows - no N+1.
     */
    private function collectGroupWordsInOrder(int $userId, string $language): array
    {
        $group = AppQyV1LanguageStudyGroupService::getDefaultGroupForLanguage($userId, $language);
        if ($group === null) {
            $groups = AppQyV1LanguageStudyGroupService::getByLanguage($userId, $language);
            if (count($groups) === 0) {
                return [];
            }
            $groupId = $groups[0]['id'];
            $gwords = $groups[0]['gwords'];
        } else {
            $groupId = $group->id;
            $gwords = $group->gwords;
        }

        $ordered = [];
        $seen = [];
        if (is_string($gwords)) {
            $gwords = json_decode($gwords, true);
        }
        if (is_array($gwords)) {
            foreach ($gwords as $gword) {
                if (!is_string($gword)) {
                    continue;
                }
                $gword = trim($gword);
                if ($gword === '') {
                    continue;
                }
                if (isset($seen[$gword])) {
                    continue;
                }
                $seen[$gword] = true;
                $ordered[] = $gword;
            }
        }

        $progressRow = AppQyV1GroupWordProgressModel::where('group_id', $groupId)->first();
        if ($progressRow) {
            $orderedIds = $progressRow->orderedWordIds();
            $resolved = $progressRow->resolveDictionaryRows($orderedIds);
            foreach ($orderedIds as $mapWordId) {
                if (!isset($resolved[$mapWordId])) {
                    continue;
                }
                $text = trim((string) $resolved[$mapWordId]->content);
                if ($text === '') {
                    continue;
                }
                if (isset($seen[$text])) {
                    continue;
                }
                $seen[$text] = true;
                $ordered[] = $text;
            }
        }

        return $ordered;
    }
}
