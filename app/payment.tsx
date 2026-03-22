import React, { useEffect, useState } from 'react';
import { View, Button, Alert } from 'react-native';
import { CardField, useStripe } from '@stripe/stripe-react-native';

export default function PaymentScreen() {
  const { confirmSetupIntent } = useStripe();
  const [clientSecret, setClientSecret] = useState('');

  useEffect(() => {
    fetchClientSecret();
  }, []);

  const fetchClientSecret = async () => {
    try {
      const res = await fetch(
        'http://127.0.0.1:5001/bookme-65bd5/us-central1/createSetupIntent',
        {
          method: 'POST',
        }
      );

      const data = await res.json();
      setClientSecret(data.clientSecret);
    } catch (err) {
      console.log(err);
    }
  };

  const handleSaveCard = async () => {
    if (!clientSecret) return;

    const { error, setupIntent } = await confirmSetupIntent(clientSecret, {
      paymentMethodType: 'Card',
    });

    if (error) {
      Alert.alert('Error', error.message || 'Something went wrong');
    } else {
      Alert.alert('Success', 'Card saved!');
      console.log(setupIntent);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <CardField postalCodeEnabled={false} style={{ height: 50, marginVertical: 30 }} />

      <Button title="Save Card" onPress={handleSaveCard} />
    </View>
  );
}
