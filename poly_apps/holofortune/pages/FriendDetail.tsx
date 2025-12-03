import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useStore } from '../store';
import { MobileLayout, Header, GlassCard } from '../components/Shared';
import Icon from 'react-native-vector-icons/Feather';

const FriendDetail: React.FC = () => {
  const route = useRoute<any>();
  const { id } = route.params || {};
  const { friends, t } = useStore();
  const friend = friends.find(f => f.id === id);

  if (!friend) {
    return (
      <MobileLayout showNav={false}>
        <Header title="Friend" />
        <View style={styles.errorContainer}>
          <Text>Not Found</Text>
        </View>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout showNav={false}>
      <Header title={friend.name} backTo="/friends" />
      
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Map Preview */}
        <TouchableOpacity>
          <GlassCard style={styles.mapPreview}>
            <View style={styles.mapPlaceholder}>
              <Text style={styles.mapPlaceholderText}>MAP VIEW</Text>
            </View>
            <View style={styles.mapFooter}>
              <View style={styles.mapFooterLeft}>
                <Icon name="map-pin" size={12} color="#3b82f6" />
                <Text style={styles.mapFooterText}>{friend.location.address}</Text>
              </View>
              <Text style={styles.mapFooterTime}>Updated: 1 min ago</Text>
            </View>
          </GlassCard>
        </TouchableOpacity>

        {/* Health Stats */}
        <View style={styles.statsGrid}>
          <GlassCard style={styles.statCard}>
            <Icon name="footprints" size={24} color="#fb923c" />
            <Text style={styles.statValue}>{friend.health?.steps}</Text>
            <Text style={styles.statLabel}>Steps</Text>
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <Icon name="heart" size={24} color="#f87171" />
            <Text style={styles.statValue}>
              {friend.health?.heartRate} <Text style={styles.statUnit}>bpm</Text>
            </Text>
            <Text style={styles.statLabel}>Heart</Text>
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <Icon name="thermometer" size={24} color="#60a5fa" />
            <Text style={styles.statValue}>{friend.health?.temp}°C</Text>
            <Text style={styles.statLabel}>Temp</Text>
          </GlassCard>
        </View>

        {/* Device Report */}
        <GlassCard>
          <Text style={styles.sectionTitle}>{t('stats.device')}</Text>
          <View style={styles.deviceList}>
            <View style={styles.deviceItem}>
              <View style={styles.deviceItemLeft}>
                <View style={[styles.deviceIcon, { backgroundColor: '#dbeafe' }]}>
                  <Icon name="wifi" size={18} color="#2563eb" />
                </View>
                <Text style={styles.deviceLabel}>Network</Text>
              </View>
              <Text style={styles.deviceValue}>{friend.device?.network}</Text>
            </View>
            <View style={styles.deviceItem}>
              <View style={styles.deviceItemLeft}>
                <View style={[styles.deviceIcon, { backgroundColor: '#f3e8ff' }]}>
                  <Icon name="smartphone" size={18} color="#9333ea" />
                </View>
                <Text style={styles.deviceLabel}>Unlocks</Text>
              </View>
              <Text style={styles.deviceValue}>{friend.device?.unlocks} times</Text>
            </View>
            <View style={[styles.deviceItem, { borderBottomWidth: 0 }]}>
              <View style={styles.deviceItemLeft}>
                <View style={[styles.deviceIcon, { backgroundColor: '#ffedd5' }]}>
                  <Icon name="clock" size={18} color="#ea580c" />
                </View>
                <Text style={styles.deviceLabel}>Screen Time</Text>
              </View>
              <Text style={styles.deviceValue}>{friend.device?.usageTime}</Text>
            </View>
          </View>
        </GlassCard>

        {/* Places */}
        <GlassCard>
          <Text style={styles.sectionTitle}>{t('stats.places')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.placesScroll}>
            {[1, 2, 3].map(i => (
              <View key={i} style={styles.placeCard}>
                <Icon name="map-pin" size={16} color="#3b82f6" style={{ marginBottom: 4 }} />
                <Text style={styles.placeName}>Central Park</Text>
                <Text style={styles.placeTime}>2h 30m</Text>
              </View>
            ))}
          </ScrollView>
        </GlassCard>
      </ScrollView>
    </MobileLayout>
  );
};

const styles = StyleSheet.create({
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
  },
  mapFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mapFooterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  mapFooterTime: {
    fontSize: 10,
    color: '#64748b',
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
    color: '#1e293b',
  },
  statUnit: {
    fontSize: 12,
  },
  statLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    color: '#64748b',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#94a3b8',
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
    borderBottomColor: 'rgba(0,0,0,0.05)',
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
    color: '#1e293b',
  },
  deviceValue: {
    fontWeight: '700',
    color: '#475569',
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
    color: '#94a3b8',
    marginTop: 4,
  },
});

export default FriendDetail;
