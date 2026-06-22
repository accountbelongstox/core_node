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
import '../components/card_display.dart';
import '../components/card_controls.dart';
import '../components/action_card.dart';

/// Enhanced Card Management Screen
/// Modern banking card interface with 3D card design, NFC features, and comprehensive controls
class BankCardManagementScreenEnhanced extends StatefulWidget {
  const BankCardManagementScreenEnhanced({super.key});

  @override
  State<BankCardManagementScreenEnhanced> createState() => _BankCardManagementScreenEnhancedState();
}

class _BankCardManagementScreenEnhancedState extends State<BankCardManagementScreenEnhanced>
    with TickerProviderStateMixin {
  late AnimationController _cardAnimationController;
  late Animation<double> _cardAnimation;

  final PageController _cardPageController = PageController(viewportFraction: 0.8);
  int _currentCardIndex = 0;

  // Cards should be loaded from BankUserProvider, not hardcoded
  final List<BankCard> _cards = [];

  @override
  void initState() {
    super.initState();
    _cardAnimationController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );
    _cardAnimation = CurvedAnimation(
      parent: _cardAnimationController,
      curve: Curves.easeOutBack,
    );
    _cardAnimationController.forward();
  }

  @override
  void dispose() {
    _cardAnimationController.dispose();
    _cardPageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF2C3E50)),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          'My Cards',
          style: BankTextStyles.headingMedium.copyWith(
            color: const Color(0xFF2C3E50),
            fontWeight: FontWeight.bold,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add, color: Color(0xFF2C3E50)),
            onPressed: _showAddCardDialog,
          ),
        ],
      ),
      body: Column(
        children: [
          // Cards Carousel
          SizedBox(
            height: 240,
            child: AnimatedBuilder(
              animation: _cardAnimation,
              builder: (context, child) {
                return Transform.scale(
                  scale: _cardAnimation.value,
                  child: PageView.builder(
                    controller: _cardPageController,
                    onPageChanged: (index) {
                      setState(() {
                        _currentCardIndex = index;
                      });
                    },
                    itemCount: _cards.length,
                    itemBuilder: (context, index) {
                      return Container(
                        margin: const EdgeInsets.symmetric(horizontal: 8),
                        child: _buildCard(_cards[index]),
                      );
                    },
                  ),
                );
              },
            ),
          ),

          // Card Indicators
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(
              _cards.length,
              (index) => AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                margin: const EdgeInsets.symmetric(horizontal: 4),
                height: 8,
                width: _currentCardIndex == index ? 24 : 8,
                decoration: BoxDecoration(
                  color: _currentCardIndex == index
                      ? const Color(0xFF4A90E2)
                      : Colors.grey[300],
                  borderRadius: BorderRadius.circular(BankConstants.borderRadius),
                ),
              ),
            ),
          ),

          const SizedBox(height: 30),

          // Card Controls
          Expanded(
            child: Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(BankConstants.borderRadius),
                  topRight: Radius.circular(BankConstants.borderRadius),
                ),
              ),
              child: CardControls(
                currentCard: _cards[_currentCardIndex],
                onToggleCardStatus: _toggleCardStatus,
                onToggleContactless: _toggleContactless,
                onResetPin: _showResetPinDialog,
                onCardLimits: _showCardLimitsDialog,
              ),
            ),
          ),
        ],
      ),
    );
  }


  void _toggleCardStatus(BankCard card) {
    setState(() {
      card.isActive = !card.isActive;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          card.isActive ? 'Card activated' : 'Card frozen',
        ),
        backgroundColor: card.isActive ? Colors.green : Colors.orange,
      ),
    );
  }

  void _toggleContactless(BankCard card) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Contactless Payment'),
        content: const Text('Toggle contactless payment for this card?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Contactless payment settings updated'),
                ),
              );
            },
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
  }

  void _showResetPinDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Reset PIN'),
        content: const Text('A new PIN will be sent to your registered mobile number.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('PIN reset instructions sent to your mobile'),
                ),
              );
            },
            child: const Text('Send PIN'),
          ),
        ],
      ),
    );
  }

  void _showCardLimitsDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Card Limits'),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: Text('Daily ATM Limit'),
              trailing: Text('\$500'),
            ),
            ListTile(
              title: Text('Daily Purchase Limit'),
              trailing: Text('\$2,000'),
            ),
            ListTile(
              title: Text('Online Purchase Limit'),
              trailing: Text('\$1,000'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Modify Limits'),
          ),
        ],
      ),
    );
  }

  void _showAddCardDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add New Card'),
        content: const Text('Would you like to apply for a new card?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Redirecting to card application...'),
                ),
              );
            },
            child: const Text('Apply Now'),
          ),
        ],
      ),
    );
  }

  Widget _buildCard(BankCard card) {
    return CardDisplay(card: card);
  }
}
