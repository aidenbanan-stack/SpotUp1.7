import React, { useState } from "react";
import { View } from "react-native";
import { Chips, C } from "../components/ui";
import MyGames from "./MyGames";
import Squads from "./Squads";
import Tournaments from "./Tournaments";
export default function Play() {
  const [tab, setTab] = useState("games");
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <Chips
          items={[
            { id: "games", name: "My Games" },
            { id: "squads", name: "Squads" },
            { id: "tournaments", name: "Tournaments" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>
      {tab === "games" ? (
        <MyGames />
      ) : tab === "squads" ? (
        <Squads />
      ) : (
        <Tournaments />
      )}
    </View>
  );
}
