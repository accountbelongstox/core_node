<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

class GoogleTranslateService
{
    private $pythonPath;
    private $translatorScript;
    
    public function __construct()
    {
        $this->pythonPath = $this->findPythonPath();
        $this->translatorScript = base_path('../pycore/pyutils/translator/google_translator.py');
    }
    
    private function findPythonPath(): ?string
    {
        $pythonCommands = ['python3', 'python'];
        
        foreach ($pythonCommands as $cmd) {
            $result = Process::run("which {$cmd} 2>/dev/null");
            if ($result->successful()) {
                return trim($result->output());
            }
        }
        
        return null;
    }
    
    public function translateWord(string $word, string $srcLang = 'en', string $destLang = 'zh-CN'): ?array
    {
        if (!$this->pythonPath) {
            Log::error('[GoogleTranslate] Python not found');
            return null;
        }
        
        if (!file_exists($this->translatorScript)) {
            Log::error('[GoogleTranslate] Translator script not found: ' . $this->translatorScript);
            return null;
        }
        
        try {
            $cacheDir = \App\Providers\PathMapper::getLaravelTmpDir() . '/translator_cache';
            if (!is_dir($cacheDir)) {
                mkdir($cacheDir, 0755, true);
            }
            
            $pythonCode = <<<PYTHON
import sys
import os
import asyncio
sys.path.insert(0, '{$this->getProjectRoot()}')

os.environ['TRANSLATOR_CACHE_DIR'] = '{$cacheDir}'

from pycore.pyutils.translator.google_translator import GoogleTranslator

async def translate():
    async with GoogleTranslator() as translator:
        result = await translator.translate_single(
            text='{$this->escapePython($word)}',
            src='{$srcLang}',
            dest='{$destLang}',
            use_cache=False
        )
        print(result.translated_text + '|||' + (result.pronunciation or ''))

asyncio.run(translate())
PYTHON;

            $result = Process::timeout(10)->run(
                $this->pythonPath . ' -c ' . escapeshellarg($pythonCode) . ' 2>/dev/null'
            );
            
            if (!$result->successful()) {
                Log::error('[GoogleTranslate] Translation failed: ' . $result->errorOutput());
                return null;
            }
            
            $output = trim($result->output());
            $lines = explode("\n", $output);
            $output = trim(end($lines));
            
            if (strpos($output, '|||') !== false) {
                list($translation, $pronunciation) = explode('|||', $output, 2);
                
                return [
                    'original' => $word,
                    'translation' => trim($translation),
                    'pronunciation' => trim($pronunciation) ?: null,
                    'src_lang' => $srcLang,
                    'dest_lang' => $destLang,
                ];
            }
            
            return [
                'original' => $word,
                'translation' => $output,
                'pronunciation' => null,
                'src_lang' => $srcLang,
                'dest_lang' => $destLang,
            ];
            
        } catch (\Exception $e) {
            Log::error('[GoogleTranslate] Exception: ' . $e->getMessage());
            return null;
        }
    }
    
    public function translateBatch(array $words, string $srcLang = 'en', string $destLang = 'zh-CN'): array
    {
        if (empty($words)) {
            return [];
        }
        
        if (!$this->pythonPath || !file_exists($this->translatorScript)) {
            return array_fill(0, count($words), null);
        }
        
        $cacheDir = \App\Providers\PathMapper::getLaravelTmpDir() . '/translator_cache';
        if (!is_dir($cacheDir)) {
            mkdir($cacheDir, 0755, true);
        }
        
        $results = [];
        $batchSize = 10;
        $batches = array_chunk($words, $batchSize);
        
        foreach ($batches as $batch) {
            try {
                $wordsJson = json_encode($batch, JSON_UNESCAPED_UNICODE);
                
                $pythonCode = <<<PYTHON
import sys
import os
import json
import asyncio
sys.path.insert(0, '{$this->getProjectRoot()}')

os.environ['TRANSLATOR_CACHE_DIR'] = '{$cacheDir}'

from pycore.pyutils.translator.google_translator import GoogleTranslator

async def translate():
    words = json.loads('''{$wordsJson}''')
    async with GoogleTranslator() as translator:
        results = await translator.translate_batch(
            texts=words,
            src='{$srcLang}',
            dest='{$destLang}',
            use_cache=False
        )
        for r in results:
            print(json.dumps({
                'original': r.original_text,
                'translation': r.translated_text,
                'pronunciation': r.pronunciation,
                'error': r.error
            }, ensure_ascii=False))

asyncio.run(translate())
PYTHON;

                $result = Process::timeout(30)->run(
                    $this->pythonPath . ' -c ' . escapeshellarg($pythonCode) . ' 2>/dev/null'
                );
                
                if ($result->successful()) {
                    $output = trim($result->output());
                    $lines = explode("\n", $output);
                    
                    foreach ($lines as $line) {
                        $line = trim($line);
                        if (empty($line) || $line[0] !== '{') continue;
                        
                        $data = json_decode($line, true);
                        if ($data) {
                            $results[] = [
                                'original' => $data['original'],
                                'translation' => $data['translation'] ?: null,
                                'pronunciation' => $data['pronunciation'] ?: null,
                                'src_lang' => $srcLang,
                                'dest_lang' => $destLang,
                                'error' => $data['error'] ?: null,
                            ];
                        }
                    }
                } else {
                    foreach ($batch as $word) {
                        $results[] = null;
                    }
                }
                
                sleep(1);
                
            } catch (\Exception $e) {
                Log::error('[GoogleTranslate] Batch translation failed: ' . $e->getMessage());
                foreach ($batch as $word) {
                    $results[] = null;
                }
            }
        }
        
        return $results;
    }
    
    private function escapePython(string $str): string
    {
        return str_replace(["\\", "'"], ["\\\\", "\\'"], $str);
    }
    
    private function getProjectRoot(): string
    {
        return realpath(base_path('../'));
    }
    
    public function isWordValid(string $word): bool
    {
        if (strlen($word) < 2 || strlen($word) > 50) {
            return false;
        }
        
        if (!preg_match('/^[a-zA-Z\-\']+$/', $word)) {
            return false;
        }
        
        return true;
    }
}
