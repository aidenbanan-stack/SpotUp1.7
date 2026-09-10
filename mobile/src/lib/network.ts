/** Bound stalled requests while preserving caller cancellation. Uploads get longer. */
export function createBoundedFetch(
  fetcher: typeof fetch,
  timeoutMs = 15000,
): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const callerSignal =
      init?.signal ??
      (typeof Request !== "undefined" && input instanceof Request
        ? input.signal
        : undefined);
    const abort = () => controller.abort();
    if (callerSignal?.aborted) abort();
    callerSignal?.addEventListener("abort", abort, { once: true });
    const requestUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const upload =
      requestUrl.includes("/storage/v1/object/") &&
      !requestUrl.includes("/storage/v1/object/sign/") &&
      init?.method?.toUpperCase() === "POST";
    let timedOut = false;
    const timer = setTimeout(
      () => {
        timedOut = true;
        controller.abort();
      },
      upload ? 120000 : timeoutMs,
    );
    try {
      return await fetcher(input, { ...init, signal: controller.signal });
    } catch (error) {
      if (timedOut)
        throw Error(
          "SpotUp took too long to respond. Check your connection and try again.",
        );
      throw error;
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener("abort", abort);
    }
  };
}
