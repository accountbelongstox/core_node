<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md). -->
<!-- - Never write summaries during development or thinking process. -->
<!-- 5. Declare all variables at the beginning of the file. -->
<!-- 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path). -->
<!-- 7. Do not modify these rules. -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

# Smart Compression Library

A powerful, intelligent compression and decompression library for Node.js that automatically optimizes performance based on system resources and file characteristics.

## Features

### 🚀 **Intelligent Scheduling**
- **Automatic parallel/serial decision making** based on file size and system load
- **CPU and memory monitoring** with adaptive task scheduling  
- **Smart queue management** with priority-based task ordering
- **System load awareness** to prevent system freezing

### 📦 **Comprehensive Compression Support**
- **7-Zip integration** with automatic path detection
- **Multiple compression levels**: fastest, fast, normal, maximum, ultra
- **Support for multiple formats**: 7z, zip, rar, tar, gz, bz2, xz, cab, iso
- **Batch processing** with group callbacks

### ⚡ **Performance Optimization**
- **Small files**: Parallel processing (up to 100MB total)
- **Large files**: Serial processing to prevent system overload
- **Dynamic resource allocation** based on CPU cores and memory
- **Configurable thresholds** for optimal performance

### 🎯 **Advanced Queue Management**
- **Priority-based task scheduling** (low, normal, high, urgent)
- **Group callbacks** for batch operation completion
- **Individual file callbacks** for progress monitoring
- **Task removal and queue clearing** capabilities

## Quick Start

```javascript
const SmartCompression = require('#@ncore/utils/smart_compression');

// Create compression instance
const compression = new SmartCompression();

// Add compression task
const taskId = compression.addCompressionTask({
    sourcePath: 'C:\\temp\\documents',
    targetPath: 'C:\\temp\\documents.7z',
    priority: 'high',
    compressionLevel: 'maximum',
    forceOverwrite: true,
    singleFileCallback: (success, result, task) => {
        if (success) {
            console.log(`Compression completed: ${result.compressionRatio}% saved`);
        }
    }
});

// Add extraction task
compression.addExtractionTask({
    archivePath: 'C:\\temp\\archive.zip',
    targetPath: 'C:\\temp\\extracted',
    priority: 'normal'
});

// Processing starts automatically!
```

## Advanced Usage

### Batch Operations with Group Callbacks

```javascript
// Add multiple tasks to a group
compression.addCompressionTask({
    sourcePath: 'C:\\temp\\file1.txt',
    groupId: 'batch1',
    priority: 'high'
});

compression.addCompressionTask({
    sourcePath: 'C:\\temp\\file2.txt', 
    groupId: 'batch1',
    priority: 'high'
});

// Set callback for when entire group completes
compression.setGroupCallback('batch1', (groupId) => {
    console.log(`All tasks in ${groupId} completed!`);
});
```

### System Monitoring and Configuration

```javascript
// Monitor system status
const systemStatus = compression.getSystemStatus();
console.log(`CPU: ${systemStatus.cpu.current}%`);
console.log(`Memory: ${systemStatus.memory.percentage}%`);

// Configure performance settings
compression.setMaxParallelSize(200); // 200MB max for parallel
compression.setMaxParallelTasks(6);  // Max 6 parallel tasks

// Get system recommendations
const recommendations = compression.getSystemRecommendations();
console.log(recommendations);
```

### Queue Management

```javascript
// Check queue status
const status = compression.getQueueStatus();
console.log(`Pending: ${status.pending}, Processing: ${status.processing}`);

// View all tasks
const tasks = compression.getQueueTasks();
tasks.forEach(task => {
    console.log(`${task.id}: ${task.status} (${task.type})`);
});

// Remove specific task
compression.removeTask(taskId);

// Clear entire queue (except processing tasks)
compression.clearQueue();
```

## Configuration Options

### Compression Levels
- `fastest`: Level 1 - Fastest compression, larger files
- `fast`: Level 3 - Fast compression, good balance  
- `normal`: Level 5 - Default balanced compression
- `maximum`: Level 7 - High compression, slower
- `ultra`: Level 9 - Maximum compression, slowest

### Priority Levels
- `low`: Processed last
- `normal`: Default priority
- `high`: Processed before normal tasks
- `urgent`: Processed first

### Task Options

```javascript
compression.addCompressionTask({
    sourcePath: 'path/to/source',        // Required
    targetPath: 'path/to/target.7z',     // Optional (auto-generated)
    sourceSize: 1024000,                 // Optional (auto-calculated)
    priority: 'normal',                  // Optional: low|normal|high|urgent
    groupId: 'myGroup',                  // Optional: for group callbacks
    forceOverwrite: false,               // Optional: overwrite existing files
    compressionLevel: 'normal',          // Optional: compression level
    singleFileCallback: (success, result, task) => {
        // Optional: individual task completion callback
    }
});
```

## System Requirements

- **7-Zip**: Must be installed and accessible
  - Windows: Automatically detected in Program Files
  - Linux/Mac: Must be in PATH or installed in standard locations
- **Node.js**: Version 12 or higher
- **Memory**: Recommended 4GB+ for large file processing

## Performance Guidelines

### Automatic Optimization
The library automatically optimizes based on:
- **File size**: Small files processed in parallel, large files serially
- **System load**: Reduces parallelism when CPU/memory usage is high
- **Available resources**: Adapts to CPU cores and available memory

### Manual Tuning
```javascript
// For high-performance systems
compression.updateConfiguration({
    maxParallelTasks: 8,
    maxParallelSize: 500 * 1024 * 1024, // 500MB
    largeFileThreshold: 200 * 1024 * 1024 // 200MB
});

// For resource-constrained systems  
compression.updateConfiguration({
    maxParallelTasks: 2,
    maxParallelSize: 50 * 1024 * 1024,  // 50MB
    largeFileThreshold: 25 * 1024 * 1024 // 25MB
});
```

## Error Handling

```javascript
compression.addCompressionTask({
    sourcePath: 'nonexistent/file.txt',
    singleFileCallback: (success, result, task) => {
        if (!success) {
            console.error(`Task failed: ${result.message}`);
            // Implement retry logic or error reporting
        }
    }
});

// Monitor failed tasks
setInterval(() => {
    const failedTasks = compression.getQueueTasks()
        .filter(task => task.status === 'failed');
    
    if (failedTasks.length > 0) {
        console.log(`${failedTasks.length} tasks failed`);
    }
}, 30000);
```

## API Reference

### Main Methods
- `addCompressionTask(options)` - Add compression task to queue
- `addExtractionTask(options)` - Add extraction task to queue  
- `setGroupCallback(groupId, callback)` - Set group completion callback
- `getQueueStatus()` - Get current queue statistics
- `getQueueTasks()` - Get all tasks in queue
- `removeTask(taskId)` - Remove specific task
- `clearQueue()` - Clear all pending tasks
- `getSystemStatus()` - Get system resource status

### Configuration Methods
- `setMaxParallelSize(sizeInMB)` - Set max size for parallel processing
- `setMaxParallelTasks(count)` - Set max concurrent tasks
- `updateConfiguration(config)` - Update multiple settings
- `getConfiguration()` - Export current configuration
- `getSystemRecommendations()` - Get optimal settings for system

## License

This library is part of the ncore framework and follows the project's licensing terms.
