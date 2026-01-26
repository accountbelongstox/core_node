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
import '../config_app_bank/constants.dart';

enum BankPageType {
  dashboard,
  cardManagement,
  investment,
  life,
  profile,
}

class BankRotatingSearchHint extends StatefulWidget {
  final BankPageType pageType;
  final Color? textColor;
  final double fontSize;
  final EdgeInsets? padding;
  final Color? backgroundColor;
  final double borderRadius;
  final Widget? prefixIcon;
  final Widget? suffixIcon;
  final VoidCallback? onTap;

  const BankRotatingSearchHint({
    super.key,
    required this.pageType,
    this.textColor,
    this.fontSize = 14,
    this.padding,
    this.backgroundColor,
    this.borderRadius = BankConstants.searchInputBorderRadius,
    this.prefixIcon,
    this.suffixIcon,
    this.onTap,
  });

  @override
  State<BankRotatingSearchHint> createState() => _BankRotatingSearchHintState();
}

class _BankRotatingSearchHintState extends State<BankRotatingSearchHint> {
  late List<String> _hints;
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    _hints = _getHintsForPageType(widget.pageType);
    _startRotation();
  }

  List<String> _getHintsForPageType(BankPageType pageType) {
    switch (pageType) {
      case BankPageType.dashboard:
        return [
          '个人养老金来啦，快来了解',
          '查看最新存款产品利率',
          '了解热门理财产品推荐',
          '查看基金投资产品',
          '申请信用卡享好礼',
          '轻松缴纳生活费用',
          '查看优惠省钱活动',
          '完成任务赢好礼',
          '查看贵金属投资',
          '开通个人养老金账户',
        ];
      case BankPageType.cardManagement:
        return [
          '手机号收款超省心',
          '申请信用卡享好礼',
          '查看信用卡权益包',
          '查看我的信用卡权益',
          '查看增值礼遇活动',
          '申请信用卡额度调整',
          '使用积分兑换好礼',
          '申请信用卡分期通',
          '一键绑定信用卡支付',
          '信用卡现金转出服务',
        ];
      case BankPageType.investment:
        return [
          '零花钱好去处，让钱生钱',
          '查看最新存款产品',
          '了解热门理财产品',
          '查看基金投资产品',
          '了解保险产品保障',
          '进行财富体检评估',
          '查看龙钱宝1号详情',
          '查看龙钱宝2号详情',
          '查看速盈产品收益',
          '查看贵金属投资',
        ];
      case BankPageType.life:
        return [
          '零花钱好去处，生活更精彩',
          '缴纳手机话费充值',
          '缴纳电费账单',
          '使用医保码就医',
          '参与低碳生活活动',
          '购买电影演出票',
          '使用智慧食堂服务',
          '查看积分汇活动',
          '缴纳党费',
          '缴纳燃气费账单',
          '缴纳水费账单',
        ];
      case BankPageType.profile:
        return [
          '查看我的资产详情',
          '查看信用卡信息',
          '查看贷款信息',
          '查看任务中心',
          '申请各类证明',
          '查看我的支付记录',
          '查看我的订单',
          '查看最近使用功能',
        ];
    }
  }

  void _startRotation() {
    if (_hints.length <= 1) return;

    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) {
        setState(() {
          _currentIndex = (_currentIndex + 1) % _hints.length;
        });
        _startRotation();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final textColor = widget.textColor ?? Colors.grey;
    final backgroundColor = widget.backgroundColor ?? Colors.white.withOpacity(0.9);
    final padding = widget.padding ?? const EdgeInsets.symmetric(horizontal: 16, vertical: 8);

    return GestureDetector(
      onTap: widget.onTap,
      child: Container(
        padding: padding,
        decoration: BoxDecoration(
          color: backgroundColor,
          borderRadius: BorderRadius.circular(widget.borderRadius),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            if (widget.prefixIcon != null) ...[
              widget.prefixIcon!,
              const SizedBox(width: 8),
            ],
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 300),
                transitionBuilder: (Widget child, Animation<double> animation) {
                  return FadeTransition(
                    opacity: animation,
                    child: SlideTransition(
                      position: Tween<Offset>(
                        begin: const Offset(0.0, 0.1),
                        end: Offset.zero,
                      ).animate(animation),
                      child: child,
                    ),
                  );
                },
                child: Text(
                  _hints[_currentIndex],
                  key: ValueKey<String>(_hints[_currentIndex]),
                  style: TextStyle(
                    fontSize: widget.fontSize,
                    color: textColor,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
            if (widget.suffixIcon != null) ...[
              const SizedBox(width: 8),
              widget.suffixIcon!,
            ],
          ],
        ),
      ),
    );
  }
}
