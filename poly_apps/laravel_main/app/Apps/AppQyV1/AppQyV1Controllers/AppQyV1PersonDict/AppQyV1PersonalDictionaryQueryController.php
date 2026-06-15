<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1PersonDict;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1PersonalDictionaryEntryModel;
use App\Traits\ApiResponse;

class AppQyV1PersonalDictionaryQueryController
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    private function formatEntry(AppQyV1PersonalDictionaryEntryModel $entry): array
    {
        $createdAt = null;
        if ($entry->created_at !== null) {
            $createdAt = $entry->created_at->toIso8601String();
        }

        return [
            'id' => (string) $entry->id,
            'word' => $entry->word,
            'definition' => $entry->definition,
            'example' => $entry->example,
            'notes' => $entry->notes,
            'language' => $entry->language,
            'created_at' => $createdAt,
        ];
    }

    public function queryPDictionary(Request $request): JsonResponse
    {
        $uid = Auth::id();
        $word = $request->input('word');
        $language = $request->input('language');
        $limit = (int) $request->input('limit', 50);
        $offset = (int) $request->input('offset', 0);

        if ($limit <= 0) {
            $limit = 50;
        }
        if ($offset < 0) {
            $offset = 0;
        }

        $query = AppQyV1PersonalDictionaryEntryModel::where('uid', $uid);

        if ($word !== null && $word !== '') {
            // Case-insensitive on BOTH drivers: plain LIKE is case-insensitive
            // on sqlite but case-SENSITIVE on pgsql.
            $query->whereRaw('LOWER(word) LIKE ?', ['%' . strtolower($word) . '%']);
        }
        if ($language !== null && $language !== '') {
            $query->where('language', $language);
        }

        $entries = $query->orderByDesc('id')
            ->offset($offset)
            ->limit($limit)
            ->get();

        $data = [];
        foreach ($entries as $entry) {
            $data[] = $this->formatEntry($entry);
        }

        return $this->success($data, 'Personal dictionary queried successfully');
    }

    public function queryPDictionaryByWords(Request $request): JsonResponse
    {
        $uid = Auth::id();
        $words = $request->input('words');
        if (!is_array($words)) {
            $words = [];
        }

        $data = [];
        if (count($words) > 0) {
            $entries = AppQyV1PersonalDictionaryEntryModel::where('uid', $uid)
                ->whereIn('word', $words)
                ->orderByDesc('id')
                ->get();
            foreach ($entries as $entry) {
                $data[] = $this->formatEntry($entry);
            }
        }

        return $this->success($data, 'Personal dictionary queried by words successfully');
    }

}
