import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../../provider_app_travel/traveler_provider_app_travel.dart';
import '../../../models_app_travel/traveler_model.dart';

/// 设置出行人管理页面
class TravelerManagementScreen extends StatefulWidget {
  const TravelerManagementScreen({super.key});

  @override
  State<TravelerManagementScreen> createState() => _TravelerManagementScreenState();
}

class _TravelerManagementScreenState extends State<TravelerManagementScreen> {
  @override
  Widget build(BuildContext context) {
    final travelerProvider = context.watch<TravelerProviderAppTravel>();
    final travelers = travelerProvider.travelers;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.black87),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          '设置出行人',
          style: TextStyle(
            fontSize: 18.0,
            fontWeight: FontWeight.w500,
            color: Colors.black87,
          ),
        ),
        centerTitle: true,
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: 12.0),
              itemCount: travelers.length,
              separatorBuilder: (context, index) => const SizedBox(height: 12.0),
              itemBuilder: (context, index) {
                final traveler = travelers[index];
                return _buildTravelerCard(traveler, travelerProvider);
              },
            ),
          ),
          _buildAddButton(),
        ],
      ),
    );
  }

  Widget _buildTravelerCard(TravelerModel traveler, TravelerProviderAppTravel provider) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16.0),
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12.0),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8.0,
            offset: const Offset(0, 2.0),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 标题行
          Row(
            children: [
              Expanded(
                child: Row(
                  children: [
                    Text(
                      traveler.name,
                      style: const TextStyle(
                        fontSize: 18.0,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                    if (traveler.isDefault) ...[
                      const SizedBox(width: 8.0),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 2.0),
                        decoration: BoxDecoration(
                          color: const Color(0xFF00D0D8),
                          borderRadius: BorderRadius.circular(4.0),
                        ),
                        child: const Text(
                          '默认',
                          style: TextStyle(
                            fontSize: 11.0,
                            color: Colors.white,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              // 编辑和删除按钮
              Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.edit_outlined, size: 20.0),
                    color: Colors.black54,
                    onPressed: () => _showEditTravelerDialog(traveler, provider),
                  ),
                  if (!traveler.isDefault)
                    IconButton(
                      icon: const Icon(Icons.delete_outline, size: 20.0),
                      color: Colors.red.shade400,
                      onPressed: () => _showDeleteConfirmDialog(traveler, provider),
                    ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12.0),
          // 手机号
          _buildInfoRow(
            Icons.phone_outlined,
            '手机号',
            traveler.maskedPhone,
            traveler.phone,
          ),
          const Divider(height: 24.0),
          // 邮箱
          _buildInfoRow(
            Icons.email_outlined,
            '邮箱',
            traveler.maskedEmail,
            traveler.email,
          ),
          // 设为默认按钮
          if (!traveler.isDefault) ...[
            const Divider(height: 24.0),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () {
                  provider.setDefaultTraveler(traveler.id);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('已设置 ${traveler.name} 为默认出行人')),
                  );
                },
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Color(0xFF00D0D8)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8.0),
                  ),
                ),
                child: const Text(
                  '设为默认',
                  style: TextStyle(
                    color: Color(0xFF00D0D8),
                    fontSize: 14.0,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String maskedValue, String fullValue) {
    return Row(
      children: [
        Icon(icon, size: 20.0, color: const Color(0xFF666666)),
        const SizedBox(width: 12.0),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12.0,
                  color: Color(0xFF999999),
                ),
              ),
              const SizedBox(height: 4.0),
              Text(
                maskedValue,
                style: const TextStyle(
                  fontSize: 15.0,
                  color: Colors.black87,
                ),
              ),
            ],
          ),
        ),
        // 复制按钮
        IconButton(
          icon: const Icon(Icons.copy_outlined, size: 18.0),
          color: const Color(0xFF00D0D8),
          onPressed: () {
            Clipboard.setData(ClipboardData(text: fullValue));
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('已复制$label')),
            );
          },
        ),
      ],
    );
  }

  Widget _buildAddButton() {
    return Container(
      padding: const EdgeInsets.all(16.0),
      color: Colors.white,
      child: SafeArea(
        child: SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () => _showAddTravelerDialog(),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF00D0D8),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14.0),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8.0),
              ),
            ),
            child: const Text(
              '添加出行人',
              style: TextStyle(
                fontSize: 16.0,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _showAddTravelerDialog() {
    final nameController = TextEditingController();
    final phoneController = TextEditingController();
    final emailController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('添加出行人'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(
                    labelText: '姓名',
                    hintText: '请输入姓名（拼音大写）',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16.0),
                TextField(
                  controller: phoneController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: '手机号',
                    hintText: '请输入11位手机号',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16.0),
                TextField(
                  controller: emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: '邮箱',
                    hintText: '请输入邮箱地址',
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('取消'),
            ),
            ElevatedButton(
              onPressed: () {
                if (_validateInput(nameController.text, phoneController.text, emailController.text)) {
                  final travelerProvider = context.read<TravelerProviderAppTravel>();
                  final newTraveler = TravelerModel(
                    id: 'traveler_${DateTime.now().millisecondsSinceEpoch}',
                    name: nameController.text.trim(),
                    phone: phoneController.text.trim(),
                    email: emailController.text.trim(),
                    isDefault: false,
                  );
                  travelerProvider.addTraveler(newTraveler);
                  Navigator.of(context).pop();
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('添加成功')),
                  );
                }
              },
              child: const Text('确定'),
            ),
          ],
        );
      },
    );
  }

  void _showEditTravelerDialog(TravelerModel traveler, TravelerProviderAppTravel provider) {
    final nameController = TextEditingController(text: traveler.name);
    final phoneController = TextEditingController(text: traveler.phone);
    final emailController = TextEditingController(text: traveler.email);

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('编辑出行人'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(
                    labelText: '姓名',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16.0),
                TextField(
                  controller: phoneController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: '手机号',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16.0),
                TextField(
                  controller: emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: '邮箱',
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('取消'),
            ),
            ElevatedButton(
              onPressed: () {
                if (_validateInput(nameController.text, phoneController.text, emailController.text)) {
                  final updatedTraveler = traveler.copyWith(
                    name: nameController.text.trim(),
                    phone: phoneController.text.trim(),
                    email: emailController.text.trim(),
                  );
                  provider.updateTraveler(updatedTraveler);
                  Navigator.of(context).pop();
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('修改成功')),
                  );
                }
              },
              child: const Text('确定'),
            ),
          ],
        );
      },
    );
  }

  void _showDeleteConfirmDialog(TravelerModel traveler, TravelerProviderAppTravel provider) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('删除出行人'),
          content: Text('确定要删除出行人 ${traveler.name} 吗？'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('取消'),
            ),
            ElevatedButton(
              onPressed: () {
                provider.deleteTraveler(traveler.id);
                Navigator.of(context).pop();
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('已删除 ${traveler.name}')),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red,
              ),
              child: const Text('删除'),
            ),
          ],
        );
      },
    );
  }

  bool _validateInput(String name, String phone, String email) {
    if (name.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请输入姓名')),
      );
      return false;
    }

    if (phone.trim().isEmpty || phone.length != 11) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请输入正确的11位手机号')),
      );
      return false;
    }

    if (email.trim().isEmpty || !email.contains('@')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请输入正确的邮箱地址')),
      );
      return false;
    }

    return true;
  }
}
