import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../localization_app_codemart/localization_keys_app_codemart.dart';
import '../../main_app_codemart.dart';
import '../../models_app_codemart/codemart_types.dart';
import '../../router_app_codemart/router_app_codemart.dart';
import '../../services_app_codemart/task_api_service_app_codemart.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class SubmitTaskViewAppCodemart extends StatefulWidget {
  final int taskId;

  const SubmitTaskViewAppCodemart({
    super.key,
    required this.taskId,
  });

  @override
  State<SubmitTaskViewAppCodemart> createState() => _SubmitTaskViewAppCodemartState();
}

class _SubmitTaskViewAppCodemartState extends State<SubmitTaskViewAppCodemart> {
  final _formKey = GlobalKey<FormState>();
  final _repositoryUrlController = TextEditingController();
  final _descriptionController = TextEditingController();

  Task? _task;
  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadTask();
  }

  @override
  void dispose() {
    _repositoryUrlController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _loadTask() async {
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

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    try {
      final taskService = context.read<TaskApiServiceAppCodemart>();
      final response = await taskService.submitTask(
        taskId: widget.taskId,
        repositoryUrl: _repositoryUrlController.text.trim(),
        description: _descriptionController.text.trim(),
      );

      if (!mounted) return;

      if (response.success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(LocalizationKeysAppCodemart.codemartSuccess.tr(context)),
            backgroundColor: Colors.green,
          ),
        );
        RouterAppCodemart.goToTaskDetails(context, widget.taskId);
      } else {
        _showError(response.message ?? 'Failed to submit task');
      }
    } catch (e) {
      _showError('Error: $e');
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(LocalizationKeysAppCodemart.codemartSubmitTask.tr(context)),
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
                        onPressed: _loadTask,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _task == null
                  ? const Center(child: Text('Task not found'))
                  : Form(
                      key: _formKey,
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          // Task info card
                          Card(
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    _task!.title,
                                    style: Theme.of(context).textTheme.titleLarge,
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    _task!.description,
                                    style: Theme.of(context).textTheme.bodyMedium,
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 24),

                          Text(
                            'Submit Your Work',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          const SizedBox(height: 16),

                          // Repository URL
                          TextFormField(
                            controller: _repositoryUrlController,
                            decoration: const InputDecoration(
                              labelText: 'Repository URL',
                              hintText: 'https://github.com/username/repo',
                              prefixIcon: Icon(Icons.link),
                              helperText: 'Link to your code repository (GitHub, GitLab, etc.)',
                            ),
                            validator: (value) {
                              if (value == null || value.isEmpty) {
                                return 'Please enter repository URL';
                              }
                              if (!value.startsWith('http://') && !value.startsWith('https://')) {
                                return 'Please enter valid URL';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 16),

                          // Description
                          TextFormField(
                            controller: _descriptionController,
                            maxLines: 6,
                            decoration: InputDecoration(
                              labelText: LocalizationKeysAppCodemart.codemartTaskDescription.tr(context),
                              hintText: 'Describe your implementation, changes made, and any notes for the reviewer...',
                              prefixIcon: const Icon(Icons.description),
                              alignLabelWithHint: true,
                            ),
                            validator: (value) {
                              if (value == null || value.isEmpty) {
                                return 'Please provide description';
                              }
                              if (value.length < 50) {
                                return 'Description should be at least 50 characters';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 24),

                          // Guidelines
                          Card(
                            color: Theme.of(context).colorScheme.surfaceContainerHighest,
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Icon(
                                        Icons.info_outline,
                                        color: Theme.of(context).colorScheme.primary,
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        'Submission Guidelines',
                                        style: Theme.of(context).textTheme.titleMedium,
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  const Text('• Ensure your code is well-documented'),
                                  const Text('• Include a README with setup instructions'),
                                  const Text('• Add tests if applicable'),
                                  const Text('• Follow the project coding standards'),
                                  const Text('• Make sure all requirements are met'),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 32),

                          // Submit button
                          FilledButton(
                            onPressed: _isSubmitting ? null : _handleSubmit,
                            child: _isSubmitting
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  )
                                : Text(LocalizationKeysAppCodemart.codemartSubmit.tr(context)),
                          ),
                        ],
                      ),
                    ),
    );
  }
}
