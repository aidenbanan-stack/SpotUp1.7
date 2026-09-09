import { createClient } from "npm:@supabase/supabase-js@2.115.0";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization,x-client-info,apikey,content-type",
  "Content-Type": "application/json",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST")
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers },
    );
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user)
      return Response.json(
        { error: "Sign in required" },
        { status: 401, headers },
      );
    const quota = await client.rpc("use_places_quota");
    if (quota.error)
      return Response.json(
        { error: quota.error.message },
        { status: 429, headers },
      );
    const key = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!key)
      return Response.json(
        { error: "Venue search is not configured" },
        { status: 503, headers },
      );
    const body = await req.json();
    let response: Response;
    if (body.action === "autocomplete") {
      if (
        typeof body.input !== "string" ||
        body.input.length < 3 ||
        body.input.length > 200
      )
        return Response.json(
          { error: "Invalid search" },
          { status: 400, headers },
        );
      response = await fetch(
        "https://places.googleapis.com/v1/places:autocomplete",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
          },
          body: JSON.stringify({
            input: body.input,
            includeQueryPredictions: false,
          }),
        },
      );
      if (!response.ok) throw Error("Venue search is temporarily unavailable");
      const data = await response.json();
      return Response.json(
        {
          suggestions: (data.suggestions ?? [])
            .filter((s: any) => s.placePrediction)
            .map((s: any) => ({
              id: s.placePrediction.placeId,
              text: s.placePrediction.text.text,
            })),
        },
        { headers },
      );
    }
    if (
      body.action === "details" &&
      typeof body.id === "string" &&
      /^[a-zA-Z0-9_-]{1,250}$/.test(body.id)
    ) {
      response = await fetch(
        "https://places.googleapis.com/v1/places/" +
          encodeURIComponent(body.id),
        {
          headers: {
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "displayName,formattedAddress,location",
          },
        },
      );
      if (!response.ok) throw Error("Venue details are unavailable");
      const data = await response.json();
      return Response.json(
        {
          name: data.displayName.text,
          address: data.formattedAddress,
          latitude: data.location.latitude,
          longitude: data.location.longitude,
        },
        { headers },
      );
    }
    return Response.json(
      { error: "Invalid request" },
      { status: 400, headers },
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Venue search failed" },
      { status: 400, headers },
    );
  }
});
