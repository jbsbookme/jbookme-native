import { memo } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { styles } from './styles';
import type { SocialLinks } from './types';

export const SocialSection = memo(function SocialSection({
	barberDocId,
	isEditing,
	onToggleEdit,
	socialLinks,
	onChangeSocialLink,
	onSaveSocials,
	savingSocials,
}: {
	barberDocId: string | null;
	isEditing: boolean;
	onToggleEdit: () => void;
	socialLinks: SocialLinks;
	onChangeSocialLink: (field: keyof SocialLinks, value: string) => void;
	onSaveSocials: () => void;
	savingSocials: boolean;
}) {
	return (
		<View style={styles.socialCard}>
			<View style={styles.socialHeaderRow}>
				<Text style={styles.socialTitle}>Social Links</Text>
				{barberDocId ? (
					<Pressable style={styles.socialEditButton} onPress={onToggleEdit}>
						<Text style={styles.socialEditText}>
							{isEditing ? 'Cancel' : 'Edit Social Links'}
						</Text>
					</Pressable>
				) : null}
			</View>
			{isEditing ? (
				<View style={styles.socialForm}>
					<Text style={styles.socialLabel}>Instagram</Text>
					<TextInput
						style={styles.socialInput}
						value={socialLinks.instagram}
						onChangeText={(value) => onChangeSocialLink('instagram', value)}
						placeholder="instagram.com/username"
						placeholderTextColor="#6b7280"
						autoCapitalize="none"
						autoCorrect={false}
					/>
					<Text style={styles.socialLabel}>Facebook</Text>
					<TextInput
						style={styles.socialInput}
						value={socialLinks.facebook}
						onChangeText={(value) => onChangeSocialLink('facebook', value)}
						placeholder="facebook.com/page"
						placeholderTextColor="#6b7280"
						autoCapitalize="none"
						autoCorrect={false}
					/>
					<Text style={styles.socialLabel}>TikTok</Text>
					<TextInput
						style={styles.socialInput}
						value={socialLinks.tiktok}
						onChangeText={(value) => onChangeSocialLink('tiktok', value)}
						placeholder="tiktok.com/@username"
						placeholderTextColor="#6b7280"
						autoCapitalize="none"
						autoCorrect={false}
					/>
					<Text style={styles.socialLabel}>Website</Text>
					<TextInput
						style={styles.socialInput}
						value={socialLinks.website}
						onChangeText={(value) => onChangeSocialLink('website', value)}
						placeholder="https://barber.com"
						placeholderTextColor="#6b7280"
						autoCapitalize="none"
						autoCorrect={false}
					/>
					<Pressable style={styles.socialSaveButton} onPress={onSaveSocials} disabled={savingSocials}>
						<Text style={styles.socialSaveText}>
							{savingSocials ? 'Saving...' : 'Save Links'}
						</Text>
					</Pressable>
				</View>
			) : (
				<View style={styles.socialList}>
					{socialLinks.instagram ? (
						<Text style={styles.socialValue}>Instagram: {socialLinks.instagram}</Text>
					) : null}
					{socialLinks.facebook ? (
						<Text style={styles.socialValue}>Facebook: {socialLinks.facebook}</Text>
					) : null}
					{socialLinks.tiktok ? (
						<Text style={styles.socialValue}>TikTok: {socialLinks.tiktok}</Text>
					) : null}
					{socialLinks.website ? (
						<Text style={styles.socialValue}>Website: {socialLinks.website}</Text>
					) : null}
					{!socialLinks.instagram &&
					!socialLinks.facebook &&
					!socialLinks.tiktok &&
					!socialLinks.website ? (
						<Text style={styles.socialEmpty}>No social links yet.</Text>
					) : null}
				</View>
			)}
		</View>
	);
});
