<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Http;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\File;

class SetLocale
{
    /**
     * Supported locales
     */
    protected $supportedLocales = ['en', 'zh'];

    /**
     * Get the current locale
     *
     * @return string
     */
    public function getCurrentLocale()
    {
        return Session::get('locale', config('app.locale'));
    }

    /**
     * Get translation data for the given locale
     *
     * @param string $locale
     * @return array
     */
    protected function getTranslations($locale)
    {
        $translations = [];

        // Read the JSON translation file
        $jsonPath = resource_path("lang/{$locale}.json");
        if (File::exists($jsonPath)) {
            $translations = json_decode(File::get($jsonPath), true) ?? [];
        }

        // Read the PHP translation file
        $phpPath = resource_path("lang/{$locale}/messages.php");
        if (File::exists($phpPath)) {
            $phpTranslations = require $phpPath;
            // Flatten the nested array into dot notation
            $flatTranslations = $this->flattenArray($phpTranslations);
            $translations = array_merge($translations, $flatTranslations);
        }

        return $translations;
    }

    /**
     * Flatten a nested array into dot notation
     *
     * @param array $array
     * @param string $prefix
     * @return array
     */
    protected function flattenArray($array, $prefix = '')
    {
        $result = [];
        foreach ($array as $key => $value) {
            $newKey = $prefix ? "{$prefix}.{$key}" : $key;
            if (is_array($value)) {
                $result = array_merge($result, $this->flattenArray($value, $newKey));
            } else {
                $result[$newKey] = $value;
            }
        }
        return $result;
    }

    /**
     * Handle the locale-switch request
     *
     * @param  Request  $request
     * @param  string  $locale
     * @return \Illuminate\Http\JsonResponse
     */
    public function __invoke(Request $request, string $locale)
    {
        // Validate that the locale is supported
        if (!in_array($locale, $this->supportedLocales)) {
            return response()->json([
                'success' => false,
                'message' => 'Unsupported locale',
                'current_locale' => $this->getCurrentLocale()
            ], 400);
        }

        // No controller-level try/catch (LARAVEL_GUIDE: trust the framework
        // exception handler). Unsupported-locale is already validated above.
        $previousLocale = $this->getCurrentLocale();

        // Set the new locale
        Session::put('locale', $locale);
        App::setLocale($locale);

        // Load translation data for the new locale
        $translations = $this->getTranslations($locale);

        return response()->json([
            'success' => true,
            'message' => 'Locale updated successfully',
            'current_locale' => $locale,
            'previous_locale' => $previousLocale,
            'html_lang' => str_replace('_', '-', $locale),
            'translations' => $translations
        ]);
    }
}
