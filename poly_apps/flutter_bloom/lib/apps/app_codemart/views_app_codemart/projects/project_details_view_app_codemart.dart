import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../localization_app_codemart/localization_keys_app_codemart.dart';
import '../../main_app_codemart.dart';
import '../../models_app_codemart/codemart_types.dart';
import '../../services_app_codemart/project_api_service_app_codemart.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class ProjectDetailsViewAppCodemart extends StatefulWidget {
  final int projectId;

  const ProjectDetailsViewAppCodemart({
    super.key,
    required this.projectId,
  });

  @override
  State<ProjectDetailsViewAppCodemart> createState() => _ProjectDetailsViewAppCodemartState();
}

class _ProjectDetailsViewAppCodemartState extends State<ProjectDetailsViewAppCodemart> {
  Project? _project;
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadProjectDetails();
  }

  Future<void> _loadProjectDetails() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final projectService = context.read<ProjectApiServiceAppCodemart>();
      final response = await projectService.getProjectDetails(widget.projectId);

      if (mounted) {
        if (response.success && response.data != null) {
          setState(() {
            _project = response.data;
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(LocalizationKeysAppCodemart.codemartProjectTitle.tr(context)),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit),
            onPressed: _project != null
                ? () {
                    // TODO: Navigate to edit project
                  }
                : null,
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
                        onPressed: _loadProjectDetails,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _project == null
                  ? const Center(child: Text('Project not found'))
                  : SingleChildScrollView(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _project!.title,
                            style: Theme.of(context).textTheme.headlineSmall,
                          ),
                          const SizedBox(height: 16),

                          // Status and complexity
                          Row(
                            children: [
                              _InfoChip(
                                icon: Icons.info,
                                label: _project!.status.name,
                              ),
                              const SizedBox(width: 8),
                              _InfoChip(
                                icon: Icons.code,
                                label: _project!.complexity.name,
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),

                          // Budget
                          _InfoRow(
                            icon: Icons.attach_money,
                            label: LocalizationKeysAppCodemart.codemartProjectBudget.tr(context),
                            value: '\$${_project!.budget.toStringAsFixed(2)} (${_project!.budgetType})',
                          ),

                          // Dates
                          _InfoRow(
                            icon: Icons.calendar_today,
                            label: LocalizationKeysAppCodemart.codemartProjectStartDate.tr(context),
                            value: _project!.startDate.toString().split(' ')[0],
                          ),
                          _InfoRow(
                            icon: Icons.event,
                            label: LocalizationKeysAppCodemart.codemartProjectEndDate.tr(context),
                            value: _project!.endDate.toString().split(' ')[0],
                          ),

                          const SizedBox(height: 24),

                          // Description
                          Text(
                            LocalizationKeysAppCodemart.codemartProjectDescription.tr(context),
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 8),
                          Text(_project!.description),

                          const SizedBox(height: 24),

                          // Skills
                          Text(
                            LocalizationKeysAppCodemart.codemartProjectSkills.tr(context),
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: _project!.skills.map((skill) {
                              return Chip(label: Text(skill));
                            }).toList(),
                          ),

                          // Languages
                          if (_project!.languages.isNotEmpty) ...[
                            const SizedBox(height: 16),
                            Text(
                              'Languages',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: _project!.languages.map((lang) {
                                return Chip(label: Text(lang.name));
                              }).toList(),
                            ),
                          ],

                          // Frameworks
                          if (_project!.frameworks.isNotEmpty) ...[
                            const SizedBox(height: 16),
                            Text(
                              'Frameworks',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: _project!.frameworks.map((framework) {
                                return Chip(label: Text(framework.name));
                              }).toList(),
                            ),
                          ],
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

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _InfoChip({
    required this.icon,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Chip(
      avatar: Icon(icon, size: 16),
      label: Text(label),
    );
  }
}
