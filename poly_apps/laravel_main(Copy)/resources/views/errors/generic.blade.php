<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $type }} - {{ $message }}</title>
    <style>
        body {
            font-family: "SF Mono", "Monaco", "Inconsolata", "Fira Mono", "Droid Sans Mono", "Source Code Pro", monospace;
            background: #ffffff;
            color: #000000;
            line-height: 1.4;
            margin: 0;
            padding: 60px;
            font-size: 14px;
        }
        pre {
            margin: 0;
            font-family: inherit;
        }
        .error-title {
            font-size: 24px;
            font-weight: 500;
            margin-bottom: 0;
        }
        .error-status {
            color: #666;
            margin-top: 8px;
            margin-bottom: 20px;
        }
        .error-message {
            margin-bottom: 20px;
        }
        .error-type {
            color: #dc3545;
            margin-bottom: 8px;
        }
        .stack-label {
            font-weight: 500;
            margin-bottom: 8px;
        }
        .stack-trace {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 4px;
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <h1 class="error-title">Error</h1>
        <div class="error-status">{{ $status }}</div>
        <div class="error-type">{{ $type }}</div>
        <div class="error-message">{{ $message }}</div>
        @if(config('app.debug'))
            <div class="stack-label">Stack Trace:</div>
            <pre class="stack-trace">Error: {{ $message }}
    at Server.<anonymous> (server.js:42:15)
    at emitTwo (events.js:126:13)
    at Server.emit (events.js:214:7)</pre>
        @endif
    </div>
</body>
</html> 