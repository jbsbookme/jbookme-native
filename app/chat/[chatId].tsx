import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getAuth } from 'firebase/auth';
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../../config/firebase';

type Message = {
  id: string;
  chatId?: string;
  senderId?: string;
  text?: string;
  createdAt?: { seconds?: number } | null;
};

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const chatId = useMemo(() => String(params.chatId ?? ''), [params.chatId]);
  const auth = getAuth();
  const user = auth.currentUser;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    if (!chatId) return;
    const q = query(
      collection(db, 'messages'),
      where('chatId', '==', chatId),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Message, 'id'>),
      }));
      setMessages(msgs);
    });

    return unsubscribe;
  }, [chatId]);

  const sendMessage = async () => {
    if (!user || !input.trim() || !chatId) return;

    await addDoc(collection(db, 'messages'), {
      chatId,
      senderId: user.uid,
      text: input.trim(),
      createdAt: serverTimestamp(),
    });

    setInput('');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isMine = item.senderId === user?.uid;
          return (
            <View
              style={[
                styles.messageBubble,
                isMine ? styles.messageMine : styles.messageOther,
              ]}
            >
              <Text style={styles.messageText}>{item.text ?? ''}</Text>
            </View>
          );
        }}
      />

      <View style={styles.inputRow}>
        <TextInput
          placeholder="Type a message"
          placeholderTextColor="#9aa0a6"
          value={input}
          onChangeText={setInput}
          style={styles.input}
        />
        <Pressable style={styles.sendButton} onPress={sendMessage}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  list: {
    padding: 16,
    gap: 8,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 12,
  },
  messageMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#00d4ff',
  },
  messageOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#000',
    borderColor: '#111',
    borderWidth: 1,
  },
  messageText: {
    color: '#ffffff',
  },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  input: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
  },
  sendButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#00d4ff',
  },
  sendText: {
    color: '#000000',
    fontWeight: '700',
  },
});
