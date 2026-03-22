import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Dimensions,
  FlatList,
  Linking,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeImage } from '../../components/SafeImage';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import {
  addComment,
  getSortedFeed,
  incrementViews,
  isFollowing,
  subscribeFeed,
  toggleFollow,
  toggleLike,
} from '../../store/feedStore';

const { height, width } = Dimensions.get('window');

function formatViews(value: number) {
  if (value >= 1000000) {
    const formatted = value >= 10000000 ? Math.round(value / 1000000) : (value / 1000000).toFixed(1);
    return `${formatted}M`;
  }

  if (value >= 1000) {
    const formatted = value >= 10000 ? Math.round(value / 1000) : (value / 1000).toFixed(1);
    return `${formatted}K`;
  }

  return value.toString();
}

type FeedItem = ReturnType<typeof getSortedFeed>[number];

type VideoItemProps = {
  item: FeedItem;
  isActive: boolean;
  isFocused: boolean;
  muted: boolean;
  viewerId: string;
  onToggleMuted: () => void;
  onPressBarber: (item: FeedItem) => void;
  onPressBook: () => void;
  onPressLocation: () => void;
  onOpenComments: (id: string) => void;
  onShare: (mediaUrl: string) => void;
};

type FeedItemProps = {
  item: FeedItem;
  viewerId: string;
  onPressBarber: (item: FeedItem) => void;
  onPressBook: () => void;
  onPressLocation: () => void;
  onOpenComments: (id: string) => void;
  onShare: (mediaUrl: string) => void;
};

