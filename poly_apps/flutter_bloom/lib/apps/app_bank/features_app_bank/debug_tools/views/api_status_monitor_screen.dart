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

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../services_app_bank/network_log_storage.dart';
import '../../../../../common/network/core/api_endpoint_manager.dart';
import '../../../config_app_bank/api_endpoints_app_bank.dart';

class ApiStatusMonitorScreen extends StatefulWidget {
  const ApiStatusMonitorScreen({super.key});

  @override
  State<ApiStatusMonitorScreen> createState() => _ApiStatusMonitorScreenState();
}

class _ApiStatusMonitorScreenState extends State<ApiStatusMonitorScreen> {
  final ApiEndpointManager _endpointManager = ApiEndpointManager();
  Map<String, EndpointHealthResult> _healthResults = {};
  bool _isRefreshing = false;

  @override
  void initState() {
    super.initState();
    _loadHealthStatus();
  }

  Future<void> _loadHealthStatus() async {
    setState(() {
      _isRefreshing = true;
    });

    try {
      final results = await _endpointManager.checkAllEndpoints(
        timeout: const Duration(seconds: 3),
      );
      setState(() {
        _healthResults = results;
        _isRefreshing = false;
      });
    } catch (e) {
      setState(() {
        _isRefreshing = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error checking endpoints: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('API Status Monitor'),
          backgroundColor: const Color(0xFF74B9FF),
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back, color: Colors.white),
            onPressed: () => context.pop(),
          ),
          actions: [
            IconButton(
              icon: _isRefreshing
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : const Icon(Icons.refresh, color: Colors.white),
              onPressed: _isRefreshing ? null : _loadHealthStatus,
              tooltip: 'Refresh',
            ),
          ],
          bottom: TabBar(
            tabs: const [
              Tab(text: 'API Status'),
              Tab(text: 'Network Logs'),
            ],
            indicatorColor: Colors.white,
            labelColor: Colors.white,
            unselectedLabelColor: Colors.white70,
          ),
        ),
        body: TabBarView(
          children: [
            _buildApiStatusTab(),
            _buildNetworkLogsTab(),
          ],
        ),
      ),
    );
  }

  Widget _buildApiStatusTab() {
    final endpoints = ApiEndpointsAppBank.endpoints;
    final currentEndpoint = _endpointManager.currentEndpoint;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildCurrentEndpointCard(currentEndpoint),
        const SizedBox(height: 16),
        ...endpoints.map((endpoint) {
          final healthResult = _healthResults[endpoint.id];
          return _buildEndpointCard(endpoint, healthResult, currentEndpoint?.id == endpoint.id);
        }),
      ],
    );
  }

  Widget _buildCurrentEndpointCard(ApiEndpoint? currentEndpoint) {
    if (currentEndpoint == null) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Text('No endpoint selected'),
        ),
      );
    }

    final healthResult = _healthResults[currentEndpoint.id];
    return Card(
      color: const Color(0xFF74B9FF).withOpacity(0.1),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.check_circle, color: Color(0xFF74B9FF)),
                const SizedBox(width: 8),
                const Text(
                  'Current Endpoint',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _buildEndpointInfo(currentEndpoint, healthResult, true),
          ],
        ),
      ),
    );
  }

  Widget _buildEndpointCard(ApiEndpoint endpoint, EndpointHealthResult? healthResult, bool isCurrent) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: _buildEndpointInfo(endpoint, healthResult, isCurrent),
      ),
    );
  }

  Widget _buildEndpointInfo(ApiEndpoint endpoint, EndpointHealthResult? healthResult, bool isCurrent) {
    final isHealthy = healthResult?.isHealthy ?? false;
    final responseTime = healthResult?.responseTime;
    final error = healthResult?.error;
    final checkedAt = healthResult?.checkedAt;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    endpoint.description ?? endpoint.id,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    endpoint.baseUrl,
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
            if (isCurrent)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF74B9FF),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  'Current',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Icon(
              isHealthy ? Icons.check_circle : Icons.error,
              color: isHealthy ? Colors.green : Colors.red,
              size: 20,
            ),
            const SizedBox(width: 8),
            Text(
              isHealthy ? 'Available' : 'Unavailable',
              style: TextStyle(
                color: isHealthy ? Colors.green : Colors.red,
                fontWeight: FontWeight.w500,
              ),
            ),
            if (responseTime != null) ...[
              const SizedBox(width: 16),
              Icon(Icons.timer, size: 16, color: Colors.grey[600]),
              const SizedBox(width: 4),
              Text(
                '${responseTime.inMilliseconds}ms',
                style: TextStyle(color: Colors.grey[600]),
              ),
            ],
          ],
        ),
        if (error != null) ...[
          const SizedBox(height: 8),
          Text(
            'Error: $error',
            style: const TextStyle(
              color: Colors.red,
              fontSize: 12,
            ),
          ),
        ],
        if (checkedAt != null) ...[
          const SizedBox(height: 4),
          Text(
            'Checked: ${_formatDateTime(checkedAt)}',
            style: TextStyle(
              color: Colors.grey[500],
              fontSize: 12,
            ),
          ),
        ],
        Row(
          children: [
            Text(
              'Priority: ${endpoint.priority}',
              style: TextStyle(
                color: Colors.grey[600],
                fontSize: 12,
              ),
            ),
            const SizedBox(width: 16),
            Text(
              endpoint.isLocal ? 'Local' : 'Remote',
              style: TextStyle(
                color: Colors.grey[600],
                fontSize: 12,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildNetworkLogsTab() {
    return FutureBuilder<List<NetworkLogEntry>>(
      future: NetworkLogStorage.getLogs(limit: 100),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        if (snapshot.hasError) {
          return Center(
            child: Text('Error loading logs: ${snapshot.error}'),
          );
        }

        final logs = snapshot.data ?? [];

        if (logs.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.description, size: 64, color: Colors.grey),
                const SizedBox(height: 16),
                const Text(
                  'No network logs',
                  style: TextStyle(fontSize: 18, color: Colors.grey),
                ),
                const SizedBox(height: 8),
                ElevatedButton.icon(
                  onPressed: () async {
                    await NetworkLogStorage.clearLogs();
                    setState(() {});
                  },
                  icon: const Icon(Icons.delete_outline),
                  label: const Text('Clear Logs'),
                ),
              ],
            ),
          );
        }

        return Column(
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              color: Colors.grey[100],
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Total logs: ${logs.length}',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  ElevatedButton.icon(
                    onPressed: () async {
                      final confirmed = await showDialog<bool>(
                        context: context,
                        builder: (context) => AlertDialog(
                          title: const Text('Clear Logs'),
                          content: const Text('Are you sure you want to clear all network logs?'),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(context, false),
                              child: const Text('Cancel'),
                            ),
                            TextButton(
                              onPressed: () => Navigator.pop(context, true),
                              child: const Text('Clear', style: TextStyle(color: Colors.red)),
                            ),
                          ],
                        ),
                      );
                      if (confirmed == true) {
                        await NetworkLogStorage.clearLogs();
                        setState(() {});
                      }
                    },
                    icon: const Icon(Icons.delete_outline),
                    label: const Text('Clear Logs'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView.builder(
                itemCount: logs.length,
                itemBuilder: (context, index) {
                  final log = logs[index];
                  return _buildLogCard(log);
                },
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildLogCard(NetworkLogEntry log) {
    final isSuccess = log.statusCode != null && log.statusCode! >= 200 && log.statusCode! < 300;
    final isError = log.error != null || (log.statusCode != null && log.statusCode! >= 400);

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: ExpansionTile(
        leading: Icon(
          isSuccess ? Icons.check_circle : isError ? Icons.error : Icons.info,
          color: isSuccess ? Colors.green : isError ? Colors.red : Colors.blue,
        ),
        title: Text(
          '${log.method} ${log.url}',
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${_formatDateTime(log.timestamp)}'),
            if (log.statusCode != null)
              Text('Status: ${log.statusCode} ${log.statusMessage ?? ''}'),
            if (log.duration != null)
              Text('Duration: ${log.duration!.inMilliseconds}ms'),
            if (log.endpointId.isNotEmpty)
              Text('Endpoint: ${log.endpointId}'),
          ],
        ),
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (log.requestHeaders != null && log.requestHeaders!.isNotEmpty) ...[
                  const Text(
                    'Request Headers:',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    log.requestHeaders!.toString(),
                    style: const TextStyle(fontSize: 12, fontFamily: 'monospace'),
                  ),
                  const SizedBox(height: 12),
                ],
                if (log.requestBody != null) ...[
                  const Text(
                    'Request Body:',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    log.requestBody.toString(),
                    style: const TextStyle(fontSize: 12, fontFamily: 'monospace'),
                  ),
                  const SizedBox(height: 12),
                ],
                if (log.responseHeaders != null && log.responseHeaders!.isNotEmpty) ...[
                  const Text(
                    'Response Headers:',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    log.responseHeaders!.toString(),
                    style: const TextStyle(fontSize: 12, fontFamily: 'monospace'),
                  ),
                  const SizedBox(height: 12),
                ],
                if (log.responseBody != null) ...[
                  const Text(
                    'Response Body:',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    log.responseBody.toString(),
                    style: const TextStyle(fontSize: 12, fontFamily: 'monospace'),
                  ),
                  const SizedBox(height: 12),
                ],
                if (log.error != null) ...[
                  const Text(
                    'Error:',
                    style: TextStyle(fontWeight: FontWeight.bold, color: Colors.red),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    log.error!,
                    style: const TextStyle(fontSize: 12, fontFamily: 'monospace', color: Colors.red),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _formatDateTime(DateTime dateTime) {
    return '${dateTime.year}-${dateTime.month.toString().padLeft(2, '0')}-${dateTime.day.toString().padLeft(2, '0')} '
        '${dateTime.hour.toString().padLeft(2, '0')}:${dateTime.minute.toString().padLeft(2, '0')}:${dateTime.second.toString().padLeft(2, '0')}';
  }
}
