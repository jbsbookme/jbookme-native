import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_BASE_URL = 'https://api.jbookme.com';
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_BASE_URL;

const TOKEN_KEY = 'auth_token';

export async function getToken(): Promise<string | null> {
	try {
		return await AsyncStorage.getItem(TOKEN_KEY);
	} catch (error) {
		console.log('[apiClient] getToken error:', error);
		return null;
	}
}

export async function setToken(token: string): Promise<void> {
	try {
		await AsyncStorage.setItem(TOKEN_KEY, token);
	} catch (error) {
		console.log('[apiClient] setToken error:', error);
	}
}

export async function removeToken(): Promise<void> {
	try {
		await AsyncStorage.removeItem(TOKEN_KEY);
	} catch (error) {
		console.log('[apiClient] removeToken error:', error);
	}
}

type RequestOptions = RequestInit & {
	auth?: boolean;
};

export async function apiClient(endpoint: string, options: RequestOptions = {}) {
	const { auth = false, headers, ...rest } = options;

	const finalHeaders: Record<string, string> = {
		'Content-Type': 'application/json',
		...(headers as Record<string, string>),
	};

	if (auth) {
		const token = await getToken();
		if (token) {
			finalHeaders.Authorization = `Bearer ${token}`;
		}
	}

	const response = await fetch(`${BASE_URL}${endpoint}`, {
		...rest,
		headers: finalHeaders,
	});

	const contentType = response.headers.get('content-type') || '';
	const isJson = contentType.includes('application/json');
	const data = isJson ? await response.json() : await response.text();

	if (!response.ok) {
		throw new Error(
			typeof data === 'string'
				? data
				: data?.error || data?.message || 'API request failed'
		);
	}

	return data;
}

export default apiClient;
