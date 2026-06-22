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
