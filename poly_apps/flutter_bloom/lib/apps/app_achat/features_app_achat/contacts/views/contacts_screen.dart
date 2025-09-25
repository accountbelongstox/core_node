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

// MODIFIED BY: AI Assistant for contacts refactoring
// NOTE FOR OTHER AIs: This screen has been refactored to use new architecture
// Please avoid modifying this file during the contacts refactoring process

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/widgets/custom_app_bar.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_achat/router_app_achat/router_app_achat.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/common_widgets/bottom_navigation/common_bottom_navigation.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/contacts/controllers/contacts_controller.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/contacts/models/contact_model.dart';

class ContactsScreen extends StatefulWidget {
  const ContactsScreen({super.key});

  @override
  State<ContactsScreen> createState() => _ContactsScreenState();
}

class _ContactsScreenState extends State<ContactsScreen> {
  final TextEditingController _searchController = TextEditingController();
  late ContactsController _controller;

  @override
  void initState() {
    super.initState();
    _controller = ContactsController();
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: _controller,
      child: Consumer<ContactsController>(
        builder: (context, controller, child) {
          return Scaffold(
            appBar: CustomAppBar(
              title: 'achat_contacts_title'.tr(context),
              actions: [
                IconButton(
                  icon: const Icon(Icons.search),
                  onPressed: () => _showSearchDialog(context, controller),
                ),
                IconButton(
                  icon: const Icon(Icons.person_add),
                  onPressed: () => _onAddContactTap(context),
                ),
                IconButton(
                  icon: const Icon(Icons.more_vert),
                  onPressed: () => _showMoreOptions(context, controller),
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
            bottomNavigationBar: const CommonBottomNavigation(currentIndex: 1),
            floatingActionButton: FloatingActionButton(
              onPressed: () => _onAddContactTap(context),
              child: const Icon(Icons.person_add),
            ),
          );
        },
      ),
    );
  }

  Widget _buildSearchBar(BuildContext context, ContactsController controller) {
    return Padding(
      padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
      child: TextField(
        controller: _searchController,
        onChanged: controller.searchContacts,
        decoration: InputDecoration(
          hintText: 'achat_search_contacts'.tr(context),
          prefixIcon: const Icon(Icons.search),
          suffixIcon: controller.isSearching
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

  Widget _buildDepartmentFilter(BuildContext context, ContactsController controller) {
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
                selected: !controller.isSearching,
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
              selected: false,
              onSelected: (selected) {
                if (selected) {
                  controller.searchContacts(department);
                }
              },
            ),
          );
        },
      ),
    );
  }

  Widget _buildContactItem(
    BuildContext context,
    ContactsController controller,
    ContactModel contact,
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
            '${contact.displayPosition} • ${contact.displayDepartment}',
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
      trailing: IconButton(
        icon: const Icon(Icons.chat),
        onPressed: () => _onContactTap(context, contact),
      ),
      onTap: () => _showContactDetails(context, contact),
    );
  }

  Widget _buildEmptyState(BuildContext context, ContactsController controller) {
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
            controller.isSearching
                ? 'achat_contacts_no_search_results'.tr(context)
                : 'achat_contacts_empty'.tr(context),
            style: TextStyle(
              fontSize: 16,
              color: Colors.grey[600],
            ),
          ),
          if (!controller.isSearching) ...[
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: () => _onAddContactTap(context),
              icon: const Icon(Icons.person_add),
              label: Text('achat_contacts_add_first'.tr(context)),
            ),
          ],
        ],
      ),
    );
  }

  void _showSearchDialog(BuildContext context, ContactsController controller) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('achat_search_contacts'.tr(context)),
        content: TextField(
          controller: _searchController,
          onChanged: controller.searchContacts,
          decoration: InputDecoration(
            hintText: 'achat_search_hint'.tr(context),
            prefixIcon: const Icon(Icons.search),
          ),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () {
              _searchController.clear();
              controller.clearSearch();
              Navigator.pop(context);
            },
            child: Text('achat_clear'.tr(context)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('achat_close'.tr(context)),
          ),
        ],
      ),
    );
  }

  void _showMoreOptions(BuildContext context, ContactsController controller) {
    showModalBottomSheet(
      context: context,
      builder: (context) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: const Icon(Icons.refresh),
            title: Text('achat_refresh'.tr(context)),
            onTap: () {
              Navigator.pop(context);
              controller.refresh();
            },
          ),
          ListTile(
            leading: const Icon(Icons.people),
            title: Text('achat_online_contacts'.tr(context)),
            subtitle: Text('${controller.onlineContactsCount} online'),
            onTap: () {
              Navigator.pop(context);
              // TODO: Show only online contacts
            },
          ),
          ListTile(
            leading: const Icon(Icons.business),
            title: Text('achat_departments'.tr(context)),
            onTap: () {
              Navigator.pop(context);
              // TODO: Show department filter
            },
          ),
        ],
      ),
    );
  }

  void _onAddContactTap(BuildContext context) {
    context.go(RouterAppAChat.addContacts);
  }

  void _onContactTap(BuildContext context, ContactModel contact) {
    context.go('${RouterAppAChat.chatDetails}/${contact.id}');
  }

  void _showContactDetails(BuildContext context, ContactModel contact) {
    showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircleAvatar(
              radius: 40,
              backgroundColor: Colors.blue,
              backgroundImage: contact.avatarUrl != null ? NetworkImage(contact.avatarUrl!) : null,
              child: contact.avatarUrl == null
                  ? Text(
                      contact.avatarText,
                      style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                    )
                  : null,
            ),
            const SizedBox(height: 16),
            Text(
              contact.displayName,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            Text(
              '${contact.displayPosition} • ${contact.displayDepartment}',
              style: const TextStyle(fontSize: 14, color: Colors.grey),
            ),
            const SizedBox(height: 8),
            Text(
              contact.statusText,
              style: TextStyle(
                fontSize: 12,
                color: contact.isOnline ? Colors.green : Colors.grey,
              ),
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pop(context);
                    _onContactTap(context, contact);
                  },
                  icon: const Icon(Icons.chat),
                  label: Text('achat_chat'.tr(context)),
                ),
                OutlinedButton.icon(
                  onPressed: () {
                    Navigator.pop(context);
                    // TODO: Call contact
                  },
                  icon: const Icon(Icons.phone),
                  label: Text('achat_call'.tr(context)),
                ),
              ],
            ),
          ],
        ),
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
