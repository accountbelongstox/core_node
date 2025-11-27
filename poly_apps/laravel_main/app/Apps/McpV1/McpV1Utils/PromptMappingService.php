<?php

namespace App\Apps\McpV1\McpV1Utils;

use App\Providers\PathMapper;

/**
 * Prompt Mapping Service (McpV1)
 *
 * Manages prompt mappings for task categories
 * - Prefix: Added before task content
 * - Suffix: Added after task content
 * - Replace Map: Content replacement rules
 *
 * Supports both MCP (Model Context Protocol) and web query interfaces
 * Following Laravel 12.x MCP specifications
 *
 * @see https://laravel.com/docs/12.x/mcp
 */
class PromptMappingService
{
    private $mappingConfigFile;

    private $defaultMappings = [
        'global' => [
            'prefix' => '',
            'suffix' => '',
            'replace_map' => []
        ],
        'mcp-dev' => [
            'prefix' => '[MCP Development Context]' . "\n",
            'suffix' => "\n" . '[Follow Laravel 12.x MCP specifications]',
            'replace_map' => [
                'API' => 'MCP API',
                'interface' => 'MCP interface',
                'service' => 'MCP service'
            ]
        ],
        'ncore-dev' => [
            'prefix' => '[NCORE Development Context]' . "\n",
            'suffix' => "\n" . '[Ensure Node.js compatibility]',
            'replace_map' => [
                'module' => 'NCORE module',
                'component' => 'NCORE component'
            ]
        ],
        'pycore-dev' => [
            'prefix' => '[PYCORE Development Context]' . "\n",
            'suffix' => "\n" . '[Follow Python best practices]',
            'replace_map' => [
                'function' => 'Python function',
                'class' => 'Python class'
            ]
        ],
        'laravel-main-dev' => [
            'prefix' => '[Laravel Main Development Context]' . "\n",
            'suffix' => "\n" . '[Follow Laravel coding standards]',
            'replace_map' => [
                'controller' => 'Laravel controller',
                'model' => 'Eloquent model',
                'middleware' => 'Laravel middleware'
            ]
        ],
        'nuxt-dev' => [
            'prefix' => '[NUXT Development Context]' . "\n",
            'suffix' => "\n" . '[Follow Vue.js and NUXT conventions]',
            'replace_map' => [
                'page' => 'NUXT page',
                'component' => 'Vue component',
                'store' => 'Vuex/Pinia store'
            ]
        ]
    ];

    public function __construct()
    {
        // Use _prompts/.prompt-mappings.json as config (can be committed to git)
        $baseDir = PathMapper::getCoreNodeDir();
        $promptsDir = $baseDir . DIRECTORY_SEPARATOR . '_prompts';
        $this->mappingConfigFile = $promptsDir . DIRECTORY_SEPARATOR . '.prompt-mappings.json';

        $this->ensureDefaultMappings();
    }

    /**
     * Ensure default mappings exist
     */
    private function ensureDefaultMappings()
    {
        if (!file_exists($this->mappingConfigFile)) {
            $this->initializeMappingsConfig();
        }
    }

    /**
     * Initialize mappings configuration file
     */
    private function initializeMappingsConfig()
    {
        $config = [
            'version' => '1.0',
            'mappings' => $this->defaultMappings
        ];

        file_put_contents(
            $this->mappingConfigFile,
            json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        error_log('[PromptMappingService] Created mappings config at: ' . $this->mappingConfigFile);
    }

    /**
     * Load mappings configuration
     */
    public function loadMappingsConfig()
    {
        if (!file_exists($this->mappingConfigFile)) {
            $this->initializeMappingsConfig();
        }

        $content = file_get_contents($this->mappingConfigFile);
        return json_decode($content, true);
    }

    /**
     * Get all mappings
     */
    public function getAllMappings()
    {
        $config = $this->loadMappingsConfig();
        return $config['mappings'] ?? [];
    }

    /**
     * Get mapping for specific category
     */
    public function getCategoryMapping($categoryId)
    {
        $mappings = $this->getAllMappings();

        if (isset($mappings[$categoryId])) {
            return $mappings[$categoryId];
        }

        return [
            'prefix' => '',
            'suffix' => '',
            'replace_map' => []
        ];
    }

    /**
     * Update mapping for specific category
     */
    public function updateCategoryMapping($categoryId, $prefix, $suffix, $replaceMap)
    {
        $config = $this->loadMappingsConfig();

        $config['mappings'][$categoryId] = [
            'prefix' => $prefix ?? '',
            'suffix' => $suffix ?? '',
            'replace_map' => $replaceMap ?? []
        ];

        $config['updated_at'] = date('Y-m-d H:i:s');

        file_put_contents(
            $this->mappingConfigFile,
            json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        return [
            'success' => true,
            'category_id' => $categoryId,
            'mapping' => $config['mappings'][$categoryId]
        ];
    }

    /**
     * Apply mapping to content
     */
    public function applyMapping($categoryId, $content)
    {
        $mapping = $this->getCategoryMapping($categoryId);

        $processedContent = $content;

        if (!empty($mapping['replace_map']) && is_array($mapping['replace_map'])) {
            foreach ($mapping['replace_map'] as $search => $replace) {
                $processedContent = str_replace($search, $replace, $processedContent);
            }
        }

        if (!empty($mapping['prefix'])) {
            $processedContent = $mapping['prefix'] . $processedContent;
        }

        if (!empty($mapping['suffix'])) {
            $processedContent = $processedContent . $mapping['suffix'];
        }

        return $processedContent;
    }

    /**
     * Delete mapping for specific category
     */
    public function deleteCategoryMapping($categoryId)
    {
        $config = $this->loadMappingsConfig();

        if (isset($config['mappings'][$categoryId])) {
            unset($config['mappings'][$categoryId]);
            $config['updated_at'] = date('Y-m-d H:i:s');

            file_put_contents(
                $this->mappingConfigFile,
                json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
            );

            return ['success' => true];
        }

        return ['success' => false, 'error' => 'Mapping not found'];
    }

    /**
     * Reset mapping to default
     */
    public function resetCategoryMapping($categoryId)
    {
        if (!isset($this->defaultMappings[$categoryId])) {
            return ['success' => false, 'error' => 'No default mapping for this category'];
        }

        $config = $this->loadMappingsConfig();
        $config['mappings'][$categoryId] = $this->defaultMappings[$categoryId];
        $config['updated_at'] = date('Y-m-d H:i:s');

        file_put_contents(
            $this->mappingConfigFile,
            json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        return [
            'success' => true,
            'category_id' => $categoryId,
            'mapping' => $config['mappings'][$categoryId]
        ];
    }
}
