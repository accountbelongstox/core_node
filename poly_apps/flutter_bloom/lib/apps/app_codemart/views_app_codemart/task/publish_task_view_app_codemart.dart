import 'dart:io';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:provider/provider.dart';
import '../../localization_app_codemart/localization_keys_app_codemart.dart';
import '../../main_app_codemart.dart';
import '../../models_app_codemart/codemart_enums.dart';
import '../../models_app_codemart/codemart_types.dart';
import '../../router_app_codemart/router_app_codemart.dart';
import '../../services_app_codemart/task_api_service_app_codemart.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class PublishTaskViewAppCodemart extends StatefulWidget {
  final int? projectId;

  const PublishTaskViewAppCodemart({
    super.key,
    this.projectId,
  });

  @override
  State<PublishTaskViewAppCodemart> createState() => _PublishTaskViewAppCodemartState();
}

class _PublishTaskViewAppCodemartState extends State<PublishTaskViewAppCodemart> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _budgetController = TextEditingController();
  final _durationController = TextEditingController();

  BudgetType _budgetType = BudgetType.fixed;
  TaskPriority _priority = TaskPriority.medium;
  final Set<String> _selectedSkills = {};
  final List<PlatformFile> _attachedFiles = [];
  bool _isLoading = false;

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _budgetController.dispose();
    _durationController.dispose();
    super.dispose();
  }

  Future<void> _pickFiles() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        allowMultiple: true,
        type: FileType.custom,
        allowedExtensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip'],
      );

      if (result != null) {
        setState(() {
          _attachedFiles.addAll(result.files);
        });
      }
    } catch (e) {
      _showError('Error picking files: $e');
    }
  }

  void _removeFile(int index) {
    setState(() {
      _attachedFiles.removeAt(index);
    });
  }

  Future<void> _handlePublish() async {
    if (!_formKey.currentState!.validate()) return;

    if (_selectedSkills.isEmpty) {
      _showError('Please select at least one skill');
      return;
    }

    setState(() => _isLoading = true);

    try {
      final taskService = context.read<TaskApiServiceAppCodemart>();

      // Prepare task data
      final taskData = {
        'title': _titleController.text.trim(),
        'description': _descriptionController.text.trim(),
        'budgetType': _budgetType.name,
        'budget': double.parse(_budgetController.text),
        'duration': int.parse(_durationController.text),
        'priority': _priority.name,
        'skills': _selectedSkills.toList(),
        if (widget.projectId != null) 'projectId': widget.projectId,
      };

      // Create task
      final response = await taskService.createTask(taskData);

      if (!mounted) return;

      if (response.success && response.data != null) {
        final taskId = response.data['id'];

        // Upload files if any
        if (_attachedFiles.isNotEmpty) {
          for (final file in _attachedFiles) {
            // TODO: Upload file to server
            // await taskService.uploadTaskAttachment(taskId, file);
          }
        }

        _showSuccess('Task published successfully!');
        RouterAppCodemart.goToTaskDetail(context, taskId: taskId);
      } else {
        _showError(response.message ?? 'Failed to publish task');
      }
    } catch (e) {
      _showError('Error publishing task: $e');
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
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

  void _showSuccess(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.green,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Publish Task'),
        actions: [
          TextButton(
            onPressed: _isLoading ? null : _handlePublish,
            child: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Publish'),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Title
            TextFormField(
              controller: _titleController,
              decoration: const InputDecoration(
                labelText: 'Task Title',
                hintText: 'e.g., Build a responsive landing page',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.title),
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Please enter task title';
                }
                if (value.length < 10) {
                  return 'Title must be at least 10 characters';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Description
            TextFormField(
              controller: _descriptionController,
              maxLines: 6,
              decoration: const InputDecoration(
                labelText: 'Task Description',
                hintText: 'Describe the task requirements, deliverables, and expectations...',
                border: OutlineInputBorder(),
                alignLabelWithHint: true,
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Please enter task description';
                }
                if (value.length < 50) {
                  return 'Description must be at least 50 characters';
                }
                return null;
              },
            ),
            const SizedBox(height: 24),

            // Budget section
            Text(
              'Budget',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: SegmentedButton<BudgetType>(
                    segments: const [
                      ButtonSegment(
                        value: BudgetType.fixed,
                        label: Text('Fixed'),
                        icon: Icon(Icons.attach_money),
                      ),
                      ButtonSegment(
                        value: BudgetType.hourly,
                        label: Text('Hourly'),
                        icon: Icon(Icons.schedule),
                      ),
                      ButtonSegment(
                        value: BudgetType.milestone,
                        label: Text('Milestone'),
                        icon: Icon(Icons.flag),
                      ),
                    ],
                    selected: {_budgetType},
                    onSelectionChanged: (Set<BudgetType> newSelection) {
                      setState(() => _budgetType = newSelection.first);
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  flex: 2,
                  child: TextFormField(
                    controller: _budgetController,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: _budgetType == BudgetType.hourly ? 'Hourly Rate (¥)' : 'Budget (¥)',
                      border: const OutlineInputBorder(),
                      prefixIcon: const Icon(Icons.payment),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Required';
                      }
                      if (double.tryParse(value) == null) {
                        return 'Invalid amount';
                      }
                      return null;
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _durationController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Days',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.calendar_today),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Required';
                      }
                      if (int.tryParse(value) == null) {
                        return 'Invalid';
                      }
                      return null;
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Priority
            Text(
              'Priority',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            SegmentedButton<TaskPriority>(
              segments: const [
                ButtonSegment(
                  value: TaskPriority.low,
                  label: Text('Low'),
                  icon: Icon(Icons.low_priority),
                ),
                ButtonSegment(
                  value: TaskPriority.medium,
                  label: Text('Medium'),
                  icon: Icon(Icons.remove),
                ),
                ButtonSegment(
                  value: TaskPriority.high,
                  label: Text('High'),
                  icon: Icon(Icons.priority_high),
                ),
                ButtonSegment(
                  value: TaskPriority.urgent,
                  label: Text('Urgent'),
                  icon: Icon(Icons.warning),
                ),
              ],
              selected: {_priority},
              onSelectionChanged: (Set<TaskPriority> newSelection) {
                setState(() => _priority = newSelection.first);
              },
            ),
            const SizedBox(height: 24),

            // Skills required
            Text(
              'Required Skills',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              'Select skills needed for this task (${_selectedSkills.length} selected)',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 12),
            _buildSkillSelector(),
            const SizedBox(height: 24),

            // File attachments
            Text(
              'Attachments (Optional)',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              'Attach requirements documents, designs, or reference files',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _pickFiles,
              icon: const Icon(Icons.attach_file),
              label: const Text('Add Files'),
            ),
            if (_attachedFiles.isNotEmpty) ...[
              const SizedBox(height: 12),
              _buildFileList(),
            ],
            const SizedBox(height: 32),

            // Submit button
            FilledButton(
              onPressed: _isLoading ? null : _handlePublish,
              child: _isLoading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Publish Task'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSkillSelector() {
    final skills = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'PHP', 'C#', 'Go', 'Rust',
      'React', 'Vue', 'Angular', 'Flutter', 'React Native',
      'Node.js', 'Django', 'Laravel', 'Spring Boot',
      'MySQL', 'PostgreSQL', 'MongoDB', 'Redis',
      'AWS', 'Azure', 'Docker', 'Kubernetes',
      'UI/UX Design', 'Mobile Development', 'Web Development', 'DevOps',
    ];

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: skills.map((skill) {
        final isSelected = _selectedSkills.contains(skill);
        return FilterChip(
          label: Text(skill),
          selected: isSelected,
          onSelected: (selected) {
            setState(() {
              if (selected) {
                _selectedSkills.add(skill);
              } else {
                _selectedSkills.remove(skill);
              }
            });
          },
        );
      }).toList(),
    );
  }

  Widget _buildFileList() {
    return Card(
      child: Column(
        children: [
          ...List.generate(_attachedFiles.length, (index) {
            final file = _attachedFiles[index];
            return ListTile(
              leading: Icon(_getFileIcon(file.extension)),
              title: Text(file.name),
              subtitle: Text(_formatFileSize(file.size)),
              trailing: IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => _removeFile(index),
              ),
            );
          }),
        ],
      ),
    );
  }

  IconData _getFileIcon(String? extension) {
    switch (extension?.toLowerCase()) {
      case 'pdf':
        return Icons.picture_as_pdf;
      case 'doc':
      case 'docx':
        return Icons.description;
      case 'xls':
      case 'xlsx':
        return Icons.table_chart;
      case 'zip':
        return Icons.folder_zip;
      default:
        return Icons.insert_drive_file;
    }
  }

  String _formatFileSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}
