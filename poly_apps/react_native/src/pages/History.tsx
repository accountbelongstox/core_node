import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { MobileLayout, Header } from '../components/Shared';
import { useStore } from '../store';
import { Feather as Icon } from '@react-native-vector-icons/feather';
import { getTheme } from '../styles/theme';

const History: React.FC = () => {
  const { friends, theme } = useStore();
  const colors = getTheme(theme);
  const activeFriend = friends[0];

  const timelineItems = [
    { time: '18:30', place: 'Home Sweet Home', dur: 'Arrived', align: 'left' },
    { time: '17:15', place: 'City Gym Center', dur: '1h 15m', align: 'right' },
    { time: '14:30', place: 'Starbucks Coffee', dur: '45m', align: 'left' },
    { time: '09:00', place: 'Tech Office Park', dur: '8h 00m', align: 'right' },
  ];

  return (
    <MobileLayout showNav={false}>
      <Header title="History Track" backTo="/friends" />
      
      {/* Friend Banner Header - Gradient Background */}
      <View style={localStyles.bannerContainer}>
        <LinearGradient
          colors={[colors.primary, '#8b5cf6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[localStyles.banner, { opacity: 0.9 }]}
        />
        <View style={localStyles.avatarContainer}>
          <Image source={{ uri: activeFriend.avatar }} style={localStyles.bannerAvatar} />
        </View>
      </View>
      
      <View style={localStyles.statsContainer}>
        <Text style={[localStyles.friendName, { color: colors.textPrimary }]}>{activeFriend.name}</Text>
        <View style={localStyles.distanceBadge}>
          <Icon name="navigation" size={14} color={colors.primary} />
          <Text style={[localStyles.distanceText, { color: colors.textPrimary }]}>15.9 KM Today</Text>
        </View>
      </View>

      {/* Timeline Sheet */}
      <ScrollView style={[localStyles.timelineSheet, { backgroundColor: colors.bg }]} contentContainerStyle={localStyles.timelineContent}>
        <View style={localStyles.timelineCentered}>
          {/* Vertical Line */}
          <View style={localStyles.timelineLine} />

          {/* Date Marker */}
          <View style={localStyles.dateMarker}>
            <Text style={[localStyles.dateText, { color: colors.textSecondary }]}>Today, Oct 24</Text>
          </View>

          {/* Timeline Items */}
          {timelineItems.map((item, idx) => (
            <View key={idx} style={localStyles.timelineItem}>
              {item.align === 'left' && (
                <View style={[localStyles.timelineContent, localStyles.timelineLeft]}>
                  <Text style={[localStyles.placeName, { color: colors.textPrimary }]}>{item.place}</Text>
                  <Text style={[localStyles.placeDur, { color: colors.textSecondary }]}>{item.dur}</Text>
                  <Text style={[localStyles.placeTime, { color: colors.primary }]}>{item.time}</Text>
                </View>
              )}
              
              <View style={[localStyles.timelineDot, { backgroundColor: colors.primary }]} />

              {item.align === 'right' && (
                <View style={[localStyles.timelineContent, localStyles.timelineRight]}>
                  <Text style={[localStyles.placeName, { color: colors.textPrimary }]}>{item.place}</Text>
                  <Text style={[localStyles.placeDur, { color: colors.textSecondary }]}>{item.dur}</Text>
                  <Text style={[localStyles.placeTime, { color: colors.primary }]}>{item.time}</Text>
                </View>
              )}
            </View>
          ))}
          
          {/* Older Records */}
          <View style={localStyles.dateMarker}>
            <Text style={[localStyles.dateText, { color: colors.textSecondary }]}>Yesterday, Oct 23</Text>
          </View>
          
          <View style={localStyles.timelineItem}>
            <View style={[localStyles.timelineContent, localStyles.timelineLeft]}>
              <Text style={[localStyles.placeName, { color: colors.textPrimary }]}>Central Park</Text>
              <Text style={[localStyles.placeDur, { color: colors.textSecondary }]}>2h 30m</Text>
              <Text style={[localStyles.placeTime, { color: colors.primary }]}>16:00</Text>
            </View>
            <View style={[localStyles.timelineDot, localStyles.timelineDotInactive]} />
            <View style={[localStyles.timelineContent, localStyles.timelineRight]} />
          </View>
        </View>
      </ScrollView>
    </MobileLayout>
  );
};

const localStyles = StyleSheet.create({
  bannerContainer: {
    position: 'relative',
    marginBottom: 60,
  },
  banner: {
    height: 120,
    overflow: 'hidden',
  },
  avatarContainer: {
    position: 'absolute',
    bottom: -40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bannerAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'white',
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  statsContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  friendName: {
    fontSize: 20,
    fontWeight: '700',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 8,
  },
  distanceText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timelineSheet: {
    flex: 1,
    marginTop: -24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  timelineContent: {
    paddingTop: 40,
    paddingBottom: 40,
  },
  timelineCentered: {
    alignItems: 'center',
    position: 'relative',
    paddingBottom: 40,
  },
  timelineLine: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#cbd5e1',
    transform: [{ translateX: -1 }],
  },
  dateMarker: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 99,
    marginVertical: 16,
    zIndex: 5,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
  },
  timelineItem: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 32,
    position: 'relative',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  timelineContent: {
    width: '45%',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 2,
  },
  timelineLeft: {
    alignItems: 'flex-end',
  },
  timelineRight: {
    alignItems: 'flex-start',
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderWidth: 3,
    borderColor: 'white',
    borderRadius: 7,
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: -7 }],
    top: 12,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  timelineDotInactive: {
    backgroundColor: '#cbd5e1',
  },
  placeName: {
    fontWeight: '700',
    fontSize: 14,
  },
  placeDur: {
    fontSize: 12,
    marginTop: 2,
  },
  placeTime: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});

export default History;

