import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../localization_app_codemart/localization_keys_app_codemart.dart';
import '../../main_app_codemart.dart';
import '../../models_app_codemart/codemart_types.dart';
import '../../router_app_codemart/router_app_codemart.dart';
import '../../services_app_codemart/project_api_service_app_codemart.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class ProposalViewAppCodemart extends StatefulWidget {
  final int projectId;

  const ProposalViewAppCodemart({
    super.key,
    required this.projectId,
  });

  @override
  State<ProposalViewAppCodemart> createState() => _ProposalViewAppCodemartState();
}

class _ProposalViewAppCodemartState extends State<ProposalViewAppCodemart> {
  ProjectProposal? _proposal;
  bool _isLoading = true;
  bool _isAccepting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadProposal();
  }

  Future<void> _loadProposal() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final projectService = context.read<ProjectApiServiceAppCodemart>();
      final response = await projectService.getProjectProposal(widget.projectId);

      if (mounted) {
        if (response.success && response.data != null) {
          setState(() {
            _proposal = response.data;
            _isLoading = false;
          });
        } else {
          setState(() {
            _errorMessage = response.message ?? 'Failed to load proposal';
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

  Future<void> _handleAcceptProposal() async {
    setState(() => _isAccepting = true);

    try {
      final projectService = context.read<ProjectApiServiceAppCodemart>();
      final response = await projectService.acceptProposal(widget.projectId);

      if (!mounted) return;

      if (response.success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(LocalizationKeysAppCodemart.codemartSuccess.tr(context)),
            backgroundColor: Colors.green,
          ),
        );
        RouterAppCodemart.goToProjectDetails(context, widget.projectId);
      } else {
        _showError(response.message ?? 'Failed to accept proposal');
      }
    } catch (e) {
      _showError('Error: $e');
    } finally {
      if (mounted) {
        setState(() => _isAccepting = false);
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
        title: const Text('Project Proposal'),
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
                        onPressed: _loadProposal,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _proposal == null
                  ? const Center(child: Text('No proposal found'))
                  : SingleChildScrollView(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Status badge
                          Chip(
                            label: Text(_proposal!.status.name),
                            backgroundColor: _getStatusColor(_proposal!.status.name),
                          ),
                          const SizedBox(height: 16),

                          // Architect info
                          Card(
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Architect',
                                    style: Theme.of(context).textTheme.titleMedium,
                                  ),
                                  const SizedBox(height: 8),
                                  Row(
                                    children: [
                                      const CircleAvatar(
                                        child: Icon(Icons.person),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              'Architect #${_proposal!.architectId?.toString() ?? 'N/A'}',
                                              style: Theme.of(context).textTheme.titleSmall,
                                            ),
                                            const Text('Professional Architect'),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),

                          // Proposal description
                          Card(
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Proposal Description',
                                    style: Theme.of(context).textTheme.titleMedium,
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    _proposal!.proposalDescription.isNotEmpty
                                        ? _proposal!.proposalDescription
                                        : 'No description provided.',
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),

                          // Estimated timeline
                          Card(
                            child: ListTile(
                              leading: const Icon(Icons.schedule),
                              title: const Text('Estimated Timeline'),
                              subtitle: Text(
                                'Start: ${_formatDate(_proposal!.estimatedStartDate)}\n'
                                'End: ${_formatDate(_proposal!.estimatedEndDate)}\n'
                                'Duration: ${_proposal!.estimatedDuration} days',
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),

                          // Milestones
                          if (_proposal!.milestones.isNotEmpty) ...[
                            Text(
                              'Milestones',
                              style: Theme.of(context).textTheme.titleLarge,
                            ),
                            const SizedBox(height: 8),
                            ...List.generate(_proposal!.milestones.length, (index) {
                              final milestone = _proposal!.milestones[index];
                              return Card(
                                margin: const EdgeInsets.only(bottom: 12),
                                child: ListTile(
                                  leading: CircleAvatar(
                                    child: Text('${index + 1}'),
                                  ),
                                  title: Text(milestone.title),
                                  subtitle: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(milestone.description),
                                      const SizedBox(height: 4),
                                      Text(
                                        'Due: ${_formatDate(milestone.dueDate)}',
                                        style: Theme.of(context).textTheme.bodySmall,
                                      ),
                                    ],
                                  ),
                                  trailing: Text(
                                    '\$${milestone.payment.toStringAsFixed(2)}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16,
                                    ),
                                  ),
                                ),
                              );
                            }),
                          ],
                          const SizedBox(height: 32),

                          // Accept button
                          if (_proposal!.status.name.toLowerCase() == 'pending')
                            SizedBox(
                              width: double.infinity,
                              child: FilledButton(
                                onPressed: _isAccepting
                                    ? null
                                    : () {
                                        showDialog(
                                          context: context,
                                          builder: (context) => AlertDialog(
                                            title: const Text('Accept Proposal'),
                                            content: const Text(
                                              'Are you sure you want to accept this proposal? '
                                              'This will start the project.',
                                            ),
                                            actions: [
                                              TextButton(
                                                onPressed: () => Navigator.pop(context),
                                                child: Text(
                                                  LocalizationKeysAppCodemart.codemartCancel.tr(context),
                                                ),
                                              ),
                                              FilledButton(
                                                onPressed: () {
                                                  Navigator.pop(context);
                                                  _handleAcceptProposal();
                                                },
                                                child: Text(
                                                  LocalizationKeysAppCodemart.codemartConfirm.tr(context),
                                                ),
                                              ),
                                            ],
                                          ),
                                        );
                                      },
                                child: _isAccepting
                                    ? const SizedBox(
                                        height: 20,
                                        width: 20,
                                        child: CircularProgressIndicator(strokeWidth: 2),
                                      )
                                    : const Text('Accept Proposal'),
                              ),
                            ),
                        ],
                      ),
                    ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'pending':
        return Colors.orange.withOpacity(0.2);
      case 'accepted':
        return Colors.green.withOpacity(0.2);
      case 'rejected':
        return Colors.red.withOpacity(0.2);
      default:
        return Colors.grey.withOpacity(0.2);
    }
  }

  String _formatDate(DateTime? date) {
    if (date == null) {
      return 'TBD';
    }

    final year = date.year.toString().padLeft(4, '0');
    final month = date.month.toString().padLeft(2, '0');
    final day = date.day.toString().padLeft(2, '0');
    return '$year-$month-$day';
  }
}
