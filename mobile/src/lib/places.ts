import { supabase } from "./supabase";
export type PlaceSuggestion = {
  id: string;
  text: string;
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
};
export function createPlaceSearch() {
  return {
    async search(input: string): Promise<PlaceSuggestion[]> {
      const { data, error } = await supabase.functions.invoke("places", {
        body: { action: "autocomplete", input },
      });
      if (error)
        throw Error("Place search couldn’t connect. Try again in a moment.");
      return data.suggestions ?? [];
    },
    async details(id: string): Promise<PlaceSuggestion> {
      const { data, error } = await supabase.functions.invoke("places", {
        body: { action: "details", id },
      });
      if (error)
        throw Error("We couldn’t open this place. Please select it again.");
      return { id, text: data.name, ...data };
    },
  };
}
