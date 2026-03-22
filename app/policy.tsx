import { SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';

export default function Policy() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.subtitle}>JBookMe Platform</Text>
        <Text style={styles.muted}>Last updated: 2026</Text>

        <Text style={styles.text}>
          JBookMe ("we", "our", or "the Platform") respects your privacy and is
          fully committed to protecting personal data. This Privacy Policy explains
          how we collect, use, store, and protect information when you use our mobile
          application, website, and services.
        </Text>
        <Text style={styles.text}>
          By using JBookMe, you agree to the practices described in this policy.
        </Text>

        <Text style={styles.sectionTitle}>1. Information We Collect</Text>
        <Text style={styles.text}>
          We collect only the minimum information required to operate the service.
        </Text>
        <Text style={styles.sectionSubtitle}>a) Personal Information</Text>
        <Text style={styles.bullet}>- Full name</Text>
        <Text style={styles.bullet}>- Phone number (for SMS notifications and confirmations)</Text>
        <Text style={styles.bullet}>- Email address</Text>
        <Text style={styles.bullet}>- Appointment details (date, time, service, barber/stylist)</Text>
        <Text style={styles.bullet}>- Role (client, barber/stylist, administrator)</Text>

        <Text style={styles.sectionSubtitle}>b) Technical Information</Text>
        <Text style={styles.bullet}>- Device type</Text>
        <Text style={styles.bullet}>- Browser type</Text>
        <Text style={styles.bullet}>- IP address (used only for security and fraud prevention)</Text>
        <Text style={styles.bullet}>- Notification permission status</Text>
        <Text style={styles.bullet}>- Push notification token (for app notifications)</Text>

        <Text style={styles.sectionSubtitle}>We do NOT collect:</Text>
        <Text style={styles.bullet}>- Government IDs</Text>
        <Text style={styles.bullet}>- Financial or credit card data</Text>
        <Text style={styles.bullet}>- Health or medical information</Text>
        <Text style={styles.bullet}>- Personal messages unrelated to appointments</Text>

        <Text style={styles.sectionTitle}>2. How We Use Information</Text>
        <Text style={styles.text}>Your data is used only for the following purposes:</Text>
        <Text style={styles.bullet}>- Appointment scheduling and management</Text>
        <Text style={styles.bullet}>- SMS notifications (confirmations, reminders, cancellations)</Text>
        <Text style={styles.bullet}>- Push notifications (app alerts and updates)</Text>
        <Text style={styles.bullet}>- Operational communication between clients, barbers, and admins</Text>
        <Text style={styles.bullet}>- Security, auditing, and fraud prevention</Text>
        <Text style={styles.bullet}>- Legal compliance (SMS regulations, consent logging)</Text>
        <Text style={styles.text}>No marketing spam. Ever.</Text>

        <Text style={styles.sectionTitle}>3. SMS & Messaging Policy</Text>
        <Text style={styles.text}>
          By providing your phone number, you explicitly consent to receive transactional
          SMS related to your appointments.
        </Text>
        <Text style={styles.sectionSubtitle}>SMS Rules:</Text>
        <Text style={styles.bullet}>- Messages are appointment-related only</Text>
        <Text style={styles.bullet}>- Max reminders: 1 confirmation, 1 reminder at 24h, 1 reminder at 2h</Text>
        <Text style={styles.bullet}>- You may reply YES to confirm or NO to cancel</Text>
        <Text style={styles.bullet}>- Reply STOP at any time to opt out</Text>
        <Text style={styles.text}>
          We do NOT sell, rent, or share phone numbers. All SMS is delivered via Twilio,
          compliant with A2P 10DLC regulations.
        </Text>

        <Text style={styles.sectionTitle}>4. Third-Party Services</Text>
        <Text style={styles.text}>We use trusted infrastructure providers:</Text>
        <Text style={styles.bullet}>- Firebase (Google) - authentication, database, notifications</Text>
        <Text style={styles.bullet}>- Twilio - SMS delivery</Text>
        <Text style={styles.bullet}>- Vercel - hosting and backend execution</Text>
        <Text style={styles.text}>
          These providers process data securely according to their own privacy policies.
        </Text>

        <Text style={styles.sectionTitle}>5. Data Sharing</Text>
        <Text style={styles.text}>
          We share data only when strictly necessary to operate the service. We never
          sell or share personal data with advertisers.
        </Text>

        <Text style={styles.sectionTitle}>6. Data Retention</Text>
        <Text style={styles.bullet}>- Appointment records are stored for operational history</Text>
        <Text style={styles.bullet}>- SMS logs are retained only as required for compliance</Text>
        <Text style={styles.bullet}>- Inactive data may be anonymized or deleted</Text>
        <Text style={styles.text}>
          You may request deletion of your data at any time.
        </Text>

        <Text style={styles.sectionTitle}>7. Security</Text>
        <Text style={styles.text}>We use industry-standard security measures:</Text>
        <Text style={styles.bullet}>- Encrypted connections (HTTPS)</Text>
        <Text style={styles.bullet}>- Role-based access control</Text>
        <Text style={styles.bullet}>- Secure backend processing</Text>
        <Text style={styles.bullet}>- Protected environment variables</Text>
        <Text style={styles.text}>
          Only authorized personnel can access sensitive data.
        </Text>

        <Text style={styles.sectionTitle}>8. User Rights</Text>
        <Text style={styles.bullet}>- Access your personal data</Text>
        <Text style={styles.bullet}>- Correct inaccurate information</Text>
        <Text style={styles.bullet}>- Request deletion of your data</Text>
        <Text style={styles.bullet}>- Opt out of SMS notifications</Text>
        <Text style={styles.bullet}>- Disable push notifications from your device</Text>

        <Text style={styles.sectionTitle}>9. Children's Privacy</Text>
        <Text style={styles.text}>
          JBookMe is not intended for users under 18. We do not knowingly collect data
          from minors.
        </Text>

        <Text style={styles.sectionTitle}>10. Multi-Barbershop & White-Label Use</Text>
        <Text style={styles.bullet}>- Each business accesses only its own data</Text>
        <Text style={styles.bullet}>- Data isolation is enforced</Text>
        <Text style={styles.bullet}>- Admin access is restricted by role</Text>

        <Text style={styles.sectionTitle}>11. Changes to This Policy</Text>
        <Text style={styles.text}>
          We may update this policy as needed. Updates will always be posted in the app.
        </Text>

        <Text style={styles.sectionTitle}>12. Contact</Text>
        <Text style={styles.bullet}>- Email: support@jbsbookme.com</Text>
        <Text style={styles.bullet}>- Website: https://www.jbsbookme.com</Text>
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
    padding: 20,
    gap: 10,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  muted: {
    color: '#ffffff',
    fontSize: 13,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
  },
  sectionSubtitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },
  text: {
    color: '#ffffff',
    fontSize: 14,
  },
  bullet: {
    color: '#ffffff',
    fontSize: 14,
    marginLeft: 6,
  },
});
