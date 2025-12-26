<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Apps\AppQyV1\Utils;

class AppQyV1ArticleTextParser
{
    /**
     * Extract words from article text
     * Based on pycore translate.py count_document_words() method
     *
     * Split pattern: /[^a-zA-Z'\-_]+/
     * Supported delimiters: space, comma, period, question mark, exclamation, etc.
     * Preserves: letters, apostrophe, hyphen, underscore
     *
     * @param string $text Article text
     * @return array{
     *     words: string[],
     *     word_frequency: array<string, int>,
     *     exclude_words: string[],
     *     total_words: int
     * }
     */
    public static function extractWords(string $text): array
    {
        $excludeWords = [];
        $normalWords = [];

        $splitPattern = "/[^a-zA-Z'\-_]+/";
        $originWords = preg_split($splitPattern, $text, -1, PREG_SPLIT_NO_EMPTY);

        foreach ($originWords as $word) {
            if (self::isEnglishWord($word)) {
                $modifiedWord = self::modifyWord($word);
                if ($modifiedWord) {
                    $normalWords[] = $modifiedWord;
                }
            } else {
                if (!in_array($word, $excludeWords)) {
                    $excludeWords[] = $word;
                }
            }
        }

        $wordFrequency = self::countWordFrequency($normalWords);
        $uniqueWords = array_values(array_unique($normalWords));

        return [
            'words' => $uniqueWords,
            'word_frequency' => $wordFrequency,
            'exclude_words' => $excludeWords,
            'total_words' => count($normalWords),
        ];
    }

    /**
     * Extract sentences from article text
     * Based on pycore translate.py analyze_doc_to_sentence() and get_docsentencemd5() methods
     *
     * @param string $text Article text
     * @return array{
     *     sentences: string[],
     *     sentences_with_md5: array<array{sentence: string, md5: string}>,
     *     exclude_sentences: string[]
     * }
     */
    public static function extractSentences(string $text): array
    {
        $excludeSentences = [];

        $text = preg_replace('/\r+/', '', $text);
        $text = preg_replace('/\n+/', ' ', $text);
        $text = preg_replace('/\s+/', ' ', $text);

        $text = preg_replace('/[,，]+/', ",\n", $text);
        $text = preg_replace('/[;；]+/', ";\n", $text);
        $text = preg_replace('/[?？]+/', "?\n", $text);
        $text = preg_replace('/(?<=[^\d])\.(?=[^\d])/', ".\n", $text);
        $text = preg_replace('/[。]+/', ".\n", $text);

        $rawSentences = preg_split('/\n+/', $text, -1, PREG_SPLIT_NO_EMPTY);

        $sentences = [];
        $sentencesWithMd5 = [];

        foreach ($rawSentences as $sentence) {
            if (self::isSentenceValid($sentence)) {
                $modifiedSentence = self::modifySentence($sentence);
                if ($modifiedSentence) {
                    $sentences[] = $modifiedSentence;
                    $sentencesWithMd5[] = [
                        'sentence' => $modifiedSentence,
                        'md5' => md5($modifiedSentence),
                    ];
                }
            } else {
                if (!in_array($sentence, $excludeSentences)) {
                    $excludeSentences[] = $sentence;
                }
            }
        }

        return [
            'sentences' => $sentences,
            'sentences_with_md5' => $sentencesWithMd5,
            'exclude_sentences' => $excludeSentences,
        ];
    }

    /**
     * Parse article text into sentences and words
     *
     * @param string $text Article text
     * @param string $language Language code (default: 'english')
     * @return array{
     *     article_text: string,
     *     sentences: string[],
     *     sentences_with_md5: array<array{sentence: string, md5: string}>,
     *     words: string[],
     *     word_frequency: array<string, int>,
     *     total_sentences: int,
     *     total_words: int,
     *     unique_words: int
     * }
     */
    public static function parseArticle(string $text, string $language = 'english'): array
    {
        $sentencesResult = self::extractSentences($text);
        $wordsResult = self::extractWords($text);

        return [
            'article_text' => $text,
            'language' => $language,
            'sentences' => $sentencesResult['sentences'],
            'sentences_with_md5' => $sentencesResult['sentences_with_md5'],
            'words' => $wordsResult['words'],
            'word_frequency' => $wordsResult['word_frequency'],
            'total_sentences' => count($sentencesResult['sentences']),
            'total_words' => $wordsResult['total_words'],
            'unique_words' => count($wordsResult['words']),
        ];
    }

    /**
     * Check if a word is valid English word
     * Based on pycore translate.py is_english() method
     *
     * @param string $word
     * @return bool
     */
    private static function isEnglishWord(string $word): bool
    {
        $word = trim($word);
        if (empty($word)) {
            return false;
        }

        if (!preg_match("/^[a-zA-Z'\-]+$/", $word)) {
            return false;
        }

        $alphabetPattern = '/^[a-zA-Z]+$/';
        $firstChar = $word[0];
        $lastChar = $word[strlen($word) - 1];

        if (preg_match($alphabetPattern, $firstChar) && preg_match($alphabetPattern, $lastChar)) {
            return true;
        }

        return false;
    }

    /**
     * Modify word to standard form
     *
     * @param string $word
     * @return string
     */
    private static function modifyWord(string $word): string
    {
        $word = trim($word);
        $word = strtolower($word);
        $word = preg_replace("/^['\-]+|['\-]+$/", '', $word);
        return $word;
    }

    /**
     * Check if sentence is valid
     * Based on pycore translate.py sentence_filter() method
     *
     * @param string $sentence
     * @return bool
     */
    private static function isSentenceValid(string $sentence): bool
    {
        if (strlen($sentence) > 1000) {
            return false;
        }

        if (preg_match('/[\x{4e00}-\x{9fa5}]/u', $sentence)) {
            return false;
        }

        $sentence = preg_replace('/^[^a-zA-Z]+/', '', $sentence);
        $sentence = trim($sentence);

        if (empty($sentence)) {
            return false;
        }

        $alphabetCount = preg_match_all('/[a-zA-Z]/', $sentence);
        if ($alphabetCount <= 1) {
            return false;
        }

        if (!preg_match('/\s/', $sentence)) {
            return false;
        }

        $numberCount = preg_match_all('/\d/', $sentence);
        if ($numberCount > 0 && $alphabetCount > 0) {
            $rate = ($numberCount / $alphabetCount) * 100;
            if ($rate > 20) {
                return false;
            }
        }

        if (preg_match('/\d\.\s/', $sentence)) {
            return false;
        }

        return true;
    }

    /**
     * Modify sentence to standard form
     *
     * @param string $sentence
     * @return string
     */
    private static function modifySentence(string $sentence): string
    {
        $sentence = trim($sentence);
        $sentence = preg_replace('/\s+/', ' ', $sentence);
        return $sentence;
    }

    /**
     * Count word frequency
     *
     * @param array $words
     * @return array<string, int>
     */
    private static function countWordFrequency(array $words): array
    {
        $frequency = [];
        foreach ($words as $word) {
            if (isset($frequency[$word])) {
                $frequency[$word] += 1;
            } else {
                $frequency[$word] = 1;
            }
        }
        arsort($frequency);
        return $frequency;
    }
}
