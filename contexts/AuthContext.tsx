import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
	createUserWithEmailAndPassword,
	onAuthStateChanged,
	signInWithEmailAndPassword,
	signOut,
	type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../src/config/firebase';
import { useRoleStore } from '../src/store/roleStore';
import {
	registerForPushNotifications,
	registerPushOnLogin,
} from '../src/services/notificationService';

type AuthContextValue = {
	user: User | null;
	loading: boolean;
	login: (email: string, password: string) => Promise<void>;
	register: (
		firstName: string,
		lastName: string,
		email: string,
		phone: string,
		password: string
	) => Promise<void>;
	logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	const { role, userId, setRole, clearRole } = useRoleStore();

	useEffect(() => {
		let active = true;
		const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
			setUser(nextUser);
			if (!nextUser) {
				clearRole();
				setLoading(false);
				return;
			}
			if (role && userId === nextUser.uid) {
				void registerForPushNotifications(nextUser.uid);
				setLoading(false);
				return;
			}

			setLoading(true);
			const loadRole = async () => {
				try {
					const snapshot = await getDoc(doc(db, 'users', nextUser.uid));
					const data = snapshot.data() as { role?: string } | undefined;
					if (active) {
						setRole(data?.role ?? null, nextUser.uid);
						await registerForPushNotifications(nextUser.uid);
					}
				} catch {
					if (active) {
						setRole(null, nextUser.uid);
					}
				} finally {
					if (active) {
						setLoading(false);
					}
				}
			};

			void loadRole();
		});

		return () => {
			active = false;
			unsubscribe();
		};
	}, [clearRole, role, setRole, userId]);

	const value = useMemo<AuthContextValue>(
		() => ({
			user,
			loading,
			login: async (email: string, password: string) => {
				await signInWithEmailAndPassword(auth, email, password);
				await registerPushOnLogin();
			},
			register: async (
				firstName: string,
				lastName: string,
				email: string,
				phone: string,
				password: string
			) => {
				const credential = await createUserWithEmailAndPassword(auth, email, password);
				await setDoc(doc(db, 'users', credential.user.uid), {
					firstName,
					lastName,
					email,
					phone,
					role: 'client',
					createdAt: serverTimestamp(),
				});
				setRole('client', credential.user.uid);
				await registerPushOnLogin();
			},
			logout: async () => {
				await signOut(auth);
				clearRole();
			},
		}),
		[clearRole, loading, setRole, user]
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error('useAuth must be used within AuthProvider');
	}
	return context;
}
