<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Utils\StartupLogger;

class StartupMonitorController
{
    public function getLogs(Request $request)
    {
        $logs = StartupLogger::getLogContents();

        return response()->json([
            'logs' => $logs,
            'total_count' => count($logs),
            'log_file' => StartupLogger::getLogPath()
        ]);
    }

    public function viewLogs(Request $request)
    {
        $logs = StartupLogger::getLogContents();

        $html = '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Startup Monitor</title>
    <style>
        body {
            font-family: monospace;
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 20px;
            margin: 0;
        }
        h1 {
            color: #4ec9b0;
            border-bottom: 2px solid #4ec9b0;
            padding-bottom: 10px;
        }
        .stats {
            background: #2d2d2d;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .stat-item {
            display: inline-block;
            margin-right: 30px;
        }
        .stat-label {
            color: #9cdcfe;
            font-weight: bold;
        }
        .stat-value {
            color: #ce9178;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background: #2d2d2d;
            border-radius: 5px;
            overflow: hidden;
        }
        th {
            background: #3c3c3c;
            color: #4ec9b0;
            padding: 12px;
            text-align: left;
            font-weight: bold;
        }
        td {
            padding: 10px 12px;
            border-top: 1px solid #3c3c3c;
        }
        tr:hover {
            background: #3c3c3c;
        }
        .stage {
            color: #dcdcaa;
            font-weight: bold;
        }
        .stage-error {
            color: #f48771;
        }
        .timestamp {
            color: #9cdcfe;
        }
        .elapsed {
            color: #b5cea8;
        }
        .message {
            color: #d4d4d4;
        }
        .data {
            color: #ce9178;
            font-size: 0.9em;
        }
        .memory {
            color: #569cd6;
        }
        .refresh-btn {
            background: #0e639c;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            margin-bottom: 20px;
        }
        .refresh-btn:hover {
            background: #1177bb;
        }
        .no-logs {
            text-align: center;
            padding: 40px;
            color: #808080;
            font-size: 18px;
        }
    </style>
    <script>
        function refresh() {
            location.reload();
        }
        setInterval(refresh, 5000);
    </script>
</head>
<body>
    <h1>🚀 Laravel Startup Monitor</h1>

    <button class="refresh-btn" onclick="refresh()">🔄 Refresh Now</button>

    <div class="stats">
        <div class="stat-item">
            <span class="stat-label">Total Events:</span>
            <span class="stat-value">' . count($logs) . '</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Log File:</span>
            <span class="stat-value">' . StartupLogger::getLogPath() . '</span>
        </div>';

        if (count($logs) > 0) {
            $lastLog = end($logs);
            $html .= '
        <div class="stat-item">
            <span class="stat-label">Last Event:</span>
            <span class="stat-value">' . $lastLog['elapsed_ms'] . 'ms</span>
        </div>';
        }

        $html .= '
    </div>';

        if (count($logs) === 0) {
            $html .= '<div class="no-logs">No startup logs found. Please restart the service to generate logs.</div>';
        } else {
            $html .= '
    <table>
        <thead>
            <tr>
                <th>Timestamp</th>
                <th>Elapsed (ms)</th>
                <th>Stage</th>
                <th>Message</th>
                <th>Memory (MB)</th>
                <th>Data</th>
            </tr>
        </thead>
        <tbody>';

            foreach ($logs as $log) {
                $stageClass = strpos($log['stage'], 'ERROR') !== false ? 'stage-error' : 'stage';
                $dataJson = !empty($log['data']) ? json_encode($log['data'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) : '';

                $html .= '
            <tr>
                <td class="timestamp">' . htmlspecialchars($log['timestamp']) . '</td>
                <td class="elapsed">' . $log['elapsed_ms'] . '</td>
                <td class="' . $stageClass . '">' . htmlspecialchars($log['stage']) . '</td>
                <td class="message">' . htmlspecialchars($log['message']) . '</td>
                <td class="memory">' . $log['memory_mb'] . '</td>
                <td class="data">' . ($dataJson ? '<pre>' . htmlspecialchars($dataJson) . '</pre>' : '-') . '</td>
            </tr>';
            }

            $html .= '
        </tbody>
    </table>';
        }

        $html .= '
</body>
</html>';

        return response($html)->header('Content-Type', 'text/html');
    }

    public function healthCheck(Request $request)
    {
        StartupLogger::checkpoint('HEALTH_CHECK', 'Health check endpoint hit');

        return response()->json([
            'status' => 'ok',
            'timestamp' => date('Y-m-d H:i:s'),
            'server_time' => microtime(true)
        ]);
    }
}
