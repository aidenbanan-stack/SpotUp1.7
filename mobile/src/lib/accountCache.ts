import { QueryClient } from "@tanstack/react-query";
/** Keep active requests on token refresh; isolate data only when the account changes. */
export function createAccountCache() {
  let account: string | null | undefined;
  let client: QueryClient;
  return (nextAccount: string | null) => {
    if (!client || account !== nextAccount) {
      account = nextAccount;
      client = new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30000, retry: 1 },
          mutations: { retry: 0 },
        },
      });
    }
    return client;
  };
}
