import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '@/src/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { fetchBarbers } from '@/src/services/barberService';

type AppointmentDoc = {
	barberId?: string;
	clientId?: string;
	userId?: string;
};

type ChatDoc = {
	appointmentId: string;
	clientId: string;
	barberId: string;
	createdAt: Date;
};

type ChatMessage = {
	id: string;
	senderId: string;
	text: string;
	createdAt?: { toDate: () => Date } | null;
};

export default function AppointmentChat() {
	const router = useRouter();
	const params = useLocalSearchParams<{ appointmentId?: string }>();
	const { user } = useAuth();
	const appointmentId = params.appointmentId ?? '';
	const [loading, setLoading] = useState(true);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [text, setText] = useState('');
	const [barberId, setBarberId] = useState<string | null>(null);
	const [barberName, setBarberName] = useState<string | null>(null);
	const [isAuthorized, setIsAuthorized] = useState(true);

	useEffect(() => {
		const loadChat = async () => {
			if (!appointmentId || !user) return;
			setLoading(true);
			try {
				const appointmentSnap = await getDoc(doc(db, 'appointments', appointmentId));
				const appointment = appointmentSnap.data() as AppointmentDoc | undefined;
				const nextBarberId = appointment?.barberId ?? null;
				const clientId = appointment?.clientId ?? appointment?.userId ?? null;
				const allowed = Boolean(user.uid && (user.uid === nextBarberId || user.uid === clientId));
				setIsAuthorized(allowed);
				if (!allowed) return;
				setBarberId(nextBarberId);
				if (nextBarberId) {
					try {
						const barberList = await fetchBarbers();
						const found = barberList.find((item: { id: string; user?: { name?: string } }) => item.id === nextBarberId);
						setBarberName(found?.user?.name ?? null);
					} catch (nameError) {
						console.log('[Chat] load barber name error:', nameError);
					}
				}
				if (nextBarberId && user.uid) {
					const chatRef = doc(db, 'chats', appointmentId);
					const chatSnap = await getDoc(chatRef);
					if (!chatSnap.exists()) {
						const payload: ChatDoc = {
							appointmentId,
							clientId: clientId ?? user.uid,
							barberId: nextBarberId,
							createdAt: new Date(),
						};
						await setDoc(chatRef, payload);
					}
				}
			} catch (error) {
				console.log('[Chat] load error:', error);
			} finally {
				setLoading(false);
			}
		};

		void loadChat();
	}, [appointmentId, user]);

	useEffect(() => {
		if (!appointmentId || !user || !isAuthorized) return;
		const messagesQuery = query(
			collection(db, 'messages'),
			where('chatId', '==', appointmentId),
			orderBy('createdAt', 'asc')
		);
		const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
			setMessages(
				snapshot.docs.map((docSnap) => {
					const data = docSnap.data() as Omit<ChatMessage, 'id'>;
					return { id: docSnap.id, ...data };
				})
			);
		});
		return () => unsubscribe();
	}, [appointmentId, user]);

	const canSend = useMemo(() => Boolean(text.trim() && user?.uid && isAuthorized), [text, user?.uid, isAuthorized]);

	const handleSend = async () => {
		if (!canSend || !user) return;
		const messageText = text.trim();
		setText('');
		try {
			await addDoc(collection(db, 'messages'), {
				chatId: appointmentId,
				senderId: user.uid,
				text: messageText,
				createdAt: serverTimestamp(),
			});
		} catch (error) {
			console.log('[Chat] send error:', error);
		}
	};

	return (
		<SafeAreaView style={styles.screen}>
			<KeyboardAvoidingView
				style={styles.screen}
				behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
				keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
			>
			<View style={styles.header}>
				<Pressable style={styles.backButton} onPress={() => router.back()}>
					<Ionicons name="chevron-back" size={22} color="#ffffff" />
				</Pressable>
				<View>
					<Text style={styles.title}>
						{barberName ? `Chat with ${barberName}` : 'Chat'}
					</Text>
				</View>
			</View>

			{loading ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator color="#00f0ff" />
					<Text style={styles.loadingText}>Loading chat...</Text>
				</View>
			) : !isAuthorized ? (
				<View style={styles.emptyState}>
					<Text style={styles.emptyTitle}>Chat unavailable</Text>
					<Text style={styles.emptyBody}>Only the client and barber for this appointment can access this chat.</Text>
				</View>
			) : (
				<View style={styles.messagesContainer}>
					{messages.length === 0 ? (
						<View style={styles.emptyState}>
							<Text style={styles.emptyTitle}>Start the conversation</Text>
							<Text style={styles.emptyBody}>Send a message to your barber about this appointment.</Text>
						</View>
					) : (
						messages.map((message) => {
							const isMe = message.senderId === user?.uid;
							return (
								<View key={message.id} style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleThem]}>
									<Text style={[styles.messageText, !isMe && styles.messageTextLight]}>{message.text}</Text>
								</View>
							);
						})
					)}
				</View>
			)}

			<View style={styles.inputBar}>
				<TextInput
					value={text}
					onChangeText={setText}
					placeholder="Write a message..."
					placeholderTextColor="#6b7280"
					style={styles.input}
					multiline
				/>
				<Pressable style={[styles.sendButton, !canSend && styles.sendButtonDisabled]} onPress={handleSend} disabled={!canSend}>
					<Text style={styles.sendButtonText}>Send</Text>
				</Pressable>
			</View>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: '#000000',
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		padding: 20,
	},
	backButton: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		backgroundColor: '#000',
	},
	title: {
		color: '#ffffff',
		fontSize: 18,
		fontWeight: '700',
	},
	subtitle: {
		color: '#9aa0a6',
		fontSize: 12,
	},
	loadingContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 10,
	},
	loadingText: {
		color: '#9aa0a6',
		fontSize: 12,
	},
	messagesContainer: {
		flex: 1,
		paddingHorizontal: 20,
		gap: 10,
	},
	messageBubble: {
		padding: 12,
		borderRadius: 14,
		maxWidth: '80%',
	},
	messageBubbleMe: {
		alignSelf: 'flex-end',
		backgroundColor: '#00f0ff',
	},
	messageBubbleThem: {
		alignSelf: 'flex-start',
		backgroundColor: '#000',
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
	},
	messageText: {
		color: '#000000',
		fontSize: 13,
		fontWeight: '600',
	},
	messageTextLight: {
		color: '#ffffff',
	},
	emptyState: {
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		borderRadius: 14,
		padding: 18,
		backgroundColor: '#000',
		gap: 6,
		alignItems: 'center',
	},
	emptyTitle: {
		color: '#ffffff',
		fontSize: 14,
		fontWeight: '700',
	},
	emptyBody: {
		color: '#9aa0a6',
		fontSize: 12,
		textAlign: 'center',
	},
	inputBar: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		gap: 10,
		padding: 16,
		borderTopWidth: 1,
		borderTopColor: 'rgba(255,255,255,0.08)',
		backgroundColor: '#000',
	},
	input: {
		flex: 1,
		minHeight: 42,
		maxHeight: 120,
		color: '#ffffff',
		fontSize: 13,
		paddingHorizontal: 12,
		paddingVertical: 10,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		backgroundColor: '#000',
	},
	sendButton: {
		paddingVertical: 10,
		paddingHorizontal: 16,
		borderRadius: 12,
		backgroundColor: '#00f0ff',
		alignItems: 'center',
		justifyContent: 'center',
	},
	sendButtonDisabled: {
		opacity: 0.5,
	},
	sendButtonText: {
		color: '#000000',
		fontSize: 13,
		fontWeight: '700',
	},
});
