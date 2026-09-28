<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

/**
 * Document Text Extractor
 *
 * Best-effort plain-text extraction for the dashboard Books pipeline. Routes by
 * file extension and NEVER throws: any failure (unreadable file, missing parser
 * package, malformed document) returns '' and logs the cause, so the caller can
 * degrade gracefully and report a per-file error instead of 500-ing the upload.
 *
 * The PDF (\Smalot\PdfParser\Parser) and DOCX (\PhpOffice\PhpWord\IOFactory)
 * parsers are optional composer packages; each is class_exists()-guarded so the
 * service still loads (and the txt/md/html/rtf/epub paths still work) before the
 * user has run `composer require`.
 */
class DocumentTextExtractor
{
    /**
     * Supported upload extensions (with leading dot), surfaced to the FE via
     * GET /books/supported-formats so it can filter the file picker.
     *
     * @return array<int, string>
     */
    public function supportedFormats(): array
    {
        return ['.txt', '.md', '.pdf', '.docx', '.doc', '.html', '.htm', '.rtf', '.epub'];
    }

    /**
     * Extract plain text from a document on disk. Returns '' on any failure.
     */
    public function extractText(string $absPath): string
    {
        if ($absPath === '' || !is_file($absPath)) {
            Log::warning('[DocumentTextExtractor] File not found', ['path' => $absPath]);
            return '';
        }

        $ext = strtolower((string) pathinfo($absPath, PATHINFO_EXTENSION));

        switch ($ext) {
            case 'txt':
            case 'md':
                return $this->extractPlain($absPath);
            case 'html':
            case 'htm':
                return $this->extractHtml($absPath);
            case 'pdf':
                return $this->extractPdf($absPath);
            case 'docx':
            case 'doc':
                return $this->extractWord($absPath);
            case 'rtf':
                return $this->extractRtf($absPath);
            case 'epub':
                return $this->extractEpub($absPath);
            default:
                Log::warning('[DocumentTextExtractor] Unsupported extension', [
                    'path' => $absPath,
                    'ext' => $ext,
                ]);
                return '';
        }
    }

    /**
     * Plain UTF-8 text (txt/md). Normalizes line endings to \n.
     */
    private function extractPlain(string $absPath): string
    {
        $raw = @file_get_contents($absPath);
        if ($raw === false) {
            Log::warning('[DocumentTextExtractor] Failed to read plain file', ['path' => $absPath]);
            return '';
        }
        return $this->normalizeNewlines($raw);
    }

    /**
     * HTML/HTM: strip tags + decode entities. Removes script/style blocks first
     * (their content is not body text), then collapses tags to text.
     */
    private function extractHtml(string $absPath): string
    {
        $raw = @file_get_contents($absPath);
        if ($raw === false) {
            Log::warning('[DocumentTextExtractor] Failed to read html file', ['path' => $absPath]);
            return '';
        }

        return $this->htmlToText($raw);
    }

    /**
     * Shared HTML -> text used by extractHtml + extractEpub. Drops script/style,
     * turns block boundaries into newlines, strips remaining tags, decodes
     * entities.
     */
    private function htmlToText(string $html): string
    {
        if ($html === '') {
            return '';
        }

        // Remove script/style blocks entirely (content is not readable text).
        $html = preg_replace('#<(script|style)\b[^>]*>.*?</\1>#is', ' ', $html);
        if ($html === null) {
            return '';
        }

        // Block-level boundaries -> newline so sentences/paragraphs do not merge.
        $html = preg_replace('#<\s*(br|/p|/div|/h[1-6]|/li|/tr)\s*[^>]*>#i', "\n", $html);
        if ($html === null) {
            return '';
        }

        $text = strip_tags($html);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');

        return $this->normalizeNewlines($text);
    }

    /**
     * PDF via smalot/pdfparser (optional package; guarded).
     */
    private function extractPdf(string $absPath): string
    {
        if (!class_exists('\Smalot\PdfParser\Parser')) {
            Log::warning('[DocumentTextExtractor] PDF parser not installed (smalot/pdfparser)', [
                'path' => $absPath,
            ]);
            return '';
        }

        try {
            $parserClass = '\Smalot\PdfParser\Parser';
            $parser = new $parserClass();
            $pdf = $parser->parseFile($absPath);
            $text = $pdf->getText();
            return $this->normalizeNewlines((string) $text);
        } catch (\Throwable $e) {
            Log::warning('[DocumentTextExtractor] PDF extraction failed', [
                'path' => $absPath,
                'error' => $e->getMessage(),
            ]);
            return '';
        }
    }

    /**
     * DOCX/DOC via phpoffice/phpword (optional package; guarded). Iterates every
     * element of every section, recursing into containers, collecting text runs.
     */
    private function extractWord(string $absPath): string
    {
        if (!class_exists('\PhpOffice\PhpWord\IOFactory')) {
            Log::warning('[DocumentTextExtractor] Word parser not installed (phpoffice/phpword)', [
                'path' => $absPath,
            ]);
            return '';
        }

        try {
            $ioFactory = '\PhpOffice\PhpWord\IOFactory';
            $ext = strtolower((string) pathinfo($absPath, PATHINFO_EXTENSION));
            // PhpWord needs the reader name; 'doc' uses the MsDoc reader, 'docx'
            // the Word2007 reader. Let it auto-detect for docx, force for doc.
            if ($ext === 'doc') {
                $phpWord = $ioFactory::load($absPath, 'MsDoc');
            } else {
                $phpWord = $ioFactory::load($absPath);
            }

            $parts = [];
            foreach ($phpWord->getSections() as $section) {
                $this->collectWordElements($section->getElements(), $parts);
            }

            return $this->normalizeNewlines(implode("\n", $parts));
        } catch (\Throwable $e) {
            Log::warning('[DocumentTextExtractor] Word extraction failed', [
                'path' => $absPath,
                'error' => $e->getMessage(),
            ]);
            return '';
        }
    }

