import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { styles } from './styles';

export const HeaderSection = memo(function HeaderSection({
	selectedDateKey,
	showCalendar,
	onBack,
	onToggleCalendar,
	onGoHistory,
	onGoAccounting,
}: {
	selectedDateKey: string;
	showCalendar: boolean;
	onBack: () => void;
	onToggleCalendar: () => void;
	onGoHistory: () => void;
	onGoAccounting: () => void;
}) {
	return (
		<View style={styles.header}>
			<Pressable style={styles.backButton} onPress={onBack}>
				<Text style={styles.backButtonText}>Back</Text>
			</Pressable>
			<Text style={styles.title}>Barber Dashboard</Text>
			<Text style={styles.subtitle}>Overview for today</Text>
			<View style={styles.dateRow}>
				<Text style={styles.dateLabel}>Date: {selectedDateKey}</Text>
				<Pressable style={styles.dateButton} onPress={onToggleCalendar}>
					<Text style={styles.dateButtonText}>
						{showCalendar ? 'Hide Calendar' : 'Pick Date'}
					</Text>
				</Pressable>
			</View>
			<View style={styles.headerActions}>
				<Pressable style={[styles.dateButton, styles.historyButton]} onPress={onGoHistory}>
					<Text style={styles.dateButtonText}>Reservation History</Text>
				</Pressable>
				<Pressable style={[styles.dateButton, styles.historyButton]} onPress={onGoAccounting}>
					<Text style={styles.dateButtonText}>Accounting</Text>
				</Pressable>
			</View>
		</View>
	);
});
