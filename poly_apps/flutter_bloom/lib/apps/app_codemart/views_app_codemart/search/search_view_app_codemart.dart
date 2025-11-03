import 'package:flutter/material.dart';
import '../../router_app_codemart/router_app_codemart.dart';

class SearchViewAppCodemart extends StatefulWidget {
  final String? initialQuery;

  const SearchViewAppCodemart({
    super.key,
    this.initialQuery,
  });

  @override
  State<SearchViewAppCodemart> createState() => _SearchViewAppCodemartState();
}

class _SearchViewAppCodemartState extends State<SearchViewAppCodemart>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _searchController = TextEditingController();
  bool _isSearching = false;

  // Mock search results
  final List<Map<String, dynamic>> _projectResults = [];
  final List<Map<String, dynamic>> _taskResults = [];
  final List<Map<String, dynamic>> _userResults = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    if (widget.initialQuery != null) {
      _searchController.text = widget.initialQuery!;
      _performSearch();
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _performSearch() async {
    if (_searchController.text.trim().isEmpty) return;

    setState(() => _isSearching = true);

    // TODO: Implement actual search API calls
    await Future.delayed(const Duration(seconds: 1));

    // Mock data
    setState(() {
      _projectResults.clear();
      _taskResults.clear();
      _userResults.clear();

      if (_searchController.text.toLowerCase().contains('flutter')) {
        _projectResults.addAll([
          {'id': 1, 'title': 'Flutter App Development', 'description': 'Build a mobile app'},
          {'id': 2, 'title': 'Flutter UI Library', 'description': 'Create reusable widgets'},
        ]);
        _taskResults.addAll([
          {'id': 1, 'title': 'Implement Flutter animation', 'description': 'Add smooth transitions'},
          {'id': 2, 'title': 'Flutter testing', 'description': 'Write unit tests'},
        ]);
      }

      _isSearching = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _searchController,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Search projects, tasks, users...',
            border: InputBorder.none,
            hintStyle: TextStyle(color: Colors.grey),
          ),
          style: const TextStyle(fontSize: 18),
          onSubmitted: (_) => _performSearch(),
        ),
        actions: [
          if (_searchController.text.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.clear),
              onPressed: () {
                setState(() {
                  _searchController.clear();
                  _projectResults.clear();
                  _taskResults.clear();
                  _userResults.clear();
                });
              },
            ),
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: _performSearch,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            Tab(text: 'Projects (${_projectResults.length})'),
            Tab(text: 'Tasks (${_taskResults.length})'),
            Tab(text: 'Users (${_userResults.length})'),
          ],
        ),
      ),
      body: _isSearching
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildProjectResults(),
                _buildTaskResults(),
                _buildUserResults(),
              ],
            ),
    );
  }

  Widget _buildProjectResults() {
    if (_projectResults.isEmpty) {
      return _buildEmptyState('No projects found');
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _projectResults.length,
      itemBuilder: (context, index) {
        final project = _projectResults[index];
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: ListTile(
            leading: const CircleAvatar(
              child: Icon(Icons.folder),
            ),
            title: Text(project['title']),
            subtitle: Text(project['description']),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => RouterAppCodemart.goToProjectDetails(context, project['id']),
          ),
        );
      },
    );
  }

  Widget _buildTaskResults() {
    if (_taskResults.isEmpty) {
      return _buildEmptyState('No tasks found');
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _taskResults.length,
      itemBuilder: (context, index) {
        final task = _taskResults[index];
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: ListTile(
            leading: const CircleAvatar(
              child: Icon(Icons.assignment),
            ),
            title: Text(task['title']),
            subtitle: Text(task['description']),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => RouterAppCodemart.goToTaskDetails(context, task['id']),
          ),
        );
      },
    );
  }

  Widget _buildUserResults() {
    if (_userResults.isEmpty) {
      return _buildEmptyState('No users found');
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _userResults.length,
      itemBuilder: (context, index) {
        final user = _userResults[index];
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: ListTile(
            leading: const CircleAvatar(
              child: Icon(Icons.person),
            ),
            title: Text(user['name']),
            subtitle: Text(user['role']),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              // TODO: Navigate to user profile
            },
          ),
        );
      },
    );
  }

  Widget _buildEmptyState(String message) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.search_off,
            size: 64,
            color: Colors.grey.shade400,
          ),
          const SizedBox(height: 16),
          Text(
            message,
            style: TextStyle(
              color: Colors.grey.shade600,
              fontSize: 16,
            ),
          ),
          if (_searchController.text.isEmpty) ...[
            const SizedBox(height: 8),
            Text(
              'Enter a search query to begin',
              style: TextStyle(
                color: Colors.grey.shade500,
                fontSize: 14,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
