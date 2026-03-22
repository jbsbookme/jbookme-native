import { memo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { styles } from './styles';

export const RevenueCard = memo(function RevenueCard({
	loading,
	revenue,
	count,
	formatMoney,
}: {
	loading: boolean;
	revenue: number;
	count: number;
	formatMoney: (value?: number) => string;
}) {
	return (
		<View style={styles.revenueCard}>
			<Text style={styles.revenueLabel}>Today Revenue</Text>
			{loading ? (
				<View style={styles.revenueLoading}>
					<ActivityIndicator color="#00f0ff" size="small" />
					<Text style={styles.revenueCount}>Loading...</Text>
				</View>
			) : (
				<>
					<Text style={styles.revenueValue}>{formatMoney(revenue)}</Text>
					<Text style={styles.revenueCount}>{count} completed</Text>
				</>
			)}
		</View>
	);
});
