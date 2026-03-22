import { SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';

export default function Terms() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Terms & Conditions</Text>
        <Text style={styles.subtitle}>JBookMe Platform</Text>
        <Text style={styles.muted}>Last updated: 2026</Text>

        <Text style={styles.text}>
          Welcome to JBookMe ("Platform", "Service", "we", "our"). By accessing or
          using JBookMe, including our mobile application and website, you agree to these
          Terms & Conditions. If you do not agree, you must not use the service.
        </Text>

        <Text style={styles.sectionTitle}>1. Description of the Service</Text>
        <Text style={styles.text}>
          JBookMe is a digital appointment management platform for barbershops, stylists,
          and clients. The platform provides:
        </Text>
        <Text style={styles.bullet}>- Appointment booking</Text>
        <Text style={styles.bullet}>- SMS confirmations and reminders</Text>
        <Text style={styles.bullet}>- Push and in-app notifications</Text>
        <Text style={styles.bullet}>- Barber, stylist, and admin management</Text>
        <Text style={styles.bullet}>- Operational reporting</Text>
        <Text style={styles.text}>
          JBookMe does NOT provide barbering, styling, medical, or healthcare services.
        </Text>

        <Text style={styles.sectionTitle}>2. User Roles</Text>
        <Text style={styles.sectionSubtitle}>a) Clients</Text>
        <Text style={styles.bullet}>- Can book, confirm, reschedule, or cancel appointments</Text>
        <Text style={styles.bullet}>- Are responsible for attending appointments on time</Text>

        <Text style={styles.sectionSubtitle}>b) Barbers / Stylists</Text>
        <Text style={styles.bullet}>- Manage availability and appointments</Text>
        <Text style={styles.bullet}>- Are fully responsible for the services they provide</Text>

        <Text style={styles.sectionSubtitle}>c) Administrators</Text>
        <Text style={styles.bullet}>- Manage barbers, services, and schedules</Text>
        <Text style={styles.bullet}>- Oversee operational data</Text>

        <Text style={styles.text}>
          All users are responsible for maintaining accurate and up-to-date contact
          information.
        </Text>

        <Text style={styles.sectionTitle}>3. Appointments & Confirmations</Text>
        <Text style={styles.bullet}>- Appointments may require SMS or in-app confirmation</Text>
        <Text style={styles.bullet}>- A booking is considered confirmed when:</Text>
        <Text style={styles.bullet}>  - The client replies YES, or</Text>
        <Text style={styles.bullet}>  - The barber/admin confirms manually</Text>
        <Text style={styles.bullet}>- Clients may cancel by replying NO or through the app</Text>
        <Text style={styles.text}>
          JBookMe is not responsible for missed appointments due to user error.
        </Text>

        <Text style={styles.sectionTitle}>4. Deposits & Payments</Text>
        <Text style={styles.bullet}>- Appointments may require a deposit (e.g., $5)</Text>
        <Text style={styles.bullet}>- Remaining balance is paid in person unless otherwise specified</Text>
        <Text style={styles.bullet}>
          - Payment methods (Zelle, CashApp, cash) are managed by individual barbers
        </Text>
        <Text style={styles.text}>
          JBookMe does not store or process financial data unless explicitly integrated
          with a payment provider.
        </Text>

        <Text style={styles.sectionTitle}>5. SMS & Notifications</Text>
        <Text style={styles.text}>
          By using the service, you consent to receive transactional communications:
        </Text>
        <Text style={styles.bullet}>- Appointment confirmations</Text>
        <Text style={styles.bullet}>- Reminders (24h / 2h)</Text>
        <Text style={styles.bullet}>- Updates or cancellations</Text>
        <Text style={styles.text}>
          You may opt out of SMS by replying STOP. Push notifications can be disabled in
          your device settings.
        </Text>
        <Text style={styles.text}>JBookMe is not responsible for:</Text>
        <Text style={styles.bullet}>- Carrier delays</Text>
        <Text style={styles.bullet}>- Message delivery failures</Text>
        <Text style={styles.bullet}>- Incorrect contact information provided by users</Text>

        <Text style={styles.sectionTitle}>6. Third-Party Services</Text>
        <Text style={styles.text}>JBookMe uses third-party providers to operate:</Text>
        <Text style={styles.bullet}>- Firebase (Google) - authentication, database, notifications</Text>
        <Text style={styles.bullet}>- Twilio - SMS delivery</Text>
        <Text style={styles.bullet}>- Vercel - hosting and backend</Text>
        <Text style={styles.text}>
          These services operate under their own terms and policies.
        </Text>

        <Text style={styles.sectionTitle}>7. No Guarantees</Text>
        <Text style={styles.text}>JBookMe does NOT guarantee:</Text>
        <Text style={styles.bullet}>- Barber availability</Text>
        <Text style={styles.bullet}>- Appointment attendance</Text>
        <Text style={styles.bullet}>- Revenue, income, or business growth</Text>
        <Text style={styles.bullet}>- Customer retention</Text>
        <Text style={styles.text}>The platform is a tool, not a guarantee of business success.</Text>

        <Text style={styles.sectionTitle}>8. Multi-Barbershop & White-Label Use</Text>
        <Text style={styles.bullet}>- Each business manages its own data</Text>
        <Text style={styles.bullet}>- Data is isolated between businesses</Text>
        <Text style={styles.bullet}>- JBookMe acts solely as a technology provider</Text>
        <Text style={styles.text}>
          JBookMe is NOT an employer, partner, or agent of any barbershop.
        </Text>

        <Text style={styles.sectionTitle}>9. User Responsibilities</Text>
        <Text style={styles.text}>You agree NOT to:</Text>
        <Text style={styles.bullet}>- Use the platform for illegal activities</Text>
        <Text style={styles.bullet}>- Send spam or abusive content</Text>
        <Text style={styles.bullet}>- Access data that does not belong to you</Text>
        <Text style={styles.bullet}>- Attempt to reverse-engineer the platform</Text>
        <Text style={styles.bullet}>- Interfere with system performance or security</Text>
        <Text style={styles.text}>
          Violations may result in account suspension or termination.
        </Text>

        <Text style={styles.sectionTitle}>10. Account Suspension & Termination</Text>
        <Text style={styles.text}>We may suspend or terminate accounts if:</Text>
        <Text style={styles.bullet}>- Terms are violated</Text>
        <Text style={styles.bullet}>- Fraud or abuse is detected</Text>
        <Text style={styles.bullet}>- Legal compliance requires it</Text>
        <Text style={styles.text}>Data may be retained as required by law.</Text>

        <Text style={styles.sectionTitle}>11. Limitation of Liability</Text>
        <Text style={styles.text}>
          To the maximum extent permitted by law, JBookMe is not liable for:
        </Text>
        <Text style={styles.bullet}>- Lost income or business</Text>
        <Text style={styles.bullet}>- Missed appointments</Text>
        <Text style={styles.bullet}>- Disputes between users</Text>
        <Text style={styles.bullet}>- Third-party failures (SMS, hosting, providers)</Text>
        <Text style={styles.bullet}>- Data loss outside our control</Text>
        <Text style={styles.text}>Use of the platform is at your own risk.</Text>

        <Text style={styles.sectionTitle}>12. Indemnification</Text>
        <Text style={styles.text}>
          You agree to indemnify and hold JBookMe harmless from claims arising from:
        </Text>
        <Text style={styles.bullet}>- Your use of the service</Text>
        <Text style={styles.bullet}>- Services you provide</Text>
        <Text style={styles.bullet}>- Violations of laws or regulations</Text>
        <Text style={styles.bullet}>- Disputes between users</Text>

        <Text style={styles.sectionTitle}>13. Intellectual Property</Text>
        <Text style={styles.text}>
          All software, branding, logos, and content are the property of JBookMe. You may
          not copy, resell, or distribute the platform without written permission.
        </Text>

        <Text style={styles.sectionTitle}>14. Governing Law</Text>
        <Text style={styles.text}>
          These Terms are governed by the laws of the United States and applicable state
          laws.
        </Text>

        <Text style={styles.sectionTitle}>15. Changes to Terms</Text>
        <Text style={styles.text}>
          We may update these Terms at any time. Continued use of the platform constitutes
          acceptance of the updated Terms.
        </Text>

        <Text style={styles.sectionTitle}>16. Contact</Text>
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
