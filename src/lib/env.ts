/**
 * Centralized environment access.
 *
 * This is a Vite app. Client-exposed env vars MUST be prefixed with `VITE_`.
 *
 * Vercel:
 * - Project Settings -> Environment Variables
 * - Add `VITE_GOOGLE_MAPS_API_KEY`
 */

export const GOOGLE_MAPS_API_KEY: string = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';

/**
 * True when the Google Maps key is present.
 * We keep this helper so the UI can gracefully fall back when the key is missing.
 */
export const hasGoogleMapsKey = Boolean(GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY.trim().length > 0);
