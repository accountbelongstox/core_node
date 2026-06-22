import 'dart:io';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:provider/provider.dart';
import '../../localization_app_codemart/localization_keys_app_codemart.dart';
import '../../main_app_codemart.dart';
import '../../models_app_codemart/codemart_enums.dart';
import '../../router_app_codemart/router_app_codemart.dart';
import '../../services_app_codemart/project_api_service_app_codemart.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

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
      _showError(LocalizationKeysAppCodemart.codemartSelectStartEndDates.tr(context));
      return;
    }
    if (_skills.isEmpty) {
      _showError(LocalizationKeysAppCodemart.codemartAddAtLeastOneSkill.tr(context));
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
            content: Text(LocalizationKeysAppCodemart.codemartSuccess.tr(context)),
            backgroundColor: Colors.green,
          ),
        );
        RouterAppCodemart.goToProjectDetails(context, projectId);
      } else {
        _showError(response.message ?? LocalizationKeysAppCodemart.codemartFailedCreateProject.tr(context));
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
        title: Text(LocalizationKeysAppCodemart.codemartAddSkill.tr(context)),
        content: TextField(
          controller: skillController,
          decoration: InputDecoration(
            labelText: LocalizationKeysAppCodemart.codemartSkillName.tr(context),
            hintText: LocalizationKeysAppCodemart.codemartSkillPlaceholder.tr(context),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(LocalizationKeysAppCodemart.codemartCancel.tr(context)),
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
            child: Text(LocalizationKeysAppCodemart.codemartAdd.tr(context)),
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
      _showError(LocalizationKeysAppCodemart.codemartErrorPickingFiles.tr(context));
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
        title: Text(LocalizationKeysAppCodemart.codemartCreateProject.tr(context)),
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
                labelText: LocalizationKeysAppCodemart.codemartProjectTitle.tr(context),
                prefixIcon: const Icon(Icons.title),
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return LocalizationKeysAppCodemart.codemartPleaseEnterProjectTitle.tr(context);
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
                labelText: LocalizationKeysAppCodemart.codemartProjectDescription.tr(context),
                prefixIcon: const Icon(Icons.description),
                alignLabelWithHint: true,
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return LocalizationKeysAppCodemart.codemartPleaseEnterProjectDescription.tr(context);
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
                labelText: LocalizationKeysAppCodemart.codemartProjectBudget.tr(context),
                prefixIcon: const Icon(Icons.attach_money),
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return LocalizationKeysAppCodemart.codemartPleaseEnterBudget.tr(context);
                }
                if (double.tryParse(value) == null) {
                  return LocalizationKeysAppCodemart.codemartPleaseEnterValidNumber.tr(context);
                }
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Budget Type
            DropdownButtonFormField<BudgetType>(
              value: _budgetType,
              decoration: InputDecoration(
                labelText: LocalizationKeysAppCodemart.codemartBudgetType.tr(context),
                prefixIcon: const Icon(Icons.payments),
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
                labelText: LocalizationKeysAppCodemart.codemartProjectComplexity.tr(context),
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
              title: Text(LocalizationKeysAppCodemart.codemartProjectStartDate.tr(context)),
              subtitle: Text(_startDate?.toString().split(' ')[0] ?? LocalizationKeysAppCodemart.codemartNotSelected.tr(context)),
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
              title: Text(LocalizationKeysAppCodemart.codemartProjectEndDate.tr(context)),
              subtitle: Text(_endDate?.toString().split(' ')[0] ?? LocalizationKeysAppCodemart.codemartNotSelected.tr(context)),
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
                  LocalizationKeysAppCodemart.codemartProjectSkills.tr(context),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                FilledButton.icon(
                  onPressed: _showAddSkillDialog,
                  icon: const Icon(Icons.add),
                  label: Text(LocalizationKeysAppCodemart.codemartAddSkill.tr(context)),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_skills.isEmpty)
              Text(LocalizationKeysAppCodemart.codemartNoSkillsAdded.tr(context), style: const TextStyle(color: Colors.grey))
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
                  LocalizationKeysAppCodemart.codemartAttachmentsOptional.tr(context),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                OutlinedButton.icon(
                  onPressed: _pickFiles,
                  icon: const Icon(Icons.attach_file),
                  label: Text(LocalizationKeysAppCodemart.codemartAddFiles.tr(context)),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_attachedFiles.isEmpty)
              Text(
                LocalizationKeysAppCodemart.codemartAttachDocumentsHint.tr(context),
                style: const TextStyle(color: Colors.grey, fontSize: 13),
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
                  : Text(LocalizationKeysAppCodemart.codemartSubmit.tr(context)),
            ),
          ],
        ),
      ),
    );
  }
}
