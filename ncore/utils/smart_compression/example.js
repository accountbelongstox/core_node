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

const SmartCompression = require('./index');
const path = require('path');

async function demonstrateSmartCompression() {
    const compression = new SmartCompression();

    console.log('=== Smart Compression Library Demo ===\n');

    // Configure compression settings
    compression.setMaxParallelSize(100); // 100MB max for parallel processing
    compression.setMaxParallelTasks(3);  // Max 3 parallel tasks

    // Example 1: Add compression tasks with different priorities
    console.log('1. Adding compression tasks...');
    
    const task1 = compression.addCompressionTask({
        sourcePath: 'C:\\temp\\small_file.txt',
        targetPath: 'C:\\temp\\small_file.7z',
        priority: 'high',
        groupId: 'group1',
        forceOverwrite: true,
        compressionLevel: 'maximum',
        singleFileCallback: (success, result, task) => {
            console.log(`Task ${task.id} completed: ${success ? 'SUCCESS' : 'FAILED'}`);
            if (success) {
                console.log(`  Compression ratio: ${result.compressionRatio}%`);
            }
        }
    });

    const task2 = compression.addCompressionTask({
        sourcePath: 'C:\\temp\\documents',
        priority: 'normal',
        groupId: 'group1',
        compressionLevel: 'fast'
    });

    // Example 2: Add extraction tasks
    console.log('2. Adding extraction tasks...');
    
    const task3 = compression.addExtractionTask({
        archivePath: 'C:\\temp\\archive.zip',
        targetPath: 'C:\\temp\\extracted',
        priority: 'urgent',
        groupId: 'group2',
        forceOverwrite: true
    });

    // Example 3: Set group callback
    compression.setGroupCallback('group1', (groupId) => {
        console.log(`Group ${groupId} completed! All compression tasks finished.`);
    });

    compression.setGroupCallback('group2', (groupId) => {
        console.log(`Group ${groupId} completed! All extraction tasks finished.`);
    });

    // Example 4: Monitor queue status
    console.log('3. Queue status:');
    console.log(compression.getQueueStatus());

    // Example 5: Monitor system status
    console.log('4. System status:');
    console.log(compression.getSystemStatus());

    // Example 6: View all tasks
    console.log('5. All tasks in queue:');
    const tasks = compression.getQueueTasks();
    tasks.forEach(task => {
        console.log(`  Task ${task.id}: ${task.type} - ${task.status} (Priority: ${task.priority})`);
    });

    // The processing will start automatically when tasks are added
    console.log('\n6. Processing started automatically...');
    
    // Wait a bit to see some processing
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Example 7: Remove a specific task (if still pending)
    console.log('7. Attempting to remove a task...');
    const removed = compression.removeTask(task2);
    console.log(`Task removal: ${removed ? 'SUCCESS' : 'FAILED'}`);

    // Example 8: Final status check
    console.log('8. Final queue status:');
    console.log(compression.getQueueStatus());
}

