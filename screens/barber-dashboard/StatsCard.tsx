import { memo } from 'react';
import { Text, View } from 'react-native';
import { styles } from './styles';
import type { ReviewsSummary } from './types';

export const StatsCard = memo(function StatsCard({
	reviewsSummary,
	totalClients,
	totalServices,
	weeklyRevenue,
	formatMoney,
}: {
	reviewsSummary: ReviewsSummary;
	totalClients: number;
	totalServices: number;
	weeklyRevenue: number;
	formatMoney: (value?: number) => string;
}) {
	return (
		<View style={styles.statsCard}>
			<Text style={styles.statsTitle}>Barber Stats</Text>
			<View style={styles.statsRow}>
				<Text style={styles.statsLabel}>⭐ Rating</Text>
				<Text style={styles.statsValue}>{reviewsSummary.average.toFixed(1)}</Text>
			</View>
			<View style={styles.statsRow}>
				<Text style={styles.statsLabel}>Total Clients</Text>
				<Text style={styles.statsValue}>{totalClients}</Text>
			</View>
			<View style={styles.statsRow}>
				<Text style={styles.statsLabel}>Total Services</Text>
				<Text style={styles.statsValue}>{totalServices}</Text>
			</View>
			<View style={styles.statsRow}>
				<Text style={styles.statsLabel}>Weekly Revenue</Text>
				<Text style={styles.statsValue}>{formatMoney(weeklyRevenue)}</Text>
			</View>
		</View>
	);
});
