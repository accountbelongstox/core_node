import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../localization_app_codemart/localization_keys_app_codemart.dart';
import '../../main_app_codemart.dart';
import '../../models_app_codemart/codemart_types.dart';
import '../../router_app_codemart/router_app_codemart.dart';
import '../../services_app_codemart/task_api_service_app_codemart.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class MyTasksViewAppCodemart extends StatefulWidget {
  const MyTasksViewAppCodemart({super.key});

  @override
  State<MyTasksViewAppCodemart> createState() => _MyTasksViewAppCodemartState();
}

class _MyTasksViewAppCodemartState extends State<MyTasksViewAppCodemart>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final Map<String, List<Task>> _tasksByStatus = {
    'in_progress': [],
    'pending_review': [],
    'completed': [],
  };
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadMyTasks();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadMyTasks() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final taskService = context.read<TaskApiServiceAppCodemart>();

      // Load tasks for each status
      for (final status in _tasksByStatus.keys) {
        final response = await taskService.getTasks(
          status: status,
          page: 1,
          pageSize: 50,
        );

        if (response.success && response.data != null) {
          _tasksByStatus[status] = response.data!.items;
        }
      }

      if (mounted) {
        setState(() => _isLoading = false);
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
        title: Text(LocalizationKeysAppCodemart.codemartTasks.tr(context)),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'In Progress'),
            Tab(text: 'Review'),
            Tab(text: 'Completed'),
          ],
        ),
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
                        onPressed: _loadMyTasks,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _buildTaskList(_tasksByStatus['in_progress']!),
                    _buildTaskList(_tasksByStatus['pending_review']!),
                    _buildTaskList(_tasksByStatus['completed']!),
                  ],
                ),
    );
  }

  Widget _buildTaskList(List<Task> tasks) {
    if (tasks.isEmpty) {
      return Center(
        child: Text(LocalizationKeysAppCodemart.codemartNoData.tr(context)),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadMyTasks,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: tasks.length,
        itemBuilder: (context, index) {
          final task = tasks[index];
          return Card(
            margin: const EdgeInsets.only(bottom: 16),
            child: InkWell(
              onTap: () => RouterAppCodemart.goToTaskDetails(context, task.id),
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      task.title,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      task.description,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        const Icon(Icons.attach_money, size: 16),
                        const SizedBox(width: 4),
                        Text('\$${task.budget.toStringAsFixed(2)}'),
                        const Spacer(),
                        Chip(
                          label: Text(task.status.name),
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
