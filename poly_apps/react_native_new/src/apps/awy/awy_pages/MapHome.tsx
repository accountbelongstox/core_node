import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { GlassCard, BottomNav } from '@/apps/awy/awy_components/Shared';
import { useStore } from '@/apps/awy/awy_store';
import Icon from '@react-native-vector-icons/feather';
import { Avatar } from '@/common/components/Avatar';

const { width, height } = Dimensions.get('window');

const MapHome: React.FC = () => {
  const { friends, t, theme } = useStore();
  const activeFriend = friends[0]; // Select first friend for demo
  const isDark = theme === 'dark';

  // OpenStreetMap HTML with Leaflet.js
  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { width: 100%; height: 100vh; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', {
          zoomControl: false,
          attributionControl: false
        }).setView([${activeFriend.location.lat}, ${activeFriend.location.lng}], 15);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);

        var marker = L.marker([${activeFriend.location.lat}, ${activeFriend.location.lng}]).addTo(map);
        marker.bindPopup('${activeFriend.name}');
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      {/* Full Screen Map Container with WebView */}
      <WebView
        style={styles.map}
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />

      {/* Floating Header Controls */}
      <View style={styles.mapControls}>
        <TouchableOpacity style={[styles.controlBtn, styles.alertBtn]}>
          <Icon name="shield-alert" size={20} color="#ef4444" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.controlBtn, styles.normalBtn]}>
          <Icon name="bell" size={20} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      {/* Bottom Card */}
      <View style={styles.mapCardContainer}>
        <GlassCard style={styles.mapCard}>
          <View style={styles.cardHeader}>
            <View style={styles.avatarContainer}>
              <Avatar
                uri={activeFriend.avatar}
                gender={activeFriend.gender}
                size={56}
                style={{ borderWidth: 2, borderColor: 'white' }}
              />
              <View style={styles.statusDot} />
            </View>
            <View style={styles.cardContent}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{activeFriend.name}</Text>
                <View style={styles.relationBadge}>
                  <Text style={styles.relationText}>{activeFriend.relation}</Text>
                </View>
              </View>
              <View style={styles.daysRow}>
                <Icon name="heart" size={12} color="#ec4899" />
                <Text style={styles.daysText}>
                  {t('home.days')}: {activeFriend.daysConnected}
                </Text>
              </View>
            </View>
            <View style={styles.batteryContainer}>
              <Text style={styles.batteryLabel}>{t('home.battery')}</Text>
              <Text style={styles.batteryValue}>85%</Text>
            </View>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity style={[styles.actionButton, styles.sosButton]}>
              <Icon name="shield-alert" size={16} color="#ef4444" />
              <Text style={[styles.actionText, styles.sosText]}>{t('home.sos')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.heartRateButton]}>
              <Icon name="heart" size={16} color="#3b82f6" />
              <Text style={[styles.actionText, styles.heartRateText]}>{t('home.heartRate')}</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>
      </View>

      {/* Bottom Navigation */}
      <BottomNav />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  mapControls: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 20,
    flexDirection: 'row',
    gap: 12,
  },
  controlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  alertBtn: {
    // Animation handled by pulse if needed
  },
  normalBtn: {
    // Normal state
  },
  mapCardContainer: {
    position: 'absolute',
    bottom: 110,
    left: 16,
    right: 16,
    zIndex: 20,
  },
  mapCard: {
    padding: 0,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'white',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    backgroundColor: '#22c55e',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'white',
  },
  cardContent: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontWeight: '700',
    fontSize: 18,
    color: '#1e293b',
  },
  relationBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
  },
  relationText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '500',
  },
  daysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  daysText: {
    fontSize: 12,
    color: '#64748b',
  },
  batteryContainer: {
    alignItems: 'center',
  },
  batteryLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  batteryValue: {
    fontFamily: 'monospace',
    fontWeight: '700',
    color: '#16a34a',
  },
  cardActions: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    padding: 12,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.4)',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  sosButton: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.4)',
  },
  heartRateButton: {
    // No border
  },
  actionText: {
    fontWeight: '700',
    fontSize: 14,
  },
  sosText: {
    color: '#ef4444',
  },
  heartRateText: {
    color: '#3b82f6',
  },
});

export default MapHome;
