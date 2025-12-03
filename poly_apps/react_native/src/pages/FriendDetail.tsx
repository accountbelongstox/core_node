import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { useRoute } from '@react-navigation/native';
import { useStore } from '../store';
import { MobileLayout, Header, GlassCard } from '../components/Shared';
import { Feather as Icon } from '@react-native-vector-icons/feather';
import { getTheme } from '../styles/theme';

const FriendDetail: React.FC = () => {
  const route = useRoute<any>();
  const { id } = route.params || {};
  const { friends, t, theme } = useStore();
  const colors = getTheme(theme);
  const friend = friends.find(f => f.id === id);

  if (!friend) {
    return (
      <MobileLayout showNav={false}>
        <Header title="Friend" />
        <View style={localStyles.errorContainer}>
          <Text style={{ color: colors.textPrimary }}>Not Found</Text>
        </View>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout showNav={false}>
      <Header title={friend.name} backTo="/friends" />
      
      <ScrollView style={localStyles.content} contentContainerStyle={localStyles.contentContainer}>
        {/* Map Preview */}
        <TouchableOpacity>
          <GlassCard style={localStyles.mapPreview}>
            <View style={localStyles.mapPlaceholder}>
              <Text style={localStyles.mapPlaceholderText}>MAP VIEW</Text>
            </View>
            <View style={localStyles.mapFooter}>
              <View style={localStyles.mapFooterLeft}>
                <Icon name="map-pin" size={12} color={colors.primary} />
                <Text style={[localStyles.mapFooterText, { color: colors.textPrimary }]}>{friend.location.address}</Text>
              </View>
              <Text style={[localStyles.mapFooterTime, { color: colors.textSecondary }]}>Updated: 1 min ago</Text>
            </View>
          </GlassCard>
        </TouchableOpacity>

        {/* Health Stats */}
        <View style={localStyles.statsGrid}>
          <GlassCard style={localStyles.statCard}>
            <Icon name="footprints" size={24} color="#fb923c" />
            <Text style={[localStyles.statValue, { color: colors.textPrimary }]}>{friend.health?.steps}</Text>
            <Text style={[localStyles.statLabel, { color: colors.textSecondary }]}>Steps</Text>
          </GlassCard>
          <GlassCard style={localStyles.statCard}>
            <Icon name="heart" size={24} color="#f87171" />
            <Text style={[localStyles.statValue, { color: colors.textPrimary }]}>
              {friend.health?.heartRate} <Text style={localStyles.statUnit}>bpm</Text>
            </Text>
            <Text style={[localStyles.statLabel, { color: colors.textSecondary }]}>Heart</Text>
          </GlassCard>
          <GlassCard style={localStyles.statCard}>
            <Icon name="thermometer" size={24} color="#60a5fa" />
            <Text style={[localStyles.statValue, { color: colors.textPrimary }]}>{friend.health?.temp}°C</Text>
            <Text style={[localStyles.statLabel, { color: colors.textSecondary }]}>Temp</Text>
          </GlassCard>
        </View>

        {/* Device Report */}
        <GlassCard>
          <Text style={[localStyles.sectionTitle, { color: colors.textSecondary }]}>{t('stats.device')}</Text>
          <View style={localStyles.deviceList}>
            <View style={[localStyles.deviceItem, { borderBottomColor: 'rgba(0,0,0,0.05)' }]}>
              <View style={localStyles.deviceItemLeft}>
                <View style={[localStyles.deviceIcon, { backgroundColor: '#dbeafe' }]}>
                  <Icon name="wifi" size={18} color="#2563eb" />
                </View>
                <Text style={[localStyles.deviceLabel, { color: colors.textPrimary }]}>Network</Text>
              </View>
              <Text style={[localStyles.deviceValue, { color: colors.textPrimary }]}>{friend.device?.network}</Text>
            </View>
            <View style={[localStyles.deviceItem, { borderBottomColor: 'rgba(0,0,0,0.05)' }]}>
              <View style={localStyles.deviceItemLeft}>
                <View style={[localStyles.deviceIcon, { backgroundColor: '#f3e8ff' }]}>
                  <Icon name="smartphone" size={18} color="#9333ea" />
                </View>
                <Text style={[localStyles.deviceLabel, { color: colors.textPrimary }]}>Unlocks</Text>
              </View>
              <Text style={[localStyles.deviceValue, { color: colors.textPrimary }]}>{friend.device?.unlocks} times</Text>
            </View>
            <View style={localStyles.deviceItem}>
              <View style={localStyles.deviceItemLeft}>
                <View style={[localStyles.deviceIcon, { backgroundColor: '#ffedd5' }]}>
                  <Icon name="clock" size={18} color="#ea580c" />
                </View>
                <Text style={[localStyles.deviceLabel, { color: colors.textPrimary }]}>Screen Time</Text>
              </View>
              <Text style={[localStyles.deviceValue, { color: colors.textPrimary }]}>{friend.device?.usageTime}</Text>
            </View>
          </View>
        </GlassCard>

        {/* Places */}
        <GlassCard>
          <Text style={[localStyles.sectionTitle, { color: colors.textSecondary }]}>{t('stats.places')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={localStyles.placesScroll}>
            {[1, 2, 3].map(i => (
              <View key={i} style={localStyles.placeCard}>
                <Icon name="map-pin" size={16} color={colors.primary} style={{ marginBottom: 4 }} />
                <Text style={[localStyles.placeName, { color: colors.textPrimary }]}>Central Park</Text>
                <Text style={[localStyles.placeTime, { color: colors.textSecondary }]}>2h 30m</Text>
              </View>
            ))}
          </ScrollView>
        </GlassCard>
      </ScrollView>
    </MobileLayout>
  );
};

const localStyles = StyleSheet.create({
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    gap: 16,
    paddingBottom: 40,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPreview: {
    padding: 0,
    height: 160,
    position: 'relative',
    overflow: 'hidden',
  },
  mapPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPlaceholderText: {
    color: '#93c5fd',
    fontWeight: '700',
    fontSize: 24,
    opacity: 0.5,
  },
  mapFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.6)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'hidden',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  mapFooterContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    zIndex: 1,
  },
  mapFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mapFooterText: {
    fontSize: 12,
    fontWeight: '700',
  },
  mapFooterTime: {
    fontSize: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statUnit: {
    fontSize: 12,
  },
  statLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  deviceList: {
    gap: 0,
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  deviceItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deviceIcon: {
    padding: 8,
    borderRadius: 8,
  },
  deviceLabel: {
    fontWeight: '500',
  },
  deviceValue: {
    fontWeight: '700',
  },
  placesScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  placeCard: {
    minWidth: 100,
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    marginRight: 16,
  },
  placeName: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    textAlign: 'center',
  },
  placeTime: {
    fontSize: 10,
    marginTop: 4,
  },
});

export default FriendDetail;

