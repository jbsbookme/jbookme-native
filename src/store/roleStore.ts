import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RoleState = {
	role: string | null;
	userId: string | null;
	setRole: (role: string | null, userId: string | null) => void;
	clearRole: () => void;
};

export const useRoleStore = create<RoleState>()(
	persist(
		(set) => ({
			role: null,
			userId: null,
			setRole: (role, userId) => set({ role, userId }),
			clearRole: () => set({ role: null, userId: null }),
		}),
		{
			name: 'jbookme.role',
			storage: createJSONStorage(() => AsyncStorage),
		}
	)
);
