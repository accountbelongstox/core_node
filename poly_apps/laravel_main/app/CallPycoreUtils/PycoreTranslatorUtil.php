<?php

namespace App\CallPycoreUtils;

use App\Providers\PathMapper;
use Illuminate\Support\Facades\Log;

class PycoreTranslatorUtil
{
    public static function translateBatch(
        array $texts,
        string $sourceLanguage,
        array $targetLanguages,
        bool $useCache = true
    ): ?array {
        $coreNodeDir = PathMapper::getCoreNodeDir();
        $tempDir = sys_get_temp_dir();
        $configFile = $tempDir . '/translator_config_' . uniqid() . '.json';
        
        $config = [
            'src' => $sourceLanguage === 'auto' ? 'auto' : $sourceLanguage,
            'dest' => $targetLanguages,
            'texts' => $texts,
        ];
        
        file_put_contents($configFile, json_encode($config, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        
        $outputFile = $tempDir . '/translator_output_' . uniqid() . '.json';
        
        $cacheFlag = $useCache ? '' : '--no-cache';
        $escapedConfigFile = escapeshellarg($configFile);
        $escapedOutputFile = escapeshellarg($outputFile);
        
        $command = "cd {$coreNodeDir} && timeout 60 python3 -m pycore.pyutils.translator --config {$escapedConfigFile} --output {$escapedOutputFile} {$cacheFlag} 2>&1";
        
        exec($command, $output, $returnCode);
        
        @unlink($configFile);
        
        if ($returnCode !== 0) {
            $errorDetails = [
                'error' => 'Python CLI failed',
                'command' => $command,
                'output' => implode("\n", $output),
                'return_code' => $returnCode,
                'config' => $config,
            ];
            
            Log::error('Translator: Command failed', $errorDetails);
            @unlink($outputFile);
            
            return [
                'error' => 'Python CLI execution failed',
                'details' => $errorDetails,
            ];
        }
        
        if (!file_exists($outputFile)) {
            $errorDetails = [
                'error' => 'Output file not created',
                'expected_file' => $outputFile,
                'stdout' => implode("\n", $output),
                'command' => $command,
            ];
            
            Log::error('Translator: Output file not created', $errorDetails);
            
            return [
                'error' => 'Python output file not created',
                'details' => $errorDetails,
            ];
        }
        
        $resultJson = file_get_contents($outputFile);
        @unlink($outputFile);
        
        $result = json_decode($resultJson, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            $errorDetails = [
                'error' => 'JSON parsing failed',
                'raw_output' => $resultJson,
                'json_error' => json_last_error_msg(),
                'command' => $command,
            ];
            
            Log::error('Translator: Failed to parse JSON output', $errorDetails);
            
            return [
                'error' => 'Failed to parse Python output',
                'details' => $errorDetails,
            ];
        }
        
        return $result;
    }
    
    public static function translateSingle(
        string $text,
        string $sourceLanguage,
        string $targetLanguage,
        bool $useCache = true
    ): ?array {
        $result = self::translateBatch(
            [$text],
            $sourceLanguage,
            [$targetLanguage],
            $useCache
        );
        
        if ($result && isset($result[0])) {
            return $result[0];
        }
        
        return null;
    }
    
    public static function clearCache(?string $srcLang = null, ?string $destLang = null): int
    {
        $args = ['--clear-cache'];
        
        if ($srcLang) {
            $args[] = '--src';
            $args[] = $srcLang;
        }
        
        if ($destLang) {
            $args[] = '--dest';
            $args[] = $destLang;
        }
        
        $response = PycoreCaller::callPythonModule('pycore.pyutils.translator', $args);
        
        if ($response && ($response['success'] ?? false)) {
            return $response['result']['cleared_count'] ?? 0;
        }
        
        return 0;
    }
}
