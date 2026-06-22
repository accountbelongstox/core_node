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

// CREATED BY: AI Assistant for new_chat refactoring
// NOTE FOR OTHER AIs: This controller has been created for the new new_chat architecture
// Please avoid modifying this file during the new_chat refactoring process

import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/new_chat/models/new_chat_contact_model.dart';

/// New Chat controller for AChat app
/// Manages new chat state and business logic using new architecture
class NewChatController extends ChangeNotifier {
  List<NewChatContactModel> _contacts = [];
  List<NewChatContactModel> _filteredContacts = [];
  String _searchQuery = '';
  bool _isLoading = false;
  String? _errorMessage;

  List<NewChatContactModel> get contacts => List.unmodifiable(_contacts);
  List<NewChatContactModel> get filteredContacts => List.unmodifiable(_filteredContacts);
  String get searchQuery => _searchQuery;
  bool get isLoading => _isLoading;
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

  NewChatController() {
    _loadContacts();
  }

  void _loadContacts() {
    _isLoading = true;
    notifyListeners();

    try {
      // Mock data for demonstration
      _contacts = [
        NewChatContactModel(
          id: '1',
          name: 'Alice Johnson',
          role: 'Senior Developer',
          department: 'Engineering',
          phone: '+1234567890',
          email: 'alice.johnson@company.com',
          avatarUrl: null,
          isOnline: true,
          lastSeen: DateTime.now().subtract(const Duration(minutes: 5)),
        ),
        NewChatContactModel(
          id: '2',
          name: 'Bob Smith',
          role: 'UI/UX Designer',
          department: 'Design',
          phone: '+1234567891',
          email: 'bob.smith@company.com',
          avatarUrl: null,
          isOnline: false,
          lastSeen: DateTime.now().subtract(const Duration(hours: 2)),
        ),
        NewChatContactModel(
          id: '3',
          name: 'Charlie Brown',
          role: 'Marketing Manager',
          department: 'Marketing',
          phone: '+1234567892',
          email: 'charlie.brown@company.com',
          avatarUrl: null,
          isOnline: true,
          lastSeen: DateTime.now().subtract(const Duration(minutes: 1)),
        ),
        NewChatContactModel(
          id: '4',
          name: 'Diana Prince',
          role: 'HR Specialist',
          department: 'HR',
          phone: '+1234567893',
          email: 'diana.prince@company.com',
          avatarUrl: null,
          isOnline: false,
          lastSeen: DateTime.now().subtract(const Duration(days: 1)),
        ),
        NewChatContactModel(
          id: '5',
          name: 'Edward Wilson',
          role: 'DevOps Engineer',
          department: 'Engineering',
          phone: '+1234567894',
          email: 'edward.wilson@company.com',
          avatarUrl: null,
          isOnline: true,
          lastSeen: DateTime.now().subtract(const Duration(minutes: 10)),
        ),
      ];

      _filteredContacts = List.from(_contacts);
      _isLoading = false;
      _errorMessage = null;
    } catch (e) {
      _isLoading = false;
      _errorMessage = e.toString();
    }
    
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
              contact.role.toLowerCase().contains(query.toLowerCase()) ||
              contact.department.toLowerCase().contains(query.toLowerCase()) ||
              contact.phone.toLowerCase().contains(query.toLowerCase()) ||
              contact.email.toLowerCase().contains(query.toLowerCase()))
          .toList();
    }
    
    notifyListeners();
  }

  void clearSearch() {
    _searchQuery = '';
    _filteredContacts = List.from(_contacts);
    notifyListeners();
  }

  NewChatContactModel? getContactById(String id) {
    try {
      return _contacts.firstWhere((contact) => contact.id == id);
    } catch (e) {
      return null;
    }
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

  List<NewChatContactModel> getContactsByDepartment(String department) {
    return _contacts.where((contact) => contact.department == department).toList();
  }

  List<String> getAllDepartments() {
    return _contacts.map((contact) => contact.department).toSet().toList()..sort();
  }

  List<NewChatContactModel> getOnlineContacts() {
    return _contacts.where((contact) => contact.isOnline).toList();
  }

  int get onlineContactsCount => _contacts.where((contact) => contact.isOnline).length;

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }
}
