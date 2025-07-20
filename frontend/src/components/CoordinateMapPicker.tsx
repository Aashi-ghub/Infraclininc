import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Navigation } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

interface CoordinateMapPickerProps {
  value?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  onChange: (value: { type: 'Point'; coordinates: [number, number] }) => void;
  className?: string;
}

export function CoordinateMapPicker({ 
  value, 
  onChange, 
  className 
}: CoordinateMapPickerProps) {
  console.log('CoordinateMapPicker props:', { value, onChange: typeof onChange, className });
  
  // Safety check for onChange
  if (typeof onChange !== 'function') {
    console.error('CoordinateMapPicker: onChange is not a function:', onChange);
    return <div>Error: Invalid onChange prop</div>;
  }
  
  // Extract longitude and latitude from the value (note the order: [longitude, latitude])
  const initialLng = value?.coordinates?.[0] || 0;
  const initialLat = value?.coordinates?.[1] || 0;
  
  const [position, setPosition] = useState<[number, number]>([initialLat, initialLng]);
  const [inputLat, setInputLat] = useState(initialLat.toString());
  const [inputLng, setInputLng] = useState(initialLng.toString());
  const [isLoading, setIsLoading] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Initialize the map when the element is available
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Use a small timeout to ensure the DOM is fully rendered
    const initMap = setTimeout(() => {
      try {
        // Create map instance
        const map = L.map(mapContainerRef.current!).setView([initialLat, initialLng], 13);
        
        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        // Add marker if coordinates are valid
        if (initialLat !== 0 || initialLng !== 0) {
          markerRef.current = L.marker([initialLat, initialLng]).addTo(map);
        }
        
        // Add click handler
        map.on('click', (e) => {
          const { lat, lng } = e.latlng;
          const roundedLat = Number(lat.toFixed(6));
          const roundedLng = Number(lng.toFixed(6));
          
          setPosition([roundedLat, roundedLng]);
          setInputLat(roundedLat.toString());
          setInputLng(roundedLng.toString());
          
          // Update with GeoJSON Point format (note the order: [longitude, latitude])
          onChange({
            type: 'Point',
            coordinates: [roundedLng, roundedLat]
          });
          
          // Update marker
          if (markerRef.current) {
            markerRef.current.setLatLng([roundedLat, roundedLng]);
          } else {
            markerRef.current = L.marker([roundedLat, roundedLng]).addTo(map);
          }
        });
        
        // Save map instance
        mapRef.current = map;
        setIsMapReady(true);
        
        // Invalidate size to handle any container resizing issues
        setTimeout(() => {
          map.invalidateSize();
        }, 100);
      } catch (error) {
        console.error("Error initializing map:", error);
      }
    }, 300);
    
    // Cleanup
    return () => {
      clearTimeout(initMap);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
    };
  }, [initialLat, initialLng, onChange]);
  
  // Update map when position changes from outside
  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;
    
    try {
      mapRef.current.setView(position, mapRef.current.getZoom());
      
      // Update marker
      if (markerRef.current) {
        markerRef.current.setLatLng(position);
      } else if (position[0] !== 0 || position[1] !== 0) {
        markerRef.current = L.marker(position).addTo(mapRef.current);
      }
    } catch (error) {
      console.error("Error updating map position:", error);
    }
  }, [position, isMapReady]);

  // Update position from value prop
  useEffect(() => {
    if (value?.coordinates) {
      // Note: value.coordinates is [longitude, latitude] but we need [latitude, longitude] for the map
      const lng = value.coordinates[0];
      const lat = value.coordinates[1];
      setPosition([lat, lng]);
      setInputLat(lat.toString());
      setInputLng(lng.toString());
    }
  }, [value]);

  const handleInputChange = () => {
    const newLat = parseFloat(inputLat);
    const newLng = parseFloat(inputLng);
    
    if (!isNaN(newLat) && !isNaN(newLng) && 
        newLat >= -90 && newLat <= 90 && 
        newLng >= -180 && newLng <= 180) {
      setPosition([newLat, newLng]);
      
      // Update with GeoJSON Point format (note the order: [longitude, latitude])
      onChange({
        type: 'Point',
        coordinates: [newLng, newLat]
      });
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      return;
    }

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const roundedLat = Number(latitude.toFixed(6));
        const roundedLng = Number(longitude.toFixed(6));
        
        setPosition([roundedLat, roundedLng]);
        setInputLat(roundedLat.toString());
        setInputLng(roundedLng.toString());
        
        // Update with GeoJSON Point format (note the order: [longitude, latitude])
        onChange({
          type: 'Point',
          coordinates: [roundedLng, roundedLat]
        });
        
        // Update map view if map is ready
        if (mapRef.current && isMapReady) {
          try {
            mapRef.current.setView([roundedLat, roundedLng], 15);
          } catch (error) {
            console.error("Error updating map view:", error);
          }
        }
        
        setIsLoading(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to retrieve your location.');
        setIsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Coordinate Picker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Manual input fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="latitude">Latitude</Label>
            <Input
              id="latitude"
              type="number"
              step="any"
              value={inputLat}
              onChange={(e) => setInputLat(e.target.value)}
              onBlur={handleInputChange}
              placeholder="e.g., 40.7128"
              min="-90"
              max="90"
            />
          </div>
          <div>
            <Label htmlFor="longitude">Longitude</Label>
            <Input
              id="longitude"
              type="number"
              step="any"
              value={inputLng}
              onChange={(e) => setInputLng(e.target.value)}
              onBlur={handleInputChange}
              placeholder="e.g., -74.0060"
              min="-180"
              max="180"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              onClick={getCurrentLocation}
              disabled={isLoading}
              className="w-full"
            >
              <Navigation className="h-4 w-4 mr-2" />
              {isLoading ? 'Getting...' : 'Use My Location'}
            </Button>
          </div>
        </div>

        {/* Map */}
        <div 
          className="h-[300px] border rounded-lg overflow-hidden"
          ref={mapContainerRef}
        />

        <p className="text-sm text-muted-foreground">
          Click on the map to select coordinates, or enter them manually above.
        </p>
      </CardContent>
    </Card>
  );
}