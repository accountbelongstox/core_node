<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordQurey;

use App\Http\Controllers\Controller;
use App\Support\EcdictDictionary;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;

/**
 * ECDICT offline word query (shared database with pycore).
 *
 * Serves the SAME stardict.db that pycore exposes via
 * ui/dictionary/dictionary_status + ui/dictionary/dictionary_lookup, read
 * directly through the PathMapper path map. Lock races against the pycore
 * service surface as busy=true / HTTP 503 with an explicit "retry
 * immediately" message; the shared UI library retries once transparently.
 */
class AppQyV1EcdictLookupCtl extends Controller
{
    use ApiResponse;

    public function status()
    {
        $status = EcdictDictionary::status();
        if ($status['busy'] ?? false) {
            return $this->error(
                'ECDICT database is busy (shared with the pycore service); retry immediately',
                503,
                $status
            );
        }
        return $this->success($status, 'ECDICT status');
    }

    public function lookup(Request $request)
    {
        $request->validate([
            'word' => 'required|string|max:64',
            'target' => 'nullable|string|max:32',
        ]);

        $word = trim((string) $request->input('word'));
        $target = (string) $request->input('target', 'zh');

        $entry = EcdictDictionary::lookup($word);
        if ($entry['busy'] ?? false) {
            return $this->error(
                'ECDICT database is busy (shared with the pycore service); retry immediately',
                503,
                $entry
            );
        }
        $entry['target'] = $target;
        $entry['target_translation'] = EcdictDictionary::translate($word, $target);

        return $this->success($entry, 'ECDICT lookup completed');
    }
}
