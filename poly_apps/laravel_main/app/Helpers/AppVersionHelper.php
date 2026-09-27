<?php

if (!function_exists('getAppVersionFromFilename')) {
    /**
     * Extract version from filename
     *
     * @param string $filePath
     * @return string
     */
    function getAppVersionFromFilename($filePath)
    {
        $filename = basename($filePath);
        if (preg_match('/V\d+/', $filename, $matches)) {
            return strtolower($matches[0]); 
        }
        return 'v1';
    }
} 