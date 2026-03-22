import { memo } from 'react';
import { Text, View } from 'react-native';
import { styles } from './styles';
import type { AccountingSummary } from './types';

export const AccountingCard = memo(function AccountingCard({
	summary,
	formatMoney,
}: {
	summary: AccountingSummary;
	formatMoney: (value?: number) => string;
}) {
	return (
		<View style={styles.statsCard}>
			<Text style={styles.statsTitle}>Accounting</Text>
			<View style={styles.statsRow}>
				<Text style={styles.statsLabel}>Appointments</Text>
				<Text style={styles.statsValue}>{formatMoney(summary.appointmentsRevenue)}</Text>
			</View>
			<View style={styles.statsRow}>
				<Text style={styles.statsLabel}>Walk-ins</Text>
				<Text style={styles.statsValue}>{formatMoney(summary.walkins)}</Text>
			</View>
			<View style={styles.statsRow}>
				<Text style={styles.statsLabel}>Tips</Text>
				<Text style={styles.statsValue}>{formatMoney(summary.tips)}</Text>
			</View>
			<View style={styles.statsRow}>
				<Text style={styles.statsLabel}>Products</Text>
				<Text style={styles.statsValue}>{formatMoney(summary.products)}</Text>
			</View>
			<View style={styles.statsRow}>
				<Text style={styles.statsLabel}>Total</Text>
				<Text style={styles.statsValue}>{formatMoney(summary.total)}</Text>
			</View>
		</View>
	);
});
