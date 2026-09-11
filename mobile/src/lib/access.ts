import { useQuery } from "@tanstack/react-query";
import { rpc } from "./supabase";
export function useAccess() {
  return useQuery({
    queryKey: ["access"],
    queryFn: () =>
      rpc<{ is_pro: boolean; is_admin: boolean }>("get_my_access_state"),
  });
}
