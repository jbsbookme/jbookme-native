import * as functions from "firebase-functions";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import twilio from "twilio";

admin.initializeApp();

const accountSid = functions.config().twilio?.account_sid as string | undefined;
const authToken = functions.config().twilio?.auth_token as string | undefined;
const fromPhone = functions.config().twilio?.phone_number as string | undefined;

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

type AppointmentData = {
  barberId?: string;
  userId?: string;
  serviceName?: string;
  date?: unknown;
  time?: unknown;
  clientPhone?: string;
  status?: string;
  reminderSentAt?: unknown;
};

function coerceDate(value?: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && value && "toDate" in value) {
    const withToDate = value as { toDate: () => Date };
    return withToDate.toDate();
  }
  return null;
}

function formatDateLabel(value?: unknown): string {
  const parsed = coerceDate(value);
  if (!parsed) return "N/A";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTimeLabel(value?: unknown): string {
  const parsed = coerceDate(value);
  if (!parsed) return "N/A";
  return parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>
) {
  await admin.messaging().send({
    token,
    notification: { title, body },
    data
  });
}

async function sendSms(to: string, message: string) {
  if (!client || !fromPhone) {
    console.warn("Twilio credentials are missing. Skipping SMS.");
    return;
  }
  try {
    await client.messages.create({
      body: message,
      from: fromPhone,
      to
    });
    console.log("SMS SENT SUCCESSFULLY");
  } catch (error) {
    console.error("TWILIO ERROR:", error);
  }
}

export const notifyBarberSMSV2 = onDocumentCreated("appointments/{appointmentId}", async (event) => {
  console.log("APPOINTMENT TRIGGERED:", event.params.appointmentId);

  const appointment = (event.data?.data() as AppointmentData | undefined) ?? {};
  const barberId = appointment.barberId;
  const userId = appointment.userId;

  if (!barberId) {
    console.warn("Missing barberId on appointment.");
    return;
  }

  const barberQuery = await admin
    .firestore()
    .collection("barbers")
    .where("prismaBarberId", "==", barberId)
    .limit(1)
    .get();

  if (barberQuery.empty) {
    console.log("Barber not found for prismaBarberId:", barberId);
    console.warn("Barber phone not found.");
    return;
  }

  const barberData = barberQuery.docs[0].data();
  const barberPhone = barberData.phone as string | undefined;
  const barberPushToken = barberData.pushToken as string | undefined;

  console.log("BARBER PHONE:", barberPhone ?? null);

  const clientPhone = appointment.clientPhone as string | undefined;
  const serviceName = appointment.serviceName ?? "N/A";
  const dateLabel = formatDateLabel(appointment.date ?? appointment.time);
  const timeLabel = formatTimeLabel(appointment.time ?? appointment.date);

  const pushData = {
    serviceName: String(serviceName),
    date: String(dateLabel),
    time: String(timeLabel),
    clientPhone: String(clientPhone ?? "")
  };

  if (barberPushToken) {
    try {
      await sendPushNotification(
        barberPushToken,
        "New Appointment",
        "You have a new booking at JB's Barbershop.",
        pushData
      );
    } catch (error) {
      console.error("PUSH ERROR:", error);
    }
  }

  if (barberPhone) {
    const barberMessage = [
      "JB's Barbershop",
      "",
      "New appointment booked.",
      "",
      `Service: ${serviceName}`,
      `Time: ${timeLabel}`,
      "",
      "Client phone:",
      String(clientPhone ?? "N/A")
    ].join("\n");
    await sendSms(barberPhone, barberMessage);
  } else {
    console.warn("Barber phone not found.");
  }

  if (!userId) {
    console.warn("Missing userId on appointment.");
  } else {
    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    const userData = userDoc.data() ?? {};
    const userPushToken = userData.pushToken as string | undefined;
    const userPhone = (userData.phone as string | undefined) ?? clientPhone;

    const clientData = {
      serviceName: String(serviceName),
      date: String(dateLabel),
      time: String(timeLabel),
      location: "98 Union St Lynn MA"
    };

    if (userPushToken) {
      try {
        await sendPushNotification(
          userPushToken,
          "Appointment Confirmed",
          "Your appointment at JB's Barbershop is confirmed.",
          clientData
        );
      } catch (error) {
        console.error("PUSH ERROR:", error);
      }
    }

    if (userPhone) {
      const clientMessage = [
        "JB's Barbershop",
        "",
        "Your appointment is confirmed.",
        "",
        `Service: ${serviceName}`,
        `Date: ${dateLabel}`,
        `Time: ${timeLabel}`,
        "",
        "Location:",
        "98 Union St Lynn MA"
      ].join("\n");
      await sendSms(userPhone, clientMessage);
    }
  }
});

export const notifyClientOnStatusChangeV2 = onDocumentUpdated(
  "appointments/{appointmentId}",
  async (event) => {
    const before = (event.data?.before.data() as AppointmentData | undefined) ?? {};
    const after = (event.data?.after.data() as AppointmentData | undefined) ?? {};
    const previousStatus = before.status;
    const nextStatus = after.status;

    if (!nextStatus || previousStatus === nextStatus) return;

    if (nextStatus === "cancelled") {
      const barberId = after.barberId;
      if (!barberId) return;
      const barberQuery = await admin
        .firestore()
        .collection("barbers")
        .where("prismaBarberId", "==", barberId)
        .limit(1)
        .get();

      if (barberQuery.empty) return;
      const barberData = barberQuery.docs[0].data();
      const barberPhone = barberData.phone as string | undefined;
      if (!barberPhone) return;

      const timeLabel = formatTimeLabel(after.time ?? after.date);
      const cancelMessage = [
        "JB's Barbershop",
        "",
        "Appointment cancelled.",
        "",
        `Client cancelled the appointment scheduled at ${timeLabel}.`
      ].join("\n");
      await sendSms(barberPhone, cancelMessage);
      return;
    }

    if (nextStatus !== "started" && nextStatus !== "completed") return;

    const userId = after.userId;
    if (!userId) {
      console.warn("Missing userId on appointment.");
      return;
    }

    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    const userData = userDoc.data() ?? {};
    const userPushToken = userData.pushToken as string | undefined;
    const userPhone = (userData.phone as string | undefined) ?? (after.clientPhone as string | undefined);

    const serviceName = after.serviceName ?? "N/A";
    const dateLabel = formatDateLabel(after.date ?? after.time);
    const timeLabel = formatTimeLabel(after.time ?? after.date);

    if (nextStatus === "started") {
      if (!userPushToken) {
        console.warn("Client pushToken not found.");
        return;
      }
      try {
        await sendPushNotification(userPushToken, "Appointment Started", "Your barber has started your appointment.", {
          serviceName: String(serviceName),
          date: String(dateLabel),
          time: String(timeLabel),
          location: "98 Union St Lynn MA"
        });
      } catch (error) {
        console.error("PUSH ERROR:", error);
      }
      return;
    }

    const appointmentId = event.params.appointmentId as string;
    if (userPushToken) {
      try {
        await sendPushNotification(
          userPushToken,
          "JB's Barbershop",
          "Your appointment is complete. Please leave a review.",
          {
            screen: "review",
            appointmentId: String(appointmentId)
          }
        );
      } catch (error) {
        console.error("PUSH ERROR:", error);
      }
      return;
    }

    if (userPhone) {
      const reviewMessage = [
        "JB's Barbershop",
        "",
        "Thanks for your visit!",
        "",
        "Please leave a review:",
        `https://jbsbookme.com/review/${appointmentId}`
      ].join("\n");
      await sendSms(userPhone, reviewMessage);
    } else {
      console.warn("Client phone not found for review request.");
    }
  }
);

export const sendAppointmentRemindersV2 = onSchedule("every 1 minutes", async () => {
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  const appointmentsSnap = await admin
    .firestore()
    .collection("appointments")
    .where("status", "==", "confirmed")
    .where("time", ">=", admin.firestore.Timestamp.fromDate(now))
    .where("time", "<=", admin.firestore.Timestamp.fromDate(oneHourFromNow))
    .where("reminderSentAt", "==", null)
    .get();

  if (appointmentsSnap.empty) return;

  await Promise.all(
    appointmentsSnap.docs.map(async (docSnap) => {
      const appointment = (docSnap.data() as AppointmentData | undefined) ?? {};
      const serviceName = appointment.serviceName ?? "N/A";
      const timeLabel = formatTimeLabel(appointment.time ?? appointment.date);
      const clientPhone = appointment.clientPhone as string | undefined;

      let resolvedPhone = clientPhone;
      if (!resolvedPhone && appointment.userId) {
        const userDoc = await admin
          .firestore()
          .collection("users")
          .doc(appointment.userId)
          .get();
        resolvedPhone = userDoc.data()?.phone as string | undefined;
      }

      if (resolvedPhone) {
        const reminderMessage = [
          "Reminder from JB's Barbershop",
          "",
          "Your appointment starts in 1 hour.",
          "",
          `Service: ${serviceName}`,
          `Time: ${timeLabel}`
        ].join("\n");
        await sendSms(resolvedPhone, reminderMessage);
      }

      await docSnap.ref.update({
        reminderSentAt: admin.firestore.FieldValue.serverTimestamp()
      });
    })
  );
});
