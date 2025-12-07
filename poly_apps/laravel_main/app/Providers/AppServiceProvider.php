<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Response;
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
                CheckCertbotCommand::class,
                NuxtServiceRefreshCommand::class,
            ]);
        }
    }
}
