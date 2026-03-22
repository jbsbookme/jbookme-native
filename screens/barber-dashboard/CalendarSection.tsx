import { memo } from 'react';
import { View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { styles } from './styles';

export const CalendarSection = memo(function CalendarSection({
	selectedDateKey,
	onDayPress,
}: {
	selectedDateKey: string;
	onDayPress: (dateString: string) => void;
}) {
	return (
		<View style={styles.calendarCard}>
			<Calendar
				markedDates={{
					[selectedDateKey]: {
						selected: true,
						selectedColor: '#00f0ff',
					},
				}}
				onDayPress={(day) => onDayPress(day.dateString)}
				theme={{
backgroundColor: '#000',
					calendarBackground: '#0a0a0a',
					textSectionTitleColor: '#9aa0a6',
					dayTextColor: '#ffffff',
					monthTextColor: '#ffffff',
					arrowColor: '#00f0ff',
					todayTextColor: '#ffd700',
					textDisabledColor: 'rgba(255,255,255,0.3)',
				}}
			/>
		</View>
	);
});
