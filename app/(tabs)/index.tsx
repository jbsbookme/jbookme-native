import { View, Text } from "react-native";

export default function Home() {
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
