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
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';
import '../../../config_app_bank/bank_text_styles.dart';
import '../models/bank_card.dart';
import 'action_card.dart';

class CardControls extends StatelessWidget {
  final BankCard currentCard;
  final Function(BankCard) onToggleCardStatus;
  final Function(BankCard) onToggleContactless;
  final VoidCallback onResetPin;
  final VoidCallback onCardLimits;

  const CardControls({
    super.key,
    required this.currentCard,
    required this.onToggleCardStatus,
    required this.onToggleContactless,
    required this.onResetPin,
    required this.onCardLimits,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFFF8F9FA),
              borderRadius: BorderRadius.circular(BankConstants.borderRadius),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      currentCard.cardType == CardType.credit
                          ? 'Available Credit'
                          : 'Available Balance',
                      style: BankTextStyles.bodyMedium.copyWith(
                        color: Colors.grey[600],
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      currentCard.cardType == CardType.credit
                          ? '\$${(currentCard.creditLimit! + currentCard.balance).toStringAsFixed(2)}'
                          : '\$${currentCard.balance.toStringAsFixed(2)}',
                      style: BankTextStyles.headingLarge.copyWith(
                        color: const Color(0xFF2C3E50),
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                if (currentCard.cardType == CardType.credit)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        'Credit Limit',
                        style: BankTextStyles.bodySmall.copyWith(
                          color: Colors.grey[600],
                        ),
                      ),
                      Text(
                        '\$${currentCard.creditLimit!.toStringAsFixed(2)}',
                        style: BankTextStyles.bodyLarge.copyWith(
                          color: const Color(0xFF2C3E50),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
          const SizedBox(height: 30),
          Text(
            'Quick Actions',
            style: BankTextStyles.headingMedium.copyWith(
              color: const Color(0xFF2C3E50),
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 3,
            crossAxisSpacing: 16,
            mainAxisSpacing: 16,
            childAspectRatio: 1.1,
            children: [
              ActionCard(
                icon: currentCard.isActive
                    ? Icons.pause_circle
                    : Icons.play_circle,
                title: currentCard.isActive ? 'Freeze Card' : 'Activate Card',
                color: currentCard.isActive ? Colors.orange : Colors.green,
                onTap: () => onToggleCardStatus(currentCard),
              ),
              ActionCard(
                icon: Icons.lock_reset,
                title: 'Reset PIN',
                color: const Color(0xFF4A90E2),
                onTap: onResetPin,
              ),
              ActionCard(
                icon: Icons.receipt_long,
                title: 'Statements',
                color: const Color(0xFF9B59B6),
                onTap: () {
                  // TODO: Add loading dialog if needed
                },
              ),
              ActionCard(
                icon: Icons.settings,
                title: 'Card Limits',
                color: const Color(0xFF34495E),
                onTap: onCardLimits,
              ),
              ActionCard(
                icon: Icons.contactless,
                title: 'Contactless',
                color: const Color(0xFF27AE60),
                onTap: () => onToggleContactless(currentCard),
              ),
              ActionCard(
                icon: Icons.help_outline,
                title: 'Support',
                color: const Color(0xFFE67E22),
                onTap: () {
                  // TODO: Add loading dialog if needed
                },
              ),
            ],
          ),
          const SizedBox(height: 30),
          Text(
            'Recent Card Transactions',
            style: BankTextStyles.headingMedium.copyWith(
              color: const Color(0xFF2C3E50),
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: ListView.separated(
              itemCount: 3,
              separatorBuilder: (context, index) => const Divider(),
              itemBuilder: (context, index) {
                return ListTile(
                  leading: const CircleAvatar(
                    backgroundColor: Color(0xFFF0F0F0),
                    child: Icon(Icons.shopping_bag, color: Color(0xFF666666)),
                  ),
                  title: Text(
                    ['Amazon Purchase', 'Starbucks', 'Gas Station'][index],
                    style: BankTextStyles.bodyMedium.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  subtitle: Text(
                    ['Online', 'Coffee Shop', 'Fuel'][index],
                    style: BankTextStyles.bodySmall.copyWith(
                      color: Colors.grey[600],
                    ),
                  ),
                  trailing: Text(
                    ['-\$89.99', '-\$12.50', '-\$45.00'][index],
                    style: BankTextStyles.bodyMedium.copyWith(
                      color: Colors.red,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
