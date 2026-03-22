import { useMemo, useState, useSyncExternalStore } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeImage } from '../components/SafeImage';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { uploadMediaToCloudinary } from '../lib/cloudinaryUpload';
import { addVideo, getFeedVideos, subscribeFeed } from '../store/feedStore';
import { useAuth } from '../contexts/AuthContext';
import { fetchBarbers } from '../src/services/barberService';

type UserRole = 'BARBER' | 'STYLIST' | 'CLIENT';

type PendingMedia = {
  uri: string;
  width?: number;
  height?: number;
  duration?: number;
  mimeType?: string | null;
  mediaType: 'image' | 'video';
};

type BarberRecord = {
	id: string;
	userId?: string;
	user?: { id?: string; uid?: string; name?: string };
	name?: string;
};


const CURRENT_ROLE: UserRole = 'BARBER';
const MAX_DURATION_SECONDS = 32;

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  return (
    <VideoView
      player={player}
      style={styles.previewVideo}
      contentFit="cover"
        fullscreenOptions={{ enable: false }}
      allowsPictureInPicture={false}
    />
  );
}

function ImagePreview({ uri }: { uri: string }) {
  return (
    <SafeImage
      uri={uri}
      fallbackSource={require('../assets/placeholder-gallery.png')}
      style={styles.previewImage}
      resizeMode="cover"
    />
  );
}

function isVerticalVideo(video: PendingMedia) {
  if (!video.width || !video.height) return true;
  return video.height >= video.width;
}

function isMp4Video(video: PendingMedia) {
  if (video.mimeType) {
    return video.mimeType.includes('video/mp4') || video.mimeType.includes('video/quicktime');
  }
  if (video.uri) {
    const lower = video.uri.toLowerCase();
    return lower.endsWith('.mp4') || lower.endsWith('.mov');
  }
  return true;
}

