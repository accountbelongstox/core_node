import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { ThemeColors } from './theme';

/**
 * Complete 1:1 migration of holofortune/style.css to React Native StyleSheet
 * All styles are migrated with full details, including glassmorphism, gradients, transparency, and blur effects
 */
export const createStyles = (colors: ThemeColors) => {
  return StyleSheet.create({
    // ============================================
    // Layout Utility Classes
    // ============================================
    mobileLayout: {
      flex: 1,
      position: 'relative',
      width: '100%',
      maxWidth: 480, // Mobile width constraint
      alignSelf: 'center',
      backgroundColor: colors.bg,
    } as ViewStyle,
    
    contentScroll: {
      flex: 1,
      paddingBottom: 120, // Space for Floating Nav
    } as ViewStyle,
    
    flexCenter: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    
    flexCol: {
      display: 'flex',
      flexDirection: 'column',
    } as ViewStyle,
    
    flexRow: {
      display: 'flex',
      flexDirection: 'row',
    } as ViewStyle,
    
    itemsCenter: {
      alignItems: 'center',
    } as ViewStyle,
    
    justifyBetween: {
      justifyContent: 'space-between',
    } as ViewStyle,
    
    textCenter: {
      textAlign: 'center',
    } as TextStyle,
    
    // ============================================
    // Spacing Utility Classes
    // ============================================
    gap1: { gap: 4 },
    gap2: { gap: 8 },
    gap3: { gap: 12 },
    gap4: { gap: 16 },
    p4: { padding: 16 },
    px5: { paddingLeft: 20, paddingRight: 20 },
    py4: { paddingTop: 16, paddingBottom: 16 },
    mt4: { marginTop: 16 },
    mb4: { marginBottom: 16 },
    
    // ============================================
    // Animated Background Orbs
    // ============================================
    orb: {
      position: 'absolute',
      borderRadius: 999,
      opacity: 0.6,
      // Note: filter: blur(80px) is not directly supported in RN
      // We use opacity and large radius to simulate blur effect
    } as ViewStyle,
    
    orb1: {
      top: '-20%',
      left: '-20%',
      width: '80%',
      height: '50%',
      backgroundColor: 'rgba(59, 130, 246, 0.25)', // Blue
    } as ViewStyle,
    
    orb2: {
      bottom: '-10%',
      right: '-10%',
      width: '80%',
      height: '50%',
      backgroundColor: 'rgba(168, 85, 247, 0.25)', // Purple
    } as ViewStyle,
    
    // ============================================
    // Glass Card - Glassmorphism Effect
    // ============================================
    glassCard: {
      backgroundColor: 'transparent', // Changed from colors.glassBg to transparent for proper layering
      // Note: backdrop-filter blur is not directly supported in RN
      // We use BlurView component wrapper for true glassmorphism
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: colors.cardRadius,
      padding: 16,
      ...colors.glassShadow,
      overflow: 'hidden', // Critical: Prevents black borders
    } as ViewStyle,
    
    // ============================================
    // Buttons
    // ============================================
    btn: {
      width: '100%',
      padding: 14,
      borderRadius: colors.btnRadius,
      fontWeight: '700',
      fontSize: 16,
      letterSpacing: 0.5,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      color: colors.textInverse,
    } as ViewStyle,
    
    btnPrimary: {
      // Note: gradient background requires LinearGradient component
      // This style is for fallback solid color
      backgroundColor: colors.primary,
      shadowColor: 'rgba(59, 130, 246, 0.3)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 15,
      elevation: 4,
    } as ViewStyle,
    
    btnDanger: {
      // Note: gradient background requires LinearGradient component
      backgroundColor: colors.danger,
      shadowColor: 'rgba(239, 68, 68, 0.3)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 15,
      elevation: 4,
    } as ViewStyle,
    
    btnGhost: {
      backgroundColor: 'transparent',
      color: colors.textPrimary,
    } as ViewStyle,
    
    btnDisabled: {
      opacity: 0.5,
    } as ViewStyle,
    
    btnText: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.5,
    } as TextStyle,
    
    // ============================================
    // Input Fields
    // ============================================
    inputField: {
      width: '100%',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: colors.btnRadius,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.inputBg,
      color: colors.textPrimary,
      fontSize: 16,
    } as ViewStyle,
    
    inputFieldFocused: {
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      borderWidth: 2,
      borderColor: colors.primary,
    } as ViewStyle,
    
    // ============================================
    // Floating Navigation Bar
    // ============================================
    floatingNavContainer: {
      position: 'absolute',
      bottom: 30,
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 100,
      overflow: 'visible', // Critical: Allow center button to extend above
      pointerEvents: 'box-none', // Allow touches to pass through to children
    } as ViewStyle,
    
    floatingNav: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.navBg,
      borderRadius: 28,
      paddingHorizontal: 24,
      paddingVertical: 10,
      width: '90%',
      maxWidth: 440,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 10,
      overflow: 'visible', // Critical: Allow center button to extend above
      position: 'relative', // Required for absolute positioning of center button
    } as ViewStyle,
    
    navItem: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      minWidth: 48,
    } as ViewStyle,
    
    navItemActive: {
      // Active state styling handled in component
    } as ViewStyle,
    
    navLabel: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.3,
      marginTop: 4,
      color: colors.navText,
    } as TextStyle,
    
    navLabelActive: {
      color: colors.navActive,
    } as TextStyle,
    
    navCenterBtn: {
      width: 56,
      height: 56,
      // Note: gradient background requires LinearGradient component
      backgroundColor: 'transparent', // Changed to transparent for gradient
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 4,
      borderColor: colors.bg, // Cutout effect
      shadowColor: 'rgba(59, 130, 246, 0.4)',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 1,
      shadowRadius: 20,
      elevation: 8,
      overflow: 'hidden', // Critical: Prevents black borders
    } as ViewStyle,
    
    // ============================================
    // Header
    // ============================================
    appHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      paddingHorizontal: 20,
      position: 'relative',
      zIndex: 20,
      backgroundColor: 'transparent', // Transparent background to not block content
    } as ViewStyle,
    
    headerTitle: {
      fontSize: 18, // 1.125rem
      fontWeight: '700',
      color: colors.textPrimary,
    } as TextStyle,
    
    backBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
      marginLeft: -8,
    } as ViewStyle,
    
    // ============================================
    // Login Page Styles
    // ============================================
    loginLogoContainer: {
      width: 80,
      height: 80,
      backgroundColor: '#ffffff',
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 25,
      elevation: 10,
      marginBottom: 24,
      transform: [{ rotate: '12deg' }],
    } as ViewStyle,
    
    gradientText: {
      color: '#ffffff',
      fontSize: 30, // 1.875rem
      fontWeight: '700',
      textShadowColor: 'rgba(0, 0, 0, 0.1)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
    } as TextStyle,
    
    socialLoginContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 24,
      marginTop: 24,
    } as ViewStyle,
    
    socialBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      // Note: backdrop-filter blur requires BlurView
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.4)',
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    
    // ============================================
    // Map Page Styles
    // ============================================
    mapFullContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 0,
    } as ViewStyle,
    
    mapControls: {
      position: 'absolute',
      top: 48,
      right: 20,
      zIndex: 20,
      flexDirection: 'row',
      gap: 12,
    } as ViewStyle,
    
    controlBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      // Note: backdrop-filter blur requires BlurView
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 4,
    } as ViewStyle,
    
    controlBtnAlert: {
      // Color handled in component
    } as ViewStyle,
    
    controlBtnNormal: {
      // Color handled in component
    } as ViewStyle,
    
    mapCardContainer: {
      position: 'absolute',
      bottom: 110, // Adjusted for floating nav
      left: 16,
      right: 16,
      zIndex: 20,
    } as ViewStyle,
    
    // ============================================
    // Friend List Styles
    // ============================================
    filterDropdown: {
      overflow: 'hidden',
      // maxHeight transition handled in component
    } as ViewStyle,
    
    filterDropdownOpen: {
      maxHeight: 200,
    } as ViewStyle,
    
    filterDropdownClosed: {
      maxHeight: 0,
    } as ViewStyle,
    
    friendItemContent: {
      flex: 1,
      flexDirection: 'column',
      gap: 4,
    } as ViewStyle,
    
    chatPreviewContainer: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: 'rgba(0, 0, 0, 0.05)',
      borderStyle: 'dashed',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    } as ViewStyle,
    
    chatPreviewText: {
      fontSize: 12, // 0.75rem
      color: colors.textSecondary,
      maxWidth: 180,
    } as TextStyle,
    
    unreadBadge: {
      backgroundColor: colors.danger,
      color: '#ffffff',
      fontSize: 10, // 0.625rem
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 99,
      fontWeight: '700',
    } as ViewStyle,
    
    friendAvatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: '#e2e8f0',
      borderWidth: 2,
      borderColor: '#ffffff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    } as ViewStyle,
    
    monitorToggle: {
      width: 48,
      height: 24,
      borderRadius: 12,
      padding: 4,
      position: 'relative',
    } as ViewStyle,
    
    monitorToggleActive: {
      backgroundColor: colors.primary,
    } as ViewStyle,
    
    monitorToggleInactive: {
      backgroundColor: '#cbd5e1',
    } as ViewStyle,
    
    toggleThumb: {
      width: 16,
      height: 16,
      backgroundColor: '#ffffff',
      borderRadius: 8,
      position: 'absolute',
      top: 4,
      left: 4,
    } as ViewStyle,
    
    toggleThumbActive: {
      transform: [{ translateX: 24 }],
    } as ViewStyle,
    
    // ============================================
    // Profile & History Banner Styles
    // ============================================
    profileBanner: {
      height: 160,
      width: '100%',
      // Note: gradient background requires LinearGradient component
      backgroundColor: colors.primary, // Fallback
      position: 'relative',
    } as ViewStyle,
    
    profileHeaderOverlay: {
      marginTop: -60,
      flexDirection: 'column',
      alignItems: 'center',
      position: 'relative',
      zIndex: 10,
      marginBottom: 24,
    } as ViewStyle,
    
    avatarOverlap: {
      width: 110,
      height: 110,
      borderRadius: 55,
      borderWidth: 4,
      borderColor: colors.bg,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1,
      shadowRadius: 15,
      elevation: 5,
      backgroundColor: '#ffffff',
    } as ViewStyle,
    
    // ============================================
    // Dashboard/Detail Styles
    // ============================================
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    } as ViewStyle,
    
    statCard: {
      flex: 1,
      minWidth: '30%',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      gap: 8,
    } as ViewStyle,
    
    statValue: {
      fontSize: 18, // 1.125rem
      fontWeight: '700',
      color: colors.textPrimary,
    } as TextStyle,
    
    statLabel: {
      fontSize: 10, // 0.625rem
      textTransform: 'uppercase',
      color: colors.textSecondary,
    } as TextStyle,
    
    // ============================================
    // History Timeline Styles
    // ============================================
    timelineSheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      marginTop: -24,
      position: 'relative',
      zIndex: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -10 },
      shadowOpacity: 0.05,
      shadowRadius: 40,
      elevation: 10,
      flex: 1,
    } as ViewStyle,
    
    timelineCentered: {
      flexDirection: 'column',
      alignItems: 'center',
      position: 'relative',
      paddingBottom: 40,
    } as ViewStyle,
    
    timelineLineCenter: {
      position: 'absolute',
      left: '50%',
      top: 0,
      bottom: 0,
      width: 2,
      backgroundColor: '#cbd5e1',
      transform: [{ translateX: -1 }],
    } as ViewStyle,
    
    timelineItem: {
      flexDirection: 'row',
      width: '100%',
      marginBottom: 32,
      position: 'relative',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    } as ViewStyle,
    
    timelineContent: {
      width: '45%',
      backgroundColor: '#ffffff',
      padding: 12,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.02,
      shadowRadius: 6,
      elevation: 2,
      position: 'relative',
    } as ViewStyle,
    
    timelineContentLeft: {
      alignSelf: 'flex-start',
      textAlign: 'right',
    } as ViewStyle,
    
    timelineContentRight: {
      alignSelf: 'flex-end',
      textAlign: 'left',
    } as ViewStyle,
    
    timelineDateMarker: {
      backgroundColor: '#e2e8f0',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 99,
      fontSize: 12, // 0.75rem
      fontWeight: '700',
      color: '#64748b',
      marginVertical: 16,
      zIndex: 5,
      alignSelf: 'center',
    } as ViewStyle,
    
    timelineDot: {
      width: 14,
      height: 14,
      backgroundColor: colors.primary,
      borderWidth: 3,
      borderColor: '#ffffff',
      borderRadius: 7,
      position: 'absolute',
      left: '50%',
      transform: [{ translateX: -7 }],
      top: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    } as ViewStyle,
    
    // ============================================
    // Chat Page Styles
    // ============================================
    chatContainer: {
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#f8fafc',
    } as ViewStyle,
    
    chatMessages: {
      flex: 1,
      padding: 20,
      flexDirection: 'column',
      gap: 16,
    } as ViewStyle,
    
    messageBubble: {
      maxWidth: '75%',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 16,
      fontSize: 14, // 0.9rem
      lineHeight: 20, // 1.4
      position: 'relative',
    } as ViewStyle,
    
    messageBubbleMine: {
      alignSelf: 'flex-end',
      // Note: gradient background requires LinearGradient component
      backgroundColor: colors.primary, // Fallback
      borderBottomRightRadius: 4,
    } as ViewStyle,
    
    messageBubbleTheirs: {
      alignSelf: 'flex-start',
      backgroundColor: '#ffffff',
      color: colors.textPrimary,
      borderBottomLeftRadius: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 5,
      elevation: 2,
    } as ViewStyle,
    
    chatInputArea: {
      backgroundColor: '#ffffff',
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: '#e2e8f0',
    } as ViewStyle,
    
    // ============================================
    // Menu List Styles
    // ============================================
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.glassBorder,
    } as ViewStyle,
    
    menuItemLast: {
      borderBottomWidth: 0,
    } as ViewStyle,
    
    iconBox: {
      padding: 8,
      borderRadius: 8,
      color: colors.primary,
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
    } as ViewStyle,
    
    // ============================================
    // Scan/Add Friend Styles
    // ============================================
    scanArea: {
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: '#bfdbfe',
      backgroundColor: 'rgba(239, 246, 255, 0.5)',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      gap: 16,
    } as ViewStyle,
  });
};
