import { memo } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeImage } from '../../components/SafeImage';
import { styles } from './styles';
import type { PaymentAccounts } from './types';

export const PaymentsSection = memo(function PaymentsSection({
	barberDocId,
	isEditing,
	onToggleEdit,
	paymentAccounts,
	onChangePaymentAccount,
	onSavePayments,
	savingPayments,
	zelleQrValue,
	cashAppQrValue,
	showZelleQR,
	onToggleZelleQR,
	showCashAppQR,
	onToggleCashAppQR,
	qrImageUrl,
}: {
	barberDocId: string | null;
	isEditing: boolean;
	onToggleEdit: () => void;
	paymentAccounts: PaymentAccounts;
	onChangePaymentAccount: (field: keyof PaymentAccounts, value: string) => void;
	onSavePayments: () => void;
	savingPayments: boolean;
	zelleQrValue: string;
	cashAppQrValue: string;
	showZelleQR: boolean;
	onToggleZelleQR: () => void;
	showCashAppQR: boolean;
	onToggleCashAppQR: () => void;
	qrImageUrl: (value: string) => string;
}) {
	return (
		<View style={styles.paymentCard}>
			<View style={styles.paymentHeaderRow}>
				<Text style={styles.paymentTitle}>Payments</Text>
				{barberDocId ? (
					<Pressable style={styles.paymentEditButton} onPress={onToggleEdit}>
						<Text style={styles.paymentEditText}>
							{isEditing ? 'Cancel' : 'Edit Payment Info'}
						</Text>
					</Pressable>
				) : null}
			</View>
			{isEditing ? (
				<View style={styles.paymentForm}>
					<Text style={styles.paymentInputLabel}>Zelle</Text>
					<TextInput
						style={styles.paymentInput}
						value={paymentAccounts.zelle}
						onChangeText={(value) => onChangePaymentAccount('zelle', value)}
						placeholder="name@email.com"
						placeholderTextColor="#6b7280"
						autoCapitalize="none"
						autoCorrect={false}
					/>
					<Text style={styles.paymentInputLabel}>CashApp</Text>
					<TextInput
						style={styles.paymentInput}
						value={paymentAccounts.cashapp}
						onChangeText={(value) => onChangePaymentAccount('cashapp', value)}
						placeholder="$cashtag"
						placeholderTextColor="#6b7280"
						autoCapitalize="none"
						autoCorrect={false}
					/>
					<Pressable style={styles.paymentSaveButton} onPress={onSavePayments} disabled={savingPayments}>
						<Text style={styles.paymentSaveText}>
							{savingPayments ? 'Saving...' : 'Save Payment Info'}
						</Text>
					</Pressable>
				</View>
			) : (
				<>
					<View style={styles.paymentRow}>
						<View style={styles.paymentDetails}>
							<Text style={styles.paymentLabel}>Zelle</Text>
							<Text style={styles.paymentValue}>{paymentAccounts.zelle || 'Not set'}</Text>
						</View>
						<Pressable
							style={[styles.paymentButton, !zelleQrValue && styles.paymentButtonDisabled]}
							onPress={onToggleZelleQR}
							disabled={!zelleQrValue}
						>
							<Text style={styles.paymentButtonText}>Show QR Code</Text>
						</Pressable>
					</View>
					{showZelleQR && zelleQrValue ? (
						<View style={styles.qrContainer}>
							<SafeImage
								uri={qrImageUrl(zelleQrValue)}
								fallbackSource={require('../../assets/placeholder-service.png')}
								style={styles.qrImage}
								resizeMode="cover"
							/>
						</View>
					) : null}
					<View style={styles.paymentRow}>
						<View style={styles.paymentDetails}>
							<Text style={styles.paymentLabel}>CashApp</Text>
							<Text style={styles.paymentValue}>{paymentAccounts.cashapp || 'Not set'}</Text>
						</View>
						<Pressable
							style={[styles.paymentButton, !cashAppQrValue && styles.paymentButtonDisabled]}
							onPress={onToggleCashAppQR}
							disabled={!cashAppQrValue}
						>
							<Text style={styles.paymentButtonText}>Show QR Code</Text>
						</Pressable>
					</View>
					{showCashAppQR && cashAppQrValue ? (
						<View style={styles.qrContainer}>
							<SafeImage
								uri={qrImageUrl(cashAppQrValue)}
								fallbackSource={require('../../assets/placeholder-service.png')}
								style={styles.qrImage}
								resizeMode="cover"
							/>
						</View>
					) : null}
				</>
			)}
		</View>
	);
});
