import React, { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import * as Location from "expo-location";
import { Button, Card, C, ErrorBox, Field, Txt } from "./ui";
import { supabase } from "../lib/supabase";
export interface VenueInput {
  venue: string;
  address: string;
  latitude: string;
  longitude: string;
}
export default function VenuePicker({
  value,
  onChange,
}: {
  value: VenueInput;
  onChange: (v: VenueInput) => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ id: string; text: string }[]>([]);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  useEffect(() => {
    if (search.length < 3) {
      setResults([]);
      return;
    }
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("places", {
          body: { action: "autocomplete", input: search },
        });
        if (error)
          throw Error(
            "Venue search is unavailable. You can enter the venue manually.",
          );
        if (alive) {
          setResults(data.suggestions);
          setError(undefined);
        }
      } catch (e) {
        if (alive) setError(e);
      }
    }, 400);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [search]);
  async function choose(id: string) {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("places", {
        body: { action: "details", id },
      });
      if (error) throw error;
      onChange({
        venue: data.name,
        address: data.address,
        latitude: String(data.latitude),
        longitude: String(data.longitude),
      });
      setSearch("");
      setResults([]);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function locate() {
    setBusy(true);
    try {
      const p = await Location.requestForegroundPermissionsAsync();
      if (!p.granted)
        throw Error(
          "Location permission was declined. Enter the venue coordinates manually.",
        );
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      onChange({
        ...value,
        latitude: String(loc.coords.latitude),
        longitude: String(loc.coords.longitude),
      });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 12 }}>
      <Field
        label="Find a court, field, or venue"
        placeholder="Search places and addresses"
        value={search}
        onChangeText={setSearch}
      />
      {results.map((r) => (
        <Pressable
          key={r.id}
          accessibilityRole="button"
          onPress={() => choose(r.id)}
          style={{ padding: 14, backgroundColor: C.card, borderRadius: 12 }}
        >
          <Txt>{r.text}</Txt>
        </Pressable>
      ))}
      {results.length > 0 && (
        <Txt size={10} color={C.muted}>
          Powered by Google
        </Txt>
      )}
      <ErrorBox error={error} />
      {value.venue && (
        <Card>
          <Txt bold>{value.venue}</Txt>
          <Txt color={C.muted}>{value.address}</Txt>
        </Card>
      )}
      <Button
        title={manual ? "Hide manual venue details" : "Enter venue manually"}
        kind="ghost"
        onPress={() => setManual(!manual)}
      />
      {manual && (
        <>
          <Field
            label="Venue name"
            value={value.venue}
            onChangeText={(venue) => onChange({ ...value, venue })}
          />
          <Field
            label="Address"
            value={value.address}
            onChangeText={(address) => onChange({ ...value, address })}
          />
          <Field
            label="Latitude"
            keyboardType="numbers-and-punctuation"
            value={value.latitude}
            onChangeText={(latitude) => onChange({ ...value, latitude })}
          />
          <Field
            label="Longitude"
            keyboardType="numbers-and-punctuation"
            value={value.longitude}
            onChangeText={(longitude) => onChange({ ...value, longitude })}
          />
          <Button
            title="Use my location for this venue"
            kind="secondary"
            loading={busy}
            onPress={locate}
          />
          <Txt size={12} color={C.muted}>
            Only use this when you are at the public venue. Your game’s venue
            will be visible to its audience.
          </Txt>
        </>
      )}
    </View>
  );
}