    /**
     * Recursively pull text out of a list of PhpWord elements. Text/TextRun
     * elements expose getText(); containers expose getElements().
     *
     * @param array<int, mixed> $elements
     * @param array<int, string> $parts collected text lines (by reference)
     */
    private function collectWordElements(array $elements, array &$parts): void
    {
        foreach ($elements as $element) {
            if (method_exists($element, 'getText')) {
                $value = $element->getText();
                if (is_string($value) && $value !== '') {
                    $parts[] = $value;
                    continue;
                }
            }

            if (method_exists($element, 'getElements')) {
                $children = $element->getElements();
                if (is_array($children) && !empty($children)) {
                    $this->collectWordElements($children, $parts);
                }
            }
        }
    }

    /**
     * RTF: strip control words / groups with a regex pass (no extra package).
     * Good enough to recover readable body text for stats + ingest.
     */
    private function extractRtf(string $absPath): string
    {
        $raw = @file_get_contents($absPath);
        if ($raw === false) {
            Log::warning('[DocumentTextExtractor] Failed to read rtf file', ['path' => $absPath]);
            return '';
        }

        $text = $raw;

        // Drop binary/picture/font/stylesheet groups wholesale.
        $text = preg_replace('/\{\\\\\*?\\\\[^{}]+\}/', ' ', $text);
        if ($text === null) {
            return '';
        }

        // \par / \line / \tab -> whitespace (keep paragraph structure as newline).
        $text = preg_replace('/\\\\par[d]?\b/', "\n", $text);
        $text = preg_replace('/\\\\(line|lbrkn)\b/', "\n", $text);
        $text = preg_replace('/\\\\tab\b/', ' ', $text);

        // \uNNNN unicode escapes -> the character (followed by a fallback char).
        $text = preg_replace_callback('/\\\\u(-?\d+)\s?\??/', function ($m) {
            $code = (int) $m[1];
            if ($code < 0) {
                $code += 65536;
            }
            if ($code <= 0) {
                return '';
            }
            return $this->codepointToUtf8($code);
        }, (string) $text);

        // Remaining control words \word and control symbols \X.
        $text = preg_replace('/\\\\[a-zA-Z]+-?\d*\s?/', ' ', (string) $text);
        $text = preg_replace('/\\\\[^a-zA-Z]/', ' ', (string) $text);

        // Drop stray braces.
        $text = str_replace(['{', '}'], ' ', (string) $text);

        return $this->normalizeNewlines((string) $text);
    }

    /**
     * EPUB: a ZIP of (x)html documents. Read each xhtml/html/htm entry and run
     * the shared HTML->text pass, in archive order.
     */
    private function extractEpub(string $absPath): string
    {
        if (!class_exists('\ZipArchive')) {
            Log::warning('[DocumentTextExtractor] ZipArchive not available for epub', [
                'path' => $absPath,
            ]);
            return '';
        }

        $zip = new \ZipArchive();
        if ($zip->open($absPath) !== true) {
            Log::warning('[DocumentTextExtractor] Failed to open epub archive', ['path' => $absPath]);
            return '';
        }

        $parts = [];
        try {
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $name = (string) $zip->getNameIndex($i);
                $ext = strtolower((string) pathinfo($name, PATHINFO_EXTENSION));
                if (!in_array($ext, ['xhtml', 'html', 'htm'], true)) {
                    continue;
                }
                $content = $zip->getFromIndex($i);
                if ($content === false || $content === '') {
                    continue;
                }
                $text = $this->htmlToText($content);
                if ($text !== '') {
                    $parts[] = $text;
                }
            }
        } catch (\Throwable $e) {
            Log::warning('[DocumentTextExtractor] EPUB extraction failed', [
                'path' => $absPath,
                'error' => $e->getMessage(),
            ]);
            $zip->close();
            return '';
        }

        $zip->close();

        return $this->normalizeNewlines(implode("\n", $parts));
    }

    /**
     * Convert a Unicode codepoint to a UTF-8 string (RTF \u helper). Uses
     * mb_chr when available, with a manual fallback.
     */
    private function codepointToUtf8(int $code): string
    {
        if (function_exists('mb_chr')) {
            $ch = mb_chr($code, 'UTF-8');
            return $ch === false ? '' : $ch;
        }
        return html_entity_decode('&#' . $code . ';', ENT_QUOTES, 'UTF-8');
    }

    /**
     * Normalize CRLF/CR to LF and strip a UTF-8 BOM. Whitespace collapsing is
     * left to the stats/ingest layer so paragraph structure survives here.
     */
    private function normalizeNewlines(string $text): string
    {
        if ($text === '') {
            return '';
        }
        // Strip UTF-8 BOM.
        $text = preg_replace('/^\xEF\xBB\xBF/', '', $text);
        $text = str_replace(["\r\n", "\r"], "\n", (string) $text);
        return $text;
    }
}
