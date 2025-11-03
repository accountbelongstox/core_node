import 'package:flutter/material.dart';

class HelpViewAppCodemart extends StatelessWidget {
  const HelpViewAppCodemart({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Help & Support'),
      ),
      body: ListView(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search for help...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onSubmitted: (query) {
                // TODO: Search help articles
              },
            ),
          ),

          // Quick help
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              'Quick Help',
              style: Theme.of(context).textTheme.titleLarge,
            ),
          ),
          const SizedBox(height: 12),
          _HelpCategory(
            icon: Icons.person,
            title: 'Account',
            children: [
              _HelpItem(
                title: 'How to create an account?',
                onTap: () => _showHelpArticle(context, 'account_creation'),
              ),
              _HelpItem(
                title: 'How to reset my password?',
                onTap: () => _showHelpArticle(context, 'password_reset'),
              ),
              _HelpItem(
                title: 'How to verify my account?',
                onTap: () => _showHelpArticle(context, 'account_verification'),
              ),
            ],
          ),
          _HelpCategory(
            icon: Icons.work,
            title: 'For Developers',
            children: [
              _HelpItem(
                title: 'How to find tasks?',
                onTap: () => _showHelpArticle(context, 'find_tasks'),
              ),
              _HelpItem(
                title: 'How to submit work?',
                onTap: () => _showHelpArticle(context, 'submit_work'),
              ),
              _HelpItem(
                title: 'How to receive payments?',
                onTap: () => _showHelpArticle(context, 'receive_payments'),
              ),
            ],
          ),
          _HelpCategory(
            icon: Icons.business,
            title: 'For Clients',
            children: [
              _HelpItem(
                title: 'How to post a project?',
                onTap: () => _showHelpArticle(context, 'post_project'),
              ),
              _HelpItem(
                title: 'How to hire developers?',
                onTap: () => _showHelpArticle(context, 'hire_developers'),
              ),
              _HelpItem(
                title: 'How to make payments?',
                onTap: () => _showHelpArticle(context, 'make_payments'),
              ),
            ],
          ),
          _HelpCategory(
            icon: Icons.payment,
            title: 'Payments',
            children: [
              _HelpItem(
                title: 'Payment methods',
                onTap: () => _showHelpArticle(context, 'payment_methods'),
              ),
              _HelpItem(
                title: 'Refund policy',
                onTap: () => _showHelpArticle(context, 'refund_policy'),
              ),
              _HelpItem(
                title: 'Payment issues',
                onTap: () => _showHelpArticle(context, 'payment_issues'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Divider(),

          // Contact support
          Padding(
            padding: const EdgeInsets.all(16),
            child: Card(
              color: Theme.of(context).colorScheme.primaryContainer,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Icon(
                      Icons.support_agent,
                      size: 48,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Need More Help?',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Our support team is here to help you 24/7',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () {
                              // TODO: Open chat support
                            },
                            icon: const Icon(Icons.chat),
                            label: const Text('Chat'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: () {
                              // TODO: Send email
                            },
                            icon: const Icon(Icons.email),
                            label: const Text('Email'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  static void _showHelpArticle(BuildContext context, String articleId) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) => Container(
          padding: const EdgeInsets.all(24),
          child: ListView(
            controller: scrollController,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Help Article',
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Text(
                'This is a help article. Content will be loaded from the backend.',
                style: TextStyle(fontSize: 16),
              ),
              const SizedBox(height: 16),
              const Text(
                'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '
                'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HelpCategory extends StatelessWidget {
  final IconData icon;
  final String title;
  final List<Widget> children;

  const _HelpCategory({
    required this.icon,
    required this.title,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return ExpansionTile(
      leading: Icon(icon),
      title: Text(title),
      children: children,
    );
  }
}

class _HelpItem extends StatelessWidget {
  final String title;
  final VoidCallback onTap;

  const _HelpItem({
    required this.title,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(title),
      trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }
}
