import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { MobileLayout, Header, GlassCard, Button } from '../components/Shared';
import { useStore } from '../store';
import Icon from 'react-native-vector-icons/Feather';

const Shop: React.FC = () => {
  const { t } = useStore();

  const products = [
    { id: 1, name: 'Kids Smart Watch', price: '$49.99', dist: '1.2km', rating: 4.8 },
    { id: 2, name: 'Safety Alarm Keychain', price: '$12.50', dist: '0.5km', rating: 4.5 },
    { id: 3, name: 'Portable GPS Tracker', price: '$29.99', dist: '2.0km', rating: 4.9 },
    { id: 4, name: 'Senior Care Band', price: '$89.00', dist: '3.5km', rating: 4.7 },
  ];

  return (
    <MobileLayout>
      <Header title={t('shop.title')} />
      
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.grid}>
          {products.map(p => (
            <GlassCard key={p.id} style={styles.productCard}>
              <View style={styles.productImage}>
                <Icon name="shopping-bag" size={48} color="#94a3b8" />
              </View>
              <View style={styles.productContent}>
                <Text style={styles.productName}>{p.name}</Text>
                
                <View style={styles.productMeta}>
                  <View style={styles.metaItem}>
                    <Icon name="map-pin" size={12} color="#64748b" />
                    <Text style={styles.metaText}>{p.dist}</Text>
                  </View>
                  <View style={styles.metaDivider} />
                  <View style={styles.metaItem}>
                    <Icon name="star" size={12} color="#fbbf24" />
                    <Text style={styles.metaText}>{p.rating}</Text>
                  </View>
                </View>

                <View style={styles.productFooter}>
                  <Text style={styles.productPrice}>{p.price}</Text>
                  <TouchableOpacity style={styles.buyButton}>
                    <Text style={styles.buyButtonText}>Buy</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </GlassCard>
          ))}
        </View>
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
    paddingBottom: 40,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 16,
  },
  productCard: {
    width: '47%',
    padding: 0,
    overflow: 'hidden',
  },
  productImage: {
    height: 120,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productContent: {
    padding: 12,
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#64748b',
  },
  metaDivider: {
    width: 1,
    height: 10,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 4,
  },
  productFooter: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productPrice: {
    fontWeight: '700',
    color: '#3b82f6',
    fontSize: 14,
  },
  buyButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  buyButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default Shop;
