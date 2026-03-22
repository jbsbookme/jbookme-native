export type ReviewsSummary = {
	average: number;
	count: number;
};

export type AccountingSummary = {
	appointmentsRevenue: number;
	appointmentsCompleted: number;
	walkins: number;
	tips: number;
	products: number;
	total: number;
};

export type SocialLinks = {
	instagram: string;
	facebook: string;
	tiktok: string;
	website: string;
};

export type PaymentAccounts = {
	zelle: string;
	cashapp: string;
};

export type WorkingHours = {
	start: string;
	end: string;
};

export type ClosedDay = {
	id: string;
	date: string;
};

export type BlockedSlot = {
	id: string;
	date: string;
	time: string;
};

export type ReviewItem = {
	id: string;
	clientName?: string;
	rating?: number;
	comment?: string;
	createdAt?: { seconds: number } | Date | string | null;
};
