import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View, Pressable } from "react-native";
import { Card, C, ErrorBox, Field, Icon, Row, Txt } from "./ui";
import { createPlaceSearch } from "../lib/places";
export interface VenueInput {
  venue: string;
  address: string;
  latitude: string;
  longitude: string;
  place_id?: string;
}
type Suggestion = {
  id: string;
  text: string;
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
};
export default function VenuePicker({
  value,
  onChange,
}: {
  value: VenueInput;
  onChange: (v: VenueInput) => void;
}) {
  const [places] = useState(createPlaceSearch);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [provider, setProvider] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    const version = ++generation.current;
    setResults([]);
    setError(undefined);
    setSearched(false);
    if (search.trim().length < 3) {
      setBusy(false);
      return;
    }
    setBusy(true);
    const timer = setTimeout(async () => {
      try {
        const suggestions = await places.search(search.trim());
        if (version !== generation.current) return;
        setResults(suggestions);
        setProvider("Google");
        setSearched(true);
      } catch (e) {
        if (version === generation.current) setError(e);
      } finally {
        if (version === generation.current) setBusy(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      generation.current++;
    };
  }, [search]);
  async function choose(item: Suggestion) {
    const version = ++generation.current;
    setBusy(true);
    setError(undefined);
    try {
      let place = item;
      if (item.latitude === undefined) {
        const data = await places.details(item.id);
        place = { ...item, ...data };
      }
      if (version !== generation.current) return;
      if (
        !place.name ||
        !place.address ||
        !Number.isFinite(place.latitude) ||
        !Number.isFinite(place.longitude)
      )
        throw Error(
          "This place is missing its address. Please choose another result.",
        );
      onChange({
        venue: place.name,
        address: place.address,
        latitude: String(place.latitude),
        longitude: String(place.longitude),
        place_id: item.id,
      });
      setSearch("");
      setResults([]);
    } catch (e) {
      if (version === generation.current) setError(e);
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }
  return (
    <View style={{ gap: 10 }}>
      <Field
        label="Location"
        placeholder="Search a park, sports center, or address"
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
      />
      {busy && (
        <Row>
          <ActivityIndicator color={C.blue} />
          <Txt size={12} color={C.muted}>
            Finding your place…
          </Txt>
        </Row>
      )}
      {results.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={`Select ${item.text}`}
          disabled={busy}
          onPress={() => choose(item)}
          style={({ pressed }) => ({
            padding: 14,
            backgroundColor: pressed ? C.line : C.card,
            borderRadius: 14,
          })}
        >
          <Row>
            <Icon name="location-outline" color={C.blue} />
            <View style={{ flex: 1 }}>
              <Txt bold>{item.name || item.text}</Txt>
              {!!item.address && (
                <Txt size={12} color={C.muted}>
                  {item.address}
                </Txt>
              )}
            </View>
            <Icon name="chevron-forward" size={16} />
          </Row>
        </Pressable>
      ))}
      {results.length > 0 && (
        <Txt size={10} color={C.muted}>
          {provider === "Google"
            ? "Powered by Google"
            : "SpotUp community venues"}
        </Txt>
      )}
      {searched && !busy && results.length === 0 && (
        <Txt size={13} color={C.muted}>
          No matches yet. Try adding the city or street name.
        </Txt>
      )}
      <ErrorBox error={error} />
      {!!value.venue && (
        <Card>
          <Row>
            <Icon name="checkmark-circle" color={C.blue} />
            <View style={{ flex: 1 }}>
              <Txt bold>{value.venue}</Txt>
              <Txt color={C.muted} size={13}>
                {value.address}
              </Txt>
            </View>
          </Row>
          <Txt size={12} color={C.muted}>
            Selected meeting place · Search above to change it.
          </Txt>
        </Card>
      )}
    </View>
  );
}
