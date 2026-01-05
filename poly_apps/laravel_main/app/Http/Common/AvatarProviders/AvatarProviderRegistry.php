<?php

namespace App\Http\Common\AvatarProviders;

use Illuminate\Support\Facades\Log;

/**
 * Avatar Provider Registry
 *
 * Manages all available avatar providers
 */
class AvatarProviderRegistry
{
    /**
     * Provider map: short_code => Provider class
     */
    private static array $providers = [
        'pravatar' => PravatarProvider::class,
        'dicebear' => DicebearProvider::class,
        'uiavatars' => UiavatarsProvider::class,
        'robohash' => RobohashProvider::class,
        'gravatar' => GravatarProvider::class,
        'dicebear-bottts' => DicebearbotttsProvider::class,
        'dicebear-pixel' => DicebearpixelProvider::class,
    ];

    /**
     * Index map: numeric index => short_code
     */
    private static array $indexMap = [
        0 => 'pravatar',
        1 => 'dicebear',
        2 => 'uiavatars',
        3 => 'robohash',
        4 => 'gravatar',
        5 => 'dicebear-bottts',
        6 => 'dicebear-pixel',
    ];

    /**
     * Default provider
     */
    private const DEFAULT_PROVIDER = 'pravatar';

    /**
     * Provider instances cache
     */
    private static array $instances = [];

    /**
     * Get provider by short code or index
     *
     * @param string|int|null $identifier Short code, index, or null for default
     * @return AvatarProviderInterface|null
     */
    public static function getProvider(string|int|null $identifier = null): ?AvatarProviderInterface
    {
        // Use default if not specified
        if ($identifier === null || $identifier === '') {
            $identifier = self::DEFAULT_PROVIDER;
        }

        // Convert index to short code
        if (is_numeric($identifier)) {
            $index = (int)$identifier;
            if (!isset(self::$indexMap[$index])) {
                Log::warning('[AvatarProviderRegistry] Invalid provider index', ['index' => $index]);
                return null;
            }
            $identifier = self::$indexMap[$index];
        }

        // Get provider class
        if (!isset(self::$providers[$identifier])) {
            Log::warning('[AvatarProviderRegistry] Invalid provider short code', ['code' => $identifier]);
            return null;
        }

        // Return cached instance or create new one
        if (!isset(self::$instances[$identifier])) {
            $className = self::$providers[$identifier];
            self::$instances[$identifier] = new $className();

            Log::info('[AvatarProviderRegistry] Provider instance created', [
                'short_code' => $identifier,
                'class' => $className,
            ]);
        }

        return self::$instances[$identifier];
    }

    /**
     * Get all available providers
     *
     * @return array
     */
    public static function getAllProviders(): array
    {
        $providers = [];

        foreach (self::$providers as $shortCode => $className) {
            $provider = self::getProvider($shortCode);
            if ($provider) {
                $providers[] = [
                    'short_code' => $shortCode,
                    'name' => $provider->getName(),
                    'max_size' => $provider->getMaxSize(),
                    'supports_size' => $provider->supportsSize(),
                    'deterministic' => $provider->isDeterministic(),
                ];
            }
        }

        return $providers;
    }

    /**
     * Get provider index map
     *
     * @return array
     */
    public static function getIndexMap(): array
    {
        return self::$indexMap;
    }

    /**
     * Get provider short codes
     *
     * @return array
     */
    public static function getShortCodes(): array
    {
        return array_keys(self::$providers);
    }

    /**
     * Check if provider exists
     *
     * @param string|int $identifier
     * @return bool
     */
    public static function hasProvider(string|int $identifier): bool
    {
        if (is_numeric($identifier)) {
            return isset(self::$indexMap[(int)$identifier]);
        }

        return isset(self::$providers[$identifier]);
    }
}
