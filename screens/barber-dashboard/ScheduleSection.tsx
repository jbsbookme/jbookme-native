import { memo } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { styles } from './styles';
import type { BlockedSlot, ClosedDay, WorkingHours } from './types';

export const ScheduleSection = memo(function ScheduleSection({
	showWorkingHours,
	showClosedDays,
	showBlockedSlots,
	workingHours,
	newClosedDate,
	blockDateKey,
	blockTime,
	closedDays,
	blockedSlots,
	weekDays,
	allTimeSlots,
	savingSchedule,
	onToggleWorkingHours,
	onToggleClosedDays,
	onToggleBlockedSlots,
	onChangeWorkingHours,
	onChangeClosedDate,
	onChangeBlockDateKey,
	onSelectBlockTime,
	onSaveWorkingHours,
	onAddClosedDay,
	onRemoveClosedDay,
	onAddBlockedSlot,
	onRemoveBlockedSlot,
	formatTimeLabel,
}: {
	showWorkingHours: boolean;
	showClosedDays: boolean;
	showBlockedSlots: boolean;
	workingHours: Record<string, WorkingHours>;
	newClosedDate: string;
	blockDateKey: string;
	blockTime: string | null;
	closedDays: ClosedDay[];
	blockedSlots: BlockedSlot[];
	weekDays: readonly string[];
	allTimeSlots: readonly string[];
	savingSchedule: boolean;
	onToggleWorkingHours: () => void;
	onToggleClosedDays: () => void;
	onToggleBlockedSlots: () => void;
	onChangeWorkingHours: (day: string, field: 'start' | 'end', value: string) => void;
	onChangeClosedDate: (value: string) => void;
	onChangeBlockDateKey: (value: string) => void;
	onSelectBlockTime: (value: string) => void;
	onSaveWorkingHours: () => void;
	onAddClosedDay: () => void;
	onRemoveClosedDay: (id: string) => void;
	onAddBlockedSlot: () => void;
	onRemoveBlockedSlot: (id: string) => void;
	formatTimeLabel: (value: string) => string;
}) {
	return (
		<View style={styles.scheduleCard}>
			<Pressable style={styles.scheduleHeader} onPress={onToggleWorkingHours}>
				<View style={styles.scheduleHeaderRow}>
					<Text style={styles.scheduleTitle}>Working Hours</Text>
					<Text style={styles.scheduleToggle}>{showWorkingHours ? '▴' : '▾'}</Text>
				</View>
				<Pressable style={styles.scheduleSaveButton} onPress={onSaveWorkingHours} disabled={savingSchedule}>
					<Text style={styles.scheduleSaveText}>
						{savingSchedule ? 'Saving...' : 'Save Hours'}
					</Text>
				</Pressable>
			</Pressable>
			{showWorkingHours
				? weekDays.map((day) => (
						<View key={day} style={styles.scheduleRow}>
							<Text style={styles.scheduleDay}>{day}</Text>
							<TextInput
								style={styles.scheduleInput}
								value={workingHours[day]?.start ?? '9:00 AM'}
								onChangeText={(value) => onChangeWorkingHours(day, 'start', value)}
								placeholder="9:00 AM"
								placeholderTextColor="#6b7280"
								autoCapitalize="none"
								autoCorrect={false}
							/>
							<Text style={styles.scheduleDash}>-</Text>
							<TextInput
								style={styles.scheduleInput}
								value={workingHours[day]?.end ?? '6:00 PM'}
								onChangeText={(value) => onChangeWorkingHours(day, 'end', value)}
								placeholder="6:00 PM"
								placeholderTextColor="#6b7280"
								autoCapitalize="none"
								autoCorrect={false}
							/>
						</View>
					))
				: null}
			<View style={styles.scheduleSection}>
				<Pressable style={styles.scheduleSectionHeader} onPress={onToggleClosedDays}>
					<Text style={styles.scheduleSubtitle}>Closed Days</Text>
					<Text style={styles.scheduleSectionToggle}>{showClosedDays ? '▴' : '▾'}</Text>
				</Pressable>
				{showClosedDays ? (
					<>
						<View style={styles.scheduleInputRow}>
							<TextInput
								style={styles.scheduleInputWide}
								value={newClosedDate}
								onChangeText={onChangeClosedDate}
								placeholder="YYYY-MM-DD"
								placeholderTextColor="#6b7280"
								autoCapitalize="none"
								autoCorrect={false}
							/>
							<Pressable style={styles.scheduleAddButton} onPress={onAddClosedDay}>
								<Text style={styles.scheduleAddText}>Add</Text>
							</Pressable>
						</View>
						{closedDays.length === 0 ? (
							<Text style={styles.scheduleEmpty}>No closed days yet.</Text>
						) : (
							closedDays.map((item) => (
								<View key={item.id} style={styles.scheduleItemRow}>
									<Text style={styles.scheduleItemText}>{item.date}</Text>
									<Pressable onPress={() => onRemoveClosedDay(item.id)}>
										<Text style={styles.scheduleRemoveText}>Remove</Text>
									</Pressable>
								</View>
							))
						)}
					</>
				) : null}
			</View>
			<View style={styles.scheduleSection}>
				<Pressable style={styles.scheduleSectionHeader} onPress={onToggleBlockedSlots}>
					<Text style={styles.scheduleSubtitle}>Blocked Slots</Text>
					<Text style={styles.scheduleSectionToggle}>{showBlockedSlots ? '▴' : '▾'}</Text>
				</Pressable>
				{showBlockedSlots ? (
					<>
						<View style={styles.scheduleInputRow}>
							<TextInput
								style={styles.scheduleInputWide}
								value={blockDateKey}
								onChangeText={onChangeBlockDateKey}
								placeholder="YYYY-MM-DD"
								placeholderTextColor="#6b7280"
								autoCapitalize="none"
								autoCorrect={false}
							/>
							<Pressable style={styles.blockButton} onPress={onAddBlockedSlot} disabled={!blockTime}>
								<Text style={styles.blockButtonText}>Block Time Slot</Text>
							</Pressable>
						</View>
						<View style={styles.blockTimeGrid}>
							{allTimeSlots.map((slot) => {
								const isSelected = slot === blockTime;
								return (
									<Pressable
										key={slot}
										style={[styles.blockTimeButton, isSelected && styles.blockTimeButtonActive]}
										onPress={() => onSelectBlockTime(slot)}
									>
										<Text style={[styles.blockTimeText, isSelected && styles.blockTimeTextActive]}>
											{formatTimeLabel(slot)}
										</Text>
									</Pressable>
								);
							})}
						</View>
						{blockedSlots.length === 0 ? (
							<Text style={styles.scheduleEmpty}>No blocked slots yet.</Text>
						) : (
							blockedSlots.map((item) => (
								<View key={item.id} style={styles.scheduleItemRow}>
									<Text style={styles.scheduleItemText}>
										{item.date} {formatTimeLabel(item.time)}
									</Text>
									<Pressable onPress={() => onRemoveBlockedSlot(item.id)}>
										<Text style={styles.scheduleRemoveText}>Remove</Text>
									</Pressable>
								</View>
							))
						)}
					</>
				) : null}
			</View>
		</View>
	);
});
