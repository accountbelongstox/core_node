<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1Utils;

class CheckCertbotCommand extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'servermanager:check-certbot {--install : Attempt to install certbot if missing}';

    /**
     * The console command description.
     */
    protected $description = 'Check if certbot is installed and provide installation guidance';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info("=== Certbot Installation Check ===");
        
        // Check if certbot is installed
        $checkResult = ServerManagerV1Utils::executeCommand('which', ['certbot']);
        
        if ($checkResult['success']) {
            $this->info("✅ Certbot is installed");
            
            // Get version
            $versionResult = ServerManagerV1Utils::executeCommand('certbot', ['--version']);
            if ($versionResult['success']) {
                $this->info("Version: " . trim($versionResult['output']));
            }
            
            // Check nginx plugin
            $pluginResult = ServerManagerV1Utils::executeCommand('certbot', ['plugins']);
            if ($pluginResult['success'] && strpos($pluginResult['output'], 'nginx') !== false) {
                $this->info("✅ Nginx plugin is available");
            } else {
                $this->warn("⚠️  Nginx plugin may not be available");
                $this->info("Install with: sudo apt install python3-certbot-nginx");
            }
            
            return 0;
        }
        
        $this->error("❌ Certbot is not installed");
        
        if ($this->option('install')) {
            return $this->attemptInstallation();
        }
        
        $this->showInstallationInstructions();
        return 1;
    }
    
    /**
     * Show installation instructions
     */
    private function showInstallationInstructions(): void
    {
        $this->warn("Installation Options:");
        $this->info("");
        $this->info("Option 1: Use the provided installation script");
        $this->info("  bash /www/wwwroot/core_node/scripts/shells/linux/debian/install_shells/27_install_certbot.sh");
        $this->info("");
        $this->info("Option 2: Install manually");
        $this->info("  sudo apt update");
        $this->info("  sudo apt install -y certbot python3-certbot-nginx");
        $this->info("");
        $this->info("Option 3: Use this command to attempt automatic installation");
        $this->info("  php artisan servermanager:check-certbot --install");
    }
    
    /**
     * Attempt to install certbot
     */
    private function attemptInstallation(): int
    {
        $this->info("Attempting to install certbot...");
        
        // Try using the installation script first
        $scriptPath = '/www/wwwroot/core_node/scripts/shells/linux/debian/install_shells/27_install_certbot.sh';
        
        if (file_exists($scriptPath)) {
            $this->info("Using installation script: $scriptPath");
            $result = ServerManagerV1Utils::executeCommand('bash', [$scriptPath], 300);
            
            if ($result['success']) {
                $this->info("✅ Installation script completed successfully");
                
                // Verify installation
                $checkResult = ServerManagerV1Utils::executeCommand('which', ['certbot']);
                if ($checkResult['success']) {
                    $this->info("✅ Certbot is now installed");
                    return 0;
                } else {
                    $this->warn("⚠️  Installation script ran but certbot is still not found");
                }
            } else {
                $this->error("❌ Installation script failed:");
                $this->error($result['error']);
                $this->warn("Trying manual installation...");
            }
        }
        
        // Try manual installation
        $this->info("Attempting manual installation...");
        
        $updateResult = ServerManagerV1Utils::executeCommand('apt', ['update'], 60);
        if (!$updateResult['success']) {
            $this->error("Failed to update package list");
            return 1;
        }
        
        $installResult = ServerManagerV1Utils::executeCommand('apt', [
            'install', '-y', 'certbot', 'python3-certbot-nginx'
        ], 300);
        
        if ($installResult['success']) {
            $this->info("✅ Certbot installed successfully");
            
            // Verify installation
            $checkResult = ServerManagerV1Utils::executeCommand('which', ['certbot']);
            if ($checkResult['success']) {
                $this->info("✅ Certbot is now available");
                return 0;
            }
        }
        
        $this->error("❌ Failed to install certbot");
        $this->error("Please install manually or check system requirements");
        return 1;
    }
}
