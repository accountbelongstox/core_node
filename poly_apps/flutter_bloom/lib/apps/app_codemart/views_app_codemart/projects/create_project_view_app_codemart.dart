import 'dart:io';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:provider/provider.dart';
import '../../localization_app_codemart/localization_keys_app_codemart.dart';
import '../../main_app_codemart.dart';
import '../../models_app_codemart/codemart_enums.dart';
import '../../router_app_codemart/router_app_codemart.dart';
import '../../services_app_codemart/project_api_service_app_codemart.dart';

class CreateProjectViewAppCodemart extends StatefulWidget {
  const CreateProjectViewAppCodemart({super.key});

  @override
  State<CreateProjectViewAppCodemart> createState() => _CreateProjectViewAppCodemartState();
}

class _CreateProjectViewAppCodemartState extends State<CreateProjectViewAppCodemart> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _budgetController = TextEditingController();

  ProjectComplexityType _complexity = ProjectComplexityType.medium;
  BudgetType _budgetType = BudgetType.fixed;
  DateTime? _startDate;
  DateTime? _endDate;
  final List<String> _skills = [];
  final List<PlatformFile> _attachedFiles = [];
  bool _isLoading = false;

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _budgetController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_startDate == null || _endDate == null) {
      _showError('Please select start and end dates');
      return;
    }
    if (_skills.isEmpty) {
      _showError('Please add at least one skill');
      return;
    }

    setState(() => _isLoading = true);

    try {
      final projectService = context.read<ProjectApiServiceAppCodemart>();
      final response = await projectService.createProject(
        title: _titleController.text.trim(),
        description: _descriptionController.text.trim(),
        complexity: _complexity.name,
        budget: double.parse(_budgetController.text),
        budgetType: _budgetType.name,
        startDate: _startDate!.toIso8601String(),
        endDate: _endDate!.toIso8601String(),
        skills: _skills,
      );

      if (!mounted) return;

      if (response.success && response.data != null) {
        final projectId = response.data!.id;

        // Upload attached files if any
        if (_attachedFiles.isNotEmpty) {
          for (final file in _attachedFiles) {
            // TODO: Upload file to server
            // await projectService.uploadProjectAttachment(projectId, file);
          }
        }

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(context.tr(LocalizationKeysAppCodemart.codemartSuccess)),
            backgroundColor: Colors.green,
          ),
        );
        RouterAppCodemart.goToProjectDetails(context, projectId);
      } else {
        _showError(response.message ?? 'Failed to create project');
      }
    } catch (e) {
      _showError('Error: $e');
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

  Future<void> _selectDate(BuildContext context, bool isStartDate) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
    );

    if (picked != null) {
      setState(() {
        if (isStartDate) {
          _startDate = picked;
        } else {
          _endDate = picked;
        }
      });
    }
  }

  void _showAddSkillDialog() {
    final skillController = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add Skill'),
        content: TextField(
          controller: skillController,
          decoration: const InputDecoration(
            labelText: 'Skill name',
            hintText: 'e.g., Flutter, Python, Node.js',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(context.tr(LocalizationKeysAppCodemart.codemartCancel)),
          ),
          FilledButton(
            onPressed: () {
              if (skillController.text.trim().isNotEmpty) {
                setState(() {
                  _skills.add(skillController.text.trim());
                });
                Navigator.pop(context);
              }
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }

  Future<void> _pickFiles() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        allowMultiple: true,
        type: FileType.custom,
        allowedExtensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip', 'rar'],
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
      case 'rar':
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr(LocalizationKeysAppCodemart.codemartCreateProject)),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Title
            TextFormField(
              controller: _titleController,
              decoration: InputDecoration(
                labelText: context.tr(LocalizationKeysAppCodemart.codemartProjectTitle),
                prefixIcon: const Icon(Icons.title),
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Please enter project title';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Description
            TextFormField(
              controller: _descriptionController,
              maxLines: 4,
              decoration: InputDecoration(
                labelText: context.tr(LocalizationKeysAppCodemart.codemartProjectDescription),
                prefixIcon: const Icon(Icons.description),
                alignLabelWithHint: true,
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Please enter project description';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Budget
            TextFormField(
              controller: _budgetController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: context.tr(LocalizationKeysAppCodemart.codemartProjectBudget),
                prefixIcon: const Icon(Icons.attach_money),
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Please enter budget';
                }
                if (double.tryParse(value) == null) {
                  return 'Please enter valid number';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Budget Type
            DropdownButtonFormField<BudgetType>(
              value: _budgetType,
              decoration: const InputDecoration(
                labelText: 'Budget Type',
                prefixIcon: Icon(Icons.payments),
              ),
              items: BudgetType.values.map((type) {
                return DropdownMenuItem(
                  value: type,
                  child: Text(type.name),
                );
              }).toList(),
              onChanged: (value) {
                if (value != null) {
                  setState(() => _budgetType = value);
                }
              },
            ),
            const SizedBox(height: 16),

            // Complexity
            DropdownButtonFormField<ProjectComplexityType>(
              value: _complexity,
              decoration: InputDecoration(
                labelText: context.tr(LocalizationKeysAppCodemart.codemartProjectComplexity),
                prefixIcon: const Icon(Icons.layers),
              ),
              items: ProjectComplexityType.values.map((type) {
                return DropdownMenuItem(
                  value: type,
                  child: Text(type.name),
                );
              }).toList(),
              onChanged: (value) {
                if (value != null) {
                  setState(() => _complexity = value);
                }
              },
            ),
            const SizedBox(height: 16),

            // Start Date
            ListTile(
              leading: const Icon(Icons.calendar_today),
              title: Text(context.tr(LocalizationKeysAppCodemart.codemartProjectStartDate)),
              subtitle: Text(_startDate?.toString().split(' ')[0] ?? 'Not selected'),
              onTap: () => _selectDate(context, true),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
                side: BorderSide(color: Theme.of(context).dividerColor),
              ),
            ),
            const SizedBox(height: 16),

            // End Date
            ListTile(
              leading: const Icon(Icons.event),
              title: Text(context.tr(LocalizationKeysAppCodemart.codemartProjectEndDate)),
              subtitle: Text(_endDate?.toString().split(' ')[0] ?? 'Not selected'),
              onTap: () => _selectDate(context, false),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
                side: BorderSide(color: Theme.of(context).dividerColor),
              ),
            ),
            const SizedBox(height: 24),

            // Skills
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  context.tr(LocalizationKeysAppCodemart.codemartProjectSkills),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                FilledButton.icon(
                  onPressed: _showAddSkillDialog,
                  icon: const Icon(Icons.add),
                  label: const Text('Add Skill'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_skills.isEmpty)
              const Text('No skills added yet', style: TextStyle(color: Colors.grey))
            else
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _skills.map((skill) {
                  return Chip(
                    label: Text(skill),
                    onDeleted: () {
                      setState(() => _skills.remove(skill));
                    },
                  );
                }).toList(),
              ),
            const SizedBox(height: 32),

            // File attachments
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Attachments (Optional)',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                OutlinedButton.icon(
                  onPressed: _pickFiles,
                  icon: const Icon(Icons.attach_file),
                  label: const Text('Add Files'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_attachedFiles.isEmpty)
              const Text(
                'Attach project documents, designs, or specifications (PDF, DOC, XLS, etc.)',
                style: TextStyle(color: Colors.grey, fontSize: 13),
              )
            else
              Card(
                child: Column(
                  children: List.generate(_attachedFiles.length, (index) {
                    final file = _attachedFiles[index];
                    return ListTile(
                      dense: true,
                      leading: Icon(_getFileIcon(file.extension)),
                      title: Text(
                        file.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      subtitle: Text(_formatFileSize(file.size)),
                      trailing: IconButton(
                        icon: const Icon(Icons.close, size: 20),
                        onPressed: () => _removeFile(index),
                      ),
                    );
                  }),
                ),
              ),
            const SizedBox(height: 32),

            // Submit button
            FilledButton(
              onPressed: _isLoading ? null : _handleSubmit,
              child: _isLoading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(context.tr(LocalizationKeysAppCodemart.codemartSubmit)),
            ),
          ],
        ),
      ),
    );
  }
}
