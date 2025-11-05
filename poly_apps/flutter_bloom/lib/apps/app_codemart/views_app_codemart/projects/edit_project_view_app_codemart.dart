import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../localization_app_codemart/localization_keys_app_codemart.dart';
import '../../main_app_codemart.dart';
import '../../models_app_codemart/codemart_enums.dart';
import '../../models_app_codemart/codemart_types.dart';
import '../../router_app_codemart/router_app_codemart.dart';
import '../../services_app_codemart/project_api_service_app_codemart.dart';

class EditProjectViewAppCodemart extends StatefulWidget {
  final int projectId;

  const EditProjectViewAppCodemart({
    super.key,
    required this.projectId,
  });

  @override
  State<EditProjectViewAppCodemart> createState() => _EditProjectViewAppCodemartState();
}

class _EditProjectViewAppCodemartState extends State<EditProjectViewAppCodemart> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _budgetController = TextEditingController();

  Project? _project;
  bool _isLoading = true;
  bool _isSaving = false;
  String? _errorMessage;
  ProjectStatus? _status;

  @override
  void initState() {
    super.initState();
    _loadProject();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _budgetController.dispose();
    super.dispose();
  }

  Future<void> _loadProject() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final projectService = context.read<ProjectApiServiceAppCodemart>();
      final response = await projectService.getProjectDetails(widget.projectId);

      if (mounted) {
        if (response.success && response.data != null) {
          final project = response.data!;
          setState(() {
            _project = project;
            _titleController.text = project.title;
            _descriptionController.text = project.description;
            _budgetController.text = project.budget.toString();
            _status = project.status;
            _isLoading = false;
          });
        } else {
          setState(() {
            _errorMessage = response.message ?? 'Failed to load project';
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

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);

    try {
      final projectService = context.read<ProjectApiServiceAppCodemart>();
      final response = await projectService.updateProject(
        projectId: widget.projectId,
        title: _titleController.text.trim(),
        description: _descriptionController.text.trim(),
        budget: double.parse(_budgetController.text),
        status: _status?.name,
      );

      if (!mounted) return;

      if (response.success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(context.tr(LocalizationKeysAppCodemart.codemartSuccess)),
            backgroundColor: Colors.green,
          ),
        );
        RouterAppCodemart.goToProjectDetails(context, widget.projectId);
      } else {
        _showError(response.message ?? 'Failed to update project');
      }
    } catch (e) {
      _showError('Error: $e');
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
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
        title: Text(context.tr(LocalizationKeysAppCodemart.codemartEdit)),
        actions: [
          if (!_isLoading && _project != null)
            IconButton(
              icon: const Icon(Icons.delete, color: Colors.red),
              onPressed: () {
                // TODO: Show delete confirmation dialog
              },
            ),
        ],
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
                        onPressed: _loadProject,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : Form(
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

                      // Status
                      if (_status != null)
                        DropdownButtonFormField<ProjectStatus>(
                          value: _status,
                          decoration: InputDecoration(
                            labelText: context.tr(LocalizationKeysAppCodemart.codemartProjectStatus),
                            prefixIcon: const Icon(Icons.info),
                          ),
                          items: ProjectStatus.values.map((type) {
                            return DropdownMenuItem(
                              value: type,
                              child: Text(type.name),
                            );
                          }).toList(),
                          onChanged: (value) {
                            if (value != null) {
                              setState(() => _status = value);
                            }
                          },
                        ),
                      const SizedBox(height: 32),

                      // Save button
                      FilledButton(
                        onPressed: _isSaving ? null : _handleSave,
                        child: _isSaving
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : Text(context.tr(LocalizationKeysAppCodemart.codemartSave)),
                      ),
                    ],
                  ),
                ),
    );
  }
}
