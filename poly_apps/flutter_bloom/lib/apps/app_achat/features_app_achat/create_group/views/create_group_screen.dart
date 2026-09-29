import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/create_group/controllers/create_group_controller.dart';

class CreateGroupScreen extends StatefulWidget {
  const CreateGroupScreen({super.key});

  @override
  State<CreateGroupScreen> createState() => _CreateGroupScreenState();
}

class _CreateGroupScreenState extends State<CreateGroupScreen> {
  final TextEditingController _searchController = TextEditingController();
  late CreateGroupController _controller;

  @override
  void initState() {
    super.initState();
    _controller = CreateGroupController();
  }

  void _onNext() {
    if (_controller.hasSelectedContacts) {
      _showGroupDetailsDialog();
    }
  }

  Future<void> _createGroup(String groupName, String? description) async {
    final success = await _controller.createGroup(groupName, description);
    if (success && mounted) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('achat_group_created_success'.tr(context)),
        ),
      );
    }
  }

  void _showGroupDetailsDialog() {
    final groupNameController = TextEditingController();
    final descriptionController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('achat_create_group_details'.tr(context)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: groupNameController,
              decoration: InputDecoration(
                labelText: 'achat_group_name'.tr(context),
                hintText: 'achat_group_name_hint'.tr(context),
                border: const OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: descriptionController,
              maxLines: 3,
              decoration: InputDecoration(
                labelText: 'achat_group_description'.tr(context),
                hintText: 'achat_group_description_hint'.tr(context),
                border: const OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('achat_cancel'.tr(context)),
          ),
          TextButton(
            onPressed: () {
              if (groupNameController.text.trim().isNotEmpty) {
                Navigator.pop(context);
                _createGroup(
                  groupNameController.text.trim(),
                  descriptionController.text.trim().isEmpty
                    ? null
                    : descriptionController.text.trim(),
                );
              }
            },
            child: Text('achat_create'.tr(context)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: _controller,
      child: Consumer<CreateGroupController>(
        builder: (context, controller, child) {
          return Scaffold(
            appBar: AppBar(
              title: Text('achat_create_group_title'.tr(context)),
              actions: [
                if (controller.hasSelectedContacts)
                  TextButton(
                    onPressed: _onNext,
                    child: Text(
                      'achat_next'.tr(context),
                      style: const TextStyle(color: Colors.white),
                    ),
                  ),
              ],
            ),
            body: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
                  child: TextField(
                    controller: _searchController,
                    onChanged: controller.searchContacts,
                    decoration: InputDecoration(
                      hintText: 'achat_search_contacts'.tr(context),
                      prefixIcon: const Icon(Icons.search),
                      border: const OutlineInputBorder(),
                    ),
                  ),
                ),
                if (controller.selectedContacts.isNotEmpty)
                  Container(
                    height: 80,
                    padding: const EdgeInsets.symmetric(horizontal: ThemeDimensions.paddingSizeDefault),
                    child: ListView.builder(
                      scrollDirection: Axis.horizontal,
                      itemCount: controller.selectedContacts.length,
                      itemBuilder: (context, index) {
                        final contact = controller.selectedContacts[index];
                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: Column(
                            children: [
                              Stack(
                                children: [
                                  CircleAvatar(
                                    radius: 25,
                                    child: Text(contact.name[0].toUpperCase()),
                                  ),
                                  Positioned(
                                    right: 0,
                                    top: 0,
                                    child: GestureDetector(
                                      onTap: () => controller.removeSelectedContact(contact),
                                      child: Container(
                                        decoration: const BoxDecoration(
                                          color: Colors.red,
                                          shape: BoxShape.circle,
                                        ),
                                        child: const Icon(
                                          Icons.close,
                                          size: 16,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                contact.name.split(' ').first,
                                style: const TextStyle(fontSize: 12),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                Expanded(
                  child: ListView.builder(
                    itemCount: controller.filteredContacts.length,
                    itemBuilder: (context, index) {
                      final contact = controller.filteredContacts[index];
                      final isSelected = controller.selectedContacts.contains(contact);

                      return ListTile(
                        leading: CircleAvatar(
                          child: Text(contact.name[0].toUpperCase()),
                        ),
                        title: Text(contact.name),
                        subtitle: Text(contact.phone ?? contact.email ?? ''),
                        trailing: isSelected
                          ? const Icon(Icons.check_circle, color: Colors.blue)
                          : const Icon(Icons.radio_button_unchecked),
                        onTap: () => controller.toggleContactSelection(contact),
                      );
                    },
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }
}
