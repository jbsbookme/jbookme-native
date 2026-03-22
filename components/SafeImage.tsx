import { memo, useEffect, useState } from 'react';
import {
  Image,
  ImageResizeMode,
  ImageSourcePropType,
  ImageStyle,
  StyleProp,
  StyleSheet,
  View,
} from 'react-native';

const DEFAULT_PLACEHOLDER = require('../assets/placeholder-service.png');

type SafeImageProps = {
  uri?: string;
  fallbackSource?: ImageSourcePropType;
  style: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
};

export const SafeImage = memo(function SafeImage({
  uri,
  fallbackSource,
  style,
  resizeMode = 'cover',
}: SafeImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const hasUri = Boolean(uri);
  const placeholder = fallbackSource ?? DEFAULT_PLACEHOLDER;

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [uri]);

  const showPlaceholder = !loaded || failed || !hasUri;

  return (
    <View style={[style, styles.container]}>
      {showPlaceholder ? (
        <Image source={placeholder} style={StyleSheet.absoluteFillObject} resizeMode={resizeMode} />
      ) : null}
      {!failed && hasUri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFillObject}
          resizeMode={resizeMode}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          fadeDuration={0}
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
