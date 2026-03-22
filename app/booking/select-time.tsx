import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeImage } from '../../components/SafeImage';
import { Calendar } from 'react-native-calendars';
import { fetchBarbers } from '../../src/services/barberService';
import { fetchServices } from '../../src/services/serviceService';
import {
  ALL_TIME_SLOTS,
  getAvailableTimeSlots,
  getBookedTimes,
} from '../../src/services/availabilityService';

type Service = {
  id: string;
  name: string;
  price: number;
  duration: number;
  image?: string;
};

type Barber = {
  id: string;
  user: {
    name: string;
  };
  profileImage: string;
};

function formatTimeLabel(value: string) {
  const [rawHour, rawMinute] = value.split(':').map(Number);
  if (Number.isNaN(rawHour) || Number.isNaN(rawMinute)) return value;
  const period = rawHour >= 12 ? 'PM' : 'AM';
  const hour = rawHour % 12 === 0 ? 12 : rawHour % 12;
  const minute = rawMinute.toString().padStart(2, '0');
  return `${hour}:${minute} ${period}`;
}

export default function SelectTime() {
  const router = useRouter();
  const params = useLocalSearchParams<{ barberId?: string; serviceId?: string }>();
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [barber, setBarber] = useState<Barber | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>(ALL_TIME_SLOTS);
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set());
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    const loadDetails = async () => {
      const [barberData, serviceData] = await Promise.all([
        fetchBarbers(),
        fetchServices(),
      ]);
      const foundBarber = barberData.find((item: Barber) => item.id === params.barberId) ?? null;
      const foundService = serviceData.find((item: Service) => item.id === params.serviceId) ?? null;
      setBarber(foundBarber);
      setService(foundService);
    };

    if (params.serviceId) {
      loadDetails();
    }
  }, [params.barberId, params.serviceId]);

  useEffect(() => {
    const loadAvailability = async () => {
      if (!params.barberId || !selectedDate) return;
      setLoadingSlots(true);
      try {
        const [available, booked] = await Promise.all([
          getAvailableTimeSlots(params.barberId, selectedDate),
          getBookedTimes(params.barberId, selectedDate),
        ]);
        setAvailableSlots(available);
        setBookedSlots(new Set(booked));
        if (selectedTime && booked.includes(selectedTime)) {
          setSelectedTime(null);
        }
      } catch (error) {
        setAvailableSlots(ALL_TIME_SLOTS);
        setBookedSlots(new Set());
      } finally {
        setLoadingSlots(false);
      }
    };

    loadAvailability();
  }, [params.barberId, selectedDate, selectedTime]);

  const bookingDateTime = useMemo(() => {
    if (!selectedDate || !selectedTime) return null;
    const [year, month, day] = selectedDate.split('-').map(Number);
    const [hour, minute] = selectedTime.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute);
  }, [selectedDate, selectedTime]);

  const isPastSlot = (dateKey: string, timeLabel: string) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    const [hour, minute] = timeLabel.split(':').map(Number);
    if ([year, month, day, hour, minute].some((value) => Number.isNaN(value))) return false;
    const slotDate = new Date(year, month - 1, day, hour, minute);
    return slotDate.getTime() < Date.now();
  };

  const visibleSlots = useMemo(() => {
    if (!selectedDate) return [] as string[];
    const baseSlots = availableSlots.length > 0 ? availableSlots : ALL_TIME_SLOTS;
    return baseSlots.filter((slot) => {
      if (bookedSlots.has(slot)) return false;
      if (isPastSlot(selectedDate, slot)) return false;
      return true;
    });
  }, [selectedDate, availableSlots, bookedSlots]);

  useEffect(() => {
    if (!selectedTime) return;
    if (!visibleSlots.includes(selectedTime)) {
      setSelectedTime(null);
    }
  }, [selectedTime, visibleSlots]);

  const canContinue = Boolean(acceptTerms && selectedDate && selectedTime);

  const handleContinue = () => {
    if (!canContinue || !bookingDateTime) return;
    router.push({
      pathname: '/booking/payment-method',
      params: {
        barberId: params.barberId,
        serviceId: params.serviceId,
        barberName: barber?.user?.name ?? 'Barber',
        serviceName: service?.name ?? 'Service',
        date: bookingDateTime.toISOString(),
        time: bookingDateTime.toISOString(),
      },
    });
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Select Date & Time</Text>

        <View style={[styles.card, { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(225, 6, 0, 0.85)' }]}>
          <Text style={styles.label}>Service</Text>
          {service ? (
            <SafeImage
              uri={service.image}
              fallbackSource={require('../../assets/placeholder-service.png')}
              style={styles.serviceImage}
              resizeMode="cover"
            />
          ) : null}
          <Text style={styles.value}>{service?.name ?? 'Service'}</Text>
          <Text style={styles.metaText}>
            ${service?.price ?? 0} • {service?.duration ?? 0} min
          </Text>
          <Text style={styles.label}>Barber</Text>
          <Text style={styles.value}>{barber?.user?.name ?? 'Barber'}</Text>
        </View>

        <View style={styles.container}>
          <Text style={styles.title}>Select Date</Text>
          <View style={styles.calendarCard}>
            <Calendar
              minDate={todayKey}
              onDayPress={(day) => {
                setSelectedDate(day.dateString);
                setSelectedTime(null);
              }}
              markedDates={
                selectedDate
                  ? {
                      [selectedDate]: {
                        selected: true,
                        selectedColor: '#00f0ff',
                      },
                    }
                  : undefined
              }
              theme={{
                backgroundColor: '#000',
                calendarBackground: '#000',
                textSectionTitleColor: '#9aa0a6',
                dayTextColor: '#ffffff',
                monthTextColor: '#ffffff',
                todayTextColor: '#ffd700',
                arrowColor: '#00f0ff',
                textDisabledColor: 'rgba(255,255,255,0.3)',
              }}
            />
          </View>

          <Text style={styles.title}>Select Time</Text>
          <View style={styles.timeGrid}>
            {visibleSlots.map((hour) => {
              const isSelected = hour === selectedTime;
              return (
                <Pressable
                  key={hour}
                  style={[styles.timeButton, isSelected && styles.timeButtonActive]}
                  onPress={() => setSelectedTime(hour)}
                  disabled={loadingSlots}
                >
                  <Text
                    style={[
                      styles.timeButtonText,
                      isSelected && styles.timeButtonTextActive,
                    ]}
                  >
                    {formatTimeLabel(hour)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {selectedDate && !loadingSlots && visibleSlots.length === 0 ? (
            <Text style={styles.emptySlotsText}>
              No available times for this barber on this date.
            </Text>
          ) : null}
        </View>

        <Pressable style={styles.checkboxRow} onPress={() => setAcceptTerms((current) => !current)}>
          <View style={[styles.checkbox, acceptTerms && styles.checkboxChecked]} />
          <Text style={styles.checkboxText}>Accept terms</Text>
        </Pressable>

        <Pressable
          style={[styles.button, !canContinue && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </Pressable>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  container: {
    gap: 12,
  },
  calendarCard: {
    backgroundColor: '#000',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
  },
  card: {
    backgroundColor: '#000',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
    gap: 8,
  },
  label: {
    color: '#9aa0a6',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  metaText: {
    color: '#9aa0a6',
    fontSize: 13,
  },
  serviceImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
backgroundColor: '#000',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timeButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
backgroundColor: '#000',
  },
  timeButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  timeButtonActive: {
    backgroundColor: '#00f0ff',
    borderColor: 'rgba(225, 6, 0, 0.85)',
  },
  timeButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  timeButtonTextDisabled: {
    color: 'rgba(255,255,255,0.35)',
  },
  timeButtonTextActive: {
    color: '#000000',
  },
  emptySlotsText: {
    color: '#9aa0a6',
    fontSize: 13,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
  },
  checkboxChecked: {
    backgroundColor: '#00f0ff',
  },
  checkboxText: {
    color: '#ffffff',
    fontSize: 14,
  },
  button: {
    marginTop: 8,
    backgroundColor: '#00f0ff',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
