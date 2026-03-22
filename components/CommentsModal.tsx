import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { fetchComments, addComment } from '../services/commentService';

export default function CommentsModal({
  visible,
  onClose,
  postId,
  token,
}: any) {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchComments(postId, token);
      setComments(data.items ?? data);
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Failed to load comments',
      });
    } finally {
      setLoading(false);
    }
  }, [postId, token]);

  useEffect(() => {
    if (visible) load();
  }, [load, visible]);

  const submit = async () => {
    if (!text.trim() || sending) return;
    setSending(true);

    const temp = {
      id: `temp-${Date.now()}`,
      text,
      user: { name: 'You' },
    };
    setComments((prev) => [temp, ...prev]);
    setText('');

    try {
      const saved = await addComment(postId, temp.text, token);
      setComments((prev) => prev.map((c) => (c.id === temp.id ? saved : c)));
    } catch {
      setComments((prev) => prev.filter((c) => c.id !== temp.id));
      Toast.show({
        type: 'error',
        text1: 'Could not post comment',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <View
          style={{
            padding: 16,
            borderBottomWidth: 1,
            borderColor: '#222',
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16 }}>Comments</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: '#fff' }}>Close</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#fff" style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            inverted
            renderItem={({ item }) => (
              <View style={{ padding: 12 }}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>
                  {item.user?.name ?? 'User'}
                </Text>
                <Text style={{ color: '#ddd' }}>{item.text}</Text>
              </View>
            )}
          />
        )}

        <View
          style={{
            padding: 12,
            borderTopWidth: 1,
            borderColor: '#222',
            flexDirection: 'row',
          }}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Add a comment…"
            placeholderTextColor="#666"
            style={{
              flex: 1,
              color: '#fff',
              padding: 10,
backgroundColor: '#000',
              borderRadius: 8,
            }}
          />
          <TouchableOpacity
            onPress={submit}
            style={{ marginLeft: 10, justifyContent: 'center' }}
          >
            <Text style={{ color: '#fff' }}>{sending ? '...' : 'Send'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
