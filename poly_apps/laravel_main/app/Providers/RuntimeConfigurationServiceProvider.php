<?php

namespace App\Providers;

use App\Constants\LaravelConfig;
use App\Support\RuntimeConfigurationStore;
use Illuminate\Console\Events\CommandStarting;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use RuntimeException;

class RuntimeConfigurationServiceProvider extends ServiceProvider
{
    private const FORBIDDEN_CONFIG_CACHE_COMMANDS = [
        'config:cache',
        'optimize',
    ];

    private const STRING_SECRET_CONFIG = [
        'FRONTEND_URL' => 'app.frontend_url',
        'SERVER_MANAGER_API_KEY' => 'app.server_manager_api_key',
        'DEEPSEEK_API_KEY' => 'deepseek.api_key',
        'WORKOS_API_KEY' => 'services.workos.api_key',
        'WORKOS_CLIENT_ID' => 'services.workos.client_id',
        'WORKOS_CLIENT_SECRET' => 'services.workos.client_secret',
        'WORKOS_REDIRECT_URL' => 'services.workos.redirect_url',
        'MAIL_HOST' => 'mail.mailers.smtp.host',
        'MAIL_USERNAME' => 'mail.mailers.smtp.username',
        'MAIL_PASSWORD' => 'mail.mailers.smtp.password',
        'MAIL_FROM_ADDRESS' => 'mail.from.address',
        'TENCENT_SMS_SECRET_ID' => 'sms.drivers.tencent.secret_id',
        'TENCENT_SMS_SECRET_KEY' => 'sms.drivers.tencent.secret_key',
        'TENCENT_SMS_SDK_APP_ID' => 'sms.drivers.tencent.sdk_app_id',
        'TENCENT_SMS_SIGN_NAME' => 'sms.drivers.tencent.sign_name',
        'TENCENT_SMS_TEMPLATE_ID' => 'sms.drivers.tencent.template_id',
        'ALIYUN_SMS_ACCESS_KEY_ID' => 'sms.drivers.aliyun.access_key_id',
        'ALIYUN_SMS_ACCESS_KEY_SECRET' => 'sms.drivers.aliyun.access_key_secret',
        'ALIYUN_SMS_SIGN_NAME' => 'sms.drivers.aliyun.sign_name',
        'ALIYUN_SMS_TEMPLATE_CODE' => 'sms.drivers.aliyun.template_code',
    ];

    public function register(): void
    {
        $this->injectApplicationKey();
        $this->injectStringSecrets();
        $this->injectApplicationKeyHistory();
        $this->injectDatabasePassword();
        $this->injectReverbCredentials();
        $this->injectAuthenticationTokens();
        $this->synchronizeSmsTemplates();
    }

    public function boot(): void
    {
        Event::listen(CommandStarting::class, function (CommandStarting $event): void {
            if (in_array($event->command, self::FORBIDDEN_CONFIG_CACHE_COMMANDS, true)) {
                throw new RuntimeException(
                    __('runtime.configuration_cache_disabled')
                );
            }
        });
    }

    private function injectApplicationKey(): void
    {
        $appKey = RuntimeConfigurationStore::get('APP_KEY');

        if ($appKey === null) {
            $appKey = 'base64:' . base64_encode(random_bytes(32));
            RuntimeConfigurationStore::put('APP_KEY', $appKey);
        }

        $this->app['config']->set('app.key', $appKey);
    }

    private function injectStringSecrets(): void
    {
        $value = null;

        foreach (self::STRING_SECRET_CONFIG as $secretKey => $configKey) {
            $value = RuntimeConfigurationStore::get($secretKey);
            if ($value !== null) {
                $this->app['config']->set($configKey, $value);
            }
        }
    }

    private function injectApplicationKeyHistory(): void
    {
        $rawKeys = RuntimeConfigurationStore::get('APP_PREVIOUS_KEYS');
        $keys = [];

        if ($rawKeys === null) {
            return;
        }

        $keys = array_values(array_filter(array_map('trim', explode(',', $rawKeys))));
        $this->app['config']->set('app.previous_keys', $keys);
    }

    private function injectDatabasePassword(): void
    {
        $password = RuntimeConfigurationStore::get('POSTGRES_PASSWORD');

        if ($password === null) {
            return;
        }

        foreach (array_keys(LaravelConfig::DATABASES) as $connection) {
            $this->app['config']->set("database.connections.{$connection}.password", $password);
        }
    }

    private function injectReverbCredentials(): void
    {
        $appId = RuntimeConfigurationStore::get('REVERB_APP_ID', LaravelConfig::REVERB_APP_ID);
        $key = $this->reverbCredential('REVERB_APP_KEY', 16);
        $secret = $this->reverbCredential('REVERB_APP_SECRET', 32);
        $configValues = [
            'broadcasting.connections.reverb.app_id' => $appId,
            'broadcasting.connections.reverb.key' => $key,
            'broadcasting.connections.reverb.secret' => $secret,
            'reverb.apps.apps.0.app_id' => $appId,
            'reverb.apps.apps.0.key' => $key,
            'reverb.apps.apps.0.secret' => $secret,
        ];

        foreach ($configValues as $configKey => $value) {
            $this->app['config']->set($configKey, $value);
        }
    }

    private function reverbCredential(string $storeKey, int $entropyBytes): string
    {
        $value = RuntimeConfigurationStore::get($storeKey);

        if ($value !== null) {
            return $value;
        }

        $value = bin2hex(random_bytes($entropyBytes));
        RuntimeConfigurationStore::put($storeKey, $value);

        return $value;
    }

    private function injectAuthenticationTokens(): void
    {
        $clientToken = RuntimeConfigurationStore::get('CLIENT_TOKEN_DEFAULT');
        $debugToken = RuntimeConfigurationStore::get('DEBUG_TOKEN_DEFAULT');
        $resourceAccessKey = RuntimeConfigurationStore::get('APPQYV1_RESOURCE_ACCESS_KEY');

        $this->app['config']->set('auth.client_tokens', $clientToken === null ? [] : [$clientToken]);
        $this->app['config']->set('dictauth.debug_tokens', $debugToken === null ? [] : [$debugToken]);
        $this->app['config']->set('AppQyV1.auth.debug_tokens', $debugToken === null ? [] : [$debugToken]);
        $this->app['config']->set(
            'AppQyV1.auth.resource_access_keys',
            $resourceAccessKey === null ? [] : [$resourceAccessKey]
        );
    }

    private function synchronizeSmsTemplates(): void
    {
        $tencentTemplate = $this->app['config']->get('sms.drivers.tencent.template_id');
        $aliyunTemplate = $this->app['config']->get('sms.drivers.aliyun.template_code');

        $this->app['config']->set('sms.templates.verification_code.tencent', $tencentTemplate);
        $this->app['config']->set('sms.templates.verification_code.aliyun', $aliyunTemplate);
    }
}
