import Constants from "expo-constants";
import { supabase } from "./supabase";
export type PlaceSuggestion = {
  id: string;
  text: string;
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
};
type Prediction = {
  placeId: string;
  text: { text: string };
  mainText?: { text: string };
  secondaryText?: { text: string };
  toPlace: () => {
    fetchFields: (options: { fields: string[] }) => Promise<unknown>;
    displayName?: string;
    formattedAddress?: string;
    location?: { lat: () => number; lng: () => number };
  };
};
type PlacesLibrary = {
  AutocompleteSessionToken: new () => object;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions: (input: {
      input: string;
      sessionToken: object;
    }) => Promise<{ suggestions: { placePrediction?: Prediction }[] }>;
  };
};
let loaded: Promise<PlacesLibrary> | undefined;
function loadPlaces(): Promise<PlacesLibrary> {
  if (loaded) return loaded;
  loaded = new Promise((resolve, reject) => {
    const key = Constants.expoConfig?.extra?.googleMapsWebKey;
    if (!key) {
      reject(Error("Place search is not connected yet."));
      return;
    }
    const w = window as unknown as {
      google?: {
        maps: { importLibrary: (name: string) => Promise<PlacesLibrary> };
      };
    };
    if (w.google?.maps.importLibrary) {
      w.google.maps.importLibrary("places").then(resolve, reject);
      return;
    }
    const script = document.createElement("script");
    const timer = setTimeout(
      () => reject(Error("Place search took too long. Please retry.")),
      12000,
    );
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&v=weekly&loading=async`;
    script.async = true;
    script.onload = () => {
      clearTimeout(timer);
      if (w.google) w.google.maps.importLibrary("places").then(resolve, reject);
      else reject(Error("Place search could not start."));
    };
    script.onerror = () => {
      clearTimeout(timer);
      script.remove();
      reject(Error("Place search couldn’t connect."));
    };
    document.head.appendChild(script);
  });
  loaded.catch(() => {
    loaded = undefined;
  });
  return loaded;
}
export function createPlaceSearch() {
  let token: object | undefined;
  const predictions = new Map<string, Prediction>();
  const browserKey = Constants.expoConfig?.extra?.googleMapsWebKey;
  return {
    async search(input: string): Promise<PlaceSuggestion[]> {
      if (!browserKey) {
        const { data, error } = await supabase.functions.invoke("places", {
          body: { action: "autocomplete", input },
        });
        if (error)
          throw Error("Place search couldn’t connect. Please try again.");
        return data.suggestions ?? [];
      }
      const lib = await loadPlaces();
      token ??= new lib.AutocompleteSessionToken();
      const { suggestions } =
        await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input,
          sessionToken: token,
        });
      predictions.clear();
      return suggestions.flatMap((s) => {
        const p = s.placePrediction;
        if (!p) return [];
        predictions.set(p.placeId, p);
        return [
          {
            id: p.placeId,
            text: p.text.text,
            name: p.mainText?.text,
            address: p.secondaryText?.text,
          },
        ];
      });
    },
    async details(id: string): Promise<PlaceSuggestion> {
      if (!browserKey) {
        const { data, error } = await supabase.functions.invoke("places", {
          body: { action: "details", id },
        });
        if (error) throw Error("Please select the place again.");
        return { id, text: data.name, ...data };
      }
      const prediction = predictions.get(id);
      if (!prediction) throw Error("Please search for this place again.");
      const p = prediction.toPlace();
      await p.fetchFields({
        fields: ["displayName", "formattedAddress", "location"],
      });
      token = undefined;
      return {
        id,
        text: p.displayName ?? "",
        name: p.displayName,
        address: p.formattedAddress,
        latitude: p.location?.lat(),
        longitude: p.location?.lng(),
      };
    },
  };
}
