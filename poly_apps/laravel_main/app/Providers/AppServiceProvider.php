<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Response;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use App\Events\TranslationTaskQueuedEvent;
use App\Events\TranslationTaskPriorityEvent;
use App\Events\WordTranslatedEvent;
use App\Events\TranslationTaskCompletedEvent;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TranslationEventModel;
use App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands\ServerManagerV1DeployCommand;
use App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands\ServerManagerV1DeploySelfCommand;
use App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands\ServerManagerV1SSLCommand;
use App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands\ServerManagerV1CertificateCommand;
use App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands\ServerManagerV1WebsiteCommand;
use App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands\ServerManagerV1SyncCommand;
use App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands\ServerManagerV1AdvancedCommand;
use App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands\ServerManagerV1NginxInspectCommand;
use App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands\ServerManagerV1SwooleCommand;
use App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands\ServerManagerV1NuxtAppCommand;
use App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands\ServerManagerV1StaticAppCommand;
use App\Apps\ServerManagerV1\ServerManagerV1CLI\Commands\ServerManagerV1PolyAppsCommand;
use App\Console\Commands\CheckCertbotCommand;
use App\Console\Commands\NuxtServiceRefreshCommand;
class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Response::macro('goStyle', function () {
            return Response::make()
                ->header('X-Go-Type', 'application/go')
                ->header('X-Runtime-Format', 'go1.21');
        });

        ResetPassword::createUrlUsing(function (object $notifiable, string $token) {
            return config('app.frontend_url') . "/password-reset/$token?email={$notifiable->getEmailForPasswordReset()}";
        });

        // Translation real-time outbox (replaces Reverb). Every translation-queue
        // event is mirrored into app_qy_v1_translation_events; the SSE endpoint
        // (translation/queue/stream) streams them to pycore over Octane :9000.
        // The events keep dispatching unchanged; this listener only fans them into
        // the outbox (best-effort — a write failure never breaks the dispatch).
        Event::listen([
            TranslationTaskQueuedEvent::class,
            TranslationTaskPriorityEvent::class,
            WordTranslatedEvent::class,
            TranslationTaskCompletedEvent::class,
        ], function (object $event): void {
            try {
                AppQyV1TranslationEventModel::emit($event->broadcastAs(), $event->broadcastWith());
            } catch (\Throwable $e) {
                Log::warning('[AppServiceProvider] translation outbox listener failed', [
                    'error' => $e->getMessage(),
                ]);
            }
        });

        // Register ServerManagerV1 CLI Commands
        if ($this->app->runningInConsole()) {
            $this->commands([
                ServerManagerV1DeployCommand::class,
                ServerManagerV1DeploySelfCommand::class,
                ServerManagerV1SSLCommand::class,
                ServerManagerV1CertificateCommand::class,
                ServerManagerV1WebsiteCommand::class,
                ServerManagerV1SyncCommand::class,
                ServerManagerV1AdvancedCommand::class,
                ServerManagerV1NginxInspectCommand::class,
                ServerManagerV1SwooleCommand::class,
                ServerManagerV1NuxtAppCommand::class,
                ServerManagerV1StaticAppCommand::class,
                ServerManagerV1PolyAppsCommand::class,
                CheckCertbotCommand::class,
                NuxtServiceRefreshCommand::class,
            ]);
        }
    }
}