export default function UploadVideo() {
  const { user } = useAuth();
  const [selectedMedia, setSelectedMedia] = useState<PendingMedia | null>(null);
  const [caption, setCaption] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [progress, setProgress] = useState(0);
  const postedVideos = useSyncExternalStore(subscribeFeed, getFeedVideos, getFeedVideos);

  const canUpload = useMemo(
    () => CURRENT_ROLE === 'BARBER' || CURRENT_ROLE === 'STYLIST',
    []
  );

  const requestMediaPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted' && status !== 'limited') {
      Alert.alert('Permission required', 'Please grant permissions to continue.');
      return false;
    }
    return true;
  };

  const handlePickMedia = async (source: 'camera' | 'gallery') => {
    if (!canUpload) {
      Alert.alert('Access denied', 'Only barbers or stylists can upload media.');
      return;
    }

    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission required', 'Please grant permissions to continue.');
      return;
    }

    const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!libraryPermission.granted) {
      Alert.alert('Permission required', 'Please grant permissions to continue.');
      return;
    }

    let result: ImagePicker.ImagePickerResult;
    try {
      result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images', 'videos'],
              videoMaxDuration: MAX_DURATION_SECONDS,
              videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
              quality: 1,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images', 'videos'],
              videoMaxDuration: MAX_DURATION_SECONDS,
              videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
              quality: 1,
            });
    } catch (error) {
      console.log('[UploadVideo] picker error:', error);
      Alert.alert('Picker error', 'Unable to access your media library.');
      return;
    }

    if (result.canceled) return;

    const asset = result.assets?.[0];
    if (!asset?.uri) return;

    const mediaType: PendingMedia['mediaType'] =
      asset.type === 'image' || asset.mimeType?.startsWith('image/') ? 'image' : 'video';

    const pending: PendingMedia = {
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      duration: asset.duration,
      mimeType: asset.mimeType ?? null,
      mediaType,
    };

    if (pending.mediaType === 'video') {
      const durationSeconds =
        typeof pending.duration === 'number'
          ? pending.duration > 1000
            ? pending.duration / 1000
            : pending.duration
          : null;

      if (durationSeconds && durationSeconds > MAX_DURATION_SECONDS + 1) {
        Alert.alert('Video too long', `Max duration is ${MAX_DURATION_SECONDS} seconds.`);
        return;
      }

      if (!isVerticalVideo(pending)) {
        Alert.alert('Invalid format', 'Please select a vertical video.');
        return;
      }

      if (!isMp4Video(pending)) {
        Alert.alert('Invalid format', 'Please select an MP4 video.');
        return;
      }
    }

    setSelectedMedia(pending);
  };

  const handlePost = async () => {
    if (!selectedMedia || isPosting) return;

    try {
      setIsPosting(true);
      setProgress(0);
      const mediaUrl = await uploadMediaToCloudinary(
        selectedMedia.uri,
        selectedMedia.mediaType,
        selectedMedia.mimeType,
        (value) => setProgress(value)
      );
      if (!user?.uid) {
        Alert.alert('Authentication error', 'You must be logged in to post.');
        return;
      }
      const barberId = user.uid;
      const barberName = user.displayName ?? 'Barber';
      addVideo({
        id: Date.now().toString(),
        mediaUrl,
        mediaType: selectedMedia.mediaType,
        caption: caption.trim(),
        title: caption.trim() || 'New Upload',
        barberId,
        barberName,
        barber: barberName,
        rating: 4.9,
        serviceType: serviceType.trim(),
        likes: 0,
        comments: 0,
        createdAt: new Date().toISOString(),
        shop: "JB's Barbershop",
        address: '98 Union St, Lynn MA',
      });
      setSelectedMedia(null);
      setCaption('');
      setServiceType('');
    } catch (error) {
      console.error(error);
      Alert.alert('Upload failed', 'Please try again.');
    } finally {
      setIsPosting(false);
      setProgress(0);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Upload Media</Text>
          <Text style={styles.subtitle}>Share your latest cut with clients.</Text>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.actionButton} onPress={() => handlePickMedia('camera')}>
            <Text style={styles.actionText}>Open Camera</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => handlePickMedia('gallery')}>
            <Text style={styles.actionText}>Choose from Gallery</Text>
          </Pressable>
        </View>

        {selectedMedia ? (
          <View style={styles.previewCard}>
            {selectedMedia.mediaType === 'video' ? (
              <VideoPreview uri={selectedMedia.uri} />
            ) : (
              <ImagePreview uri={selectedMedia.uri} />
            )}
            <TextInput
              style={styles.input}
              placeholder="Caption"
              placeholderTextColor="#9aa0a6"
              value={caption}
              onChangeText={setCaption}
            />
            <TextInput
              style={styles.input}
              placeholder="Service type (optional)"
              placeholderTextColor="#9aa0a6"
              value={serviceType}
              onChangeText={setServiceType}
            />
            {selectedMedia.mediaType === 'video' && isPosting ? (
              <View style={styles.progressWrapper}>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressLabel}>Uploading video...</Text>
                  <Text style={styles.progressPercent}>{progress}%</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
              </View>
            ) : null}
            <Pressable style={styles.postButton} onPress={handlePost} disabled={isPosting}>
              <Text style={styles.postText}>
                {isPosting
                  ? 'Posting...'
                  : selectedMedia.mediaType === 'video'
                    ? 'Post Video'
                    : 'Post Photo'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {postedVideos.length > 0 ? (
          <View style={styles.listSection}>
            <Text style={styles.sectionTitle}>Posted Media (local)</Text>
            {postedVideos.map((video) => (
              <View key={video.id} style={styles.postedItem}>
                <Text style={styles.postedTitle}>{video.caption || video.title || 'Untitled video'}</Text>
                <Text style={styles.postedMeta}>Service: {video.serviceType || 'N/A'}</Text>
                <Text style={styles.postedMeta}>Barber: {video.barber ?? 'Unknown'} ⭐ {(video.rating ?? 0).toFixed(1)}</Text>
              </View>
            ))}
          </View>
        ) : null}
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
    paddingBottom: 40,
    gap: 18,
  },
  header: {
    gap: 6,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#9aa0a6',
    fontSize: 14,
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionText: {
    color: '#00f0ff',
    fontSize: 14,
    fontWeight: '600',
  },
  previewCard: {
backgroundColor: '#000',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
    padding: 12,
    gap: 12,
  },
  previewVideo: {
    width: '100%',
    height: 360,
    borderRadius: 12,
    backgroundColor: '#000000',
  },
  previewImage: {
    width: '100%',
    height: 360,
    borderRadius: 12,
    backgroundColor: '#000000',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: '#ffffff',
    fontSize: 14,
  },
  postButton: {
    backgroundColor: '#00f0ff',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  postText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  progressWrapper: {
    gap: 8,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    color: '#9aa0a6',
    fontSize: 12,
  },
  progressPercent: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  progressBar: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00f0ff',
  },
  listSection: {
    gap: 10,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  postedItem: {
backgroundColor: '#000',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
    gap: 4,
  },
  postedTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  postedMeta: {
    color: '#9aa0a6',
    fontSize: 12,
  },
});
