<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Http\Clash;

use App\Models\ClashUrlsConfig;
use App\Services\ContentFetchers\UrlContentFetcher;
use App\Services\ContentFetchers\WebContentFetcher;
use App\Helpers\BrowserSimulator;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use App\Helpers\ClashDefaultConfigProcessor;
use Illuminate\Support\Facades\File;

class SubscriptionListController
{
    private $urlFetcher;
    private $webFetcher;
    private static $proxyNames = [];  // Stores all proxy names
    private static $proxyLines = [];  // Stores all proxy lines

    public function __construct()
    {
        $browser = new BrowserSimulator();
        $this->urlFetcher = new UrlContentFetcher($browser);
        $this->webFetcher = new WebContentFetcher($browser);
    }

    public function index(Request $request)
    {
        return view('subscription.list');
    }

    public function getPublishText(Request $request,$group_id = null)
    {
        $groupId = $group_id ?? $request->query('group_id');
        
        
        if (!$groupId) {
            return response()->json([
                'success' => false,
                'message' => 'Group ID is required',
                "group_id" => $groupId
            ], 400);
        }

        $defaultConfig = ClashDefaultConfigProcessor::processConfig();
        $configs = ClashUrlsConfig::where('group_id', $groupId)
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($config) {
                $expiryMonths = $this->calculateExpiryMonths($config);
                $yamlContent = $this->handleContentWithYamlCache($config);
                
                if (isset($yamlContent['proxy_lines'])) {
                    $this->processProxyNames($yamlContent['proxy_lines']);
                }
                return [
                    'group_id' => $config->group_id,
                    'id' => $config->id,
                    'type' => $config->type,
                    'content' => $config->content,
                    'md5' => $config->md5,
                    'expires_at' => $config->expires_at ? $config->expires_at->format('Y-m-d H:i:s') : null,
                    'expiry_months' => $config->expires_at ? $expiryMonths : 0,
                    'created_at' => $config->created_at->format('Y-m-d H:i:s'),
                    'yaml_content' => $yamlContent
                ];
            });

        $mergedConfig = $this->mergeProxyLines($defaultConfig, self::$proxyLines);

