import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type VideoItem = {
  id: string;
  uri: string;
  type: 'video' | 'image';
};

type VideoState = {
  videos: VideoItem[];
  addVideo: (uri: string) => void;
  addImage: (uri: string) => void;
  setVideos: (videos: VideoItem[]) => void;
  pauseAll: boolean;
  setPauseAll: (value: boolean) => void;
  muteAll: boolean;
  setMuteAll: (value: boolean) => void;
};

export const useVideoStore = create<VideoState>()(
  persist(
    (set) => ({
      videos: [],
      pauseAll: false,
      setPauseAll: (pauseAll) => set({ pauseAll }),
      muteAll: false,
      setMuteAll: (muteAll) => set({ muteAll }),
      addVideo: (uri) =>
        set((state) => ({
          videos: [
            { id: Date.now().toString(), uri, type: 'video' },
            ...state.videos,
          ],
        })),
      addImage: (uri) =>
        set((state) => ({
          videos: [
            { id: Date.now().toString(), uri, type: 'image' },
            ...state.videos,
          ],
        })),
      setVideos: (videos) => set({ videos }),
    }),
    {
      name: 'video-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);