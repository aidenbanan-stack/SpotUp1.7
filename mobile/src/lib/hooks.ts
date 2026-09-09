import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
export function useAction<T = void, V = void>(fn: (value: V) => Promise<T>) {
  const q = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      q.invalidateQueries({
        predicate: (query) =>
          !["videoUrl", "showcaseUrl", "reviewMedia"].includes(
            String(query.queryKey[0]),
          ),
      }),
  });
}
export function useRealtime(table: string, filter?: string) {
  const q = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel(table + ":" + (filter ?? "all"))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
        () => {
          q.invalidateQueries();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [table, filter, q]);
}
