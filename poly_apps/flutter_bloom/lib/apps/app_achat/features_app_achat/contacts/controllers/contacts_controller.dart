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

// CREATED BY: AI Assistant for contacts refactoring
// NOTE FOR OTHER AIs: This controller has been created for the new contacts architecture
// Please avoid modifying this file during the contacts refactoring process

import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/contacts/models/contact_model.dart';

/// Contacts controller for AChat app
/// Manages contacts state and business logic using new architecture
class ContactsController extends ChangeNotifier {
  List<ContactModel> _contacts = [];
  List<ContactModel> _filteredContacts = [];
  String _searchQuery = '';
  bool _isLoading = false;
  bool _isSearching = false;
  String? _errorMessage;

  List<ContactModel> get contacts => List.unmodifiable(_contacts);
  List<ContactModel> get filteredContacts => List.unmodifiable(_filteredContacts);
  String get searchQuery => _searchQuery;
  bool get isLoading => _isLoading;
  bool get isSearching => _isSearching;
  String? get errorMessage => _errorMessage;
  bool get hasContacts => _contacts.isNotEmpty;
  bool get hasFilteredContacts => _filteredContacts.isNotEmpty;

  // Soft avatar colors for better UI
  final List<Color> avatarColors = [
    const Color(0xFF26C6DA), // Cyan
    const Color(0xFF42A5F5), // Blue
    const Color(0xFF66BB6A), // Green
    const Color(0xFFAB47BC), // Purple
    const Color(0xFFFF7043), // Orange
    const Color(0xFFEC407A), // Pink
    const Color(0xFF7E57C2), // Deep Purple
    const Color(0xFFFFCA28), // Yellow
  ];

  ContactsController() {
    _loadContacts();
  }

  void _loadContacts() {
    _isLoading = true;
    notifyListeners();

    // Mock data for demonstration
    _contacts = [
      ContactModel(
        id: '1',
        name: 'Alice Johnson',
        phone: '+1234567890',
        email: 'alice.johnson@company.com',
        department: 'Engineering',
        position: 'Senior Developer',
        avatarUrl: null,
        isOnline: true,
        lastSeen: DateTime.now().subtract(const Duration(minutes: 5)),
      ),
      ContactModel(
        id: '2',
        name: 'Bob Smith',
        phone: '+1234567891',
        email: 'bob.smith@company.com',
        department: 'Design',
        position: 'UI/UX Designer',
        avatarUrl: null,
        isOnline: false,
        lastSeen: DateTime.now().subtract(const Duration(hours: 2)),
      ),
      ContactModel(
        id: '3',
        name: 'Charlie Brown',
        phone: '+1234567892',
        email: 'charlie.brown@company.com',
        department: 'Marketing',
        position: 'Marketing Manager',
        avatarUrl: null,
        isOnline: true,
        lastSeen: DateTime.now().subtract(const Duration(minutes: 1)),
      ),
      ContactModel(
        id: '4',
        name: 'Diana Prince',
        phone: '+1234567893',
        email: 'diana.prince@company.com',
        department: 'HR',
        position: 'HR Specialist',
        avatarUrl: null,
        isOnline: false,
        lastSeen: DateTime.now().subtract(const Duration(days: 1)),
      ),
      ContactModel(
        id: '5',
        name: 'Edward Wilson',
        phone: '+1234567894',
        email: 'edward.wilson@company.com',
        department: 'Engineering',
        position: 'DevOps Engineer',
        avatarUrl: null,
        isOnline: true,
        lastSeen: DateTime.now().subtract(const Duration(minutes: 10)),
      ),
    ];

    _filteredContacts = List.from(_contacts);
    _isLoading = false;
    notifyListeners();
  }

  void searchContacts(String query) {
    _searchQuery = query;
    _isSearching = query.isNotEmpty;
    
    if (query.isEmpty) {
      _filteredContacts = List.from(_contacts);
    } else {
      _filteredContacts = _contacts
          .where((contact) =>
              contact.name.toLowerCase().contains(query.toLowerCase()) ||
              contact.phone.toLowerCase().contains(query.toLowerCase()) ||
              contact.email.toLowerCase().contains(query.toLowerCase()) ||
              contact.department.toLowerCase().contains(query.toLowerCase()) ||
              contact.position.toLowerCase().contains(query.toLowerCase()))
          .toList();
    }
    
    notifyListeners();
  }

  void clearSearch() {
    _searchQuery = '';
    _isSearching = false;
    _filteredContacts = List.from(_contacts);
    notifyListeners();
  }

  ContactModel? getContactById(String id) {
    try {
      return _contacts.firstWhere((contact) => contact.id == id);
    } catch (e) {
      return null;
    }
  }

  void addContact(ContactModel contact) {
    _contacts.add(contact);
    if (_searchQuery.isEmpty) {
      _filteredContacts = List.from(_contacts);
    } else {
      searchContacts(_searchQuery);
    }
    notifyListeners();
  }

  void updateContact(ContactModel updatedContact) {
    final index = _contacts.indexWhere((contact) => contact.id == updatedContact.id);
    if (index != -1) {
      _contacts[index] = updatedContact;
      if (_searchQuery.isEmpty) {
        _filteredContacts = List.from(_contacts);
      } else {
        searchContacts(_searchQuery);
      }
      notifyListeners();
    }
  }

  void deleteContact(String contactId) {
    _contacts.removeWhere((contact) => contact.id == contactId);
    _filteredContacts.removeWhere((contact) => contact.id == contactId);
    notifyListeners();
  }

  Color getAvatarColor(int index) {
    return avatarColors[index % avatarColors.length];
  }

  void navigateToChat(String contactId) {
    // TODO: Implement navigation to chat with contact
    // This would typically use GoRouter or Navigator
  }

  Future<void> refresh() async {
    _loadContacts();
  }

  List<ContactModel> getContactsByDepartment(String department) {
    return _contacts.where((contact) => contact.department == department).toList();
  }

  List<String> getAllDepartments() {
    return _contacts.map((contact) => contact.department).toSet().toList()..sort();
  }

  List<ContactModel> getOnlineContacts() {
    return _contacts.where((contact) => contact.isOnline).toList();
  }

  int get onlineContactsCount => _contacts.where((contact) => contact.isOnline).length;
}
