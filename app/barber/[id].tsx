import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeImage } from '../../components/SafeImage';
import { collection, doc, getDocs, limit, query, updateDoc, where } from 'firebase/firestore';
import { Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import { getBarberMetrics, getFeedVideos, subscribeFeed } from '../../store/feedStore';
import { getAverageRating, getReviewsForBarber } from '../../store/reviewsStore';
import {
  getNotifications,
  subscribe as subscribeNotifications,
} from '../../store/notificationStore';
import {
  getFavoriteBarber,
  setFavoriteBarber,
  subscribe as subscribeFavorites,
} from '../../store/favoriteBarberStore';
import { registerForPushNotifications } from '../../lib/notifications';
import { db } from '../../config/firebase';
import { fetchBarberGalleryImages } from '../../src/services/galleryService';
import { fetchBarbers } from '../../src/services/barberService';
import { uploadImageToCloudinary } from '../../services/cloudinary';

type Service = {
	id: string;
	name: string;
	price: number;
	duration: number;
	imageUrl?: string;
};

type Barber = {
  id: string;
  userId?: string;
  uid?: string;
  name?: string;
  email?: string;
  user?: { name?: string; image?: string; email?: string; id?: string; uid?: string };
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  website?: string;
  profileImage?: string;
  imageUrl?: string;
  bio?: string;
  specialties?: string;
  hourlyRate?: number;
  services?: Service[];
  galleryImages?: { cloud_storage_path?: string }[];
  role?: 'barber' | 'stylist' | 'BARBER' | 'STYLIST';
  rating?: number;
  reviewCount?: number;
  experienceYears?: number;
  shopName?: string;
  location?: string;
};

type GalleryItem = {
  barberId?: string;
  imageUrl?: string;
  cloud_storage_path?: string;
};

type AppointmentItem = {
  id: string;
  userId?: string;
  serviceId?: string;
  clientName?: string;
  serviceName?: string;
  price?: number;
  barberId?: string;
  time?: string;
  status?: string;
  date?: { seconds: number } | Date | null;
};

type BarberPost = {
  id: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  videoUrl?: string;
  barberId?: string;
  barberUserId?: string;
  barberName?: string;
  createdAt?: unknown;
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function normalizeDateString(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (value.includes('T')) return value.split('T')[0] ?? value;
  return value;
}

function formatDateKeyFromDateUTC(value: Date) {
  const year = value.getUTCFullYear();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${value.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateLabelFromKey(dateKey: string) {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateKey;
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const label = MONTH_LABELS[monthIndex] ?? match[2];
  return `${label} ${day}`;
}

function dateKeyToSortKey(dateKey: string) {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(year, month - 1, day).getTime();
}

const resolveAppointmentDate = (value: AppointmentItem['date']) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const normalized = normalizeDateString(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      const [year, month, day] = normalized.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if ('seconds' in value && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  return null;
};

function PortfolioItem({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  return (
    <VideoView
      player={player}
      style={styles.portfolioVideo}
      contentFit="cover"
        fullscreenOptions={{ enable: false }}
      allowsPictureInPicture={false}
    />
  );
}

function MediaPortfolioItem({ uri, mediaType }: { uri: string; mediaType?: 'image' | 'video' }) {
  if (mediaType === 'image') {
    return (
      <SafeImage
        uri={uri}
        fallbackSource={require('../../assets/placeholder-gallery.png')}
        style={styles.portfolioMedia}
        resizeMode="cover"
      />
    );
  }

  return <PortfolioItem uri={uri} />;
}

function getBarberImage(url?: string) {
  if (!url) return 'https://via.placeholder.com/300x300';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return 'https://via.placeholder.com/300x300';
}

export default function BarberProfile() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const barberId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const [barber, setBarber] = useState<Barber | null>(null);
	const [loading, setLoading] = useState(true);

  const videos = useSyncExternalStore(subscribeFeed, getFeedVideos, getFeedVideos);
  const favoriteUserId = 'user_001';

  const notifications = useSyncExternalStore(
    subscribeNotifications,
    () => getNotifications(barber?.id ?? ''),
    () => getNotifications(barber?.id ?? '')
  );
  const favoriteBarberId = useSyncExternalStore(
    subscribeFavorites,
    () => getFavoriteBarber(favoriteUserId),
    () => getFavoriteBarber(favoriteUserId)
  );
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [portfolioImages, setPortfolioImages] = useState<string[]>([]);
  const [showAllPortfolio, setShowAllPortfolio] = useState(false);
  const [barberPosts, setBarberPosts] = useState<BarberPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [barberDocIds, setBarberDocIds] = useState<string[]>([]);
  const [socialLinks, setSocialLinks] = useState({
    instagram: '',
    facebook: '',
    tiktok: '',
    website: '',
  });
  const [profileForm, setProfileForm] = useState({
    name: '',
    bio: '',
    specialties: '',
    hourlyRate: '',
    profileImage: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [socialDocId, setSocialDocId] = useState<string | null>(null);
  const [savingSocials, setSavingSocials] = useState(false);

  useEffect(() => {
    const loadBarber = async () => {
      if (!barberId) {
        setLoading(false);
        return;
      }
      console.log('PROFILE PARAM ID:', barberId);
      setLoading(true);
      try {
        const allBarbers = await fetchBarbers();
        const foundBarber = allBarbers.find((item) => {
          console.log('SEARCHING BARBER', {
            paramId: barberId,
            barberId: item.id,
            userId: item.userId,
            userObjectId: item.user?.id,
            uid: item.uid,
            userObjectUid: item.user?.uid,
          });
          return (
            item.id === barberId ||
            item.userId === barberId ||
            item.user?.id === barberId ||
            item.uid === barberId ||
            item.user?.uid === barberId
          );
        });
        console.log('FOUND IN API:', !!foundBarber);

        if (foundBarber) {
          setBarber(foundBarber as Barber);
        } else {
          setBarber(null);
        }
      } catch (error) {
        console.error('Error loading barber:', error);
        setBarber(null);
      } finally {
        setLoading(false);
      }
    };
    void loadBarber();
  }, [barberId]);

  useEffect(() => {
    if (!barber) return;
    setProfileForm({
      name: barber.name ?? barber.user?.name ?? '',
      bio: barber.bio ?? '',
      specialties: barber.specialties ?? '',
      hourlyRate: typeof barber.hourlyRate === 'number' ? `${barber.hourlyRate}` : '',
      profileImage: barber.profileImage ?? barber.user?.image ?? barber.imageUrl ?? '',
    });
  }, [barber]);

  useEffect(() => {
    const loadSocialLinks = async () => {
      if (!barberId) return;
      try {
        const snapshot = await getDocs(
          query(
            collection(db, 'barbers'),
            where('prismaBarberId', '==', barberId),
            limit(1)
          )
        );
        if (snapshot.empty) return;
        const docSnap = snapshot.docs[0];
        const data = docSnap.data() as {
          instagram?: string;
          facebook?: string;
          tiktok?: string;
          website?: string;
        };
        setSocialDocId(docSnap.id);
        setSocialLinks({
          instagram: data.instagram ?? '',
          facebook: data.facebook ?? '',
          tiktok: data.tiktok ?? '',
          website: data.website ?? '',
        });
      } catch (error) {
        console.log('[BarberProfile] load social links error:', error);
      }
    };

    void loadSocialLinks();
  }, [barberId]);

  useEffect(() => {
    if (!barber) return;
  if (__DEV__) return;

    const registerToken = async () => {
      try {
        await registerForPushNotifications();
      } catch (error) {
        console.log('Register push token error:', error);
      }
    };

    registerToken();
  }, [barber]);

  useEffect(() => {
    const loadBarberAppointments = async () => {
      if (!user) return;

      console.log('BARBER UID:', user.uid);

      const q = query(
        collection(db, 'appointments'),
        where('barberId', '==', user.uid)
      );

      const snapshot = await getDocs(q);
      console.log('BARBER APPOINTMENTS FOUND:', snapshot.size);

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as AppointmentItem),
      }));

      setAppointments(data);
    };

    if (user && barber && user.uid === barber.id) {
      loadBarberAppointments();
    }
  }, [user, barber]);

  useEffect(() => {
    const resolveBarberDocIds = async () => {
      if (!barber && !barberId) return;
      const candidates = [
        { field: 'prismaBarberId', value: barberId },
        { field: 'userId', value: barber?.userId },
        { field: 'uid', value: barber?.uid },
        { field: 'email', value: barber?.email },
        { field: 'email', value: barber?.user?.email },
      ].filter((item) => item.value);

      const resolved = new Set<string>();
      try {
        for (const candidate of candidates) {
          const snapshot = await getDocs(
            query(
              collection(db, 'barbers'),
              where(candidate.field, '==', candidate.value),
              limit(1)
            )
          );
          if (!snapshot.empty) {
            resolved.add(snapshot.docs[0].id);
          }
        }
      } catch (error) {
        console.log('[BarberProfile] resolve barber doc id error:', error);
      }

      const ownerUid =
        user?.uid &&
        (barber?.userId === user.uid || barber?.uid === user.uid || barber?.user?.id === user.uid)
          ? user.uid
          : null;

      if (resolved.size === 0) {
        if (barberId) resolved.add(barberId);
        if (barber?.userId) resolved.add(barber.userId);
        if (barber?.uid) resolved.add(barber.uid);
      }

      if (ownerUid) {
        resolved.add(ownerUid);
      }

      setBarberDocIds(Array.from(resolved));
    };

    void resolveBarberDocIds();
  }, [barber, barberId, user?.uid]);

  useEffect(() => {
    const loadPortfolioImages = async () => {
      if (barberDocIds.length === 0) {
        setPortfolioImages([]);
        return;
      }
      const galleryItems = (await fetchBarberGalleryImages(barberDocIds)) as GalleryItem[];
      const fromGallery = galleryItems
        .map((item) => item.imageUrl ?? item.cloud_storage_path)
        .filter((url): url is string => Boolean(url));
      setPortfolioImages(fromGallery);
    };

    void loadPortfolioImages();
  }, [barberDocIds]);

  useEffect(() => {
    const loadBarberPosts = async () => {
      if (!barber) return;
      const ids = [
        ...barberDocIds,
        barber.userId,
        barber.uid,
        barber.user?.id,
        barber.user?.uid,
      ].filter((value): value is string => Boolean(value));
      if (ids.length === 0) {
        setBarberPosts([]);
        setLoadingPosts(false);
        return;
      }
      setLoadingPosts(true);
      try {
        const uniqueIds = Array.from(new Set(ids));
        const queries = uniqueIds.flatMap((id) => [
          query(collection(db, 'feed'), where('barberId', '==', id)),
          query(collection(db, 'feed'), where('barberUserId', '==', id)),
        ]);
        const snapshots = await Promise.all(queries.map((q) => getDocs(q)));
        const merged = new Map<string, BarberPost>();
        snapshots.forEach((snapshot) => {
          snapshot.docs.forEach((docSnap) => {
            merged.set(docSnap.id, { id: docSnap.id, ...(docSnap.data() as BarberPost) });
          });
        });
        setBarberPosts(Array.from(merged.values()));
      } catch (error) {
        console.log('[BarberProfile] load posts error:', error);
        setBarberPosts([]);
      } finally {
        setLoadingPosts(false);
      }
    };

    void loadBarberPosts();
  }, [barber, barberDocIds]);

  const groupedAppointments = useMemo(() => {
    if (appointments.length === 0) return [] as Array<{
      label: string;
      sortKey: number;
      items: AppointmentItem[];
    }>;

    const groups = new Map<string, { label: string; sortKey: number; items: AppointmentItem[] }>();

    appointments.forEach((appointment) => {
      let dateKey = '';
      if (typeof appointment.date === 'string') {
        dateKey = normalizeDateString(appointment.date);
      } else {
        const date = resolveAppointmentDate(appointment.date);
        dateKey = date ? formatDateKeyFromDateUTC(date) : '';
      }
      const label = dateKey ? formatDateLabelFromKey(dateKey) : 'Pending date';
      const sortKey = dateKey ? dateKeyToSortKey(dateKey) : Number.MAX_SAFE_INTEGER;

      const group = groups.get(label);
      if (group) {
        group.items.push(appointment);
      } else {
        groups.set(label, { label, sortKey, items: [appointment] });
      }
    });

    const sorted = Array.from(groups.values()).sort((a, b) => a.sortKey - b.sortKey);
    sorted.forEach((group) => {
      group.items.sort((a, b) => {
        const aDate = resolveAppointmentDate(a.date);
        const bDate = resolveAppointmentDate(b.date);
        if (!aDate || !bDate) return 0;
        return aDate.getTime() - bDate.getTime();
      });
    });

    return sorted;
  }, [appointments]);

  const mergedPortfolioImages = useMemo(() => {
    const combined = [...portfolioImages];
    const seen = new Set<string>();
    return combined.filter((url) => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    });
  }, [portfolioImages]);

	if (loading) {
    return <SafeAreaView style={styles.screen}><Text style={styles.name}>Loading profile...</Text></SafeAreaView>
  }

  if (!barber) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.name}>Barber not found.</Text>
      </SafeAreaView>
    );
  }

  const isOwner = Boolean(
    user?.uid && (barber.userId === user.uid || barber.uid === user.uid || barber.user?.id === user.uid)
  );
  const barberName = barber?.name || barber?.user?.name || 'Barber';
  const barberEmail =
    barber?.user?.email || barber?.email || (isOwner ? user?.email : '') || '';
  const avatarUri = barber?.imageUrl || barber?.profileImage || barber?.user?.image || '';
  console.log('BARBER PROFILE IMAGE URL:', barber?.imageUrl);
  const barberImage = getBarberImage(avatarUri);
  const visiblePortfolioImages = showAllPortfolio
    ? mergedPortfolioImages
    : mergedPortfolioImages.slice(0, 6);
	const reviews = getReviewsForBarber(barber.id);
  const averageRating = Number.isFinite(barber.rating)
    ? barber.rating
    : reviews.length
    ? getAverageRating(barber.id)
    : 4.8;
  const metrics = getBarberMetrics(barberName);
  const isFavorite = favoriteBarberId === barber.id;
  const bookingsThisWeek = notifications.filter((item) => {
    if (item.type !== 'booking') return false;
    return item.createdAt >= Date.now() - 7 * 24 * 60 * 60 * 1000;
  }).length;
  const reviewCount = typeof barber.reviewCount === 'number' ? barber.reviewCount : reviews.length;
  const portfolio = barberPosts.filter((item) => item.mediaType === 'video' || item.videoUrl);

  const rankInShop = (() => {
    const uniqueBarbers = new Map<string, string>();
    videos.forEach((video) => {
      const name = video.barber ?? 'Barber';
      const id = video.barberId ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      uniqueBarbers.set(id, name);
    });
    uniqueBarbers.set(barber.id, barberName);

    const ranked = Array.from(uniqueBarbers.entries()).map(([id, name]) => {
      const totals = getBarberMetrics(name);
      const reviewsTotal = getReviewsForBarber(id).length;
      const score = totals.likes * 3 + totals.comments * 4 + totals.views * 1 + reviewsTotal * 5;
      return { id, score };
    });

    ranked.sort((a, b) => b.score - a.score);
    const index = ranked.findIndex((entry) => entry.id === barber.id);
    return index === -1 ? ranked.length : index + 1;
  })();

  const formatAppointmentTime = (value: AppointmentItem['date']) => {
    const date = resolveAppointmentDate(value);
    if (!date) return 'Time pending';
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const openLink = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    await Linking.openURL(url);
  };

  const handleSaveSocials = async () => {
    if (!socialDocId || savingSocials) return;
    setSavingSocials(true);
    try {
      await updateDoc(doc(db, 'barbers', socialDocId), {
        instagram: socialLinks.instagram.trim(),
        facebook: socialLinks.facebook.trim(),
        tiktok: socialLinks.tiktok.trim(),
        website: socialLinks.website.trim(),
      });
    } catch (error) {
      console.log('[BarberProfile] save social links error:', error);
    } finally {
      setSavingSocials(false);
    }
  };

  const requestMediaPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos to choose a profile image.');
      return false;
    }
    return true;
  };

  const handlePickPhoto = async () => {
    if (uploadingPhoto) return;
    setUploadingPhoto(true);
    try {
      const allowed = await requestMediaPermission();
      if (!allowed) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      const uploadUrl = await uploadImageToCloudinary(result.assets[0].uri);
      setProfileForm((current) => ({ ...current, profileImage: uploadUrl }));
    } catch (error) {
      console.log('[BarberProfile] photo upload error:', error);
      Alert.alert('Upload failed', 'Unable to upload profile photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!barber || savingProfile) return;
    setSavingProfile(true);
    try {
      const payload: Record<string, unknown> = {
        name: profileForm.name.trim(),
        bio: profileForm.bio.trim(),
        specialties: profileForm.specialties.trim(),
        updatedAt: new Date(),
      };
      const hourlyRateValue = Number(profileForm.hourlyRate);
      if (profileForm.hourlyRate.trim() !== '' && Number.isFinite(hourlyRateValue)) {
        payload.hourlyRate = hourlyRateValue;
      }
      if (profileForm.profileImage.trim()) {
        payload.profileImage = profileForm.profileImage.trim();
        payload.imageUrl = profileForm.profileImage.trim();
      }
      await updateDoc(doc(db, 'barbers', barber.id), payload);
      setBarber((current) => (current ? { ...current, ...payload } : current));
    } catch (error) {
      console.log('[BarberProfile] save profile error:', error);
      Alert.alert('Save failed', 'Unable to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const openMap = () => {
    Linking.openURL('https://maps.google.com/?q=JB+Barbershop+Lynn+MA');
  };

  const makeCall = () => {
    Linking.openURL('tel:+17815551234');
  };

  const openWhatsAppShop = () => {
    Linking.openURL('https://wa.me/17815551234?text=Hi I want to book an appointment');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarFrame}>
          <SafeImage
            uri={barberImage}
            fallbackSource={require('../../assets/placeholder-barber.png')}
            style={styles.avatar}
            resizeMode="cover"
          />
          <Text style={styles.avatarNameText}>{barberName}</Text>
          {barberEmail ? (
            <Text style={styles.avatarEmailText}>{barberEmail}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: '/book',
              params: { barberId },
            })
          }
          style={{
            backgroundColor: '#00d4ff',
            padding: 15,
            borderRadius: 12,
            marginTop: 20,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#000', fontWeight: 'bold' }}>
            BOOK WITH THIS BARBER
          </Text>
        </TouchableOpacity>

        <View style={styles.details}>
          <Pressable
            style={[styles.favoriteButton, isFavorite && styles.favoriteButtonActive]}
            onPress={() => setFavoriteBarber(favoriteUserId, barber.id)}
          >
            <Text style={[styles.favoriteButtonText, isFavorite && styles.favoriteButtonTextActive]}>
              {isFavorite ? '⭐ Your Favorite Barber' : '⭐ Favorite Barber'}
            </Text>
          </Pressable>
          <Text style={styles.role}>Barber at JB's Barbershop</Text>
          <View style={styles.ratingRow}>
            <Text style={styles.rating}>⭐ {averageRating.toFixed(1)}</Text>
            <Text style={styles.ratingCount}>{reviewCount} reviews</Text>
          </View>
          <Text style={styles.exp}>{barber.experienceYears ?? 5} Years Experience</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Social Links</Text>
          <View style={styles.socialRow}>
            {socialLinks.instagram ? (
              <Pressable style={styles.socialButton} onPress={() => openLink(socialLinks.instagram)}>
                <Ionicons name="logo-instagram" size={18} color="#ffffff" />
              </Pressable>
            ) : null}
            {socialLinks.facebook ? (
              <Pressable style={styles.socialButton} onPress={() => openLink(socialLinks.facebook)}>
                <Ionicons name="logo-facebook" size={18} color="#ffffff" />
              </Pressable>
            ) : null}
            {socialLinks.tiktok ? (
              <Pressable style={styles.socialButton} onPress={() => openLink(socialLinks.tiktok)}>
                <Ionicons name="logo-tiktok" size={18} color="#ffffff" />
              </Pressable>
            ) : null}
            {socialLinks.website ? (
              <Pressable style={styles.socialButton} onPress={() => openLink(socialLinks.website)}>
                <Ionicons name="globe" size={18} color="#ffffff" />
              </Pressable>
            ) : null}
            {(!socialLinks.instagram && !socialLinks.facebook && !socialLinks.tiktok && !socialLinks.website) ? (
              <Text style={styles.emptyText}>No links yet.</Text>
            ) : null}
          </View>

          {isOwner ? (
            <View style={styles.socialEditor}>
              <Text style={styles.socialLabel}>Instagram</Text>
              <TextInput
                style={styles.socialInput}
                value={socialLinks.instagram}
                onChangeText={(value) => setSocialLinks((current) => ({ ...current, instagram: value }))}
                placeholder="instagram.com/username"
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.socialLabel}>Facebook</Text>
              <TextInput
                style={styles.socialInput}
                value={socialLinks.facebook}
                onChangeText={(value) => setSocialLinks((current) => ({ ...current, facebook: value }))}
                placeholder="facebook.com/page"
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.socialLabel}>TikTok</Text>
              <TextInput
                style={styles.socialInput}
                value={socialLinks.tiktok}
                onChangeText={(value) => setSocialLinks((current) => ({ ...current, tiktok: value }))}
                placeholder="tiktok.com/@username"
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.socialLabel}>Website</Text>
              <TextInput
                style={styles.socialInput}
                value={socialLinks.website}
                onChangeText={(value) => setSocialLinks((current) => ({ ...current, website: value }))}
                placeholder="https://yourbarber.com"
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable style={styles.saveSocialButton} onPress={handleSaveSocials} disabled={savingSocials}>
                <Text style={styles.saveSocialText}>{savingSocials ? 'Saving...' : 'Save Links'}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {isOwner ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Edit Profile</Text>
            <View style={styles.editPhotoRow}>
              <View style={styles.editPhotoPreview}>
                {profileForm.profileImage ? (
                  <SafeImage
                    uri={profileForm.profileImage}
                    fallbackSource={require('../../assets/placeholder-barber.png')}
                    style={styles.editPhotoImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.editPhotoPlaceholder}>No photo</Text>
                )}
              </View>
              <Pressable
                style={styles.editPhotoButton}
                onPress={handlePickPhoto}
                disabled={uploadingPhoto}
              >
                <Text style={styles.editPhotoButtonText}>
                  {uploadingPhoto ? 'Uploading...' : 'Change Photo'}
                </Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.editInput}
              value={profileForm.name}
              onChangeText={(value) => setProfileForm((current) => ({ ...current, name: value }))}
              placeholder="Name"
              placeholderTextColor="#6b7280"
            />
            <TextInput
              style={styles.editInput}
              value={profileForm.bio}
              onChangeText={(value) => setProfileForm((current) => ({ ...current, bio: value }))}
              placeholder="Bio"
              placeholderTextColor="#6b7280"
              multiline
            />
            <TextInput
              style={styles.editInput}
              value={profileForm.specialties}
              onChangeText={(value) => setProfileForm((current) => ({ ...current, specialties: value }))}
              placeholder="Specialties (comma separated)"
              placeholderTextColor="#6b7280"
            />
            <TextInput
              style={styles.editInput}
              value={profileForm.hourlyRate}
              onChangeText={(value) => setProfileForm((current) => ({ ...current, hourlyRate: value }))}
              placeholder="Hourly rate"
              placeholderTextColor="#6b7280"
              keyboardType="numeric"
            />
            <Pressable style={styles.saveProfileButton} onPress={handleSaveProfile} disabled={savingProfile}>
              <Text style={styles.saveProfileText}>{savingProfile ? 'Saving...' : 'Save Profile'}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Barber Stats</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>⭐ Rating</Text>
              <Text style={styles.statValue}>{averageRating.toFixed(1)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>✂️ Haircuts</Text>
              <Text style={styles.statValue}>420</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>📅 Experience</Text>
              <Text style={styles.statValue}>{barber.experienceYears ?? 5} years</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📊 Performance</Text>
            <View style={styles.performanceCard}>
              <View style={styles.performanceRow}>
                <Text style={styles.performanceLabel}>🎥 Videos</Text>
                <Text style={styles.performanceValue}>{metrics.videos}</Text>
              </View>
              <View style={styles.performanceRow}>
                <Text style={styles.performanceLabel}>❤️ Likes</Text>
                <Text style={styles.performanceValue}>{metrics.likes}</Text>
              </View>
              <View style={styles.performanceRow}>
                <Text style={styles.performanceLabel}>👁 Views</Text>
                <Text style={styles.performanceValue}>{metrics.views}</Text>
              </View>
              <View style={styles.performanceRow}>
                <Text style={styles.performanceLabel}>💬 Comments</Text>
                <Text style={styles.performanceValue}>{metrics.comments}</Text>
              </View>
              <View style={styles.performanceRow}>
                <Text style={styles.performanceLabel}>⭐ Rating</Text>
                <Text style={styles.performanceValue}>
                  {averageRating.toFixed(1)} ({reviewCount} reviews)
                </Text>
              </View>
              <View style={styles.performanceRow}>
                <Text style={styles.performanceLabel}>📅 Bookings this week</Text>
                <Text style={styles.performanceValue}>{bookingsThisWeek}</Text>
              </View>
              <View style={styles.performanceRow}>
                <Text style={styles.performanceLabel}>🏆 Rank in Shop</Text>
                <Text style={styles.performanceValue}>#{rankInShop}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specialties</Text>
          <View style={styles.specialtiesList}>
            {(barber.specialties || '')
              .split(',')
              .filter(Boolean)
              .map((item) => (
                <View key={item} style={styles.specialtyPill}>
                  <Text style={styles.specialtyText}>{item.trim()}</Text>
                </View>
              ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support & Info</Text>
          <View style={styles.supportGrid}>
            <Pressable style={styles.supportCard} onPress={openMap}>
              <View style={styles.supportIconWrap}>
                <Ionicons name="map" size={18} color="#00f0ff" />
              </View>
              <Text style={styles.supportTitle}>Get Directions</Text>
              <Text style={styles.supportSubtitle}>Open Maps</Text>
            </Pressable>
            <Pressable style={styles.supportCard} onPress={makeCall}>
              <View style={styles.supportIconWrap}>
                <Ionicons name="call" size={18} color="#00f0ff" />
              </View>
              <Text style={styles.supportTitle}>Call Shop</Text>
              <Text style={styles.supportSubtitle}>Tap to call</Text>
            </Pressable>
            <Pressable style={styles.supportCard} onPress={openWhatsAppShop}>
              <View style={styles.supportIconWrap}>
                <Ionicons name="logo-whatsapp" size={18} color="#00f0ff" />
              </View>
              <Text style={styles.supportTitle}>WhatsApp</Text>
              <Text style={styles.supportSubtitle}>Send a message</Text>
            </Pressable>
            <Pressable style={styles.supportCard} onPress={() => router.push('/about')}>
              <View style={styles.supportIconWrap}>
                <Ionicons name="information-circle" size={18} color="#00f0ff" />
              </View>
              <Text style={styles.supportTitle}>About Us</Text>
              <Text style={styles.supportSubtitle}>Learn more</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Next Available</Text>
          <View style={styles.nextCard}>
            <View>
              <Text style={styles.nextLabel}>Today 4:30 PM</Text>
              <Text style={styles.nextSub}>Prime slot ready for you</Text>
            </View>
            <Pressable style={styles.nextButton} onPress={() => router.push('/(tabs)/book')}>
              <Text style={styles.nextButtonText}>Book Appointment</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Portfolio Videos</Text>
          <FlatList
            data={portfolio}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.portfolioList}
            renderItem={({ item }) =>
              (item.mediaUrl || item.videoUrl)
                ? (
                    <MediaPortfolioItem
                      uri={item.mediaUrl ?? item.videoUrl ?? ''}
                      mediaType={item.mediaType}
                    />
                  )
                : null
            }
            ListEmptyComponent={
              loadingPosts ? <Text style={styles.emptyText}>Loading posts...</Text> : <Text style={styles.emptyText}>No posts yet.</Text>
            }
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📷 Photo Portfolio</Text>
          {visiblePortfolioImages.length > 0 ? (
            <FlatList
              data={visiblePortfolioImages}
              keyExtractor={(_, index) => index.toString()}
              numColumns={3}
              scrollEnabled={false}
              contentContainerStyle={styles.galleryGrid}
              renderItem={({ item }) =>
                item ? (
                  <View style={styles.portfolioImageWrapper}>
                    <SafeImage
                      uri={item}
                      fallbackSource={require('../../assets/placeholder-gallery.png')}
                      style={styles.portfolioImage}
                      resizeMode="cover"
                    />
                  </View>
                ) : null
              }
            />
          ) : (
            <Text style={styles.emptyText}>No photos yet.</Text>
          )}
          {portfolioImages.length >= 6 ? (
            <Pressable
              style={styles.seeAllLink}
              onPress={() => setShowAllPortfolio((current) => !current)}
              hitSlop={10}
              accessibilityRole="button"
            >
              <Text style={styles.seeAllText}>
                {showAllPortfolio ? 'Show less' : 'See all'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reviews</Text>
          <Text style={styles.reviewMeta}>
            ⭐ {averageRating.toFixed(1)} based on {reviewCount} reviews
          </Text>
          {reviews.length === 0 ? (
            <Text style={styles.emptyText}>No reviews yet.</Text>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View>
                    <Text style={styles.reviewUser}>{review.userName}</Text>
                    <Text style={styles.reviewDate}>{review.createdAt}</Text>
                  </View>
                  <Text style={styles.reviewRating}>{'⭐'.repeat(Math.round(review.rating))}</Text>
                </View>
                {review.comment ? (
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                ) : (
                  <Text style={styles.reviewCommentMuted}>No comment provided.</Text>
                )}
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appointments</Text>
          {groupedAppointments.length === 0 ? (
            <Text style={styles.emptyText}>
              No booked appointments yet.
              {'\n'}Your upcoming bookings will appear here.
            </Text>
          ) : (
            groupedAppointments.map((group) => (
              <View key={group.label} style={styles.appointmentGroup}>
                <Text style={styles.appointmentGroupTitle}>{group.label}</Text>
                {group.items.map((appointment) => (
                  <View key={appointment.id} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <View>
                        <Text style={styles.reviewUser}>User: {appointment.userId ?? 'Client'}</Text>
                        <Text style={styles.reviewDate}>
                          {formatAppointmentTime(appointment.date)}
                        </Text>
                      </View>
                      <Text style={styles.reviewRating}>
                        {typeof appointment.price === 'number'
                          ? `$${appointment.price}`
                          : 'N/A'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ))
          )}
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
    gap: 20,
  },
  avatarFrame: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  avatar: {
    width: 156,
    height: 156,
    borderRadius: 78,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
backgroundColor: '#000',
  },
  avatarNameText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
  },
  avatarEmailText: {
    color: '#9aa0a6',
    fontSize: 13,
    marginTop: 6,
  },
  details: {
    gap: 8,
  },
  name: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
  },
  favoriteButton: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: '#00f0ff',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  favoriteButtonActive: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
  },
  favoriteButtonText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  favoriteButtonTextActive: {
    color: '#00f0ff',
  },
  role: {
    color: '#9aa0a6',
    fontSize: 14,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rating: {
    color: '#ffd700',
    fontSize: 16,
    fontWeight: '600',
  },
  ratingCount: {
    color: '#9aa0a6',
    fontSize: 13,
  },
  exp: {
    color: '#9aa0a6',
    fontSize: 14,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: '#00f0ff',
    fontSize: 16,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
  },
  statLabel: {
    color: '#9aa0a6',
    fontSize: 12,
  },
  statValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  performanceCard: {
    backgroundColor: '#000',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
    gap: 12,
  },
  performanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  performanceLabel: {
    color: '#9aa0a6',
    fontSize: 13,
    fontWeight: '600',
  },
  performanceValue: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  socialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  socialButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
backgroundColor: '#000',
  },
  socialEditor: {
    marginTop: 12,
    gap: 8,
  },
  editPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editPhotoPreview: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
  },
  editPhotoImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  editPhotoPlaceholder: {
    color: '#9aa0a6',
    fontSize: 12,
  },
  editPhotoButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
    backgroundColor: '#000',
  },
  editPhotoButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  editInput: {
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: '#ffffff',
    marginTop: 10,
  },
  saveProfileButton: {
    marginTop: 12,
    backgroundColor: '#00f0ff',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveProfileText: {
    color: '#000000',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  socialLabel: {
    color: '#9aa0a6',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  socialInput: {
backgroundColor: '#000',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
    color: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  saveSocialButton: {
    marginTop: 6,
    backgroundColor: '#00f0ff',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveSocialText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  specialtiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  specialtyPill: {
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  specialtyText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  supportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  supportCard: {
    flexBasis: '48%',
    backgroundColor: '#000',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
    gap: 6,
  },
  supportIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  supportSubtitle: {
    color: '#9aa0a6',
    fontSize: 11,
  },
  portfolioList: {
    gap: 12,
  },
  portfolioVideo: {
    width: 180,
    height: 240,
    borderRadius: 16,
backgroundColor: '#000',
  },
  portfolioMedia: {
    width: 180,
    height: 240,
    borderRadius: 16,
backgroundColor: '#000',
  },
  nextCard: {
    backgroundColor: '#000',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
    gap: 12,
  },
  nextLabel: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  nextSub: {
    color: '#9aa0a6',
    fontSize: 13,
    marginTop: 4,
  },
  nextButton: {
    backgroundColor: '#00f0ff',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  galleryGrid: {
    gap: 10,
  },
  portfolioImageWrapper: {
    width: '33.33%',
    paddingRight: 8,
    paddingBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  portfolioImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
backgroundColor: '#000',
  },
  emptyText: {
    color: '#9aa0a6',
    fontSize: 13,
  },
  seeAllLink: {
    alignSelf: 'flex-start',
    marginTop: 4,
		paddingVertical: 6,
		paddingHorizontal: 4,
  },
  seeAllText: {
    color: '#00f0ff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  reviewMeta: {
    color: '#9aa0a6',
    fontSize: 13,
  },
  reviewCard: {
    backgroundColor: '#000',
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reviewRating: {
    color: '#ffd700',
    fontSize: 14,
    fontWeight: '600',
  },
  reviewComment: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 18,
  },
  reviewCommentMuted: {
    color: '#9aa0a6',
    fontSize: 13,
    lineHeight: 18,
  },
  reviewUser: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  reviewDate: {
    color: '#9aa0a6',
    fontSize: 11,
    marginTop: 2,
  },
  appointmentGroup: {
    gap: 10,
  },
  appointmentGroupTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
