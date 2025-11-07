import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../localization_app_codemart/localization_keys_app_codemart.dart';
import '../../main_app_codemart.dart';
import '../../models_app_codemart/codemart_types.dart';
import '../../services_app_codemart/task_api_service_app_codemart.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class TaskDetailsViewAppCodemart extends StatefulWidget {
  final int taskId;

  const TaskDetailsViewAppCodemart({
    super.key,
    required this.taskId,
  });

  @override
  State<TaskDetailsViewAppCodemart> createState() => _TaskDetailsViewAppCodemartState();
}

class _TaskDetailsViewAppCodemartState extends State<TaskDetailsViewAppCodemart> {
  Task? _task;
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadTaskDetails();
  }

  Future<void> _loadTaskDetails() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final taskService = context.read<TaskApiServiceAppCodemart>();
      final response = await taskService.getTaskDetails(widget.taskId);

      if (mounted) {
        if (response.success && response.data != null) {
          setState(() {
            _task = response.data;
            _isLoading = false;
          });
        } else {
          setState(() {
            _errorMessage = response.message ?? 'Failed to load task';
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Error: $e';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _handleAcceptTask() async {
    if (_task == null) return;

    try {
      final taskService = context.read<TaskApiServiceAppCodemart>();
      final response = await taskService.acceptTask(_task!.id);

      if (!mounted) return;

      if (response.success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(LocalizationKeysAppCodemart.codemartSuccess.tr(context)),
            backgroundColor: Colors.green,
          ),
        );
        _loadTaskDetails(); // Reload to get updated status
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(response.message ?? 'Failed to accept task'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(LocalizationKeysAppCodemart.codemartTaskTitle.tr(context)),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error, size: 64, color: Colors.red),
                      const SizedBox(height: 16),
                      Text(_errorMessage!),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadTaskDetails,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _task == null
                  ? const Center(child: Text('Task not found'))
                  : SingleChildScrollView(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _task!.title,
                            style: Theme.of(context).textTheme.headlineSmall,
                          ),
                          const SizedBox(height: 16),
                          _InfoRow(
                            icon: Icons.info,
                            label: LocalizationKeysAppCodemart.codemartTaskStatus.tr(context),
                            value: _task!.status.name,
                          ),
                          _InfoRow(
                            icon: Icons.priority_high,
                            label: LocalizationKeysAppCodemart.codemartTaskPriority.tr(context),
                            value: _task!.priority.name,
                          ),
                          _InfoRow(
                            icon: Icons.attach_money,
                            label: LocalizationKeysAppCodemart.codemartProjectBudget.tr(context),
                            value: '\$${_task!.budget.toStringAsFixed(2)}',
                          ),
                          const SizedBox(height: 24),
                          Text(
                            LocalizationKeysAppCodemart.codemartTaskDescription.tr(context),
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 8),
                          Text(_task!.description),
                          const SizedBox(height: 32),
                          if (_task!.status.name == 'open')
                            SizedBox(
                              width: double.infinity,
                              child: FilledButton(
                                onPressed: _handleAcceptTask,
                                child: Text(LocalizationKeysAppCodemart.codemartAcceptTask.tr(context)),
                              ),
                            ),
                        ],
                      ),
                    ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, size: 20),
          const SizedBox(width: 8),
          Text(
            '$label: ',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          Expanded(
            child: Text(
              value,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ],
      ),
    );
  }
}
