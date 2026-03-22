import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, SafeAreaView, Text, View } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { fetchBarbers } from '../../src/services/barberService';
import { db } from '../../src/config/firebase';

type BarberRecord = {
  id: string;
  name?: string;
  role?: string;
};

export default function AdminBarbers() {
  const [barbers, setBarbers] = useState<BarberRecord[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    void loadBarbers();
  }, []);

  const loadBarbers = async () => {
    const data = await fetchBarbers();
    setBarbers(data as BarberRecord[]);
  };

  const updateRole = async (barberId: string, role: 'BARBER' | 'STYLIST') => {
    if (isUpdating) return;
    try {
      setIsUpdating(true);
      await updateDoc(doc(db, 'barbers', barberId), { role });
      await loadBarbers();
    } catch (error) {
      console.log('[AdminBarbers] updateRole error:', error);
      Alert.alert('Error', 'No se pudo actualizar el rol.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 20, backgroundColor: '#000' }}>
      <Text style={{ color: 'white', fontSize: 22, marginBottom: 20 }}>
        Barbers & Stylists
      </Text>

      <FlatList
        data={barbers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: '#111',
              padding: 12,
              marginBottom: 10,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: 'white', fontSize: 16 }}>{item.name}</Text>
            <Text style={{ color: '#aaa' }}>Role: {item.role || 'UNKNOWN'}</Text>

            <View style={{ flexDirection: 'row', marginTop: 10, gap: 10 }}>
              <Pressable
                onPress={() => updateRole(item.id, 'BARBER')}
                style={{ backgroundColor: '#00f0ff', padding: 8, borderRadius: 8 }}
                disabled={isUpdating}
              >
                <Text>Barber</Text>
              </Pressable>

              <Pressable
                onPress={() => updateRole(item.id, 'STYLIST')}
                style={{ backgroundColor: '#ff00aa', padding: 8, borderRadius: 8 }}
                disabled={isUpdating}
              >
                <Text>Stylist</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
