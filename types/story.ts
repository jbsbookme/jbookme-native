export type Story = {
  id: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  barberId: string;
  barberName: string;
  createdAt: string;
  expiresAt: string;
};
