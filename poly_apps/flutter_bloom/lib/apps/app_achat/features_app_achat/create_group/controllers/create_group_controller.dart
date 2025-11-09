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

import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/create_group/models/contact_model.dart';

class CreateGroupController extends ChangeNotifier {
  List<ContactModel> _contacts = [];
  final List<ContactModel> _selectedContacts = [];
  List<ContactModel> _filteredContacts = [];
  String _searchQuery = '';
  bool _isLoading = false;

  List<ContactModel> get contacts => List.unmodifiable(_contacts);
  List<ContactModel> get selectedContacts => List.unmodifiable(_selectedContacts);
  List<ContactModel> get filteredContacts => List.unmodifiable(_filteredContacts);
  String get searchQuery => _searchQuery;
  bool get isLoading => _isLoading;
  bool get hasSelectedContacts => _selectedContacts.isNotEmpty;

  CreateGroupController() {
    _loadContacts();
  }

  void _loadContacts() {
    _isLoading = true;
    notifyListeners();

    // Mock data for demonstration
    _contacts = [
      const ContactModel(
        id: '1',
        name: 'Alice Johnson',
        phone: '+1234567890',
        email: 'alice@example.com',
        isOnline: true,
      ),
      const ContactModel(
        id: '2',
        name: 'Bob Smith',
        phone: '+1234567891',
        email: 'bob@example.com',
        isOnline: false,
        lastSeen: null,
      ),
      const ContactModel(
        id: '3',
        name: 'Charlie Brown',
        phone: '+1234567892',
        email: 'charlie@example.com',
        isOnline: true,
      ),
      const ContactModel(
        id: '4',
        name: 'Diana Prince',
        phone: '+1234567893',
        email: 'diana@example.com',
        isOnline: false,
      ),
      const ContactModel(
        id: '5',
        name: 'Edward Norton',
        phone: '+1234567894',
        email: 'edward@example.com',
        isOnline: true,
      ),
    ];

    _filteredContacts = List.from(_contacts);
    _isLoading = false;
    notifyListeners();
  }

  void searchContacts(String query) {
    _searchQuery = query;
    
    if (query.isEmpty) {
      _filteredContacts = List.from(_contacts);
    } else {
      _filteredContacts = _contacts
          .where((contact) =>
              contact.name.toLowerCase().contains(query.toLowerCase()) ||
              (contact.phone?.contains(query) ?? false) ||
              (contact.email?.toLowerCase().contains(query.toLowerCase()) ?? false))
          .toList();
    }
    
    notifyListeners();
  }

  void toggleContactSelection(ContactModel contact) {
    if (_selectedContacts.contains(contact)) {
      _selectedContacts.remove(contact);
    } else {
      _selectedContacts.add(contact);
    }
    notifyListeners();
  }

  void clearSelection() {
    _selectedContacts.clear();
    notifyListeners();
  }

  Future<bool> createGroup(String groupName, String? description) async {
    if (_selectedContacts.isEmpty) return false;

    _isLoading = true;
    notifyListeners();

    try {
      // Simulate API call
      await Future.delayed(const Duration(seconds: 1));
      
      // TODO: Implement actual group creation logic
      // This would typically involve calling a service to create the group
      
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  void removeSelectedContact(ContactModel contact) {
    _selectedContacts.remove(contact);
    notifyListeners();
  }
}
