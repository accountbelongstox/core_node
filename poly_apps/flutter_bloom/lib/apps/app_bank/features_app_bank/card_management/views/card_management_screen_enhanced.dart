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
import '../../../config_app_bank/bank_text_styles.dart';

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

  final List<BankCard> _cards = [
    BankCard(
      cardNumber: '1234 5678 9012 3456',
      cardHolder: 'JOHN DOE',
      expiryDate: '12/28',
      cardType: CardType.debit,
      bank: 'Flutter Bank',
      balance: 12459.50,
      gradient: const [Color(0xFF667eea), Color(0xFF764ba2)],
      isActive: true,
    ),
    BankCard(
      cardNumber: '9876 5432 1098 7654',
      cardHolder: 'JOHN DOE',
      expiryDate: '09/27',
      cardType: CardType.credit,
      bank: 'Flutter Bank',
      creditLimit: 5000.0,
      balance: -1250.75,
      gradient: const [Color(0xFFf093fb), Color(0xFFf5576c)],
      isActive: true,
    ),
    BankCard(
      cardNumber: '5555 4444 3333 2222',
      cardHolder: 'JOHN DOE',
      expiryDate: '06/26',
      cardType: CardType.debit,
      bank: 'Flutter Bank',
      balance: 3750.25,
      gradient: const [Color(0xFF4facfe), Color(0xFF00f2fe)],
      isActive: false,
    ),
  ];

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
                  borderRadius: BorderRadius.circular(4),
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
                  topLeft: Radius.circular(30),
                  topRight: Radius.circular(30),
                ),
              ),
              child: _buildCardControls(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCard(BankCard card) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: card.gradient,
        ),
        boxShadow: [
          BoxShadow(
            color: card.gradient[0].withOpacity(0.3),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Stack(
        children: [
          // Background Pattern
          Positioned(
            top: -50,
            right: -50,
            child: Container(
              width: 150,
              height: 150,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withOpacity(0.1),
              ),
            ),
          ),
          Positioned(
            bottom: -30,
            left: -30,
            child: Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withOpacity(0.05),
              ),
            ),
          ),

          // Card Content
          Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Bank Name and Card Status
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      card.bank,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1.2,
                      ),
                    ),
                    Row(
                      children: [
                        Icon(
                          card.isActive ? Icons.wifi : Icons.wifi_off,
                          color: Colors.white,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Icon(
                          Icons.nfc,
                          color: Colors.white.withOpacity(0.8),
                          size: 20,
                        ),
                      ],
                    ),
                  ],
                ),

                const Spacer(),

                // Chip
                Container(
                  width: 45,
                  height: 35,
                  decoration: BoxDecoration(
                    color: Colors.amber.withOpacity(0.9),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Icon(
                    Icons.memory,
                    color: Colors.black87,
                    size: 20,
                  ),
                ),

                const SizedBox(height: 20),

                // Card Number
                Text(
                  card.cardNumber,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w300,
                    letterSpacing: 3.0,
                  ),
                ),

                const Spacer(),

                // Card Holder and Expiry
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'CARD HOLDER',
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.7),
                            fontSize: 10,
                            letterSpacing: 1.5,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          card.cardHolder,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 1.2,
                          ),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          'EXPIRES',
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.7),
                            fontSize: 10,
                            letterSpacing: 1.5,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          card.expiryDate,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 1.2,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Card Type Badge
          Positioned(
            top: 16,
            right: 16,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                card.cardType == CardType.credit ? 'CREDIT' : 'DEBIT',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.0,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCardControls() {
    final currentCard = _cards[_currentCardIndex];

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Card Balance/Limit
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFFF8F9FA),
              borderRadius: BorderRadius.circular(16),
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

          // Quick Actions Grid
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
              _buildActionCard(
                icon: currentCard.isActive ? Icons.pause_circle : Icons.play_circle,
                title: currentCard.isActive ? 'Freeze Card' : 'Activate Card',
                color: currentCard.isActive ? Colors.orange : Colors.green,
                onTap: () => _toggleCardStatus(currentCard),
              ),
              _buildActionCard(
                icon: Icons.lock_reset,
                title: 'Reset PIN',
                color: const Color(0xFF4A90E2),
                onTap: () => _showResetPinDialog(),
              ),
              _buildActionCard(
                icon: Icons.receipt_long,
                title: 'Statements',
                color: const Color(0xFF9B59B6),
                onTap: () {},
              ),
              _buildActionCard(
                icon: Icons.settings,
                title: 'Card Limits',
                color: const Color(0xFF34495E),
                onTap: () => _showCardLimitsDialog(),
              ),
              _buildActionCard(
                icon: Icons.contactless,
                title: 'Contactless',
                color: const Color(0xFF27AE60),
                onTap: () => _toggleContactless(currentCard),
              ),
              _buildActionCard(
                icon: Icons.help_outline,
                title: 'Support',
                color: const Color(0xFFE67E22),
                onTap: () {},
              ),
            ],
          ),

          const SizedBox(height: 30),

          // Recent Transactions
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

  Widget _buildActionCard({
    required IconData icon,
    required String title,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              color: color,
              size: 32,
            ),
            const SizedBox(height: 8),
            Text(
              title,
              style: BankTextStyles.bodySmall.copyWith(
                color: color,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
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
}

enum CardType { debit, credit }

class BankCard {
  final String cardNumber;
  final String cardHolder;
  final String expiryDate;
  final CardType cardType;
  final String bank;
  final double balance;
  final double? creditLimit;
  final List<Color> gradient;
  bool isActive;

  BankCard({
    required this.cardNumber,
    required this.cardHolder,
    required this.expiryDate,
    required this.cardType,
    required this.bank,
    required this.balance,
    this.creditLimit,
    required this.gradient,
    this.isActive = true,
  });
}