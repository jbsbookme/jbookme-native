import { useMemo, useSyncExternalStore } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { addNotification } from '../../store/notificationStore';
import {
  checkInAppointment,
  getCheckInStatus,
  subscribe as subscribeCheckins,
} from '../../store/checkinStore';

function parseAppointmentId(appointmentId: string) {
  const parts = appointmentId.split('-');
  if (parts.length < 4) return null;
  const userId = parts[0] || 'user';
  const timePart = parts[parts.length - 1];
  const datePart = parts[parts.length - 2];
  const barberId = parts.slice(1, parts.length - 2).join('-') || 'barber';
  return { userId, barberId, datePart, timePart };
}

function appointmentTimeFromId(appointmentId: string) {
  const parsed = parseAppointmentId(appointmentId);
  if (!parsed) return null;
  const { datePart, timePart } = parsed;
  if (datePart.length !== 8 || timePart.length !== 4) return null;
  const year = Number(datePart.slice(0, 4));
  const month = Number(datePart.slice(4, 6)) - 1;
  const day = Number(datePart.slice(6, 8));
  const hours = Number(timePart.slice(0, 2));
  const minutes = Number(timePart.slice(2, 4));
  if ([year, month, day, hours, minutes].some((value) => Number.isNaN(value))) return null;
  return new Date(year, month, day, hours, minutes, 0, 0);
}

export default function BookingConfirmation() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    appointmentId?: string;
    barberId?: string;
    barberName?: string;
    serviceId?: string;
    serviceName?: string;
    date?: string;
    time?: string;
    userId?: string;
    userName?: string;
  }>();
  const fallbackAppointmentId = useMemo(() => {
    const now = new Date();
    const dateId = `${now.getFullYear()}${`${now.getMonth() + 1}`.padStart(2, '0')}${`${now.getDate()}`.padStart(2, '0')}`;
    const timeId = `${`${now.getHours()}`.padStart(2, '0')}${`${now.getMinutes()}`.padStart(2, '0')}`;
    const userId = params.userId ?? 'U123';
    const barberId = params.barberId ?? 'barber';
    return `${userId}-${barberId}-${dateId}-${timeId}`;
  }, [params.barberId, params.userId]);
  const appointmentId = params.appointmentId ?? fallbackAppointmentId;
  const parsed = useMemo(() => parseAppointmentId(appointmentId), [appointmentId]);
  const barberId = params.barberId ?? parsed?.barberId ?? 'barber';
  const barberName = params.barberName ?? 'Carlos Fade';
  const serviceName = params.serviceName ?? params.serviceId ?? 'Service';
  const userName = params.userName ?? 'Customer';
  const appointmentTime = useMemo(() => {
    if (params.time) {
      const fromParams = new Date(params.time);
      if (!Number.isNaN(fromParams.getTime())) return fromParams;
    }
    return appointmentTimeFromId(appointmentId);
  }, [appointmentId, params.time]);
  const appointmentDate = useMemo(() => {
    if (params.date) {
      const fromParams = new Date(params.date);
      if (!Number.isNaN(fromParams.getTime())) return fromParams;
    }
    return appointmentTime;
  }, [appointmentTime, params.date]);
  const timeLabel = appointmentTime
    ? appointmentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : 'Pending time';
  const dateLabel = appointmentDate
    ? appointmentDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
    : 'Pending date';
  const checkInStatus = useSyncExternalStore(
    subscribeCheckins,
    () => getCheckInStatus(appointmentId),
    () => getCheckInStatus(appointmentId)
  );
  const isCheckedIn = !!checkInStatus?.checkedIn;
  const canCheckIn = true;

  const handleCheckIn = () => {
    if (!appointmentTime) {
      Alert.alert('Check-in unavailable', 'Missing appointment time.');
      return;
    }
    if (isCheckedIn) return;
    checkInAppointment(appointmentId);
    addNotification(barberId, 'checkin', `${userName} arrived for appointment`);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.icon}>✅</Text>
        <Text style={styles.title}>Booking Confirmed</Text>
        <Text style={styles.subtitle}>Your appointment has been scheduled successfully.</Text>

        <View style={styles.details}>
          <Text style={styles.detailLabel}>Barber: <Text style={styles.detailValue}>{barberName}</Text></Text>
          <Text style={styles.detailLabel}>Service: <Text style={styles.detailValue}>{serviceName}</Text></Text>
          <Text style={styles.detailLabel}>Date: <Text style={styles.detailValue}>{dateLabel}</Text></Text>
          <Text style={styles.detailLabel}>Time: <Text style={styles.detailValue}>{timeLabel}</Text></Text>
        </View>

        <Pressable
          style={[
            styles.checkInButton,
            (!canCheckIn || isCheckedIn) && styles.checkInButtonDisabled,
            isCheckedIn && styles.checkInButtonDone,
          ]}
          onPress={handleCheckIn}
        >
          <Text style={[styles.checkInText, isCheckedIn && styles.checkInTextDone]}>
            {isCheckedIn ? '✔ Confirmed' : '✅ Confirm Now'}
          </Text>
        </Pressable>

        <Pressable style={styles.button} onPress={() => router.replace('/(tabs)/home')}>
          <Text style={styles.buttonText}>Back to Home</Text>
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: '#9aa0a6',
    fontSize: 14,
    textAlign: 'center',
  },
  details: {
    marginTop: 18,
    gap: 6,
    alignItems: 'center',
  },
  detailLabel: {
    color: '#ffffff',
    fontSize: 14,
  },
  detailValue: {
    color: '#00f0ff',
    fontWeight: '600',
  },
  button: {
    marginTop: 22,
    backgroundColor: '#00f0ff',
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderRadius: 14,
  },
  checkInButton: {
    marginTop: 18,
    backgroundColor: '#00f0ff',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
  },
  checkInButtonDisabled: {
    opacity: 0.5,
  },
  checkInButtonDone: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
  },
  checkInText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  checkInTextDone: {
    color: '#00f0ff',
  },
  buttonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
