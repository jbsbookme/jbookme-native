"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAppointmentReminders = exports.sendAppointmentRemindersV2 = exports.notifyClientOnStatusChangeV3 = exports.notifyBarberSMSV3 = void 0;
const functions = __importStar(require("firebase-functions"));
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
const twilio_1 = __importDefault(require("twilio"));
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const accountSid = (_a = functions.config().twilio) === null || _a === void 0 ? void 0 : _a.account_sid;
const authToken = (_b = functions.config().twilio) === null || _b === void 0 ? void 0 : _b.auth_token;
const fromPhone = (_c = functions.config().twilio) === null || _c === void 0 ? void 0 : _c.phone_number;
const client = accountSid && authToken ? (0, twilio_1.default)(accountSid, authToken) : null;
function coerceDate(value) {
    if (!value)
        return null;
    if (value instanceof Date)
        return value;
    if (typeof value === "string") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === "object" && value && "toDate" in value) {
        const withToDate = value;
        return withToDate.toDate();
    }
    return null;
}
function formatDateLabel(value) {
    const parsed = coerceDate(value);
    if (!parsed)
        return "N/A";
    return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function formatTimeLabel(value) {
    const parsed = coerceDate(value);
    if (!parsed)
        return "N/A";
    return parsed.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
}
async function sendPushNotification(token, title, body, data) {
    await admin.messaging().send({
        token,
        notification: { title, body },
        data
    });
}
async function sendSms(to, message) {
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
    }
    catch (error) {
        console.error("TWILIO ERROR:", error);
    }
}
exports.notifyBarberSMSV3 = (0, firestore_1.onDocumentCreated)("appointments/{appointmentId}", async (event) => {
    var _a, _b, _c, _d, _e, _f, _g;
    console.log("APPOINTMENT TRIGGERED:", event.params.appointmentId);
    const appointment = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data()) !== null && _b !== void 0 ? _b : {};
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
    const barberPhone = barberData.phone;
    const barberPushToken = barberData.pushToken;
    console.log("BARBER PHONE:", barberPhone !== null && barberPhone !== void 0 ? barberPhone : null);
    const clientPhone = appointment.clientPhone;
    const serviceName = (_c = appointment.serviceName) !== null && _c !== void 0 ? _c : "N/A";
    const dateLabel = formatDateLabel((_d = appointment.date) !== null && _d !== void 0 ? _d : appointment.time);
    const timeLabel = formatTimeLabel((_e = appointment.time) !== null && _e !== void 0 ? _e : appointment.date);
    const pushData = {
        serviceName: String(serviceName),
        date: String(dateLabel),
        time: String(timeLabel),
        clientPhone: String(clientPhone !== null && clientPhone !== void 0 ? clientPhone : "")
    };
    if (barberPushToken) {
        try {
            await sendPushNotification(barberPushToken, "New Appointment", "You have a new booking at JB's Barbershop.", pushData);
        }
        catch (error) {
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
            String(clientPhone !== null && clientPhone !== void 0 ? clientPhone : "N/A")
        ].join("\n");
        await sendSms(barberPhone, barberMessage);
    }
    else {
        console.warn("Barber phone not found.");
    }
    if (!userId) {
        console.warn("Missing userId on appointment.");
    }
    else {
        const userDoc = await admin.firestore().collection("users").doc(userId).get();
        const userData = (_f = userDoc.data()) !== null && _f !== void 0 ? _f : {};
        const userPushToken = userData.pushToken;
        const userPhone = (_g = userData.phone) !== null && _g !== void 0 ? _g : clientPhone;
        const clientData = {
            serviceName: String(serviceName),
            date: String(dateLabel),
            time: String(timeLabel),
            location: "98 Union St Lynn MA"
        };
        if (userPushToken) {
            try {
                await sendPushNotification(userPushToken, "Appointment Confirmed", "Your appointment at JB's Barbershop is confirmed.", clientData);
            }
            catch (error) {
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
exports.notifyClientOnStatusChangeV3 = (0, firestore_1.onDocumentUpdated)("appointments/{appointmentId}", async (event) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const before = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data()) !== null && _b !== void 0 ? _b : {};
    const after = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.after.data()) !== null && _d !== void 0 ? _d : {};
    const previousStatus = before.status;
    const nextStatus = after.status;
    if (!nextStatus || previousStatus === nextStatus)
        return;
    if (nextStatus === "cancelled") {
        const barberId = after.barberId;
        if (!barberId)
            return;
        const barberQuery = await admin
            .firestore()
            .collection("barbers")
            .where("prismaBarberId", "==", barberId)
            .limit(1)
            .get();
        if (barberQuery.empty)
            return;
        const barberData = barberQuery.docs[0].data();
        const barberPhone = barberData.phone;
        if (!barberPhone)
            return;
        const timeLabel = formatTimeLabel((_e = after.time) !== null && _e !== void 0 ? _e : after.date);
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
    if (nextStatus !== "started" && nextStatus !== "completed")
        return;
    const userId = after.userId;
    if (!userId) {
        console.warn("Missing userId on appointment.");
        return;
    }
    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    const userData = (_f = userDoc.data()) !== null && _f !== void 0 ? _f : {};
    const userPushToken = userData.pushToken;
    const userPhone = (_g = userData.phone) !== null && _g !== void 0 ? _g : after.clientPhone;
    const serviceName = (_h = after.serviceName) !== null && _h !== void 0 ? _h : "N/A";
    const dateLabel = formatDateLabel((_j = after.date) !== null && _j !== void 0 ? _j : after.time);
    const timeLabel = formatTimeLabel((_k = after.time) !== null && _k !== void 0 ? _k : after.date);
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
        }
        catch (error) {
            console.error("PUSH ERROR:", error);
        }
        return;
    }
    const appointmentId = event.params.appointmentId;
    if (userPushToken) {
        try {
            await sendPushNotification(userPushToken, "JB's Barbershop", "Your appointment is complete. Please leave a review.", {
                screen: "review",
                appointmentId: String(appointmentId)
            });
        }
        catch (error) {
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
    }
    else {
        console.warn("Client phone not found for review request.");
    }
});
exports.sendAppointmentRemindersV2 = (0, scheduler_1.onSchedule)("every 1 minutes", async () => {
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
    if (appointmentsSnap.empty)
        return;
    await Promise.all(appointmentsSnap.docs.map(async (docSnap) => {
        var _a, _b, _c, _d;
        const appointment = (_a = docSnap.data()) !== null && _a !== void 0 ? _a : {};
        const serviceName = (_b = appointment.serviceName) !== null && _b !== void 0 ? _b : "N/A";
        const timeLabel = formatTimeLabel((_c = appointment.time) !== null && _c !== void 0 ? _c : appointment.date);
        const clientPhone = appointment.clientPhone;
        let resolvedPhone = clientPhone;
        if (!resolvedPhone && appointment.userId) {
            const userDoc = await admin
                .firestore()
                .collection("users")
                .doc(appointment.userId)
                .get();
            resolvedPhone = (_d = userDoc.data()) === null || _d === void 0 ? void 0 : _d.phone;
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
    }));
});
exports.sendAppointmentReminders = (0, scheduler_1.onSchedule)("every 1 minutes", async () => {
    console.log("sendAppointmentReminders is deprecated; use sendAppointmentRemindersV2.");
});
//# sourceMappingURL=notifyBarberSMS.js.map