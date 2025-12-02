import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';
import { MobileLayout, Header } from '../components/Shared';
import { useStore } from '../store';
import Icon from 'react-native-vector-icons/Feather';

const History: React.FC = () => {
  const { friends } = useStore();
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
      
      {/* Friend Banner Header */}
      <View style={styles.bannerContainer}>
        <View style={styles.banner} />
        <View style={styles.avatarContainer}>
          <Image source={{ uri: activeFriend.avatar }} style={styles.bannerAvatar} />
        </View>
      </View>
      
      <View style={styles.statsContainer}>
        <Text style={styles.friendName}>{activeFriend.name}</Text>
        <View style={styles.distanceBadge}>
          <Icon name="navigation" size={14} color="#3b82f6" />
          <Text style={styles.distanceText}>15.9 KM Today</Text>
        </View>
      </View>

      {/* Timeline Sheet */}
      <ScrollView style={styles.timelineSheet} contentContainerStyle={styles.timelineContent}>
        <View style={styles.timelineCentered}>
          {/* Vertical Line */}
          <View style={styles.timelineLine} />

          {/* Date Marker */}
          <View style={styles.dateMarker}>
            <Text style={styles.dateText}>Today, Oct 24</Text>
          </View>

          {/* Timeline Items */}
          {timelineItems.map((item, idx) => (
            <View key={idx} style={styles.timelineItem}>
              {item.align === 'left' && (
                <View style={[styles.timelineContent, styles.timelineLeft]}>
                  <Text style={styles.placeName}>{item.place}</Text>
                  <Text style={styles.placeDur}>{item.dur}</Text>
                  <Text style={styles.placeTime}>{item.time}</Text>
                </View>
              )}
              
              <View style={styles.timelineDot} />

              {item.align === 'right' && (
                <View style={[styles.timelineContent, styles.timelineRight]}>
                  <Text style={styles.placeName}>{item.place}</Text>
                  <Text style={styles.placeDur}>{item.dur}</Text>
                  <Text style={styles.placeTime}>{item.time}</Text>
                </View>
              )}
            </View>
          ))}
          
          {/* Older Records */}
          <View style={styles.dateMarker}>
            <Text style={styles.dateText}>Yesterday, Oct 23</Text>
          </View>
          
          <View style={styles.timelineItem}>
            <View style={[styles.timelineContent, styles.timelineLeft]}>
              <Text style={styles.placeName}>Central Park</Text>
              <Text style={styles.placeDur}>2h 30m</Text>
              <Text style={styles.placeTime}>16:00</Text>
            </View>
            <View style={[styles.timelineDot, styles.timelineDotInactive]} />
            <View style={[styles.timelineContent, styles.timelineRight]} />
          </View>
        </View>
      </ScrollView>
    </MobileLayout>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'relative',
    marginBottom: 60,
  },
  banner: {
    height: 120,
    backgroundColor: '#3b82f6',
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
    color: '#1e293b',
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
    color: '#1e293b',
  },
  timelineSheet: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
    color: '#64748b',
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
    backgroundColor: '#3b82f6',
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
    color: '#1e293b',
    fontSize: 14,
  },
  placeDur: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  placeTime: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '600',
    marginTop: 4,
  },
});

export default History;
