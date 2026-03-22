type CreateIntentResponse = {
	clientSecret: string;
};

type CreateIntentParams = {
	serviceId: string;
	barberId: string;
};

const PAYMENTS_BASE_URL = 'https://jbsbookme.com/api';

export async function createPaymentIntent(params: CreateIntentParams): Promise<CreateIntentResponse> {
	const response = await fetch(`${PAYMENTS_BASE_URL}/payments/create-intent`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(params),
	});

	const data = await response.json();

	if (!response.ok) {
		throw new Error(data?.error || data?.message || 'Payment intent failed');
	}

	return data as CreateIntentResponse;
}
