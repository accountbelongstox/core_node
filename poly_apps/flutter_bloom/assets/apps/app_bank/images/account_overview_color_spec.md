# Account Overview Wealth Panorama Background - Color Specifications

## Text Color Specifications

### Title: "账户总览" (Account Overview)
- **Color**: White (#FFFFFF)
- **Font Size**: 18px
- **Font Weight**: Bold (600 / FontWeight.w600)
- **Text Align**: Center

### Subtitle: "财富全景银行卡" (Wealth Panorama Bank Cards)
- **Color**: White (#FFFFFF)
- **Font Size**: 14px
- **Font Weight**: Medium (500 / FontWeight.w500)
- **Text Align**: Center

## Background Color Specifications

### Primary Background Color
- **Color**: #4A90E2 (Color(0xFF4A90E2))
- **Usage**: AppBar background, primary UI elements

### Secondary Background Color
- **Color**: #357ABD (Color(0xFF357ABD))
- **Usage**: Gradient end color, secondary UI elements

### Accent Color
- **Color**: #74B9FF (Color(0xFF74B9FF))
- **Usage**: Buttons, links, interactive elements

### Background Overlay
- **Gradient**: LinearGradient from #4A90E2 (90% opacity) to #357ABD (80% opacity)
- **Usage**: Overlay on background image for better text readability

## Image Specifications

### File Name
- **Current**: `确定上面一行字的配色及生成提示词.png`
- **Recommended**: `account_overview_wealth_panorama_bg.png`

### Image Requirements
- **Aspect Ratio**: 9:16 (portrait for mobile)
- **Resolution**: 1080x1920px or higher
- **Format**: PNG with transparency support
- **Style**: Modern banking app background with gradient from #4A90E2 to #357ABD
- **Content**: Abstract financial patterns, geometric shapes, subtle light effects
- **No Text**: Image should not contain any text overlays

## Usage in Code

```dart
// Asset reference
BankImages.accountOverviewWealthPanoramaBg

// Text styling
Text(
  '账户总览',
  style: TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w600,
    color: Colors.white,
  ),
)

Text(
  '财富全景银行卡',
  style: TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    color: Colors.white,
  ),
)
```
