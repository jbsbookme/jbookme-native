import { useEffect } from "react";
import { View, Text } from "react-native";
import { cleanExpiredStories } from "../../store/storyStore";

export default function Home() {
  useEffect(() => {
    const intervalId = setInterval(() => {
      cleanExpiredStories();
    }, 60_000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "black",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text style={{ color: "white", fontSize: 20 }}>JBookMe Running 🔥</Text>
    </View>
  );
}
