import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { GOOGLE_MAPS_API_KEY, hasGoogleMapsKey } from '@/lib/env';
import { GOOGLE_MAPS_LANGUAGE, GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_LOADER_ID, GOOGLE_MAPS_REGION } from '@/lib/googleMaps';
import { useJsApiLoader } from '@react-google-maps/api';

export function CityAutocomplete({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_MAPS_LIBRARIES,
    language: GOOGLE_MAPS_LANGUAGE,
    region: GOOGLE_MAPS_REGION,
  });
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);

  useEffect(() => {
    if (!hasGoogleMapsKey || !isLoaded || !value.trim()) {
      setPredictions([]);
      return;
    }
    const service = new google.maps.places.AutocompleteService();
    service.getPlacePredictions({ input: value, types: ['(cities)'] }, (results) => {
      setPredictions(results ?? []);
    });
  }, [isLoaded, value]);

  const uniquePredictions = useMemo(() => {
    const seen = new Set<string>();
    return predictions.filter((prediction) => {
      const key = prediction.description;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 5);
  }, [predictions]);

  return (
    <div className="relative">
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {uniquePredictions.length > 0 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-2xl border border-border bg-background shadow-xl overflow-hidden">
          {uniquePredictions.map((prediction) => (
            <button
              key={prediction.place_id}
              type="button"
              onClick={() => {
                onChange(prediction.description);
                setPredictions([]);
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-secondary/60"
            >
              {prediction.description}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
