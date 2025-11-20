<?php

namespace App\Services\TimerTasks;

use App\Providers\PathMapper;

/**
 * Test Date File Task
 *
 * Creates a new timestamped file every second.
 * Keeps only the last 10 files for testing purposes.
 */
class TestDateFileTask extends OctaneTimerTaskAbstract
{
    /**
     * @inheritDoc
     */
    public function getName(): string
    {
        return 'test_date_file';
    }

    /**
     * @inheritDoc
     */
    public function getInterval(): int
    {
        return 1; // Every 1 second
    }

    /**
     * @inheritDoc
     */
    public function exec(): void
    {
        try {
            $tmpDir = PathMapper::getLaravelTmpDir();
            $dateStr = date('Y-m-d_H-i-s');
            $filePath = $tmpDir . "/timer_date_test.txt";

            $content = "Created at: {$dateStr}\n";
            $content .= "Timestamp: " . time() . "\n";

            file_put_contents($filePath, $content);

            // Clean up old files (keep only last 10)
            $files = glob($tmpDir . '/timer_date_test.txt');
            if (count($files) > 10) {
                usort($files, function($a, $b) {
                    return filemtime($a) - filemtime($b);
                });
                $toDelete = array_slice($files, 0, count($files) - 10);
                foreach ($toDelete as $file) {
                    @unlink($file);
                }
            }

        } catch (\Throwable $e) {
            $this->logError('Failed to create date file', [
                'error' => $e->getMessage()
            ]);
        }
    }
}
