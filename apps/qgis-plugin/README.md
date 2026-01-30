# Map to GeoJSON - QGIS Plugin

Extract polygons from colored map images with stable, deterministic zone IDs.

## Installation

### Requirements
- QGIS 3.22+
- Python packages: `opencv-python-headless`, `numpy`, `scipy`

### Install Dependencies

In QGIS Python console or OSGeo4W shell:
```bash
pip install opencv-python-headless numpy scipy
```

### Install Plugin

1. Copy the `map_to_geojson` folder to your QGIS plugins directory:
   - **Linux**: `~/.local/share/QGIS/QGIS3/profiles/default/python/plugins/`
   - **Windows**: `C:\Users\{USER}\AppData\Roaming\QGIS\QGIS3\profiles\default\python\plugins\`
   - **macOS**: `~/Library/Application Support/QGIS/QGIS3/profiles/default/python/plugins/`

2. Restart QGIS

3. Enable the plugin: **Plugins → Manage and Install Plugins → Installed → Map to GeoJSON**

## Usage

1. Load a raster image (masterplan, zoning map) into QGIS
2. Optionally georeference it using **Raster → Georeferencer**
3. Run **Raster → Map to GeoJSON**
4. Adjust settings:
   - **Color Clusters**: More = finer detail (8-64)
   - **Min Area %**: Filter small noise polygons
   - **Simplification**: Higher = simpler polygon shapes
5. Click **Extract Polygons**
6. Edit the resulting vector layer with QGIS tools as needed
7. Export: **Right-click layer → Export → Save Features As → GeoJSON**

## Zone ID Assignment

Zone IDs are deterministic based on polygon centroid position:
- Sorted top-to-bottom, then left-to-right
- Format: `ZONE_0001`, `ZONE_0002`, etc.
- Same input + settings = same IDs every time

## Workflow Tips

1. **Georeferencing**: Use QGIS Georeferencer for accurate real-world coordinates before extraction
2. **Cropping**: Crop your raster to exclude legends/margins before extraction
3. **Editing**: Use QGIS digitizing tools to clean up extracted polygons
4. **Merging**: Select polygons → **Edit → Merge Selected Features**
5. **Splitting**: Use **Edit → Split Features** for manual adjustments
