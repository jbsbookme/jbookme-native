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
var _a, _b, _c, _d, _e, _f;
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMediaFromCloudinary = exports.sendAppointmentReminders = exports.sendAppointmentRemindersV2 = exports.listPaymentMethods = exports.createSetupIntent = void 0;
const functions = __importStar(require("firebase-functions"));
const https_1 = require("firebase-functions/v2/https");
const stripe_1 = __importDefault(require("stripe"));
const cloudinary_1 = require("cloudinary");
const admin = __importStar(require("firebase-admin"));
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const stripeSecret = (_b = (_a = functions.config().stripe) === null || _a === void 0 ? void 0 : _a.secret_key) !== null && _b !== void 0 ? _b : (_c = functions.config().stripe) === null || _c === void 0 ? void 0 : _c.secret;
const stripe = stripeSecret
    ? new stripe_1.default(stripeSecret, {
        apiVersion: "2023-10-16"
    })
    : null;
exports.createSetupIntent = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    var _a, _b;
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }
    if (!stripe) {
        res.status(500).json({ error: "Stripe is not configured." });
        return;
    }
    try {
        const body = ((_a = req.body) !== null && _a !== void 0 ? _a : {});
        let resolvedCustomerId = (_b = body.customerId) === null || _b === void 0 ? void 0 : _b.trim();
        if (!resolvedCustomerId) {
            const customer = await stripe.customers.create({
                email: body.email,
                name: body.name
            });
            resolvedCustomerId = customer.id;
        }
        const setupIntent = await stripe.setupIntents.create({
            customer: resolvedCustomerId,
            payment_method_types: ["card"]
        });
        res.status(200).json({
            clientSecret: setupIntent.client_secret,
            customerId: resolvedCustomerId
        });
    }
    catch (error) {
        console.error("\ud83d\udd25 STRIPE ERROR:", error);
        res.status(500).json({
            error: (error === null || error === void 0 ? void 0 : error.message) || "Failed to create setup intent."
        });
    }
});
exports.listPaymentMethods = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    var _a, _b;
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }
    if (!stripe) {
        res.status(500).json({ error: "Stripe is not configured." });
        return;
    }
    try {
        const body = ((_a = req.body) !== null && _a !== void 0 ? _a : {});
        const customerId = (_b = body.customerId) === null || _b === void 0 ? void 0 : _b.trim();
        if (!customerId) {
            res.status(400).json({ error: "customerId is required." });
            return;
        }
        const paymentMethods = await stripe.paymentMethods.list({
            customer: customerId,
            type: "card"
        });
        res.status(200).json({ paymentMethods: paymentMethods.data });
    }
    catch (error) {
        console.error("listPaymentMethods error:", error);
        res.status(500).json({ error: "Failed to list payment methods." });
    }
});
var notifyBarberSMS_1 = require("./notifyBarberSMS");
Object.defineProperty(exports, "sendAppointmentRemindersV2", { enumerable: true, get: function () { return notifyBarberSMS_1.sendAppointmentRemindersV2; } });
Object.defineProperty(exports, "sendAppointmentReminders", { enumerable: true, get: function () { return notifyBarberSMS_1.sendAppointmentReminders; } });
const cloudinaryConfig = {
    cloud_name: (_d = functions.config().cloudinary) === null || _d === void 0 ? void 0 : _d.cloud_name,
    api_key: (_e = functions.config().cloudinary) === null || _e === void 0 ? void 0 : _e.api_key,
    api_secret: (_f = functions.config().cloudinary) === null || _f === void 0 ? void 0 : _f.api_secret
};
function extractCloudinaryPublicId(inputUrl) {
    var _a;
    try {
        const withoutQuery = (_a = inputUrl.split("?")[0]) !== null && _a !== void 0 ? _a : inputUrl;
        const uploadIndex = withoutQuery.indexOf("/upload/");
        if (uploadIndex === -1)
            return null;
        const afterUpload = withoutQuery.slice(uploadIndex + "/upload/".length);
        const segments = afterUpload.split("/");
        if (segments.length === 0)
            return null;
        let startIndex = 0;
        if (/^v\d+$/.test(segments[0]))
            startIndex = 1;
        const publicIdWithExt = segments.slice(startIndex).join("/");
        if (!publicIdWithExt)
            return null;
        return publicIdWithExt.replace(/\.[^/.]+$/, "");
    }
    catch {
        return null;
    }
}
function resolveResourceType(value, url) {
    const normalized = value === null || value === void 0 ? void 0 : value.toLowerCase();
    if (normalized === "video" || normalized === "image" || normalized === "raw") {
        return normalized;
    }
    if (url === null || url === void 0 ? void 0 : url.includes("/video/upload/"))
        return "video";
    if (url === null || url === void 0 ? void 0 : url.includes("/image/upload/"))
        return "image";
    return "image";
}
exports.deleteMediaFromCloudinary = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    var _a, _b, _c;
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    if (!cloudinaryConfig.cloud_name || !cloudinaryConfig.api_key || !cloudinaryConfig.api_secret) {
        res.status(500).json({ error: "Cloudinary is not configured." });
        return;
    }
    cloudinary_1.v2.config(cloudinaryConfig);
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        const body = ((_a = req.body) !== null && _a !== void 0 ? _a : {});
        if (body.ownerId && body.ownerId !== decodedToken.uid) {
            res.status(403).json({ error: "Forbidden" });
            return;
        }
        const url = (_b = body.url) === null || _b === void 0 ? void 0 : _b.trim();
        const providedPublicId = (_c = body.publicId) === null || _c === void 0 ? void 0 : _c.trim();
        const publicId = providedPublicId || (url ? extractCloudinaryPublicId(url) : null);
        if (!publicId) {
            res.status(400).json({ error: "publicId or url is required." });
            return;
        }
        const resourceType = resolveResourceType(body.resourceType, url);
        const result = await cloudinary_1.v2.uploader.destroy(publicId, {
            resource_type: resourceType
        });
        if (result.result !== "ok" && result.result !== "not found") {
            res.status(500).json({ error: "Failed to delete Cloudinary asset.", result });
            return;
        }
        res.status(200).json({ success: true, result });
    }
    catch (error) {
        console.error("Cloudinary delete error:", error);
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "Cloudinary delete failed." });
    }
});
//# sourceMappingURL=index.js.map