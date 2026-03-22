import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { openNativeShare } from '../services/shareService';

export default function ShareSheet({
  visible,
  onClose,
  videoUrl,
  shareUrl,
}: any) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.4)',
        }}
      >
        <View
          style={{
backgroundColor: '#000',
            padding: 20,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          }}
        >
          <Text
            style={{
              color: '#fff',
              fontSize: 16,
              marginBottom: 16,
            }}
          >
            Share
          </Text>

          <TouchableOpacity
            onPress={() => {
              openNativeShare({
                title: 'Share',
                message: 'Check this out 👇',
                url: shareUrl,
              });
              onClose();
            }}
          >
            <Text style={{ color: '#fff', marginBottom: 12 }}>
              📲 Share…
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: '#888', marginTop: 8 }}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
