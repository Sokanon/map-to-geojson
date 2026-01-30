# Map to GeoJSON Converter

A tool for converting static masterplan map images into vector polygons (GeoJSON/TopoJSON) with stable, deterministic zone IDs.

## Features

- **Image Upload**: Supports PNG, JPG, and PDF files
- **Cropping**: Select the map area to exclude legends and margins
- **Georeferencing**: Optional bounding box coordinates for real-world positioning
- **Polygon Extraction**: Automated extraction using color segmentation
- **Leaflet Preview**: Interactive map preview with polygon selection and editing
- **Stable IDs**: Deterministic zone IDs based on centroid position (ZONE_0001, ZONE_0002, etc.)
- **Export**: GeoJSON and TopoJSON export formats

## Quick Start

### Prerequisites

- Python 3.9+
- Node.js 18+
- npm or yarn

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The application will be available at `http://localhost:3000`

## Usage

1. **Upload Image**: Drop a map image (PNG/JPG/PDF) into the upload area
2. **Crop (Optional)**: Draw a rectangle to select just the map area
3. **Georeference (Optional)**: Enter bounding box coordinates if you need real-world coordinates
4. **Extract Polygons**: Adjust settings and click "Extract Polygons"
5. **Preview & Edit**: Review polygons in the Leaflet preview
   - Click to select polygons
   - Ctrl+Click for multi-select
   - Delete or merge selected polygons
6. **Export**: Download as GeoJSON or TopoJSON

## Extraction Settings

- **Min Area (%)**: Minimum polygon size as percentage of image area (filters noise)
- **Simplification**: Douglas-Peucker simplification tolerance (higher = simpler shapes)
- **Color Clusters**: Number of distinct colors to segment (more clusters = finer detail)
- **Fill Holes**: Fill internal holes in polygons
- **Smooth Contours**: Apply contour smoothing

## Zone ID Rules

- Format: `ZONE_0001`, `ZONE_0002`, etc.
- **Deterministic**: Same input + settings = same IDs
- **Sorted by position**: Top-to-bottom, then left-to-right by centroid
- **Stable on edit**: Geometry changes keep the same ID
- **New on merge**: Merged polygons get a new ID
- **Retired on delete**: Deleted IDs are never reused

## Output Format

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "zone_id": "ZONE_0001" },
      "geometry": { "type": "Polygon", "coordinates": [...] }
    }
  ]
}
```

## Tech Stack

- **Backend**: Python, FastAPI, OpenCV, NumPy, Shapely
- **Frontend**: React, TypeScript, Vite, Leaflet, react-image-crop

## Development

### API Endpoints

- `POST /api/upload` - Upload and validate image
- `POST /api/process` - Process image and extract polygons
- `GET /api/health` - Health check

### Project Structure

```
map-to-geojson/
├── backend/
│   ├── main.py           # FastAPI application
│   └── requirements.txt  # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── types/        # TypeScript types
│   │   ├── App.tsx       # Main application
│   │   └── main.tsx      # Entry point
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## License

MIT
