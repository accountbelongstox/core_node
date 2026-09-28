import 'package:qyflutter/apps/app_achat/features_app_achat/create_group/domain/model/contact_model.dart';
// AI: Claude Code - Fixed import path for Contact model

class ContactService {
  List<Contact> getContacts() {
    // TODO: 实现从服务器获取联系人列表
    return Contact.getDefaultContacts();
  }

  List<Contact> searchContacts(List<Contact> contacts, String query) {
    if (query.isEmpty) return contacts;
    return contacts.where((contact) {
      return contact.name.contains(query) ||
          contact.role.contains(query) ||
          contact.department.contains(query);
    }).toList();
  }
} 
