<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Vocabulary;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryService;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Vocabulary export downloads (csv / json / anki / text / pdf).
 *
 * Word data comes from the consolidated store: vocabulary_libraries.word_ids
 * (ordered dictionary ids) resolved against the canonical tts_cache_{lang}
 * dictionary for texts, translations and phonetics.
 */
class AppQyV1VocabularyExportController extends Controller
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    private const SUPPORTED_FORMATS = ['csv', 'json', 'anki', 'text', 'pdf'];
    private const DEFAULT_LIMIT = 5000;
    private const MAX_LIMIT = 20000;

    public function export(Request $request, string $format): Response
    {
        if (!in_array($format, self::SUPPORTED_FORMATS, true)) {
            return $this->error(
                'Unsupported export format: ' . $format . '. Supported formats: ' . implode(', ', self::SUPPORTED_FORMATS),
                400
            );
        }

        $language = $request->input('language');
        if (!is_string($language) || trim($language) === '') {
            $language = 'en';
        }

        $limit = (int) $request->input('limit', self::DEFAULT_LIMIT);
        if ($limit < 1) {
            $limit = 1;
        }
        if ($limit > self::MAX_LIMIT) {
            $limit = self::MAX_LIMIT;
        }

        $includePhonetics = $request->boolean('include_phonetics', true);
        $includeTranslations = $request->boolean('include_translations', true);

        $languageName = AppQyV1DictionaryService::getLanguageName($language);
        $languageCode = AppQyV1DictionaryService::getLanguageCode($language);

        $library = null;
        $libraryIdParam = $request->input('library_id');
        if ($libraryIdParam !== null && $libraryIdParam !== '') {
            $library = AppQyV1VocabularyLibraryModel::findPublicById((int) $libraryIdParam);

            if (!$library) {
                return $this->notFound('Library not found');
            }

            // The library's own language wins over the request language.
            if (is_string($library->language) && $library->language !== '') {
                $languageName = AppQyV1DictionaryService::getLanguageName($library->language);
                $languageCode = AppQyV1DictionaryService::getLanguageCode($library->language);
            }
        }

        $words = $this->fetchExportWords($languageName, $languageCode, $library, $limit, $includeTranslations);

        if (count($words) === 0) {
            return $this->error('No words match the export criteria', 404);
        }

        $filenameBase = 'vocabulary_' . $languageCode . '_' . now()->format('Ymd_His');

        if ($format === 'csv') {
            return $this->exportCsv($words, $filenameBase, $includeTranslations, $includePhonetics);
        }
        if ($format === 'json') {
            return $this->exportJson($words, $filenameBase, $includeTranslations, $includePhonetics);
        }
        if ($format === 'anki') {
            return $this->exportAnki($words, $filenameBase, $includeTranslations, $includePhonetics);
        }
        if ($format === 'text') {
            return $this->exportText($words, $filenameBase, $includeTranslations);
        }

        return $this->exportPdf($words, $filenameBase, $languageCode, $includeTranslations, $includePhonetics);
    }

    /**
     * Fetch the export rows from the consolidated store, WITHOUT the
     * per-word audio enrichment: exports may pull up to 20000 rows and the
     * audio check costs a filesystem stat per word, none of which is needed
     * in any export format.
     *
     * Library mode keeps word_ids order (the old word_index order); the
     * whole-language mode unions every public library's word_ids and orders
     * by word text (the old ORDER BY w.word + DISTINCT collapse - one id per
     * exact text makes the dedupe-by-id equivalent).
     *
     * @return array<int, array{word: string, translation: ?string, phonetic_us: ?string, phonetic_uk: ?string}>
     */
    private function fetchExportWords(
        string $languageName,
        string $languageCode,
        ?AppQyV1VocabularyLibraryModel $library,
        int $limit,
        bool $includeTranslations
    ): array {
        if (!AppQyV1LangDictionaryModel::languageTableExists($languageCode)) {
            return [];
        }

        if ($library !== null) {
            $orderedIds = array_slice($library->getWordIdsArray(), 0, $limit);
        } else {
            $libraries = AppQyV1VocabularyLibraryModel::publicForLanguage(
                $languageName,
                ['id', 'word_ids']
            );

            $idSet = [];
            foreach ($libraries as $publicLibrary) {
                foreach ($publicLibrary->getWordIdsArray() as $wordId) {
                    $idSet[$wordId] = true;
                }
            }
            $orderedIds = array_keys($idSet);
        }

        if (count($orderedIds) === 0) {
            return [];
        }

        $rowsById = AppQyV1LangDictionaryModel::exportRowsByIds($languageCode, $orderedIds);

        if ($library === null) {
            // Whole-language mode: order by word text like the old SQL.
            usort($orderedIds, function (int $a, int $b) use ($rowsById) {
                $wordA = '';
                if (isset($rowsById[$a])) {
                    $wordA = (string) $rowsById[$a]->content;
                }
                $wordB = '';
                if (isset($rowsById[$b])) {
                    $wordB = (string) $rowsById[$b]->content;
                }
                if ($wordA !== $wordB) {
                    return strcmp($wordA, $wordB);
                }
                return $a <=> $b;
            });
            $orderedIds = array_slice($orderedIds, 0, $limit);
        }

        $words = [];
        foreach ($orderedIds as $wordId) {
            if (!isset($rowsById[$wordId])) {
                continue;
            }
            $row = $rowsById[$wordId];

            $translation = null;
            if ($includeTranslations) {
                $simpleTranslations = AppQyV1DictionaryService::decodeSimpleTranslations($row->translations);
                if ($simpleTranslations !== null) {
                    $translation = implode('; ', $simpleTranslations);
                }
            }

            $words[] = [
                'word' => (string) $row->content,
                'translation' => $translation,
                'phonetic_us' => $row->us_phonetic,
                'phonetic_uk' => $row->uk_phonetic,
            ];
        }

        return $words;
    }

    private function exportCsv(array $words, string $filenameBase, bool $includeTranslations, bool $includePhonetics): Response
    {
        $header = ['word'];
        if ($includeTranslations) {
            $header[] = 'translation';
        }
        if ($includePhonetics) {
            $header[] = 'phonetic_us';
            $header[] = 'phonetic_uk';
        }

        $handle = fopen('php://temp', 'r+');
        // Escape parameter passed explicitly ('' = RFC 4180 escaping, also
        // silences the PHP 8.4+ implicit-$escape deprecation).
        fputcsv($handle, $header, ',', '"', '');

        foreach ($words as $word) {
            $row = [$word['word']];
            if ($includeTranslations) {
                $row[] = $word['translation'] !== null ? $word['translation'] : '';
            }
            if ($includePhonetics) {
                $row[] = $word['phonetic_us'] !== null ? $word['phonetic_us'] : '';
                $row[] = $word['phonetic_uk'] !== null ? $word['phonetic_uk'] : '';
            }
            fputcsv($handle, $row, ',', '"', '');
        }

        rewind($handle);
        $csv = stream_get_contents($handle);
        fclose($handle);

        // UTF-8 BOM so Excel detects the encoding correctly.
        $content = "\xEF\xBB\xBF" . $csv;

        return response($content, 200, $this->downloadHeaders('text/csv; charset=UTF-8', $filenameBase . '.csv'));
    }

    private function exportJson(array $words, string $filenameBase, bool $includeTranslations, bool $includePhonetics): Response
    {
        $items = [];
        foreach ($words as $word) {
            $item = ['word' => $word['word']];
            if ($includeTranslations) {
                $item['translation'] = $word['translation'];
            }
            if ($includePhonetics) {
                $item['phonetic_us'] = $word['phonetic_us'];
                $item['phonetic_uk'] = $word['phonetic_uk'];
            }
            $items[] = $item;
        }

        $content = json_encode($items, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        return response($content, 200, $this->downloadHeaders('application/json; charset=UTF-8', $filenameBase . '.json'));
    }

    /**
     * Anki-importable TSV: front<TAB>back, one card per line. Delivered as a
     * .txt file because Anki's importer expects tab-separated .txt files.
     */
    private function exportAnki(array $words, string $filenameBase, bool $includeTranslations, bool $includePhonetics): Response
    {
        $lines = [];
        foreach ($words as $word) {
            $front = $this->sanitizeSingleLine($word['word']);

            $backParts = [];
            if ($includeTranslations && $word['translation'] !== null && $word['translation'] !== '') {
                $backParts[] = $word['translation'];
            }
            if ($includePhonetics) {
                $phonetics = [];
                if ($word['phonetic_us'] !== null && $word['phonetic_us'] !== '') {
                    $phonetics[] = 'US: ' . $word['phonetic_us'];
                }
                if ($word['phonetic_uk'] !== null && $word['phonetic_uk'] !== '') {
                    $phonetics[] = 'UK: ' . $word['phonetic_uk'];
                }
                if (count($phonetics) > 0) {
                    $backParts[] = '(' . implode(', ', $phonetics) . ')';
                }
            }

            $back = $this->sanitizeSingleLine(implode(' ', $backParts));
            $lines[] = $front . "\t" . $back;
        }

        $content = implode("\n", $lines) . "\n";

        return response($content, 200, $this->downloadHeaders('text/plain; charset=UTF-8', $filenameBase . '.txt'));
    }

    private function exportText(array $words, string $filenameBase, bool $includeTranslations): Response
    {
        $lines = [];
        foreach ($words as $word) {
            $line = $this->sanitizeSingleLine($word['word']);
            if ($includeTranslations && $word['translation'] !== null && $word['translation'] !== '') {
                $line .= ' — ' . $this->sanitizeSingleLine($word['translation']);
            }
            $lines[] = $line;
        }

        $content = implode("\n", $lines) . "\n";

        return response($content, 200, $this->downloadHeaders('text/plain; charset=UTF-8', $filenameBase . '.txt'));
    }

    /**
     * PDF export. When dompdf is installed it renders a real PDF; otherwise
     * (no composer dependency is ever added for this) it falls back to a
     * print-ready standalone HTML document and flags the fallback via the
     * X-Export-Fallback: html response header so the frontend can message
     * the user accordingly.
     */
    private function exportPdf(array $words, string $filenameBase, string $languageCode, bool $includeTranslations, bool $includePhonetics): Response
    {
        $html = $this->buildPrintableHtml($words, $languageCode, $includeTranslations, $includePhonetics);

        if (class_exists(\Dompdf\Dompdf::class)) {
            $dompdf = new \Dompdf\Dompdf();
            $dompdf->loadHtml($html, 'UTF-8');
            $dompdf->setPaper('A4', 'portrait');
            $dompdf->render();

            return response($dompdf->output(), 200, $this->downloadHeaders('application/pdf', $filenameBase . '.pdf'));
        }

        $headers = $this->downloadHeaders('text/html; charset=UTF-8', $filenameBase . '.html');
        $headers['X-Export-Fallback'] = 'html';

        return response($html, 200, $headers);
    }

    private function buildPrintableHtml(array $words, string $languageCode, bool $includeTranslations, bool $includePhonetics): string
    {
        $generatedAt = now()->format('Y-m-d H:i:s');
        $total = count($words);

        $headCells = '<th class="num">#</th><th>Word</th>';
        if ($includeTranslations) {
            $headCells .= '<th>Translation</th>';
        }
        if ($includePhonetics) {
            $headCells .= '<th>Phonetic (US)</th><th>Phonetic (UK)</th>';
        }

        $bodyRows = '';
        $rowNumber = 0;
        foreach ($words as $word) {
            $rowNumber++;
            $cells = '<td class="num">' . $rowNumber . '</td>';
            $cells .= '<td>' . $this->escapeHtml($word['word']) . '</td>';
            if ($includeTranslations) {
                $cells .= '<td>' . $this->escapeHtml($word['translation']) . '</td>';
            }
            if ($includePhonetics) {
                $cells .= '<td>' . $this->escapeHtml($word['phonetic_us']) . '</td>';
                $cells .= '<td>' . $this->escapeHtml($word['phonetic_uk']) . '</td>';
            }
            $bodyRows .= '        <tr>' . $cells . '</tr>' . "\n";
        }

        $title = 'Vocabulary Export (' . $this->escapeHtml($languageCode) . ')';

        return '<!DOCTYPE html>' . "\n"
            . '<!-- AUTO-PRINT HINT: this document is a print-ready PDF fallback.' . "\n"
            . '     Open it in a browser and use window.print() / Ctrl+P, then choose' . "\n"
            . '     "Save as PDF" to produce the final PDF file. -->' . "\n"
            . '<html lang="en">' . "\n"
            . '<head>' . "\n"
            . '<meta charset="UTF-8">' . "\n"
            . '<title>' . $title . '</title>' . "\n"
            . '<style>' . "\n"
            . '  body { font-family: "Segoe UI", Arial, "Noto Sans", sans-serif; color: #1a1a2e; margin: 24px; }' . "\n"
            . '  h1 { font-size: 20px; margin: 0 0 4px 0; }' . "\n"
            . '  p.meta { font-size: 12px; color: #555; margin: 0 0 16px 0; }' . "\n"
            . '  table { width: 100%; border-collapse: collapse; font-size: 12px; }' . "\n"
            . '  th, td { border: 1px solid #c9c9d4; padding: 4px 8px; text-align: left; vertical-align: top; }' . "\n"
            . '  th { background: #ececf4; }' . "\n"
            . '  td.num, th.num { width: 40px; text-align: right; color: #777; }' . "\n"
            . '  tr:nth-child(even) td { background: #f7f7fb; }' . "\n"
            . '  @media print { body { margin: 0; } }' . "\n"
            . '</style>' . "\n"
            . '</head>' . "\n"
            . '<body>' . "\n"
            . '<h1>' . $title . '</h1>' . "\n"
            . '<p class="meta">Generated at ' . $this->escapeHtml($generatedAt) . ' — ' . $total . ' words</p>' . "\n"
            . '<table>' . "\n"
            . '    <thead><tr>' . $headCells . '</tr></thead>' . "\n"
            . '    <tbody>' . "\n"
            . $bodyRows
            . '    </tbody>' . "\n"
            . '</table>' . "\n"
            . '</body>' . "\n"
            . '</html>' . "\n";
    }

    private function escapeHtml(?string $value): string
    {
        if ($value === null) {
            return '';
        }
        return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
    }

    private function sanitizeSingleLine(?string $value): string
    {
        if ($value === null) {
            return '';
        }
        return str_replace(["\t", "\r", "\n"], ' ', $value);
    }

    private function downloadHeaders(string $contentType, string $filename): array
    {
        return [
            'Content-Type' => $contentType,
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control' => 'no-store',
        ];
    }
}
