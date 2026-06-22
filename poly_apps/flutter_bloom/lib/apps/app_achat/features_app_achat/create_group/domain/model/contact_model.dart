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
