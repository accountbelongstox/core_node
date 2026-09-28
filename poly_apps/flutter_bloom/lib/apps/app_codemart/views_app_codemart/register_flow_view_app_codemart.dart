import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../localization_app_codemart/localization_keys_app_codemart.dart';
import '../main_app_codemart.dart';
import '../models_app_codemart/codemart_enums.dart';
import '../router_app_codemart/router_app_codemart.dart';
import '../services_app_codemart/auth_api_service_app_codemart.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class RegisterFlowViewAppCodemart extends StatefulWidget {
  const RegisterFlowViewAppCodemart({super.key});

  @override
  State<RegisterFlowViewAppCodemart> createState() => _RegisterFlowViewAppCodemartState();
}

class _RegisterFlowViewAppCodemartState extends State<RegisterFlowViewAppCodemart> {
  final _pageController = PageController();
  int _currentStep = 0;

  // Form controllers
  final _usernameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _companyNameController = TextEditingController();
  final _companyRegController = TextEditingController();
  final _contactPersonController = TextEditingController();
  final _contactPhoneController = TextEditingController();

  // Registration data
  UserRoleType? _selectedRole;
  DeveloperType? _developerType;
  ClientType? _clientType;
  final Set<String> _selectedSkills = {};
  Industry? _selectedIndustry;
  bool _isLoading = false;

  @override
  void dispose() {
    _pageController.dispose();
    _usernameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _companyNameController.dispose();
    _companyRegController.dispose();
    _contactPersonController.dispose();
    _contactPhoneController.dispose();
    super.dispose();
  }

