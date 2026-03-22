import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { useRoleStore } from '@/src/store/roleStore';

const TAB_BAR_HEIGHT = 64;

function TabBarBackground() {
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: TAB_BAR_HEIGHT,
        backgroundColor: '#0a0a0a',
        borderTopWidth: 1,
        borderTopColor: '#1a1a1a',
        shadowColor: '#000',
        shadowOpacity: 0.5,
        shadowOffset: { width: 0, height: -4 },
        shadowRadius: 12,
        elevation: 10,
      }}
    />
  );
}

const SCREEN_OPTIONS = {
  headerShown: false,
  tabBarStyle: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: TAB_BAR_HEIGHT,
    backgroundColor: 'transparent',
    borderTopColor: 'transparent',
    paddingBottom: 0,
  },
  tabBarBackground: () => <TabBarBackground />,
  tabBarLabelStyle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  tabBarActiveTintColor: '#e10600',
  tabBarInactiveTintColor: '#b7b7b7',
} as const;

const TAB_SCREENS = [
  {
    name: 'home',
    options: {
      title: 'Home',
      tabBarIcon: ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="home" color={color} size={size + 4} />
          <View
            style={{
              marginTop: 4,
              width: 20,
              height: 2,
              borderRadius: 999,
              backgroundColor: '#e10600',
              opacity: focused ? 1 : 0,
            }}
          />
        </View>
      ),
    },
  },
  {
    name: 'barbers',
    options: {
      title: 'Barbers',
      tabBarIcon: ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="cut" color={color} size={size + 4} />
          <View
            style={{
              marginTop: 4,
              width: 20,
              height: 2,
              borderRadius: 999,
              backgroundColor: '#e10600',
              opacity: focused ? 1 : 0,
            }}
          />
        </View>
      ),
    },
  },
  {
    name: 'book',
    options: {
      title: 'Book',
      tabBarIcon: ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="calendar" color={color} size={size + 4} />
          <View
            style={{
              marginTop: 4,
              width: 20,
              height: 2,
              borderRadius: 999,
              backgroundColor: '#e10600',
              opacity: focused ? 1 : 0,
            }}
          />
        </View>
      ),
    },
  },
  {
    name: 'feed',
    options: {
      title: 'Feed',
      tabBarIcon: ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="play-circle" color={color} size={size + 4} />
          <View
            style={{
              marginTop: 4,
              width: 20,
              height: 2,
              borderRadius: 999,
              backgroundColor: '#e10600',
              opacity: focused ? 1 : 0,
            }}
          />
        </View>
      ),
      unmountOnBlur: true,
    },
  },
  {
    name: 'profile',
    options: {
      title: 'Profile',
      tabBarIcon: ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="person" color={color} size={size + 4} />
          <View
            style={{
              marginTop: 4,
              width: 20,
              height: 2,
              borderRadius: 999,
              backgroundColor: '#e10600',
              opacity: focused ? 1 : 0,
            }}
          />
        </View>
      ),
    },
  },
];

export default function TabsLayout() {
  return (
    <Tabs screenOptions={SCREEN_OPTIONS}>
      {TAB_SCREENS.map((screen) => (
        <Tabs.Screen
          key={screen.name}
          name={screen.name}
          options={screen.options}
        />
      ))}
      <Tabs.Screen
        name="admin-dashboard"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="index"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="barber-dashboard"
        options={{ href: null }}
      />
    </Tabs>
  );
}