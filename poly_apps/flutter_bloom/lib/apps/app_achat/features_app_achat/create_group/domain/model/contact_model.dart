import 'package:flutter/material.dart';

class Contact {
  final String name;
  final String role;
  final String department;
  final Color color;

  Contact({
    required this.name,
    required this.role,
    required this.department,
    required this.color,
  });

  static List<Contact> getDefaultContacts() {
    return [
      Contact(
        name: '张',
        role: '张经理',
        department: '技术部 | 项目总监',
        color: const Color(0xFF3CB371),
      ),
      Contact(
        name: '李',
        role: '李工程师',
        department: '研发部 | 高级开发工程师',
        color: const Color(0xFF40A9FF),
      ),
      Contact(
        name: '王',
        role: '王设计师',
        department: '设计部 | UI设计师',
        color: const Color(0xFF9254DE),
      ),
      Contact(
        name: '赵',
        role: '赵经理',
        department: '产品部 | 产品经理',
        color: const Color(0xFFFF7A45),
      ),
    ];
  }
} 