function FeedItemOverlay({
  item,
  viewerId,
  onPressBarber,
  onPressLocation,
  onOpenComments,
  onShare,
}: FeedItemProps) {
  const shareUrl = item.mediaUrl ?? item.videoUrl ?? '';

  return (
    <>
      <View style={styles.overlayTop}>
        <View>
          <Pressable
            onPress={() => {
              if (item.barberId) onPressBarber(item);
            }}
            disabled={!item.barberId}
          >
            <Text style={styles.overlayBarberLine}>
              <Ionicons name="person" size={14} color="#ffffff" /> {item.barberName ?? item.barber ?? 'Barber'}
            </Text>
          </Pressable>
          <Text style={styles.overlayShopLine}>
            <Ionicons name="cut" size={14} color="#9aa0a6" /> {item.shop ?? "JB's Barbershop"}
          </Text>
        </View>
        {item.barberId ? (
          <Pressable style={styles.overlayViewButton} onPress={() => onPressBarber(item)}>
            <Text style={styles.overlayViewText}>View Barber</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.overlay}>
        <View style={styles.overlayLeft}>
          {isFollowing(viewerId, item.barberId ?? item.barber ?? 'barber') ? (
            <Text style={styles.followingLabel}>⭐ Following</Text>
          ) : null}
          <Text style={styles.title}>{item.title || item.caption || 'Fresh Cut'}</Text>
          <Text style={styles.serviceLine}>Service: {item.serviceType || 'N/A'}</Text>
          <View style={styles.shopBlock}>
            <Text style={styles.shopName}>{item.shop ?? "JB's Barbershop"}</Text>
            <View style={styles.shopAddressRow}>
              <Ionicons name="location" size={14} color="#9aa0a6" />
              <Text style={styles.shopAddress}>{item.address ?? '98 Union St Lynn MA'}</Text>
              <Pressable style={styles.mapButton} onPress={onPressLocation}>
                <Ionicons name="location" size={16} color="#ffffff" />
              </Pressable>
            </View>
          </View>
        </View>
        <View style={styles.overlayRight}>
          <TouchableOpacity style={styles.likeButton} onPress={() => toggleLike(item.id)}>
            <Ionicons
              name={item.liked ? 'heart' : 'heart-outline'}
              size={28}
              color={item.liked ? '#ff3040' : '#ffffff'}
            />
            <Text style={styles.likeCount}>{item.likes}</Text>
          </TouchableOpacity>
          <View style={styles.viewCountRow}>
            <Ionicons name="eye" size={18} color="#ffffff" />
            <Text style={styles.viewCountText}>{formatViews(item.views)} views</Text>
          </View>
          <TouchableOpacity style={styles.commentButton} onPress={() => onOpenComments(item.id)}>
            <Ionicons name="chatbubble-outline" size={26} color="#ffffff" />
            <Text style={styles.commentCount}>{item.commentsCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.followButton}
            onPress={() => toggleFollow(viewerId, item.barberId ?? item.barber ?? 'barber')}
          >
            <Ionicons
              name="star"
              size={26}
              color={
                isFollowing(viewerId, item.barberId ?? item.barber ?? 'barber')
                  ? '#ffd700'
                  : '#ffffff'
              }
            />
            <Text style={styles.followText}>
              {isFollowing(viewerId, item.barberId ?? item.barber ?? 'barber')
                ? 'Following'
                : 'Follow'}
            </Text>
          </TouchableOpacity>
          <Pressable style={styles.actionButton} onPress={() => onShare(shareUrl)}>
            <Ionicons name="share-social" size={20} color="#00f0ff" />
            <Text style={styles.actionText}>Share</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

const VideoItem = memo(function VideoItem({
  item,
  isActive,
  isFocused,
  muted,
  viewerId,
  onToggleMuted,
  onPressBarber,
  onPressBook,
  onPressLocation,
  onOpenComments,
  onShare,
}: VideoItemProps) {
  const [paused, setPaused] = useState(false);
  const [showPauseIcon, setShowPauseIcon] = useState(false);
  const hideIconTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const player = useVideoPlayer(item.mediaUrl ?? item.videoUrl ?? '', (p) => {
    p.loop = true;
    p.muted = muted;
  });

  useEffect(() => {
    if (!isFocused) {
      player.pause();
      setPaused(false);
      setShowPauseIcon(false);
      return;
    }
    if (!isActive) {
      player.pause();
      setPaused(false);
      setShowPauseIcon(false);
      return;
    }

    if (paused) {
      player.pause();
      return;
    }

    player.play();
  }, [isActive, isFocused, paused, player]);

  useEffect(() => {
    if (!showPauseIcon) return;

    if (hideIconTimeoutRef.current) {
      clearTimeout(hideIconTimeoutRef.current);
    }

    hideIconTimeoutRef.current = setTimeout(() => {
      setShowPauseIcon(false);
    }, 1000);

    return () => {
      if (hideIconTimeoutRef.current) {
        clearTimeout(hideIconTimeoutRef.current);
      }
    };
  }, [showPauseIcon]);

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  return (
    <Pressable
      style={styles.item}
      onPress={() => {
        setPaused((prev) => !prev);
        setShowPauseIcon(true);
      }}
    >
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        fullscreenOptions={{ enable: false }}
        allowsPictureInPicture={false}
      />
      <FeedItemOverlay
        item={item}
        viewerId={viewerId}
        onPressBarber={onPressBarber}
        onPressBook={onPressBook}
        onPressLocation={onPressLocation}
        onOpenComments={onOpenComments}
        onShare={onShare}
      />
      <Pressable style={styles.muteButton} onPress={onToggleMuted}>
        <Ionicons
          name={muted ? 'volume-mute' : 'volume-high'}
          size={20}
          color="#ffffff"
        />
      </Pressable>
      {paused && showPauseIcon ? (
        <View style={styles.pauseIndicator}>
          <Ionicons name="play-circle" size={72} color="rgba(255,255,255,0.6)" />
        </View>
      ) : null}
    </Pressable>
  );
});

const ImageItem = memo(function ImageItem({
  item,
  viewerId,
  onPressBarber,
  onPressBook,
  onPressLocation,
  onOpenComments,
  onShare,
}: FeedItemProps) {
  const mediaUrl = item.mediaUrl ?? item.videoUrl ?? '';

  return (
    <View style={styles.item}>
      {mediaUrl ? (
        <SafeImage
          uri={mediaUrl}
          fallbackSource={require('../../assets/placeholder-gallery.png')}
          style={styles.image}
          resizeMode="cover"
        />
      ) : null}
      <FeedItemOverlay
        item={item}
        viewerId={viewerId}
        onPressBarber={onPressBarber}
        onPressBook={onPressBook}
        onPressLocation={onPressLocation}
        onOpenComments={onOpenComments}
        onShare={onShare}
      />
    </View>
  );
});

export default function Feed() {
  const router = useRouter();
  const isScreenFocused = useIsFocused();
  const listRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(true);
  const currentUser = {
    id: 'user_001',
    name: 'Demo User',
  };
  const viewerId = currentUser?.id ?? 'defaultViewer';
  const videos = useSyncExternalStore(
    subscribeFeed,
    () => getSortedFeed(viewerId),
    () => getSortedFeed(viewerId)
  );
  const [activeCommentsId, setActiveCommentsId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const viewedVideosRef = useRef(new Set<string>());
  const lastActiveIndexRef = useRef(0);
  const [muted, setMuted] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      setActiveIndex(lastActiveIndexRef.current);
      return () => {
        setIsFocused(false);
        setActiveIndex(-1);
      };
    }, [])
  );


  const handlePressBarber = useMemo(
    () => (item: FeedItem) => {
      if (!item.barberId) return;
      router.push(`/barber/${encodeURIComponent(item.barberId)}`);
    },
    [router]
  );

  const handlePressLocation = useMemo(
    () => () => {
      Linking.openURL('https://www.google.com/maps?q=42.46815,-70.94011');
    },
    []
  );

  const handleShare = useMemo(
    () => async (mediaUrl: string) => {
      if (!mediaUrl) return;
      try {
        await Share.share({ message: mediaUrl });
      } catch (error) {
        console.log('[Feed] share error:', error);
      }
    },
    []
  );

  const activeComments = useMemo(() => {
    if (!activeCommentsId) return [];
    return videos.find((item) => item.id === activeCommentsId)?.comments ?? [];
  }, [activeCommentsId, videos]);

  const onViewableItemsChanged = useMemo(
    () =>
      ({
        viewableItems,
      }: {
        viewableItems: Array<{
          index: number | null;
          item: ReturnType<typeof getSortedFeed>[number];
          isViewable: boolean;
        }>;
      }) => {
        if (viewableItems?.[0]?.index != null) {
          lastActiveIndexRef.current = viewableItems[0].index;
          setActiveIndex(viewableItems[0].index);
        }

        viewableItems.forEach((entry) => {
          if (!entry.isViewable) return;
          const id = entry.item?.id;
          if (!id || viewedVideosRef.current.has(id)) return;
          viewedVideosRef.current.add(id);
          incrementViews(id);
        });
      },
    []
  );

  if (!isScreenFocused) {
    return <View style={styles.screen} />;
  }

  return (
    <View style={styles.screen}>
      <Pressable
        style={styles.backButton}
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
            return;
          }
          router.replace('/(tabs)/home');
        }}
      >
        <Ionicons name="chevron-back" size={22} color="#ffffff" />
      </Pressable>
      <FlatList
        ref={listRef}
        data={videos}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) =>
          item.mediaType === 'image' ? (
            <ImageItem
              item={item}
              viewerId={viewerId}
              onPressBarber={handlePressBarber}
              onPressLocation={handlePressLocation}
              onOpenComments={setActiveCommentsId}
              onShare={handleShare}
            />
          ) : (
            <VideoItem
              item={item}
              isActive={index === activeIndex}
              isFocused={isFocused}
              muted={muted}
              viewerId={viewerId}
              onToggleMuted={() => setMuted((prev) => !prev)}
              onPressBarber={handlePressBarber}
              onPressLocation={handlePressLocation}
              onOpenComments={setActiveCommentsId}
              onShare={handleShare}
            />
          )
        }
        pagingEnabled
        snapToInterval={height}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
        onViewableItemsChanged={onViewableItemsChanged}
        getItemLayout={(_, index) => ({
          length: height,
          offset: height * index,
          index,
        })}
      />

      <Modal
        visible={!!activeCommentsId}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveCommentsId(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <Pressable onPress={() => setActiveCommentsId(null)}>
                <Ionicons name="close" size={22} color="#ffffff" />
              </Pressable>
            </View>
            <View style={styles.commentsList}>
              {activeComments.length === 0 ? (
                <Text style={styles.emptyText}>No comments yet.</Text>
              ) : (
                activeComments.map((comment) => (
                  <View key={comment.id} style={styles.commentItem}>
                    <Text style={styles.commentUser}>{comment.user}</Text>
                    <Text style={styles.commentText}>{comment.text}</Text>
                  </View>
                ))
              )}
            </View>
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment..."
                placeholderTextColor="#9aa0a6"
                value={commentText}
                onChangeText={setCommentText}
              />
              <Pressable
                style={styles.commentPostButton}
                onPress={() => {
                  if (!activeCommentsId) return;
                  addComment(activeCommentsId, commentText);
                  setCommentText('');
                }}
              >
                <Text style={styles.commentPostText}>Post</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  item: {
    width,
    height,
    backgroundColor: '#000000',
  },
  video: {
    width,
    height,
  },
  image: {
    width,
    height,
  },
  overlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 110,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 16,
  },
  overlayTop: {
    position: 'absolute',
    top: 54,
    left: 64,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  overlayBarberLine: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  overlayShopLine: {
    color: '#9aa0a6',
    fontSize: 12,
    marginTop: 2,
  },
  overlayViewButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#00f0ff',
  },
  overlayViewText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  overlayLeft: {
    flex: 1,
    gap: 8,
  },
  overlayRight: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 40,
  },
  muteButton: {
    position: 'absolute',
    right: 20,
    bottom: 80,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  pauseIndicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  followingLabel: {
    color: '#00f0ff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  barberLine: {
    color: '#9aa0a6',
    fontSize: 13,
  },
  serviceLine: {
    color: '#9aa0a6',
    fontSize: 12,
  },
  shopBlock: {
    gap: 2,
  },
  shopName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  shopAddress: {
    color: '#9aa0a6',
    fontSize: 12,
  },
  shopAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapButton: {
    marginLeft: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00f0ff',
    borderWidth: 1,
    borderColor: 'rgba(0,240,255,0.4)',
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
  },
  likeButton: {
    alignItems: 'center',
    marginBottom: 18,
  },
  likeCount: {
    color: '#ffffff',
    marginTop: 4,
    fontSize: 14,
  },
  viewCountRow: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 18,
  },
  viewCountText: {
    color: '#ffffff',
    fontSize: 12,
  },
  commentButton: {
    alignItems: 'center',
    marginBottom: 18,
  },
  commentCount: {
    color: '#ffffff',
    marginTop: 4,
    fontSize: 14,
  },
  followButton: {
    alignItems: 'center',
    marginBottom: 18,
  },
  followText: {
    color: '#ffffff',
    fontSize: 12,
    marginTop: 4,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  locationButton: {
    alignSelf: 'center',
    paddingHorizontal: 5,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#00f0ff',
  },
  locationText: {
    color: '#000000',
    fontSize: 9,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
backgroundColor: '#000',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
    minHeight: 280,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  commentsList: {
    gap: 10,
    marginBottom: 16,
  },
  emptyText: {
    color: '#9aa0a6',
    fontSize: 13,
  },
  commentItem: {
    backgroundColor: '#000',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
  },
  commentUser: {
    color: '#00f0ff',
    fontSize: 12,
    fontWeight: '600',
  },
  commentText: {
    color: '#ffffff',
    fontSize: 13,
    marginTop: 4,
  },
  commentInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: '#ffffff',
    fontSize: 14,
  },
  commentPostButton: {
    backgroundColor: '#00f0ff',
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  commentPostText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