// Advanced usage examples
async function advancedUsageExamples() {
    const compression = new SmartCompression();

    console.log('\n=== Advanced Usage Examples ===\n');

    // Example 1: Batch compression with size-based scheduling
    console.log('1. Batch compression with intelligent scheduling...');
    
    const files = [
        { path: 'C:\\temp\\small1.txt', size: 1024 * 1024 },      // 1MB
        { path: 'C:\\temp\\small2.txt', size: 2 * 1024 * 1024 }, // 2MB
        { path: 'C:\\temp\\large.iso', size: 100 * 1024 * 1024 }, // 100MB
        { path: 'C:\\temp\\medium.zip', size: 10 * 1024 * 1024 }  // 10MB
    ];

    files.forEach((file, index) => {
        compression.addCompressionTask({
            sourcePath: file.path,
            sourceSize: file.size,
            priority: index === 2 ? 'low' : 'normal', // Large file gets low priority
            groupId: 'batch_compression',
            compressionLevel: file.size > 50 * 1024 * 1024 ? 'fast' : 'maximum'
        });
    });

    // Example 2: Mixed operations with different priorities
    console.log('2. Mixed compression and extraction tasks...');
    
    compression.addCompressionTask({
        sourcePath: 'C:\\temp\\urgent_backup',
        priority: 'urgent',
        groupId: 'urgent_tasks'
    });

    compression.addExtractionTask({
        archivePath: 'C:\\temp\\urgent_restore.7z',
        priority: 'urgent',
        groupId: 'urgent_tasks'
    });

    // Example 3: Monitor and adjust based on system load
    setInterval(() => {
        const systemStatus = compression.getSystemStatus();
        const queueStatus = compression.getQueueStatus();
        
        console.log(`System Load - CPU: ${systemStatus.cpu.current}%, Memory: ${systemStatus.memory.percentage}%`);
        console.log(`Queue Status - Pending: ${queueStatus.pending}, Processing: ${queueStatus.processing}`);
        
        // Adjust settings based on system load
        if (systemStatus.load.underLoad) {
            compression.setMaxParallelTasks(1);
            console.log('System under load - reduced to serial processing');
        } else if (systemStatus.cpu.current < 50) {
            compression.setMaxParallelTasks(4);
            console.log('System load normal - increased parallel tasks');
        }
    }, 10000); // Check every 10 seconds

    // Example 4: Custom callbacks for detailed monitoring
    compression.setGroupCallback('batch_compression', (groupId) => {
        console.log(`Batch compression completed for group: ${groupId}`);
        
        const completedTasks = compression.getQueueTasks()
            .filter(task => task.groupId === groupId && task.status === 'completed');
        
        const totalOriginalSize = completedTasks.reduce((sum, task) => 
            sum + (task.result ? task.result.originalSize : 0), 0);
        const totalCompressedSize = completedTasks.reduce((sum, task) => 
            sum + (task.result ? task.result.compressedSize : 0), 0);
        
        if (totalOriginalSize > 0) {
            const overallRatio = ((totalOriginalSize - totalCompressedSize) / totalOriginalSize * 100).toFixed(2);
            console.log(`Overall compression ratio: ${overallRatio}%`);
        }
    });
}

// Error handling examples
async function errorHandlingExamples() {
    const compression = new SmartCompression();

    console.log('\n=== Error Handling Examples ===\n');

    // Example 1: Handle non-existent files
    try {
        compression.addCompressionTask({
            sourcePath: 'C:\\nonexistent\\file.txt',
            singleFileCallback: (success, result, task) => {
                if (!success) {
                    console.log(`Task ${task.id} failed: ${result.message}`);
                    // Could implement retry logic here
                }
            }
        });
    } catch (error) {
        console.log(`Failed to add task: ${error.message}`);
    }

    // Example 2: Handle permission errors
    compression.addCompressionTask({
        sourcePath: 'C:\\System32\\important.dll', // This will likely fail
        singleFileCallback: (success, result, task) => {
            if (!success) {
                console.log(`Permission denied for: ${task.sourcePath}`);
                // Could log to file or notify administrator
            }
        }
    });

    // Example 3: Monitor failed tasks
    setInterval(() => {
        const queueStatus = compression.getQueueStatus();
        if (queueStatus.failed > 0) {
            const failedTasks = compression.getQueueTasks()
                .filter(task => task.status === 'failed');
            
            console.log(`Found ${failedTasks.length} failed tasks:`);
            failedTasks.forEach(task => {
                console.log(`  - ${task.id}: ${task.error ? task.error.message : 'Unknown error'}`);
            });
        }
    }, 30000); // Check every 30 seconds
}

// Uncomment to run examples:
// demonstrateSmartCompression();
// advancedUsageExamples();
// errorHandlingExamples();

module.exports = {
    demonstrateSmartCompression,
    advancedUsageExamples,
    errorHandlingExamples
};
