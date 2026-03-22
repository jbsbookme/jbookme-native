import { useEffect, useMemo, useState } from 'react';
import {
	Alert,
	FlatList,
	Pressable,
	SafeAreaView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native';
import { SafeImage } from '../../components/SafeImage';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	getDocs,
	orderBy,
	query,
	serverTimestamp,
	where,
} from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { auth, db } from '@/config/firebase';
import { uploadImageToCloudinary, uploadVideoToCloudinary } from '@/services/cloudinary';

type PostItem = {
	id: string;
	barberId?: string;
	mediaUrl?: string;
	mediaType?: 'image' | 'video';
	caption?: string;
	createdAt?: unknown;
	likes?: number;
	comments?: number;
};

function MediaTile({ uri, mediaType }: { uri: string; mediaType?: 'image' | 'video' }) {
	if (mediaType === 'video') {
		const player = useVideoPlayer(uri, (p) => {
			p.loop = true;
			p.muted = true;
		});
		return <VideoView player={player} style={styles.media} contentFit="cover" />;
	}

	return (
		<SafeImage
			uri={uri}
			fallbackSource={require('../../assets/placeholder-gallery.png')}
			style={styles.media}
			resizeMode="cover"
		/>
	);
}

export default function BarberGallery() {
	const { user } = useAuth();
	const [posts, setPosts] = useState<PostItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [captionText, setCaptionText] = useState('');

	const canPublish = !!user?.uid && !uploading;

	const loadPosts = async () => {
		if (!user?.uid) return;
		console.log('GALLERY BARBER UID:', user.uid);
		setLoading(true);
		try {
			const q = query(
				collection(db, 'posts'),
				where('barberId', '==', user.uid),
				orderBy('createdAt', 'desc')
			);
			const snapshot = await getDocs(q);
			const data = snapshot.docs.map((docItem) => ({
				id: docItem.id,
				...(docItem.data() as PostItem),
			}));
			setPosts(data);
		} catch (error) {
			console.log('[BarberGallery] load posts error:', error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadPosts();
	}, [user?.uid]);

	const requestMediaPermission = async () => {
		const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (status !== 'granted') {
			Alert.alert('Permission needed', 'Allow access to your photos to upload.');
			return false;
		}
		return true;
	};

	const handlePublishWork = async () => {
		if (!canPublish) return;
		setUploading(true);
		try {
			const allowed = await requestMediaPermission();
			if (!allowed) return;
			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ImagePicker.MediaTypeOptions.All,
				quality: 0.8,
			});
			if (result.canceled || !result.assets?.length) return;

			const asset = result.assets[0];
			const mediaType = asset.type === 'video' ? 'video' : 'image';
			console.log('UPLOAD MEDIA TYPE:', mediaType);

			const cloudinaryUrl =
				mediaType === 'video'
					? await uploadVideoToCloudinary(asset.uri)
					: await uploadImageToCloudinary(asset.uri);

			console.log('CLOUDINARY URL:', cloudinaryUrl);

			const currentUser = auth.currentUser;
			if (!currentUser) {
				console.log('ERROR: user not authenticated');
				return;
			}
			console.log('POST USER UID:', currentUser.uid);

			const docRef = await addDoc(collection(db, 'posts'), {
				userId: currentUser.uid,
				barberId: currentUser.uid,
				uri: cloudinaryUrl,
				type: mediaType,
				mediaUrl: cloudinaryUrl,
				mediaType,
				caption: captionText.trim(),
				createdAt: serverTimestamp(),
				likes: 0,
				comments: 0,
			});

			console.log('POST CREATED:', docRef.id);
			setCaptionText('');
			await loadPosts();
		} catch (error) {
			console.log('[BarberGallery] publish error:', error);
			Alert.alert('Upload failed', 'Unable to publish this post.');
		} finally {
			setUploading(false);
		}
	};

	const handleDeletePost = async (postId: string) => {
		Alert.alert('Delete post?', 'This cannot be undone.', [
			{ text: 'Cancel', style: 'cancel' },
			{
				text: 'Delete',
				style: 'destructive',
				onPress: async () => {
					try {
						await deleteDoc(doc(db, 'posts', postId));
						await loadPosts();
					} catch (error) {
						Alert.alert('Delete failed', 'Unable to delete this post.');
					}
				},
			},
		]);
	};

	const gridData = useMemo(() => posts.filter((item) => item.mediaUrl), [posts]);

	return (
		<SafeAreaView style={styles.screen}>
			<View style={styles.header}>
				<Text style={styles.title}>My Gallery</Text>
				<Text style={styles.subtitle}>Publish photos or videos of your work.</Text>
				<TextInput
					value={captionText}
					onChangeText={setCaptionText}
					placeholder="Caption (optional)"
					placeholderTextColor="#9aa0a6"
					style={styles.captionInput}
				/>
				<Pressable
					style={[styles.publishButton, (!canPublish || uploading) && styles.buttonDisabled]}
					onPress={handlePublishWork}
					disabled={!canPublish}
				>
					<Text style={styles.publishText}>
						{uploading ? 'Publishing...' : 'Publish Work'}
					</Text>
				</Pressable>
			</View>

			<FlatList
				data={gridData}
				numColumns={3}
				keyExtractor={(item) => item.id}
				renderItem={({ item }) => (
					<Pressable
						style={styles.tile}
						onLongPress={() => handleDeletePost(item.id)}
						delayLongPress={300}
					>
						{item.mediaUrl ? (
							<MediaTile uri={item.mediaUrl} mediaType={item.mediaType} />
						) : (
							<View style={styles.mediaPlaceholder} />
						)}
					</Pressable>
				)}
				contentContainerStyle={styles.grid}
				ListEmptyComponent={
					<View style={styles.emptyState}>
						<Text style={styles.emptyText}>
							{loading ? 'Loading posts...' : 'No posts yet.'}
						</Text>
					</View>
				}
				showsVerticalScrollIndicator={false}
			/>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: '#000000',
	},
	header: {
		paddingHorizontal: 20,
		paddingTop: 16,
		paddingBottom: 12,
		gap: 10,
	},
	title: {
		color: '#ffffff',
		fontSize: 22,
		fontWeight: '700',
	},
	subtitle: {
		color: '#9aa0a6',
		fontSize: 13,
	},
	captionInput: {
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		borderRadius: 10,
		paddingVertical: 10,
		paddingHorizontal: 12,
		color: '#ffffff',
	},
	publishButton: {
		backgroundColor: '#00f0ff',
		borderRadius: 12,
		paddingVertical: 12,
		alignItems: 'center',
	},
	publishText: {
		color: '#000000',
		fontSize: 14,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 0.4,
	},
	buttonDisabled: {
		opacity: 0.6,
	},
	grid: {
		paddingHorizontal: 12,
		paddingBottom: 24,
		gap: 6,
	},
	tile: {
		width: '33.33%',
		padding: 4,
	},
	media: {
		width: '100%',
		aspectRatio: 1,
		borderRadius: 8,
		backgroundColor: '#000',
	},
	mediaPlaceholder: {
		width: '100%',
		aspectRatio: 1,
		borderRadius: 8,
		backgroundColor: '#000',
	},
	emptyState: {
		paddingTop: 40,
		alignItems: 'center',
	},
	emptyText: {
		color: '#9aa0a6',
		fontSize: 13,
	},
});
