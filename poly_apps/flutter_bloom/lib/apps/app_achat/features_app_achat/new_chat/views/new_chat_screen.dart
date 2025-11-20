// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

// MODIFIED BY: AI Assistant for new_chat refactoring
// NOTE FOR OTHER AIs: This screen has been refactored to use new architecture
// Please avoid modifying this file during the new_chat refactoring process

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/widgets/custom_app_bar.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_achat/router_app_achat/router_app_achat.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/new_chat/controllers/new_chat_controller.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/new_chat/models/new_chat_contact_model.dart';

class NewChatScreen extends StatefulWidget {
  const NewChatScreen({super.key});

  @override
  State<NewChatScreen> createState() => _NewChatScreenState();
}

class _NewChatScreenState extends State<NewChatScreen> {
  final TextEditingController _searchController = TextEditingController();
  late NewChatController _controller;

  @override
  void initState() {
    super.initState();
    _controller = NewChatController();
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: _controller,
      child: Consumer<NewChatController>(
        builder: (context, controller, child) {
          return Scaffold(
            appBar: CustomAppBar(
              title: 'achat_new_chat_title'.tr(context),
              showBackButton: true,
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: Text(
                    'achat_cancel'.tr(context),
                    style: const TextStyle(color: Colors.white, fontSize: 16),
                  ),
                ),
              ],
            ),
            body: Column(
              children: [
                _buildSearchBar(context, controller),
                _buildDepartmentFilter(context, controller),
                Expanded(
                  child: controller.isLoading
                      ? const Center(child: CircularProgressIndicator())
                      : controller.errorMessage != null
                          ? _buildErrorView(context, controller)
                          : RefreshIndicator(
                              onRefresh: controller.refresh,
                              child: controller.hasFilteredContacts
                                  ? ListView.separated(
                                      itemCount: controller.filteredContacts.length,
                                      separatorBuilder: (context, index) => const Divider(height: 1),
                                      itemBuilder: (context, index) => _buildContactItem(
                                        context,
                                        controller,
                                        controller.filteredContacts[index],
                                        index,
                                      ),
                                    )
                                  : _buildEmptyState(context, controller),
                            ),
                ),
              ],
            ),
            floatingActionButton: FloatingActionButton(
              onPressed: () => _showAddContactOptions(context),
              child: const Icon(Icons.add),
            ),
          );
        },
      ),
    );
  }

  Widget _buildSearchBar(BuildContext context, NewChatController controller) {
    return Padding(
      padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
      child: TextField(
        controller: _searchController,
        onChanged: controller.searchContacts,
        decoration: InputDecoration(
          hintText: 'achat_search_contacts'.tr(context),
          prefixIcon: const Icon(Icons.search),
          suffixIcon: controller.searchQuery.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear),
                  onPressed: () {
                    _searchController.clear();
                    controller.clearSearch();
                  },
                )
              : null,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusDefault),
          ),
          filled: true,
          fillColor: Colors.grey.shade100,
        ),
      ),
    );
  }

  Widget _buildDepartmentFilter(BuildContext context, NewChatController controller) {
    final departments = controller.getAllDepartments();
    if (departments.isEmpty) return const SizedBox.shrink();

    return Container(
      height: 50,
      padding: const EdgeInsets.symmetric(horizontal: ThemeDimensions.paddingSizeDefault),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: departments.length + 1,
        itemBuilder: (context, index) {
          if (index == 0) {
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: FilterChip(
                label: Text('achat_all_departments'.tr(context)),
                selected: controller.searchQuery.isEmpty,
                onSelected: (selected) {
                  if (selected) {
                    _searchController.clear();
                    controller.clearSearch();
                  }
                },
              ),
            );
          }

          final department = departments[index - 1];
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilterChip(
              label: Text(department),
              selected: controller.searchQuery == department,
              onSelected: (selected) {
                if (selected) {
                  _searchController.text = department;
                  controller.searchContacts(department);
                }
              },
            ),
          );
        },
      ),
    );
  }

  Widget _buildErrorView(BuildContext context, NewChatController controller) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            Icons.error_outline,
            size: 64,
            color: Colors.red,
          ),
          const SizedBox(height: 16),
          Text(
            controller.errorMessage ?? 'Unknown error',
            style: const TextStyle(color: Colors.red),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () {
              controller.clearError();
              controller.refresh();
            },
            child: Text('achat_retry'.tr(context)),
          ),
        ],
      ),
    );
  }

  Widget _buildContactItem(
    BuildContext context,
    NewChatController controller,
    NewChatContactModel contact,
    int index,
  ) {
    final avatarColor = controller.getAvatarColor(index);

    return ListTile(
      leading: Stack(
        children: [
          CircleAvatar(
            backgroundColor: avatarColor,
            backgroundImage: contact.avatarUrl != null ? NetworkImage(contact.avatarUrl!) : null,
            child: contact.avatarUrl == null
                ? Text(
                    contact.avatarText,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                  )
                : null,
          ),
          if (contact.isOnline)
            Positioned(
              right: 0,
              bottom: 0,
              child: Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: Colors.green,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2),
                ),
              ),
            ),
        ],
      ),
      title: Row(
        children: [
          Expanded(
            child: Text(
              contact.displayName,
              style: const TextStyle(fontWeight: FontWeight.w500),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (contact.isFavorite) const Icon(Icons.star, size: 16, color: Colors.amber),
        ],
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${contact.displayRole} • ${contact.displayDepartment}',
            style: const TextStyle(fontSize: 12),
            overflow: TextOverflow.ellipsis,
          ),
          Text(
            contact.statusText,
            style: TextStyle(
              fontSize: 11,
              color: contact.isOnline ? Colors.green : Colors.grey,
            ),
          ),
        ],
      ),
      trailing: const Icon(Icons.chat_bubble_outline),
      onTap: () => _onContactTap(context, contact),
    );
  }

  Widget _buildEmptyState(BuildContext context, NewChatController controller) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.people_outline,
            size: 64,
            color: Colors.grey[400],
          ),
          const SizedBox(height: 16),
          Text(
            controller.searchQuery.isNotEmpty
                ? 'achat_no_contacts_found'.tr(context)
                : 'achat_no_contacts_available'.tr(context),
            style: TextStyle(
              fontSize: 16,
              color: Colors.grey[600],
            ),
          ),
          if (controller.searchQuery.isEmpty) ...[
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: () => _showAddContactOptions(context),
              icon: const Icon(Icons.person_add),
              label: Text('achat_add_contacts'.tr(context)),
            ),
          ],
        ],
      ),
    );
  }

  void _onContactTap(BuildContext context, NewChatContactModel contact) {
    // Navigate to chat with this contact
    context.go('${RouterAppAChat.chatDetails}/${contact.id}');
  }

  void _showAddContactOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (context) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: const Icon(Icons.person_add),
            title: Text('achat_add_contact'.tr(context)),
            onTap: () {
              Navigator.pop(context);
              context.go(RouterAppAChat.addContacts);
            },
          ),
          ListTile(
            leading: const Icon(Icons.qr_code_scanner),
            title: Text('achat_scan_qr_code'.tr(context)),
            onTap: () {
              Navigator.pop(context);
              // TODO: Navigate to QR scanner
            },
          ),
          ListTile(
            leading: const Icon(Icons.group_add),
            title: Text('achat_create_group'.tr(context)),
            onTap: () {
              Navigator.pop(context);
              // TODO: Navigate to create group
            },
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    _controller.dispose();
    super.dispose();
  }
}
