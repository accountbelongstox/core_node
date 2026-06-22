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
import 'package:qyflutter/common/widgets/bank_scaffold.dart';
import '../components/life_top_header.dart';
import '../components/life_main_banner.dart';
import '../components/life_services_grid.dart';
import '../components/payment_government_section.dart';
import '../components/new_customer_gift_banner.dart';
import '../components/local_good_stuff_tabs.dart';
import '../components/beautiful_life_section.dart';
import '../components/now_showing_section.dart';
// import '../components/payment_government_section_v01.dart';
// import '../components/payment_government_section_v02.dart';
// import '../components/payment_government_section_v03.dart';
// import '../components/payment_government_section_v04.dart';
// import '../components/payment_government_section_v05.dart';
// import '../components/payment_government_section_v06.dart';
// import '../components/payment_government_section_v07.dart';
// import '../components/payment_government_section_v08.dart';
// import '../components/payment_government_section_v09.dart';
// import '../components/payment_government_section_v10.dart';

class BankLifeScreen extends StatefulWidget {
  const BankLifeScreen({super.key});

  @override
  State<BankLifeScreen> createState() => _BankLifeScreenState();
}

class _BankLifeScreenState extends State<BankLifeScreen> {
  int _currentBannerIndex = 0;

  @override
  Widget build(BuildContext context) {
    return BankScaffold(
      currentBottomNavIndex: 3,
      backgroundColor: Colors.transparent,
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0xFFFCF3EC),
              Color(0xFFF8FCFF),
            ],
          ),
        ),
        child: SingleChildScrollView(
          child: Column(
            children: [
              const LifeTopHeader(),
              LifeMainBanner(
                currentBannerIndex: _currentBannerIndex,
                onPageChanged: (index) {
                  setState(() {
                    _currentBannerIndex = index;
                  });
                },
              ),
              LifeServicesGrid(),
              Container(
                color: const Color(0xFFF8FCFF),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    PaymentGovernmentSection(),
                    NewCustomerGiftBanner(),
                    BeautifulLifeSection(),
                    LocalGoodStuffTabs(),
                    NowShowingSection(),
                    // PaymentGovernmentSectionV01(),
                    // PaymentGovernmentSectionV02(),
                    // PaymentGovernmentSectionV03(),
                    // PaymentGovernmentSectionV04(),
                    // PaymentGovernmentSectionV05(),
                    // PaymentGovernmentSectionV06(),
                    // PaymentGovernmentSectionV07(),
                    // PaymentGovernmentSectionV08(),
                    // PaymentGovernmentSectionV09(),
                    // PaymentGovernmentSectionV10(),
                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