        return response($mergedConfig['content'], 200)
        ->header('Content-Type', 'text/plain');
    }

    public function getList(Request $request)
    {
        self::$proxyNames = [];
        self::$proxyLines = [];
        
        $groupId = $request->query('group_id')  
            ?? $request->query('group_id') 
            ?? $request->post('group_id');
        
        
        if (!$groupId) {
            return response()->json([
                'success' => false,
                'message' => 'Group ID is required',
                "group_id" => $groupId
            ], 400);
        }

        $defaultConfig = ClashDefaultConfigProcessor::processConfig();
        $configs = ClashUrlsConfig::where('group_id', $groupId)
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($config) {
                $expiryMonths = $this->calculateExpiryMonths($config);
                $yamlContent = $this->handleContentWithYamlCache($config);
                
                if (isset($yamlContent['proxy_lines'])) {
                    unset($yamlContent['proxy_lines']);
                }
                // if (isset($yamlContent['content'])) {
                //     unset($yamlContent['content']);
                // }
                if (isset($yamlContent['lines'])) {
                    unset($yamlContent['lines']);
                }
                return [
                    'group_id' => $config->group_id,
                    'id' => $config->id,
                    'type' => $config->type,
                    'content' => $config->content,
                    'md5' => $config->md5,
                    'expires_at' => $config->expires_at ? $config->expires_at->format('Y-m-d H:i:s') : null,
                    'expiry_months' => $config->expires_at ? $expiryMonths : 0,
                    'created_at' => $config->created_at->format('Y-m-d H:i:s'),
                    'yaml_content' => $yamlContent
                ];
            });

        $mergedConfig = $this->mergeProxyLines($defaultConfig, self::$proxyLines);

        $resultData = [
            'default_config' => $defaultConfig,
            'configs' => $configs,
            'proxy_names' => array_values(self::$proxyNames),
            'proxy_lines' => array_values(array_unique(self::$proxyLines)),
            'merged_config' => $mergedConfig
        ];

        $keysToRemove = [
            'default_config.template' => true,
            'default_config.proxy_groups_section.second_max_indent_set' => true,
            'default_config.proxy_groups_section.removed_lines' => true,
            'default_config.processed_config_lines' => true,
            'merged_config.base_indent' => true,
            'merged_config.proxy_indent' => true,
            'merged_config.merged_lines' => true,
            'merged_config.content' => true
        ];

        foreach ($keysToRemove as $keyPath => $shouldRemove) {
            if ($shouldRemove) {
                $this->removeKeyByPath($resultData, $keyPath);
            }
        }

        return response()->json($resultData);
    }

    private function calculateExpiryMonths($config)
    {
        $expiryMonths = 0;
        if ($config->expires_at) {
            $now = Carbon::now();
            $expiryDate = Carbon::parse($config->expires_at);
            if ($expiryDate->gt($now)) {
                $expiryMonths = $now->diffInMonths($expiryDate);
                if ($expiryMonths > 6) {
                    $expiryMonths = 6;
                } else if ($expiryMonths > 2) {
                    $expiryMonths = 6;
                } else if ($expiryMonths > 1) {
                    $expiryMonths = 2;
                } else {
                    $expiryMonths = 1;
                }
            }
        }
        return $expiryMonths;
    }

    private function handleContentWithYamlCache($config)
    {
        if ($config->expires_at && Carbon::parse($config->expires_at)->isPast()) {
            return [
                'status' => 'config_expired',
                'content' => null,
                'message' => 'Configuration has expired'
            ];
        }

        switch ($config->type) {
            case 'url':
                return $this->urlFetcher->handleContent($config);
            case 'web':
                return $this->webFetcher->handleContent($config);
            default:
                return [
                    'status' => 'error',
                    'content' => null,
                    'message' => 'Unsupported type: ' . $config->type
                ];
        }
    }

    private function processProxyNames($proxyLines)
    {
        $names = [];
        $existingNames = self::$proxyNames;
        $currentProxyLines = self::$proxyLines; // Get the proxy lines that already exist

        foreach ($proxyLines as $line) {
            if (preg_match('/name:\s*"([^"]+)"/', $line, $matches)) {
                $originalName = $matches[1];
                $baseName = preg_replace('/\s*\(\d+\)$/', '', $originalName);

                $counter = 1;
                $newName = $baseName;
                while (in_array($newName, $existingNames) || in_array($newName, $currentProxyLines)) {
                    $newName = $baseName . ' (' . ++$counter . ')';
                }

                $existingNames[] = $newName;
                $names[] = $newName;
                self::$proxyLines[] = str_replace($originalName, $newName, $line);
            } else {
                // Add non-proxy lines directly to the collection
                if (!in_array($line, self::$proxyLines)) {
                    self::$proxyLines[] = $line;
                }
            }
        }

        self::$proxyNames = array_unique(array_merge(self::$proxyNames, $names));
        return self::$proxyLines; // Return all proxy lines after the update
    }

    private function mergeProxyLines($defaultConfig, $processedLines)
    {
        $mergedLines = $defaultConfig['processed_config_lines'];
        
        // Define indentation
        $baseIndent = '  ';  // Two spaces
        $proxyIndent = "      ";  // Four spaces

        // Handle the proxies section
        $proxiesIndex = array_search('proxies:', array_map('trim', $mergedLines));
        if ($proxiesIndex !== false) {
            $indentedProxyLines = array_map(function($line) use ($baseIndent) {
                return $baseIndent . $line;
            }, self::$proxyLines);
            array_splice($mergedLines, $proxiesIndex + 1, 0, $indentedProxyLines);
        }

        // Handle the proxy-groups section
        $groupStartIndex = array_search('proxy-groups:', array_map('trim', $mergedLines));
        $groupEndIndex = array_search('rules:', array_map('trim', $mergedLines));
        
        if ($groupStartIndex !== false && $groupEndIndex !== false) {
            // Collect the positions of all name lines within the range
            $nameLineIndexes = [];
            for ($i = $groupStartIndex; $i < $groupEndIndex; $i++) {
                if (preg_match('/^\s+- name:/', $mergedLines[$i])) {
                    $nameLineIndexes[] = $i;
                }
            }

            // Prepare the list of proxy names
            $proxyNameLines = array_map(function($name) use ($proxyIndent) {
                return $proxyIndent . '- ' . $name;
            }, self::$proxyNames);

            // Insert from back to front (except the first position)
            for ($i = count($nameLineIndexes) - 1; $i > 0; $i--) {
                array_splice($mergedLines, $nameLineIndexes[$i], 0, $proxyNameLines);
            }

            // Insert once more at the end of the section
            array_splice($mergedLines, $groupEndIndex, 0, $proxyNameLines);
        }

        // Generate the merged configuration file
        $mergedContent = implode("\n", $mergedLines);
        $cacheDir = storage_path('framework/cache/clash_configs');
        if (!File::exists($cacheDir)) {
            File::makeDirectory($cacheDir, 0755, true);
        }
        $mergedFilePath = $cacheDir . DIRECTORY_SEPARATOR . 'group_' . request()->query('group_id') . '.yaml';
        File::put($mergedFilePath, $mergedContent);

        return [
            'merged_lines' => $mergedLines,
            'content' => $mergedContent,  // Add the plain-text content
            'proxies_index' => $proxiesIndex,
            'base_indent' => $baseIndent,
            'proxy_indent' => $proxyIndent,
            'group_indexes' => [
                'start' => $groupStartIndex,
                'end' => $groupEndIndex,
                'name_lines' => $nameLineIndexes ?? []
            ]
        ];
    }

    /**
     * Remove a key by its dot-separated path
     * @param array &$data The data to process (passed by reference)
     * @param string $keyPath The dot-separated key path (e.g. 'a.b.c')
     */
    private function removeKeyByPath(&$data, $keyPath)
    {
        $segments = explode('.', $keyPath);
        $current = &$data;
        
        foreach ($segments as $index => $segment) {
            if (!array_key_exists($segment, $current)) {
                return;
            }
            
            if ($index === count($segments) - 1) {
                unset($current[$segment]);
            } else {
                if (!is_array($current[$segment])) {
                    return;
                }
                $current = &$current[$segment];
            }
        }
    }
} 