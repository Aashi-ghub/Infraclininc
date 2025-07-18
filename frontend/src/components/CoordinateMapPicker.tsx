import { useState, useEffect } from 'react';
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
  initialLat?: number;
  initialLng?: number;
  onCoordinateChange: (lat: number, lng: number) => void;
  className?: string;
}

export function CoordinateMapPicker({ 
  initialLat = 0, 
  initialLng = 0, 
  onCoordinateChange, 
  className 
}: CoordinateMapPickerProps) {
  const [position, setPosition] = useState<[number, number]>([initialLat || 0, initialLng || 0]);
  const [inputLat, setInputLat] = useState(initialLat?.toString() || '');
  const [inputLng, setInputLng] = useState(initialLng?.toString() || '');
  const [isLoading, setIsLoading] = useState(false);
  const [mapElement, setMapElement] = useState<HTMLDivElement | null>(null);
  const [leafletMap, setLeafletMap] = useState<L.Map | null>(null);
  const [marker, setMarker] = useState<L.Marker | null>(null);

  // Initialize the map when the element is available
  useEffect(() => {
    if (!mapElement) return;

    // Create map instance
    const map = L.map(mapElement).setView(position, 13);
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Add marker if coordinates are valid
    let mapMarker: L.Marker | null = null;
    if (position[0] !== 0 || position[1] !== 0) {
      mapMarker = L.marker(position).addTo(map);
      setMarker(mapMarker);
    }
    
    // Add click handler
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      const roundedLat = Number(lat.toFixed(6));
      const roundedLng = Number(lng.toFixed(6));
      
      setPosition([roundedLat, roundedLng]);
      setInputLat(roundedLat.toString());
      setInputLng(roundedLng.toString());
      onCoordinateChange(roundedLat, roundedLng);
      
      // Update marker
      if (mapMarker) {
        mapMarker.setLatLng([roundedLat, roundedLng]);
      } else {
        mapMarker = L.marker([roundedLat, roundedLng]).addTo(map);
        setMarker(mapMarker);
      }
    });
    
    // Save map instance
    setLeafletMap(map);
    
    // Cleanup
    return () => {
      map.remove();
      setLeafletMap(null);
      setMarker(null);
    };
  }, [mapElement, onCoordinateChange]);
  
  // Update map when position changes from outside
  useEffect(() => {
    if (!leafletMap) return;
    
    leafletMap.setView(position, leafletMap.getZoom());
    
    // Update marker
    if (marker) {
      marker.setLatLng(position);
    } else if (position[0] !== 0 || position[1] !== 0) {
      const newMarker = L.marker(position).addTo(leafletMap);
      setMarker(newMarker);
    }
  }, [position, leafletMap, marker]);

  // Update position from initial props
  useEffect(() => {
    if (initialLat && initialLng) {
      setPosition([initialLat, initialLng]);
      setInputLat(initialLat.toString());
      setInputLng(initialLng.toString());
    }
  }, [initialLat, initialLng]);

  const handleInputChange = () => {
    const newLat = parseFloat(inputLat);
    const newLng = parseFloat(inputLng);
    
    if (!isNaN(newLat) && !isNaN(newLng) && 
        newLat >= -90 && newLat <= 90 && 
        newLng >= -180 && newLng <= 180) {
      setPosition([newLat, newLng]);
      onCoordinateChange(newLat, newLng);
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
        onCoordinateChange(roundedLat, roundedLng);
        
        // Update map view
        if (leafletMap) {
          leafletMap.setView([roundedLat, roundedLng], 15);
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
          ref={setMapElement}
        />

        <p className="text-sm text-muted-foreground">
          Click on the map to select coordinates, or enter them manually above.
        </p>
      </CardContent>
    </Card>
  );
}