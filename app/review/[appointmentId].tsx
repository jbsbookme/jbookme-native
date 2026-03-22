import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { addReview } from '../../store/reviewsStore';
import { addNotification } from '../../store/notificationStore';

const STAR_VALUES = [1, 2, 3, 4, 5];

function toBarberId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function ReviewScreen() {
  const router = useRouter();
  const { appointmentId, barberName, barberId, userName } = useLocalSearchParams<{
    appointmentId?: string;
    barberName?: string;
    barberId?: string;
    userName?: string;
  }>();
  const resolvedBarberName = (barberName ?? 'your barber').trim();
  const resolvedBarberId = (barberId ?? toBarberId(resolvedBarberName)).trim() || 'barber';
  const resolvedUserName = (userName ?? 'Client').trim() || 'Client';
  const reviewId = useMemo(
    () => `${appointmentId ?? 'appointment'}-${Date.now()}`,
    [appointmentId]
  );

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const handleSubmit = () => {
    addReview({
      id: reviewId,
      barberId: resolvedBarberId,
      barberName: resolvedBarberName,
      rating,
      comment: comment.trim(),
      userName: resolvedUserName,
      createdAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      }),
    });

    addNotification(resolvedBarberId, 'review', 'New review received');

    router.back();
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>Rate Your Experience</Text>
        <Text style={styles.subtitle}>How was your haircut with {resolvedBarberName}?</Text>

        <View style={styles.starRow}>
          {STAR_VALUES.map((value) => (
            <Pressable
              key={value}
              style={[styles.starButton, rating >= value && styles.starButtonActive]}
              onPress={() => setRating(value)}
            >
              <Text style={styles.starText}>{rating >= value ? '⭐' : '☆'}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>Leave a comment (optional)</Text>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Tell us about your experience"
            placeholderTextColor="#9aa0a6"
            style={styles.input}
            multiline
          />
        </View>

        <Pressable style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Submit Review</Text>
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
  content: {
    padding: 20,
    gap: 20,
  },
  title: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    color: '#9aa0a6',
    fontSize: 15,
  },
  starRow: {
    flexDirection: 'row',
    gap: 10,
  },
  starButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
  },
  starButtonActive: {
    borderColor: 'rgba(225, 6, 0, 0.85)',
  },
  starText: {
    fontSize: 18,
  },
  inputCard: {
    backgroundColor: '#000',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
    gap: 10,
  },
  inputLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    color: '#ffffff',
    minHeight: 120,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: '#00f0ff',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
