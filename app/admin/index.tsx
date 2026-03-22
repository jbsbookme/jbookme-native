import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeImage } from '../../components/SafeImage';
import * as ImagePicker from 'expo-image-picker';
import { addDoc, collection, deleteDoc, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/config/firebase';
import {
  getAllAppointments,
  getDashboardStats,
  updateAppointmentStatus,
} from '../../src/services/appointmentService';

type BarberDoc = {
  id: string;
  name?: string;
  shopName?: string;
  rating?: number;
  image?: string;
  servicesCount?: number;
};

type AppointmentDoc = {
  id: string;
  userId?: string;
  barberId?: string;
  serviceId?: string;
  date?: { seconds: number } | Date | null;
  status?: string;
  barberName?: string;
  serviceName?: string;
};

type ServiceDoc = {
  id: string;
  name?: string;
  price?: number;
  duration?: number;
  image?: string;
};

export default function AdminDashboard() {
  const auth = getAuth();
  const [barbers, setBarbers] = useState<BarberDoc[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<BarberDoc | null>(null);
  const [services, setServices] = useState<ServiceDoc[]>([]);
  const [appointments, setAppointments] = useState<AppointmentDoc[]>([]);
  const [stats, setStats] = useState<null | {
    revenue: number;
    todayCount: number;
    completed: number;
    cancelled: number;
  }>(null);
  const [newBarberName, setNewBarberName] = useState('');
  const [newBarberAccountEmail, setNewBarberAccountEmail] = useState('');
  const [newBarberAccountPassword, setNewBarberAccountPassword] = useState('');
  const [role, setRole] = useState<'BARBER' | 'STYLIST'>('BARBER');
  const [newBarberEmail, setNewBarberEmail] = useState('');
  const [newBarberPhone, setNewBarberPhone] = useState('');
  const [newBarberWhatsApp, setNewBarberWhatsApp] = useState('');
  const [newBarberSpecialties, setNewBarberSpecialties] = useState('');
  const [newBarberHourlyRate, setNewBarberHourlyRate] = useState('');
  const [newBarberBio, setNewBarberBio] = useState('');
  const [newBarberInstagram, setNewBarberInstagram] = useState('');
  const [newBarberFacebook, setNewBarberFacebook] = useState('');
  const [newBarberTwitter, setNewBarberTwitter] = useState('');
  const [newBarberTiktok, setNewBarberTiktok] = useState('');
  const [newBarberYoutube, setNewBarberYoutube] = useState('');
  const [newBarberZelleEmail, setNewBarberZelleEmail] = useState('');
  const [newBarberZellePhone, setNewBarberZellePhone] = useState('');
  const [newBarberCashApp, setNewBarberCashApp] = useState('');
  const [newBarberImageUrl, setNewBarberImageUrl] = useState('');
  const [barberImageUri, setBarberImageUri] = useState<string | null>(null);
  const [barberImageName, setBarberImageName] = useState<string | null>(null);
  const [barberActive, setBarberActive] = useState(true);
  const [isUploadingBarberImage, setIsUploadingBarberImage] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceDuration, setNewServiceDuration] = useState('');
  const [serviceImageUri, setServiceImageUri] = useState<string | null>(null);
  const [serviceImageName, setServiceImageName] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const requestMediaPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to select an image.');
      return false;
    }
    return true;
  };

  const loadBarbers = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'barbers'));
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<BarberDoc, 'id'>),
      }));
      setBarbers(data);
      if (data.length > 0) {
        setSelectedBarber(data[0]);
      }
    } catch (error) {
      console.error('[ADMIN] Error fetching barbers:', error);
      Alert.alert('Error', 'Could not fetch barbers from Firestore.');
    }
  };

  const loadServices = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'services'));
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<ServiceDoc, 'id'>),
      }));
      setServices(data);
    } catch (error) {
      console.error('[ADMIN] Error fetching services:', error);
      Alert.alert('Error', 'Could not fetch services from Firestore.');
    }
  };

  const loadAppointments = async () => {
    try {
      const data = await getAllAppointments();
      setAppointments(data as AppointmentDoc[]);
    } catch (error) {
      console.error('[ADMIN] Error fetching appointments:', error);
      setAppointments([]);
    }
  };

  const getCurrentBarber = async () => {
    const user = auth.currentUser;
    if (!user?.email) return null;
    const q = query(collection(db, 'barbers'), where('email', '==', user.email));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return {
        id: snapshot.docs[0].id,
        ...(snapshot.docs[0].data() as Omit<BarberDoc, 'id'>),
      };
    }
    return null;
  };

  const handleTakeBreak = async () => {
    const barber = await getCurrentBarber();
    if (!barber) return;

    const now = new Date();
    const time = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const date = now.toISOString().split('T')[0];

    await addDoc(collection(db, 'barberBlocks'), {
      barberId: barber.id,
      date,
      blockedSlots: [time],
    });

    Alert.alert('Break activated');
  };

  const handleUnlock = async () => {
    if (!selectedBarber) return;

    const now = new Date();
    const time = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const date = now.toISOString().split('T')[0];

    const q = query(
      collection(db, 'barberBlocks'),
      where('barberId', '==', selectedBarber.id),
      where('date', '==', date)
    );

    const snapshot = await getDocs(q);
    snapshot.forEach(async (d) => {
      await deleteDoc(doc(db, 'barberBlocks', d.id));
    });

    Alert.alert('Break removed');
  };

  const saveAvailability = async (slots: string[]) => {
    if (!selectedBarber) return;

    const now = new Date();
    const day = now.toLocaleDateString('en-US', {
      weekday: 'long',
    });

    await setDoc(doc(db, 'barberAvailability', `${selectedBarber.id}_${day}`), {
      barberId: selectedBarber.id,
      day,
      slots,
    });

    Alert.alert('Availability saved');
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    await updateAppointmentStatus(id, status);
    setAppointments((prev) =>
      prev.map((appointment) =>
        appointment.id === id ? { ...appointment, status } : appointment
      )
    );
  };

  useEffect(() => {
    loadBarbers();
    loadServices();
    loadAppointments();
    const loadStats = async () => {
      const data = await getDashboardStats();
      setStats(data);
    };
    loadStats();
  }, []);

  const pickBarberImage = async () => {
    const allowed = await requestMediaPermission();
    if (!allowed) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setBarberImageUri(asset.uri);
      setBarberImageName(asset.fileName ?? null);
    }
  };

  const uploadBarberImage = async (uri: string, fileName?: string | null) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const safeName = (fileName && fileName.trim()) || `image-${Date.now()}.jpg`;
    const storageRef = ref(storage, `barbers/${Date.now()}-${safeName}`);
    await uploadBytes(storageRef, blob);
    const downloadUrl = await getDownloadURL(storageRef);
    if (!downloadUrl) {
      throw new Error('Empty download URL');
    }
    return downloadUrl;
  };

  const createBarber = async () => {
    const trimmedName = newBarberName.trim();

    if (!trimmedName) {
      console.log('[ADMIN] Validation failed: Name is empty');
      Alert.alert('Validation Error', 'Please enter a name for the barber.');
      return;
    }

    // NOTE: The user's request simplifies the creation and does not include image upload.
    // This new implementation will not handle image uploads for barbers for now.
    setIsUploadingBarberImage(true);

    try {
      const barberData = {
        name: trimmedName,
        role,
        email: newBarberEmail.trim(),
        phone: newBarberPhone.trim(),
        specialty: newBarberSpecialties.trim(),
        active: barberActive,
        bio: newBarberBio.trim(),
        instagram: newBarberInstagram.trim(),
        facebook: newBarberFacebook.trim(),
        twitter: newBarberTwitter.trim(),
        tiktok: newBarberTiktok.trim(),
        youtube: newBarberYoutube.trim(),
        zelleEmail: newBarberZelleEmail.trim(),
        zellePhone: newBarberZellePhone.trim(),
        cashApp: newBarberCashApp.trim(),
        image: newBarberImageUrl.trim(),
      };

      await addDoc(collection(db, 'barbers'), barberData);

      Alert.alert('Success', `Barber ${trimmedName} has been created.`);

      // Reset form fields
      setNewBarberName('');
      setNewBarberEmail('');
      setNewBarberPhone('');
      setNewBarberSpecialties('');
      // ... reset other fields as necessary

      // Refresh the list of barbers
      await loadBarbers();
    } catch (error) {
      console.error('[ADMIN] Error creating barber in Firestore:', error);
      Alert.alert('Error', 'An error occurred while creating the barber. Please check the console.');
    } finally {
      setIsUploadingBarberImage(false);
    }
  };

  const formatAppointmentDate = (value: AppointmentDoc['date']) => {
    if (!value) return 'Pending date';
    if (value instanceof Date) return value.toLocaleString();
    if ('seconds' in value) return new Date(value.seconds * 1000).toLocaleString();
    return 'Pending date';
  };

  const getAppointmentDate = (value: AppointmentDoc['date']) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if ('seconds' in value) return new Date(value.seconds * 1000);
    return null;
  };

  const pickServiceImage = async () => {
    const allowed = await requestMediaPermission();
    if (!allowed) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setServiceImageUri(asset.uri);
      setServiceImageName(asset.fileName ?? null);
    }
  };

  const uploadServiceImage = async (uri: string, fileName?: string | null) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const safeName = (fileName && fileName.trim()) || `image-${Date.now()}.jpg`;
    const storageRef = ref(storage, `services/${Date.now()}-${safeName}`);
    await uploadBytes(storageRef, blob);
    const downloadUrl = await getDownloadURL(storageRef);
    if (!downloadUrl) {
      throw new Error('Empty download URL');
    }
    return downloadUrl;
  };

  const createService = async () => {
    const trimmedName = newServiceName.trim();
    if (!trimmedName) return;

    const parsedPrice = Number(newServicePrice);
    const parsedDuration = Number(newServiceDuration);

    try {
      setIsUploadingImage(true);
      const imageUrl = serviceImageUri
        ? await uploadServiceImage(serviceImageUri, serviceImageName)
        : null;
      if (serviceImageUri && !imageUrl) {
        Alert.alert('Upload failed', 'Image upload did not return a URL.');
        return;
      }
      const serviceDoc: Record<string, unknown> = {
        name: trimmedName,
      };

      if (!Number.isNaN(parsedPrice)) {
        serviceDoc.price = parsedPrice;
      }
      if (!Number.isNaN(parsedDuration)) {
        serviceDoc.duration = parsedDuration;
      }
      if (imageUrl) {
        serviceDoc.image = imageUrl;
      }

      await addDoc(collection(db, 'services'), serviceDoc);

      setNewServiceName('');
      setNewServicePrice('');
      setNewServiceDuration('');
      setServiceImageUri(null);
      setServiceImageName(null);
      await loadServices();
    } catch (error) {
      console.log('Create service error:', error);
      Alert.alert('Upload failed', 'Unable to create the service right now.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Admin Dashboard</Text>

      <View style={{ marginBottom: 20 }}>
        <Text style={{ color: 'white', fontSize: 18 }}>
          💰 Today Revenue: ${stats?.revenue || 0}
        </Text>
        <Text style={{ color: 'white' }}>
          📅 Today Appointments: {stats?.todayCount || 0}
        </Text>
        <Text style={{ color: 'green' }}>
          ✔ Completed: {stats?.completed || 0}
        </Text>
        <Text style={{ color: 'red' }}>
          ❌ Cancelled: {stats?.cancelled || 0}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Add Barber</Text>
      <TextInput
        placeholder="Full name"
        placeholderTextColor="#9aa0a6"
        value={newBarberName}
        onChangeText={setNewBarberName}
        style={styles.input}
      />
      <TextInput
        placeholder="Email"
        placeholderTextColor="#9aa0a6"
        value={newBarberAccountEmail}
        onChangeText={setNewBarberAccountEmail}
        style={styles.input}
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Password"
        placeholderTextColor="#9aa0a6"
        value={newBarberAccountPassword}
        onChangeText={setNewBarberAccountPassword}
        style={styles.input}
        secureTextEntry
      />
      <View style={styles.inlineRow}>
        <Pressable
          style={[styles.chip, barberActive && styles.chipActive]}
          onPress={() => setBarberActive((current) => !current)}
        >
          <Text style={[styles.chipText, barberActive && styles.chipTextActive]}>
            {barberActive ? 'Active' : 'Inactive'}
          </Text>
        </Pressable>
      </View>
      <View style={{ marginTop: 10 }}>
        <Text style={{ color: '#aaa', marginBottom: 6 }}>Role</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={() => setRole('BARBER')}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 10,
              backgroundColor: role === 'BARBER' ? '#00f0ff' : '#111',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: role === 'BARBER' ? '#000' : '#fff' }}>Barber</Text>
          </Pressable>
          <Pressable
            onPress={() => setRole('STYLIST')}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 10,
              backgroundColor: role === 'STYLIST' ? '#ff00aa' : '#111',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff' }}>Stylist</Text>
          </Pressable>
        </View>
      </View>
      <TextInput
        placeholder="Barber personal email"
        placeholderTextColor="#9aa0a6"
        value={newBarberEmail}
        onChangeText={setNewBarberEmail}
        style={styles.input}
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Phone"
        placeholderTextColor="#9aa0a6"
        value={newBarberPhone}
        onChangeText={setNewBarberPhone}
        style={styles.input}
      />
      <TextInput
        placeholder="WhatsApp"
        placeholderTextColor="#9aa0a6"
        value={newBarberWhatsApp}
        onChangeText={setNewBarberWhatsApp}
        style={styles.input}
      />
      <TextInput
        placeholder="Specialties"
        placeholderTextColor="#9aa0a6"
        value={newBarberSpecialties}
        onChangeText={setNewBarberSpecialties}
        style={styles.input}
      />
      <TextInput
        placeholder="Hourly rate"
        placeholderTextColor="#9aa0a6"
        value={newBarberHourlyRate}
        onChangeText={setNewBarberHourlyRate}
        style={styles.input}
      />
      <TextInput
        placeholder="Biography"
        placeholderTextColor="#9aa0a6"
        value={newBarberBio}
        onChangeText={setNewBarberBio}
        style={styles.input}
        multiline
      />
      <TextInput
        placeholder="Instagram"
        placeholderTextColor="#9aa0a6"
        value={newBarberInstagram}
        onChangeText={setNewBarberInstagram}
        style={styles.input}
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Facebook"
        placeholderTextColor="#9aa0a6"
        value={newBarberFacebook}
        onChangeText={setNewBarberFacebook}
        style={styles.input}
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Twitter"
        placeholderTextColor="#9aa0a6"
        value={newBarberTwitter}
        onChangeText={setNewBarberTwitter}
        style={styles.input}
        autoCapitalize="none"
      />
      <TextInput
        placeholder="TikTok"
        placeholderTextColor="#9aa0a6"
        value={newBarberTiktok}
        onChangeText={setNewBarberTiktok}
        style={styles.input}
        autoCapitalize="none"
      />
      <TextInput
        placeholder="YouTube"
        placeholderTextColor="#9aa0a6"
        value={newBarberYoutube}
        onChangeText={setNewBarberYoutube}
        style={styles.input}
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Zelle email"
        placeholderTextColor="#9aa0a6"
        value={newBarberZelleEmail}
        onChangeText={setNewBarberZelleEmail}
        style={styles.input}
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Zelle phone"
        placeholderTextColor="#9aa0a6"
        value={newBarberZellePhone}
        onChangeText={setNewBarberZellePhone}
        style={styles.input}
      />
      <TextInput
        placeholder="CashApp cashtag"
        placeholderTextColor="#9aa0a6"
        value={newBarberCashApp}
        onChangeText={setNewBarberCashApp}
        style={styles.input}
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Profile image URL"
        placeholderTextColor="#9aa0a6"
        value={newBarberImageUrl}
        onChangeText={setNewBarberImageUrl}
        style={styles.input}
        autoCapitalize="none"
      />
      <Pressable style={styles.imagePicker} onPress={pickBarberImage}>
        {barberImageUri ? (
          <SafeImage
            uri={barberImageUri}
            fallbackSource={require('../../assets/placeholder-barber.png')}
            style={styles.imagePreview}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.imagePickerText}>Select barber image</Text>
        )}
      </Pressable>
      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.primaryButton, isUploadingBarberImage && styles.primaryButtonDisabled]}
          onPress={createBarber}
          disabled={isUploadingBarberImage}
        >
          {isUploadingBarberImage ? (
            <ActivityIndicator color="#0a0a0a" />
          ) : (
            <Text style={styles.primaryButtonText}>Add Barber</Text>
          )}
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Add Service</Text>
      <TextInput
        placeholder="Service name"
        placeholderTextColor="#9aa0a6"
        value={newServiceName}
        onChangeText={setNewServiceName}
        style={styles.input}
      />
      <View style={styles.inlineRow}>
        <TextInput
          placeholder="Price"
          placeholderTextColor="#9aa0a6"
          value={newServicePrice}
          onChangeText={setNewServicePrice}
          style={[styles.input, styles.inputHalf]}
          keyboardType="numeric"
        />
        <TextInput
          placeholder="Duration (min)"
          placeholderTextColor="#9aa0a6"
          value={newServiceDuration}
          onChangeText={setNewServiceDuration}
          style={[styles.input, styles.inputHalf]}
          keyboardType="numeric"
        />
      </View>
      <Pressable style={styles.imagePicker} onPress={pickServiceImage}>
        {serviceImageUri ? (
          <SafeImage
            uri={serviceImageUri}
            fallbackSource={require('../../assets/placeholder-service.png')}
            style={styles.imagePreview}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.imagePickerText}>Select service image</Text>
        )}
      </Pressable>
      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.primaryButton, isUploadingImage && styles.primaryButtonDisabled]}
          onPress={createService}
          disabled={isUploadingImage}
        >
          {isUploadingImage ? (
            <ActivityIndicator color="#0a0a0a" />
          ) : (
            <Text style={styles.primaryButtonText}>Create Service</Text>
          )}
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Services</Text>
      {services.length === 0 ? (
        <Text style={styles.emptyText}>No services available yet.</Text>
      ) : (
        services.map((service) => (
          <View key={service.id} style={[styles.card, { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(225, 6, 0, 0.85)' }]}>
            <Text style={styles.itemTitle}>{service.name ?? 'Service'}</Text>
            <Text style={styles.itemMeta}>Price: ${service.price ?? 0}</Text>
            <Text style={styles.itemMeta}>Duration: {service.duration ?? 0} min</Text>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Barbers</Text>
      <TouchableOpacity onPress={handleTakeBreak}>
        <Text style={{ color: 'white' }}>Take a Break</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleUnlock}>
        <Text style={{ color: 'white' }}>Remove Break</Text>
      </TouchableOpacity>
      {barbers.length === 0 ? (
        <Text style={styles.emptyText}>No barbers available yet.</Text>
      ) : (
        barbers.map((barber) => (
          <View key={barber.id} style={[styles.card, { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(225, 6, 0, 0.85)' }]}>
            <Text style={styles.itemTitle}>{barber.name ?? 'Barber'}</Text>
            <Text style={styles.itemMeta}>Shop: {barber.shopName ?? 'JB Barbershop'}</Text>
            <Text style={styles.itemMeta}>
              Rating: {Number.isFinite(barber.rating) ? barber.rating?.toFixed(1) : '4.8'}
            </Text>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Appointments</Text>
      {appointments.length === 0 ? (
        <Text style={styles.emptyText}>No appointments yet.</Text>
      ) : (
        [...appointments]
          .sort((a, b) => {
            const left = getAppointmentDate(a.date)?.getTime() ?? 0;
            const right = getAppointmentDate(b.date)?.getTime() ?? 0;
            return left - right;
          })
          .map((item) => (
            <View key={item.id} style={{ marginBottom: 12 }}>
              <Text style={{ color: '#00d4ff', fontWeight: 'bold' }}>
                {getAppointmentDate(item.date)?.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                }) ?? 'Pending time'}
              </Text>

              <Text style={{ color: 'white' }}>💈 {item.barberName ?? 'Unknown'}</Text>

              <Text style={{ color: 'gray' }}>✂️ {item.serviceName ?? 'Unknown'}</Text>

              <Text
                style={{
                  color:
                    item.status === 'completed'
                      ? 'green'
                      : item.status === 'cancelled'
                      ? 'red'
                      : 'orange',
                }}
              >
                {item.status ?? 'pending'}
              </Text>
            </View>
          ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#000000',
    gap: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#00f0ff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  inputLabel: {
    color: '#9aa0a6',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  card: {
    backgroundColor: '#000',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
  },
  itemTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  itemMeta: {
    color: '#9aa0a6',
    fontSize: 12,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
backgroundColor: '#000',
  },
  buttonRow: {
    alignSelf: 'flex-start',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  inputHalf: {
    flex: 1,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
  },
  chipActive: {
    borderColor: 'rgba(225, 6, 0, 0.85)',
    backgroundColor: 'rgba(0,240,255,0.12)',
  },
  chipText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#00f0ff',
  },
  imagePicker: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.85)',
backgroundColor: '#000',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imagePickerText: {
    color: '#9aa0a6',
    fontSize: 12,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  primaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#00f0ff',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#0a0a0a',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyText: {
    color: '#9aa0a6',
    fontSize: 13,
  },
});
