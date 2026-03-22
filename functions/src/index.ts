import * as functions from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import Stripe from "stripe";
import { v2 as cloudinary } from "cloudinary";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
	admin.initializeApp();
}

const stripeSecret =
	(functions.config().stripe?.secret_key as string | undefined) ??
	(functions.config().stripe?.secret as string | undefined);

const stripe = stripeSecret
	? new Stripe(stripeSecret, {
			apiVersion: "2023-10-16"
		})
	: null;

export const createSetupIntent = onRequest({ cors: true }, async (req, res) => {
	if (req.method !== "POST") {
		res.status(405).json({ error: "Method Not Allowed" });
		return;
	}

	if (!stripe) {
		res.status(500).json({ error: "Stripe is not configured." });
		return;
	}

	try {
		const body = (req.body ?? {}) as {
			customerId?: string;
			email?: string;
			name?: string;
		};

		let resolvedCustomerId = body.customerId?.trim();
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
	} catch (error: any) {
		console.error("\ud83d\udd25 STRIPE ERROR:", error);
		res.status(500).json({
			error: error?.message || "Failed to create setup intent."
		});
	}
});

export const listPaymentMethods = onRequest({ cors: true }, async (req, res) => {
	if (req.method !== "POST") {
		res.status(405).json({ error: "Method Not Allowed" });
		return;
	}

	if (!stripe) {
		res.status(500).json({ error: "Stripe is not configured." });
		return;
	}

	try {
		const body = (req.body ?? {}) as { customerId?: string };
		const customerId = body.customerId?.trim();

		if (!customerId) {
			res.status(400).json({ error: "customerId is required." });
			return;
		}

		const paymentMethods = await stripe.paymentMethods.list({
			customer: customerId,
			type: "card"
		});

		res.status(200).json({ paymentMethods: paymentMethods.data });
	} catch (error) {
		console.error("listPaymentMethods error:", error);
		res.status(500).json({ error: "Failed to list payment methods." });
	}
});

export {
  sendAppointmentRemindersV2,
  sendAppointmentReminders
} from "./notifyBarberSMS";

const cloudinaryConfig = {
	cloud_name: functions.config().cloudinary?.cloud_name as string | undefined,
	api_key: functions.config().cloudinary?.api_key as string | undefined,
	api_secret: functions.config().cloudinary?.api_secret as string | undefined
};

function extractCloudinaryPublicId(inputUrl: string) {
	try {
		const withoutQuery = inputUrl.split("?")[0] ?? inputUrl;
		const uploadIndex = withoutQuery.indexOf("/upload/");
		if (uploadIndex === -1) return null;
		const afterUpload = withoutQuery.slice(uploadIndex + "/upload/".length);
		const segments = afterUpload.split("/");
		if (segments.length === 0) return null;
		let startIndex = 0;
		if (/^v\d+$/.test(segments[0])) startIndex = 1;
		const publicIdWithExt = segments.slice(startIndex).join("/");
		if (!publicIdWithExt) return null;
		return publicIdWithExt.replace(/\.[^/.]+$/, "");
	} catch {
		return null;
	}
}

function resolveResourceType(value?: string, url?: string) {
	const normalized = value?.toLowerCase();
	if (normalized === "video" || normalized === "image" || normalized === "raw") {
		return normalized;
	}
	if (url?.includes("/video/upload/")) return "video";
	if (url?.includes("/image/upload/")) return "image";
	return "image";
}

export const deleteMediaFromCloudinary = onRequest({ cors: true }, async (req, res) => {
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

	cloudinary.config(cloudinaryConfig);

	try {
		const decodedToken = await admin.auth().verifyIdToken(token);

		const body = (req.body ?? {}) as {
			url?: string;
			publicId?: string;
			resourceType?: string;
			ownerId?: string;
		};

		if (body.ownerId && body.ownerId !== decodedToken.uid) {
			res.status(403).json({ error: "Forbidden" });
			return;
		}

		const url = body.url?.trim();
		const providedPublicId = body.publicId?.trim();
		const publicId = providedPublicId || (url ? extractCloudinaryPublicId(url) : null);

		if (!publicId) {
			res.status(400).json({ error: "publicId or url is required." });
			return;
		}

		const resourceType = resolveResourceType(body.resourceType, url);
		const result = await cloudinary.uploader.destroy(publicId, {
			resource_type: resourceType
		});

		if (result.result !== "ok" && result.result !== "not found") {
			res.status(500).json({ error: "Failed to delete Cloudinary asset.", result });
			return;
		}

		res.status(200).json({ success: true, result });
	} catch (error: any) {
		console.error("Cloudinary delete error:", error);
		res.status(500).json({ error: error?.message || "Cloudinary delete failed." });
	}
});
