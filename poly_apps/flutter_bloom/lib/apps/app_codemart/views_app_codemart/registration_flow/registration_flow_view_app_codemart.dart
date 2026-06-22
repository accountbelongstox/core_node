import 'package:flutter/material.dart';
import '../../localization_app_codemart/localization_keys_app_codemart.dart';
import '../../main_app_codemart.dart';
import '../../router_app_codemart/router_app_codemart.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class RegistrationFlowViewAppCodemart extends StatefulWidget {
  final String roleType;

  const RegistrationFlowViewAppCodemart({
    super.key,
    required this.roleType,
  });

  @override
  State<RegistrationFlowViewAppCodemart> createState() =>
      _RegistrationFlowViewAppCodemartState();
}

class _RegistrationFlowViewAppCodemartState
    extends State<RegistrationFlowViewAppCodemart> {
  int _currentStep = 0;
  final bool _isLoading = false;

  final List<String> _steps = [
    LocalizationKeysAppCodemart.codemartEmailVerification,
    LocalizationKeysAppCodemart.codemartPhoneVerification,
    LocalizationKeysAppCodemart.codemartKycVerification,
    LocalizationKeysAppCodemart.codemartPaymentDeposit,
  ];

  Future<void> _handleNext() async {
    if (_currentStep < _steps.length - 1) {
      setState(() => _currentStep++);
    } else {
      // Complete registration flow
      RouterAppCodemart.goToHome(context);
    }
  }

  void _handleBack() {
    if (_currentStep > 0) {
      setState(() => _currentStep--);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.roleType == 'developer'
              ? LocalizationKeysAppCodemart.codemartRegisterAsDeveloper.tr(context)
              : LocalizationKeysAppCodemart.codemartRegisterAsClient.tr(context),
        ),
      ),
      body: Column(
        children: [
          // Progress indicator
          LinearProgressIndicator(
            value: (_currentStep + 1) / _steps.length,
          ),
          const SizedBox(height: 16),

          // Step indicator
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: List.generate(_steps.length, (index) {
                return Expanded(
                  child: Column(
                    children: [
                      CircleAvatar(
                        radius: 16,
                        backgroundColor: index <= _currentStep
                            ? Theme.of(context).colorScheme.primary
                            : Colors.grey.shade300,
                        child: index < _currentStep
                            ? const Icon(Icons.check, size: 16, color: Colors.white)
                            : Text(
                                '${index + 1}',
                                style: TextStyle(
                                  color: index <= _currentStep ? Colors.white : Colors.grey,
                                ),
                              ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _steps[index].tr(context),
                        style: Theme.of(context).textTheme.labelSmall,
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                );
              }),
            ),
          ),

          const SizedBox(height: 32),

          // Step content
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: _buildStepContent(),
            ),
          ),

          // Navigation buttons
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                if (_currentStep > 0)
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _handleBack,
                      child: Text(LocalizationKeysAppCodemart.codemartPrevious.tr(context)),
                    ),
                  ),
                if (_currentStep > 0) const SizedBox(width: 16),
                Expanded(
                  child: FilledButton(
                    onPressed: _isLoading ? null : _handleNext,
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(
                            _currentStep < _steps.length - 1
                                ? LocalizationKeysAppCodemart.codemartNext.tr(context)
                                : LocalizationKeysAppCodemart.codemartFinish.tr(context),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStepContent() {
    switch (_currentStep) {
      case 0:
        return _EmailVerificationStep();
      case 1:
        return _PhoneVerificationStep();
      case 2:
        return _KycVerificationStep();
      case 3:
        return _PaymentDepositStep();
      default:
        return const SizedBox.shrink();
    }
  }
}

class _EmailVerificationStep extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              LocalizationKeysAppCodemart.codemartEmailVerification.tr(context),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),
            const Text('Enter verification code sent to your email'),
            const SizedBox(height: 16),
            TextFormField(
              decoration: const InputDecoration(
                labelText: 'Verification Code',
                prefixIcon: Icon(Icons.mail),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PhoneVerificationStep extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              LocalizationKeysAppCodemart.codemartPhoneVerification.tr(context),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),
            const Text('Enter your phone number for verification'),
            const SizedBox(height: 16),
            TextFormField(
              decoration: const InputDecoration(
                labelText: 'Phone Number',
                prefixIcon: Icon(Icons.phone),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _KycVerificationStep extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              LocalizationKeysAppCodemart.codemartKycVerification.tr(context),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),
            const Text('Upload identification documents'),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.upload_file),
              label: const Text('Upload Document'),
            ),
          ],
        ),
      ),
    );
  }
}

class _PaymentDepositStep extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              LocalizationKeysAppCodemart.codemartPaymentDeposit.tr(context),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),
            const Text('Pay registration deposit to complete verification'),
            const SizedBox(height: 16),
            TextFormField(
              decoration: const InputDecoration(
                labelText: 'Amount',
                prefixIcon: Icon(Icons.attach_money),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
