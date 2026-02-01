import { useCallback, useEffect, useMemo, useState } from 'react';
import { GoogleMap as GoogleMapComponent, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { Game } from '@/types';
import { SportIcon } from './SportIcon';
import { Lock } from 'lucide-react';
import { GOOGLE_MAPS_API_KEY, hasGoogleMapsKey } from '@/lib/env';
import { getBrowserLocation, LatLng } from '@/lib/geo';

interface GoogleMapProps {
  games: Game[];
  selectedGame: Game | null;
  onGameSelect: (game: Game | null) => void;
  center?: { lat: number; lng: number };
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 40.7128,
  lng: -74.006,
};

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0a0a0a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b9a76' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#2a2a2a' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#3a3a3a' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0a' }] },
];

const sportColors: Record<string, string> = {
  basketball: '#f97316',
  soccer: '#22c55e',
  pickleball: '#0ea5e9',
  'flag-football': '#a855f7',
  baseball: '#eab308',
  volleyball: '#ec4899',
  'ultimate-frisbee': '#06b6d4',
};

export function GoogleMap({ games, selectedGame, onGameSelect, center }: GoogleMapProps) {
  // If the key is missing, do not attempt to load Maps (prevents runtime/deploy errors).
  if (!hasGoogleMapsKey) {
    return (
      <div className="flex items-center justify-center h-full bg-secondary/30">
        <p className="text-muted-foreground text-sm">
          Google Maps is not configured. Set <span className="font-mono">VITE_GOOGLE_MAPS_API_KEY</span> to enable maps.
        </p>
      </div>
    );
  }

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);

  const [resolvedCenter, setResolvedCenter] = useState<LatLng>(center ?? defaultCenter);
  const hasCenterProp = useMemo(() => !!center, [center]);

  useEffect(() => {
    if (center) setResolvedCenter(center);
  }, [center?.lat, center?.lng]);

  useEffect(() => {
    // If the parent did not provide a center, try to start at the user's location.
    if (hasCenterProp) return;

    let cancelled = false;
    void getBrowserLocation()
      .then((loc) => {
        if (cancelled) return;
        setResolvedCenter(loc);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [hasCenterProp]);


  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full bg-secondary/30">
        <p className="text-destructive">Error loading map</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-secondary/30">
        <div className="animate-pulse text-muted-foreground">Loading map...</div>
      </div>
    );
  }

  return (
    <GoogleMapComponent
      mapContainerStyle={mapContainerStyle}
      center={resolvedCenter}
      zoom={13}
      onLoad={onLoad}
      onUnmount={onUnmount}
      options={{
        styles: darkMapStyle,
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',
      }}
      onClick={() => onGameSelect(null)}
    >
      {games.map((game) => {
        const position = {
          lat: game.location.latitude,
          lng: game.location.longitude,
        };

        return (
          <Marker
            key={game.id}
            position={position}
            onClick={() => onGameSelect(game)}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor: sportColors[game.sport] || '#E50914',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }}
          />
        );
      })}

      {selectedGame && (
        <InfoWindow
          position={{
            lat: selectedGame.location.latitude,
            lng: selectedGame.location.longitude,
          }}
          onCloseClick={() => onGameSelect(null)}
        >
          <div className="p-2 min-w-[150px] bg-background text-foreground rounded">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm">{selectedGame.title}</span>
              {selectedGame.isPrivate && <Lock className="w-3 h-3" />}
            </div>
            <p className="text-xs text-muted-foreground capitalize">{selectedGame.sport.replace('-', ' ')}</p>
          </div>
        </InfoWindow>
      )}
    </GoogleMapComponent>
  );
}
