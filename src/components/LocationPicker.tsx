import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPin, Search, Loader2 } from 'lucide-react';
import { GOOGLE_MAPS_API_KEY, hasGoogleMapsKey } from '@/lib/env';

interface LocationPickerProps {
  value: {
    latitude: number;
    longitude: number;
    areaName: string;
  };
  onChange: (location: { latitude: number; longitude: number; areaName: string }) => void;
}

const mapContainerStyle = {
  width: '100%',
  height: '200px',
  borderRadius: '12px',
};

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e0e1a' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1e3a2f' }] },
];

export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [open, setOpen] = useState(false);

  const serviceHostRef = useRef<HTMLDivElement | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  // If the key is missing, gracefully fall back to manual entry.
  if (!hasGoogleMapsKey) {
    return (
      <div className="bg-secondary rounded-xl p-4 text-center text-muted-foreground">
        <p>Location picker needs Google Maps. Enter location manually.</p>
        <Input
          value={value.areaName}
          onChange={(e) => onChange({ ...value, areaName: e.target.value })}
          placeholder="Enter location name"
          className="mt-2 bg-background border-border"
        />
      </div>
    );
  }

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: ['places'],
  });

  const autocomplete = useMemo(() => {
    if (!isLoaded) return null;
    return new google.maps.places.AutocompleteService();
  }, [isLoaded]);

  // IMPORTANT: Initialize PlacesService after the hidden div ref exists.
  useEffect(() => {
    if (!isLoaded) return;
    if (!placesServiceRef.current && serviceHostRef.current) {
      placesServiceRef.current = new google.maps.places.PlacesService(serviceHostRef.current);
    }
  }, [isLoaded]);

  // Keep the input text synced with the selected location when the dropdown is not open.
  useEffect(() => {
    if (!open) {
      setSearchQuery(value.areaName || '');
    }
  }, [value.areaName, open]);

  useEffect(() => {
    if (!isLoaded || !autocomplete) return;

    const q = searchQuery.trim();
    if (!q) {
      setPredictions([]);
      return;
    }

    const t = window.setTimeout(() => {
      autocomplete.getPlacePredictions({ input: q }, (res) => {
        setPredictions(res ?? []);
      });
    }, 200);

    return () => window.clearTimeout(t);
  }, [searchQuery, isLoaded, autocomplete]);

  const handleMapClick = useCallback(
    async (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;

      const lat = e.latLng.lat();
      const lng = e.latLng.lng();

      const geocoder = new google.maps.Geocoder();
      try {
        const result = await geocoder.geocode({ location: { lat, lng } });
        const address =
          result.results[0]?.formatted_address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

        onChange({
          latitude: lat,
          longitude: lng,
          areaName: address,
        });
        setOpen(false);
      } catch {
        onChange({
          latitude: lat,
          longitude: lng,
          areaName: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        });
        setOpen(false);
      }
    },
    [onChange]
  );

  const handleSearch = useCallback(async () => {
    // Manual search (geocode) if user hits Enter without selecting an autocomplete option.
    if (!searchQuery.trim() || !isLoaded) return;

    setIsSearching(true);
    const geocoder = new google.maps.Geocoder();

    try {
      const result = await geocoder.geocode({ address: searchQuery });
      if (result.results[0]) {
        const location = result.results[0].geometry.location;
        onChange({
          latitude: location.lat(),
          longitude: location.lng(),
          areaName: result.results[0].formatted_address,
        });
        setOpen(false);
        setPredictions([]);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Geocoding error:', error);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, isLoaded, onChange]);

  const selectPrediction = useCallback(
    (p: google.maps.places.AutocompletePrediction) => {
      const placesService = placesServiceRef.current;

      if (!placesService) {
        // Should be rare now, but keep a safe fallback.
        setSearchQuery(p.description);
        setOpen(false);
        return;
      }

      setIsSearching(true);
      placesService.getDetails(
        {
          placeId: p.place_id,
          fields: ['geometry.location', 'formatted_address', 'name'],
        },
        (details, status) => {
          setIsSearching(false);
          if (
            status !== google.maps.places.PlacesServiceStatus.OK ||
            !details?.geometry?.location
          ) {
            setSearchQuery(p.description);
            return;
          }

          const loc = details.geometry.location;
          const label = details.formatted_address || details.name || p.description;

          onChange({
            latitude: loc.lat(),
            longitude: loc.lng(),
            areaName: label,
          });

          setSearchQuery(label);
          setOpen(false);
          setPredictions([]);
        }
      );
    },
    [onChange]
  );

  if (loadError) {
    return (
      <div className="bg-secondary rounded-xl p-4 text-center text-muted-foreground">
        <p>Unable to load map. Please enter location manually.</p>
        <Input
          value={value.areaName}
          onChange={(e) => onChange({ ...value, areaName: e.target.value })}
          placeholder="Enter location name"
          className="mt-2 bg-background border-border"
        />
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="bg-secondary rounded-xl p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setOpen(true);
          }}
          placeholder="Search for a location..."
          className="bg-secondary border-border"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          onFocus={() => setOpen(true)}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleSearch}
          disabled={isSearching}
          className="shrink-0"
        >
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Autocomplete dropdown */}
      {open && predictions.length > 0 && (
        <div className="bg-card border border-border/50 rounded-xl overflow-hidden shadow-card">
          {predictions.slice(0, 6).map((p) => (
            <button
              type="button"
              key={p.place_id}
              className="w-full text-left px-4 py-3 hover:bg-secondary/60 transition-colors text-sm"
              onClick={() => selectPrediction(p)}
            >
              {p.description}
            </button>
          ))}
        </div>
      )}

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={{ lat: value.latitude, lng: value.longitude }}
        zoom={14}
        onClick={handleMapClick}
        options={{
          styles: darkMapStyle,
          disableDefaultUI: true,
          zoomControl: true,
        }}
      >
        <Marker
          position={{ lat: value.latitude, lng: value.longitude }}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#e11d48',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
          }}
        />
      </GoogleMap>

      {value.areaName && (
        <div className="flex items-start gap-2 p-3 bg-secondary/60 rounded-xl">
          <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <span className="text-sm text-foreground">{value.areaName}</span>
        </div>
      )}

      {/* Hidden element to host PlacesService */}
      <div ref={serviceHostRef} className="hidden" />
    </div>
  );
}
