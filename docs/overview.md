# Map to GeoJSON - Product Overview

## What It Is

A web-based tool for digitizing map images (masterplans, floor plans, zoning maps) into structured vector data (GeoJSON/TopoJSON). Point, click, extract — no GIS expertise required.

## The Problem It Solves

Organizations have thousands of static map images (PDFs, PNGs) containing valuable spatial data locked in pixels. Currently, extracting this data requires:
- Expensive GIS software (ArcGIS: $1,500+/year)
- Steep learning curves (QGIS: weeks of training)
- Manual tracing (hours per map)
- GIS specialists ($80-150/hr)

## Core Features

### Smart Region Selection
- **Boundary Color Mode**: Click inside zones bounded by lines (grey borders, black outlines) — the algorithm respects color boundaries
- **Color Tolerance Mode**: Traditional flood-fill for solid-colored regions
- Automatic overlap detection prevents duplicate selections

### AI-Powered OCR
- Dual engine support: Tesseract (local) + Google Gemini 2.0 (AI vision)
- Extracts text labels automatically from selected regions
- Multiple preprocessing strategies for poor image quality
- Confidence scoring for quality assurance

### Interactive Editing
- Drag vertices to refine polygon boundaries
- Edit labels manually
- Organize units into collections
- Bulk operations (select all, delete, assign collection)

### Professional Export
- GeoJSON (standard GIS interchange format)
- TopoJSON (optimized for web, grouped by collection)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Tailwind v4, shadcn/ui |
| Backend | FastAPI (Python), OpenCV, Shapely |
| OCR | Tesseract, Google Gemini 2.0 |
| Deployment | Docker, docker-compose |

## Target Users

1. **Real Estate Developers** — Digitizing masterplans for property management systems
2. **Urban Planners** — Converting zoning maps for GIS analysis
3. **Architects** — Extracting room data from floor plans
4. **Property Managers** — Creating interactive unit maps
5. **GIS Analysts** — Accelerating digitization workflows

## Competitive Positioning

| Feature | This Tool | QGIS | Bunting Labs | Manual Tracing |
|---------|-----------|------|--------------|----------------|
| Learning Curve | Minutes | Weeks | Hours | None |
| AI OCR | Yes | No | Yes | No |
| Price Point | TBD | Free | Enterprise | Labor cost |
| Deployment | Web/Self-host | Desktop | Cloud | N/A |
| Boundary-aware selection | Yes | No | Unknown | N/A |

## Key Differentiators

1. **Boundary Color Mode** — Unique flood-fill algorithm that respects color boundaries (perfect for masterplans with grey/black zone dividers)
2. **Instant OCR** — Click a zone, get the label automatically
3. **Zero GIS Knowledge Required** — No coordinate systems, projections, or layer management
4. **Self-Hostable** — Run on-premise for sensitive documents
5. **Modern UX** — Built for 2024, not 1994