  void _nextStep() {
    if (_currentStep < 3) {
      setState(() => _currentStep++);
      _pageController.animateToPage(
        _currentStep,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  void _previousStep() {
    if (_currentStep > 0) {
      setState(() => _currentStep--);
      _pageController.animateToPage(
        _currentStep,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  Future<void> _handleSubmit() async {
    setState(() => _isLoading = true);

    try {
      final authService = context.read<AuthApiServiceAppCodemart>();

      // Prepare registration data
      final Map<String, dynamic> registrationData = {
        'username': _usernameController.text.trim(),
        'email': _emailController.text.trim(),
        'password': _passwordController.text,
        'roleType': _selectedRole!.name,
      };

      // Add type-specific data
      if (_selectedRole == UserRoleType.developer) {
        registrationData['developerType'] = _developerType!.name;
        registrationData['skills'] = _selectedSkills.toList();
      } else if (_selectedRole == UserRoleType.client) {
        registrationData['clientType'] = _clientType!.name;
        if (_clientType == ClientType.enterprise) {
          registrationData['companyName'] = _companyNameController.text.trim();
          registrationData['companyRegistrationNumber'] = _companyRegController.text.trim();
          registrationData['contactPerson'] = _contactPersonController.text.trim();
          registrationData['contactPhone'] = _contactPhoneController.text.trim();
          registrationData['industry'] = _selectedIndustry?.name;
        }
      }

      final response = await authService.register(
        username: registrationData['username'],
        email: registrationData['email'],
        password: registrationData['password'],
        roleType: _selectedRole!,
        additionalData: registrationData,
      );

      if (!mounted) return;

      if (response.success) {
        // Navigate to home or verification page
        RouterAppCodemart.goToHome(context);
      } else {
        _showError(response.message ?? 'Registration failed');
      }
    } catch (e) {
      _showError('Registration error: $e');
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(LocalizationKeysAppCodemart.codemartRegister.tr(context)),
        leading: _currentStep > 0
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: _previousStep,
              )
            : null,
      ),
      body: Column(
        children: [
          // Progress indicator
          LinearProgressIndicator(
            value: (_currentStep + 1) / 4,
            backgroundColor: Colors.grey[200],
          ),

          // Step indicator
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(4, (index) {
                return Row(
                  children: [
                    CircleAvatar(
                      radius: 12,
                      backgroundColor: index <= _currentStep
                          ? Theme.of(context).colorScheme.primary
                          : Colors.grey[300],
                      child: Text(
                        '${index + 1}',
                        style: TextStyle(
                          color: index <= _currentStep ? Colors.white : Colors.grey[600],
                          fontSize: 12,
                        ),
                      ),
                    ),
                    if (index < 3)
                      Container(
                        width: 40,
                        height: 2,
                        color: index < _currentStep
                            ? Theme.of(context).colorScheme.primary
                            : Colors.grey[300],
                      ),
                  ],
                );
              }),
            ),
          ),

          // Page view
          Expanded(
            child: PageView(
              controller: _pageController,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                _buildRoleSelectionStep(),
                _buildSubtypeSelectionStep(),
                _buildAccountInfoStep(),
                _buildAdditionalInfoStep(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRoleSelectionStep() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Choose Your Role',
            style: Theme.of(context).textTheme.headlineSmall,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'Select whether you want to offer services or hire developers',
            style: Theme.of(context).textTheme.bodyMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 32),

          // Developer option
          _RoleSelectionCard(
            icon: Icons.code,
            title: LocalizationKeysAppCodemart.codemartDeveloper.tr(context),
            description: 'Find projects and earn by completing tasks',
            isSelected: _selectedRole == UserRoleType.developer,
            onTap: () => setState(() => _selectedRole = UserRoleType.developer),
          ),
          const SizedBox(height: 16),

          // Client option
          _RoleSelectionCard(
            icon: Icons.business,
            title: LocalizationKeysAppCodemart.codemartClient.tr(context),
            description: 'Post projects and hire talented developers',
            isSelected: _selectedRole == UserRoleType.client,
            onTap: () => setState(() => _selectedRole = UserRoleType.client),
          ),
          const SizedBox(height: 32),

          // Continue button
          FilledButton(
            onPressed: _selectedRole != null ? _nextStep : null,
            child: const Text('Continue'),
          ),
        ],
      ),
    );
  }

  Widget _buildSubtypeSelectionStep() {
    if (_selectedRole == UserRoleType.developer) {
      return _buildDeveloperSubtypeStep();
    } else if (_selectedRole == UserRoleType.client) {
      return _buildClientSubtypeStep();
    }
    return const SizedBox.shrink();
  }

  Widget _buildDeveloperSubtypeStep() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Developer Type',
            style: Theme.of(context).textTheme.headlineSmall,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'Choose your specialization level',
            style: Theme.of(context).textTheme.bodyMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 32),

          // Regular developer
          _SubtypeCard(
            icon: Icons.code_outlined,
            title: 'Regular Developer',
            description: 'Complete individual tasks and projects',
            badge: null,
            isSelected: _developerType == DeveloperType.regular,
            onTap: () => setState(() => _developerType = DeveloperType.regular),
          ),
          const SizedBox(height: 16),

          // Architect
          _SubtypeCard(
            icon: Icons.architecture,
            title: 'Architect',
            description: 'Lead projects and provide architectural guidance',
            badge: 'Deposit: ¥999',
            isSelected: _developerType == DeveloperType.architect,
            onTap: () => setState(() => _developerType = DeveloperType.architect),
          ),
          const SizedBox(height: 32),

          FilledButton(
            onPressed: _developerType != null ? _nextStep : null,
            child: const Text('Continue'),
          ),
        ],
      ),
    );
  }

  Widget _buildClientSubtypeStep() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Client Type',
            style: Theme.of(context).textTheme.headlineSmall,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'Select your client category',
            style: Theme.of(context).textTheme.bodyMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 32),

          // Individual
          _SubtypeCard(
            icon: Icons.person,
            title: 'Individual',
            description: 'Personal projects and small-scale development',
            badge: null,
            isSelected: _clientType == ClientType.individual,
            onTap: () => setState(() => _clientType = ClientType.individual),
          ),
          const SizedBox(height: 16),

          // Enterprise
          _SubtypeCard(
            icon: Icons.business,
            title: 'Enterprise',
            description: 'Corporate projects with verification',
            badge: 'Requires verification',
            isSelected: _clientType == ClientType.enterprise,
            onTap: () => setState(() => _clientType = ClientType.enterprise),
          ),
          const SizedBox(height: 32),

          FilledButton(
            onPressed: _clientType != null ? _nextStep : null,
            child: const Text('Continue'),
          ),
        ],
      ),
    );
  }

  Widget _buildAccountInfoStep() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Account Information',
            style: Theme.of(context).textTheme.headlineSmall,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 32),

          // Username
          TextFormField(
            controller: _usernameController,
            decoration: InputDecoration(
              labelText: LocalizationKeysAppCodemart.codemartUsername.tr(context),
              prefixIcon: const Icon(Icons.person),
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),

          // Email
          TextFormField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            decoration: InputDecoration(
              labelText: LocalizationKeysAppCodemart.codemartEmail.tr(context),
              prefixIcon: const Icon(Icons.email),
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),

          // Password
          TextFormField(
            controller: _passwordController,
            obscureText: true,
            decoration: InputDecoration(
              labelText: LocalizationKeysAppCodemart.codemartPassword.tr(context),
              prefixIcon: const Icon(Icons.lock),
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),

          // Confirm password
          TextFormField(
            controller: _confirmPasswordController,
            obscureText: true,
            decoration: const InputDecoration(
              labelText: 'Confirm Password',
              prefixIcon: Icon(Icons.lock_outline),
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 32),

          FilledButton(
            onPressed: () {
              if (_usernameController.text.isNotEmpty &&
                  _emailController.text.isNotEmpty &&
                  _passwordController.text.isNotEmpty &&
                  _passwordController.text == _confirmPasswordController.text) {
                _nextStep();
              } else {
                _showError('Please fill all fields correctly');
              }
            },
            child: const Text('Continue'),
          ),
        ],
      ),
    );
  }

  Widget _buildAdditionalInfoStep() {
    if (_selectedRole == UserRoleType.developer) {
      return _buildDeveloperSkillsStep();
    } else if (_selectedRole == UserRoleType.client && _clientType == ClientType.enterprise) {
      return _buildEnterpriseInfoStep();
    } else {
      return _buildFinalStep();
    }
  }

  Widget _buildDeveloperSkillsStep() {
    final skills = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'PHP', 'C#', 'Go', 'Rust',
      'React', 'Vue', 'Angular', 'Flutter', 'React Native',
      'Node.js', 'Django', 'Laravel', 'Spring Boot',
      'MySQL', 'PostgreSQL', 'MongoDB', 'Redis',
      'AWS', 'Azure', 'Docker', 'Kubernetes',
      'UI/UX Design', 'Mobile Development', 'Web Development', 'DevOps',
    ];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Select Your Skills',
            style: Theme.of(context).textTheme.headlineSmall,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'Choose at least 3 skills (${_selectedSkills.length} selected)',
            style: Theme.of(context).textTheme.bodyMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),

          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: skills.map((skill) {
              final isSelected = _selectedSkills.contains(skill);
              return FilterChip(
                label: Text(skill),
                selected: isSelected,
                onSelected: (selected) {
                  setState(() {
                    if (selected) {
                      _selectedSkills.add(skill);
                    } else {
                      _selectedSkills.remove(skill);
                    }
                  });
                },
              );
            }).toList(),
          ),
          const SizedBox(height: 32),

          FilledButton(
            onPressed: _selectedSkills.length >= 3 ? _handleSubmit : null,
            child: _isLoading
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Complete Registration'),
          ),
        ],
      ),
    );
  }

  Widget _buildEnterpriseInfoStep() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Enterprise Information',
            style: Theme.of(context).textTheme.headlineSmall,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 32),

          // Company name
          TextFormField(
            controller: _companyNameController,
            decoration: const InputDecoration(
              labelText: 'Company Name',
              prefixIcon: Icon(Icons.business),
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),

          // Registration number
          TextFormField(
            controller: _companyRegController,
            decoration: const InputDecoration(
              labelText: 'Company Registration Number',
              prefixIcon: Icon(Icons.numbers),
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),

          // Industry
          DropdownButtonFormField<Industry>(
            value: _selectedIndustry,
            decoration: const InputDecoration(
              labelText: 'Industry',
              prefixIcon: Icon(Icons.category),
              border: OutlineInputBorder(),
            ),
            items: Industry.values.map((industry) {
              return DropdownMenuItem(
                value: industry,
                child: Text(industry.name.toUpperCase()),
              );
            }).toList(),
            onChanged: (value) => setState(() => _selectedIndustry = value),
          ),
          const SizedBox(height: 16),

          // Contact person
          TextFormField(
            controller: _contactPersonController,
            decoration: const InputDecoration(
              labelText: 'Contact Person',
              prefixIcon: Icon(Icons.person_outline),
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),

          // Contact phone
          TextFormField(
            controller: _contactPhoneController,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
              labelText: 'Contact Phone',
              prefixIcon: Icon(Icons.phone),
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 32),

          FilledButton(
            onPressed: () {
              if (_companyNameController.text.isNotEmpty &&
                  _companyRegController.text.isNotEmpty &&
                  _contactPersonController.text.isNotEmpty &&
                  _contactPhoneController.text.isNotEmpty) {
                _handleSubmit();
              } else {
                _showError('Please fill all fields');
              }
            },
            child: _isLoading
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Complete Registration'),
          ),
        ],
      ),
    );
  }

  Widget _buildFinalStep() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Ready to Register',
            style: Theme.of(context).textTheme.headlineSmall,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 32),

          FilledButton(
            onPressed: _handleSubmit,
            child: _isLoading
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Complete Registration'),
          ),
        ],
      ),
    );
  }
}

class _RoleSelectionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final bool isSelected;
  final VoidCallback onTap;

  const _RoleSelectionCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: isSelected ? 8 : 2,
      color: isSelected ? Theme.of(context).colorScheme.primaryContainer : null,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Row(
            children: [
              Icon(
                icon,
                size: 48,
                color: isSelected ? Theme.of(context).colorScheme.primary : null,
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: isSelected ? Theme.of(context).colorScheme.primary : null,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      description,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
              if (isSelected)
                Icon(
                  Icons.check_circle,
                  color: Theme.of(context).colorScheme.primary,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SubtypeCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final String? badge;
  final bool isSelected;
  final VoidCallback onTap;

  const _SubtypeCard({
    required this.icon,
    required this.title,
    required this.description,
    this.badge,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: isSelected ? 8 : 2,
      color: isSelected ? Theme.of(context).colorScheme.primaryContainer : null,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    icon,
                    size: 32,
                    color: isSelected ? Theme.of(context).colorScheme.primary : null,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      title,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: isSelected ? Theme.of(context).colorScheme.primary : null,
                          ),
                    ),
                  ),
                  if (isSelected)
                    Icon(
                      Icons.check_circle,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                description,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              if (badge != null) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.secondaryContainer,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    badge!,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
