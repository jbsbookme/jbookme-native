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
exports.notifyBarberSMS = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const twilio_1 = __importDefault(require("twilio"));
admin.initializeApp();
const accountSid = (_a = functions.config().twilio) === null || _a === void 0 ? void 0 : _a.account_sid;
const authToken = (_b = functions.config().twilio) === null || _b === void 0 ? void 0 : _b.auth_token;
const fromPhone = (_c = functions.config().twilio) === null || _c === void 0 ? void 0 : _c.phone_number;
const client = accountSid && authToken ? (0, twilio_1.default)(accountSid, authToken) : null;
exports.notifyBarberSMS = functions.firestore
    .document("appointments/{appointmentId}")
    .onCreate(async (snap, context) => {
    var _a, _b, _c, _d;
    console.log("APPOINTMENT TRIGGERED:", context.params.appointmentId);
    if (!client || !fromPhone) {
        console.warn("Twilio credentials are missing. Skipping SMS.");
        return;
    }
    const appointment = snap.data() || {};
    const barberId = appointment.barberId;
    if (!barberId) {
        console.warn("Missing barberId on appointment.");
        return;
    }
    const barberDoc = await admin.firestore().collection("barbers").doc(barberId).get();
    const barber = barberDoc.data();
    console.log("BARBER PHONE:", (_a = barber === null || barber === void 0 ? void 0 : barber.phone) !== null && _a !== void 0 ? _a : null);
    if (!(barber === null || barber === void 0 ? void 0 : barber.phone)) {
        console.warn("Barber phone not found.");
        return;
    }
    const message = [
        "New booking at JB's Barbershop.",
        `Service: ${(_b = appointment.serviceName) !== null && _b !== void 0 ? _b : "N/A"}`,
        `Date: ${(_c = appointment.date) !== null && _c !== void 0 ? _c : "N/A"}`,
        `Time: ${(_d = appointment.time) !== null && _d !== void 0 ? _d : "N/A"}`
    ].join("\n");
    try {
        await client.messages.create({
            body: message,
            from: fromPhone,
            to: barber.phone
        });
        console.log("SMS SENT SUCCESSFULLY");
    }
    catch (error) {
        console.error("TWILIO ERROR:", error);
    }
});
//# sourceMappingURL=notifyBarberSMS.js.map