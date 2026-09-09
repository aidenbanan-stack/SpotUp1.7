import React from "react";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Linking } from "react-native";
import { one, rows } from "../../src/lib/supabase";
import { Venue, Game } from "../../src/lib/types";
import {
  Button,
  ErrorBox,
  Header,
  Screen,
  Section,
  Txt,
} from "../../src/components/ui";
import GameCard from "../../src/components/GameCard";
import { GAME_SELECT } from "../../src/screens/Home";
export default function VenueDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({
    queryKey: ["venue", id],
    queryFn: () => one<Venue>("locations", id),
  });
  const games = useQuery({
    queryKey: ["venueGames", id],
    queryFn: () =>
      rows<Game>("games", GAME_SELECT, { location_id: id }, "starts_at"),
  });
  return (
    <Screen>
      <Header title={q.data?.name ?? "Venue"} />
      <ErrorBox error={q.error || games.error} />
      <Txt>{q.data?.address}</Txt>
      {q.data && (
        <Button
          title="Get directions"
          onPress={() =>
            Linking.openURL(
              `https://www.google.com/maps/dir/?api=1&destination=${q.data!.latitude},${q.data!.longitude}`,
            )
          }
        />
      )}
      <Section title="Games at this spot" />
      {games.data?.map((g) => (
        <GameCard key={g.id} game={g} />
      ))}
    </Screen>
  );
}
