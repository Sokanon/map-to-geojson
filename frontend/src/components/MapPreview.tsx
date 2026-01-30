import { useEffect, useRef, useCallback, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet-draw';
import { GeoJSON, GeoJSONFeature } from '../types';

interface MapPreviewProps {
  geojson: GeoJSON;
  selectedFeatures: string[];
  onFeatureSelect: (zoneId: string, multiSelect: boolean) => void;
  onFeatureDelete: (zoneIds: string[]) => void;
  onFeatureUpdate: (zoneId: string, geometry: GeoJSONFeature['geometry']) => void;
  onNewPolygon: (geometry: GeoJSONFeature['geometry']) => void;
}

function MapPreview({
  geojson,
  selectedFeatures,
  onFeatureSelect,
  onFeatureDelete,
  onFeatureUpdate,
  onNewPolygon,
}: MapPreviewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  const featureLayersRef = useRef<Map<string, L.Polygon>>(new Map());

  const isPixelCoords = useMemo(
    () => geojson.metadata?.coordinate_system === 'pixel',
    [geojson]
  );

  const bounds = useMemo(() => {
    if (!geojson.features.length) return null;

    if (isPixelCoords && geojson.metadata) {
      // For pixel coordinates, create bounds from image dimensions
      return L.latLngBounds(
        [0, 0],
        [geojson.metadata.image_height, geojson.metadata.image_width]
      );
    }

    // For geo coordinates, compute from features
    let minLat = Infinity,
      maxLat = -Infinity,
      minLng = Infinity,
      maxLng = -Infinity;

    geojson.features.forEach((feature) => {
      feature.geometry.coordinates[0].forEach(([lng, lat]) => {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
      });
    });

    return L.latLngBounds([minLat, minLng], [maxLat, maxLng]);
  }, [geojson, isPixelCoords]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      crs: isPixelCoords ? L.CRS.Simple : L.CRS.EPSG3857,
      minZoom: -5,
      maxZoom: 10,
    });

    if (!isPixelCoords) {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
    }

    const layerGroup = L.layerGroup().addTo(map);
    layerGroupRef.current = layerGroup;

    // Add draw control
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
        },
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false,
      },
      edit: false,
    });

    map.addControl(drawControl);
    drawControlRef.current = drawControl;

    // Handle new polygon creation
    map.on(L.Draw.Event.CREATED, (e: L.LeafletEvent) => {
      const layer = (e as L.DrawEvents.Created).layer as L.Polygon;
      const latLngs = layer.getLatLngs()[0] as L.LatLng[];

      const coordinates = latLngs.map((ll) => {
        if (isPixelCoords) {
          return [ll.lng, ll.lat];
        }
        return [ll.lng, ll.lat];
      });

      // Close the polygon
      if (coordinates.length > 0) {
        coordinates.push([...coordinates[0]]);
      }

      onNewPolygon({
        type: 'Polygon',
        coordinates: [coordinates],
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [isPixelCoords, onNewPolygon]);

  // Update features on the map
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    // Clear existing layers
    layerGroup.clearLayers();
    featureLayersRef.current.clear();

    // Add features
    geojson.features.forEach((feature) => {
      const coords = feature.geometry.coordinates[0];
      const latLngs: L.LatLngExpression[] = coords.map(([lng, lat]) => {
        if (isPixelCoords) {
          // For pixel coords, y is lat, x is lng in Simple CRS
          return [lat, lng] as [number, number];
        }
        return [lat, lng] as [number, number];
      });

      const isSelected = selectedFeatures.includes(feature.properties.zone_id);

      const polygon = L.polygon(latLngs, {
        color: isSelected ? '#e94560' : '#3388ff',
        weight: isSelected ? 3 : 2,
        fillOpacity: isSelected ? 0.5 : 0.3,
        fillColor: isSelected ? '#e94560' : '#3388ff',
      });

      polygon.bindTooltip(feature.properties.zone_id, {
        permanent: false,
        direction: 'center',
      });

      polygon.on('click', (e: L.LeafletMouseEvent) => {
        const multiSelect = e.originalEvent.ctrlKey || e.originalEvent.metaKey;
        onFeatureSelect(feature.properties.zone_id, multiSelect);
      });

      polygon.addTo(layerGroup);
      featureLayersRef.current.set(feature.properties.zone_id, polygon);
    });

    // Fit bounds
    if (bounds) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [geojson, selectedFeatures, isPixelCoords, bounds, onFeatureSelect]);

  // Update selected feature styles
  useEffect(() => {
    featureLayersRef.current.forEach((layer, zoneId) => {
      const isSelected = selectedFeatures.includes(zoneId);
      layer.setStyle({
        color: isSelected ? '#e94560' : '#3388ff',
        weight: isSelected ? 3 : 2,
        fillOpacity: isSelected ? 0.5 : 0.3,
        fillColor: isSelected ? '#e94560' : '#3388ff',
      });
    });
  }, [selectedFeatures]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedFeatures.length > 0) {
      onFeatureDelete(selectedFeatures);
    }
  }, [selectedFeatures, onFeatureDelete]);

  const handleZoomToSelected = useCallback(() => {
    const map = mapRef.current;
    if (!map || selectedFeatures.length === 0) return;

    const layers = selectedFeatures
      .map((id) => featureLayersRef.current.get(id))
      .filter((l): l is L.Polygon => l !== undefined);

    if (layers.length > 0) {
      const group = L.featureGroup(layers);
      map.fitBounds(group.getBounds(), { padding: [50, 50] });
    }
  }, [selectedFeatures]);

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <div ref={mapContainerRef} style={{ height: '100%' }} />

      <div className="toolbar">
        <button
          className="btn btn-secondary"
          onClick={handleZoomToSelected}
          disabled={selectedFeatures.length === 0}
          title="Zoom to selected"
        >
          Zoom
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleDeleteSelected}
          disabled={selectedFeatures.length === 0}
          title="Delete selected"
          style={{ color: selectedFeatures.length > 0 ? '#ef4444' : undefined }}
        >
          Delete
        </button>
      </div>

      <div className="info-panel">
        <h4>Map Preview</h4>
        <p>{geojson.features.length} polygons</p>
        <p>
          Coordinates:{' '}
          {isPixelCoords ? 'Pixel' : geojson.metadata?.coordinate_system}
        </p>
        {selectedFeatures.length > 0 && (
          <p>{selectedFeatures.length} selected</p>
        )}
        <p style={{ marginTop: '0.5rem', color: '#888' }}>
          Click to select. Ctrl+Click for multi-select.
        </p>
      </div>
    </div>
  );
}

export default MapPreview;
