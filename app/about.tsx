import { useEffect, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, Pressable, View } from 'react-native';
import { SafeImage } from '../components/SafeImage';
import * as Linking from 'expo-linking';
import { getShopInfo } from '../src/services/shopService';

export default function About() {
  const [shop, setShop] = useState<{
    name?: string;
    address?: string;
    description?: string;
    image?: string;
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    website?: string;
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      const data = await getShopInfo();
      setShop(data);
    };
    void load();
  }, []);

  const openLink = async (url?: string) => {
    if (!url) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Link unavailable', 'Unable to open this link on your device.');
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      console.log('[About] open link error:', error);
      Alert.alert('Link error', 'Unable to open this link.');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>About Us</Text>
        <Text style={styles.subtitle}>{shop?.name ?? "JB's Barbershop"}</Text>

        <View style={styles.photoPlaceholder}>
          {shop?.image ? (
            <SafeImage
              uri={shop.image}
              fallbackSource={require('../assets/placeholder-gallery.png')}
              style={styles.photoImage}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.photoText}>Shop Photo Coming Soon</Text>
          )}
        </View>

        {shop?.description ? (
          <Text style={styles.text}>{shop.description}</Text>
        ) : (
          <Text style={styles.text}>
            Located at 98 Union St, Lynn, MA, JB's Barbershop is more than just a place
            to get a haircut - it's a space where style, precision, and community come
            together.
          </Text>
        )}
        <Text style={styles.text}>📍 {shop?.address ?? '98 Union St, Lynn, MA'}</Text>
        <Text style={styles.text}>📞 Walk-ins and appointments welcome</Text>
        <Text style={styles.text}>💈 Precision. Style. Consistency.</Text>

        <View style={styles.buttonGroup}>
          <Pressable
            style={styles.button}
            onPress={() => openLink(shop?.instagram)}
            disabled={!shop?.instagram}
          >
            <Text style={styles.buttonText}>Instagram</Text>
          </Pressable>
          <Pressable
            style={styles.button}
            onPress={() => openLink(shop?.facebook)}
            disabled={!shop?.facebook}
          >
            <Text style={styles.buttonText}>Facebook</Text>
          </Pressable>
          <Pressable
            style={styles.button}
            onPress={() => openLink(shop?.tiktok)}
            disabled={!shop?.tiktok}
          >
            <Text style={styles.buttonText}>TikTok</Text>
          </Pressable>
          <Pressable
            style={styles.button}
            onPress={() => openLink(shop?.website)}
            disabled={!shop?.website}
          >
            <Text style={styles.buttonText}>Website</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    padding: 20,
    gap: 10,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  photoPlaceholder: {
    height: 180,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  text: {
    color: '#ffffff',
    fontSize: 14,
  },
  buttonGroup: {
    marginTop: 12,
    gap: 10,
  },
  button: {
    backgroundColor: '#000',
    borderColor: '#111',
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
  },
});
