import { Share, Platform } from 'react-native';

export async function openNativeShare({
  title,
  message,
  url,
}: {
  title: string;
  message: string;
  url: string;
}) {
  const content =
    Platform.OS === 'ios'
      ? {
          url,
          message,
        }
      : {
          message: `${message} ${url}`,
        };

  await Share.share(content, {
    subject: title,
    dialogTitle: title,
  });
}
