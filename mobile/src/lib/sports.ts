import { useQuery } from "@tanstack/react-query";
import { configured, supabase } from "./supabase";
import { SPORTS } from "./types";
/** Catalog is managed in Supabase; bundled choices also support setup/offline UI. */
export function useSports() {
  const { data } = useQuery({
    queryKey: ["sports"],
    enabled: configured,
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sports")
        .select("id,name,icon")
        .order("name");
      if (error) throw error;
      return data as typeof SPORTS;
    },
  });
  return (data?.length ? data : SPORTS)
    .slice()
    .sort((a, b) =>
      a.id === "other"
        ? 1
        : b.id === "other"
          ? -1
          : a.name.localeCompare(b.name),
    );
}
