<?php

namespace App\Utils;

final class CloudClipboardTextMerge
{
    private static function change(string $base, string $text): array
    {
        $start = 0;
        $baseEnd = strlen($base);
        $textEnd = strlen($text);
        $limit = min($baseEnd, $textEnd);

        while ($start < $limit && $base[$start] === $text[$start]) {
            $start++;
        }
        while ($start > 0 && $start < $baseEnd && (ord($base[$start]) & 0xc0) === 0x80) {
            $start--;
        }
        while ($baseEnd > $start && $textEnd > $start && $base[$baseEnd - 1] === $text[$textEnd - 1]) {
            $baseEnd--;
            $textEnd--;
        }
        while ($baseEnd < strlen($base) && (ord($base[$baseEnd]) & 0xc0) === 0x80) {
            $baseEnd++;
            $textEnd++;
        }

        return ['start' => $start, 'end' => $baseEnd, 'text' => substr($text, $start, $textEnd - $start)];
    }

    public static function merge(string $base, string $local, string $remote): string
    {
        $localChange = [];
        $remoteChange = [];
        $offset = 0;

        if ($local === $base || $local === $remote) return $remote;
        if ($remote === $base) return $local;
        $localChange = self::change($base, $local);
        $remoteChange = self::change($base, $remote);
        if ($localChange['end'] <= $remoteChange['start']
            && $localChange['start'] < $remoteChange['start']) {
            return substr_replace($remote, $localChange['text'], $localChange['start'],
                $localChange['end'] - $localChange['start']);
        }
        if ($localChange['start'] >= $remoteChange['end']) {
            $offset = strlen($remoteChange['text']) - ($remoteChange['end'] - $remoteChange['start']);

            return substr_replace($remote, $localChange['text'], $localChange['start'] + $offset,
                $localChange['end'] - $localChange['start']);
        }

        return substr_replace($remote, $localChange['text'],
            $remoteChange['start'] + strlen($remoteChange['text']), 0);
    }
}
