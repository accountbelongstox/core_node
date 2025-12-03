import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { ThemeColors } from './theme';

export const createStyles = (colors: ThemeColors) => {
  return StyleSheet.create({
    // Layout
    mobileLayout: {
      flex: 1,
      position: 'relative',
    },
    contentScroll: {
      flex: 1,
    },
    flexCenter: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    flexCol: {
      display: 'flex',
      flexDirection: 'column',
    },
    flexRow: {
      display: 'flex',
      flexDirection: 'row',
    },
    itemsCenter: {
      alignItems: 'center',
    },
    justifyBetween: {
      justifyContent: 'space-between',
    },
    textCenter: {
      textAlign: 'center',
    },
    // Spacing
    gap1: { gap: 4 },
    gap2: { gap: 8 },
    gap3: { gap: 12 },
    gap4: { gap: 16 },
    p4: { padding: 16 },
    px5: { paddingLeft: 20, paddingRight: 20 },
    py4: { paddingTop: 16, paddingBottom: 16 },
    mt4: { marginTop: 16 },
    mb4: { marginBottom: 16 },
    // Glass Card
    glassCard: {
      borderRadius: colors.cardRadius,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glassBg,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    // Buttons
    btn: {
      width: '100%',
      padding: 14,
      borderRadius: colors.btnRadius,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnPrimary: {
      backgroundColor: colors.primary,
    },
    btnDanger: {
      backgroundColor: colors.danger,
    },
    btnGhost: {
      backgroundColor: 'transparent',
    },
    btnDisabled: {
      opacity: 0.5,
    },
    btnText: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    // Input
    inputField: {
      width: '100%',
      padding: 12,
      borderRadius: colors.btnRadius,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.inputBg,
      color: colors.textPrimary,
      fontSize: 16,
    },
    // Navigation
    floatingNavContainer: {
      position: 'absolute',
      bottom: 30,
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 100,
    },
    floatingNav: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderRadius: 28,
      paddingHorizontal: 24,
      paddingVertical: 10,
      width: '90%',
      maxWidth: 440,
      backgroundColor: colors.navBg,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 10,
    },
    navItem: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 48,
    },
    navLabel: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.3,
      marginTop: 4,
      color: colors.navText,
    },
    navCenterBtn: {
      width: 56,
      height: 56,
      backgroundColor: colors.navActive,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -24,
      borderWidth: 4,
      borderColor: colors.bg,
      shadowColor: colors.navActive,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 8,
    },
    // Header
    appHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      paddingHorizontal: 20,
      backgroundColor: colors.bg,
      zIndex: 20,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    backBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: -8,
    },
    // Background Orbs
    orb: {
      position: 'absolute',
      borderRadius: 999,
      opacity: 0.6,
    },
    orb1: {
      top: '-20%',
      left: '-20%',
      width: '80%',
      height: '50%',
      backgroundColor: 'rgba(59, 130, 246, 0.25)',
    },
    orb2: {
      bottom: '-10%',
      right: '-10%',
      width: '80%',
      height: '50%',
      backgroundColor: 'rgba(168, 85, 247, 0.25)',
    },
  });
};

