"""
Map to GeoJSON - QGIS Plugin
Extract polygons from colored map images with stable zone IDs
"""


def classFactory(iface):
    from .plugin import MapToGeoJSONPlugin
    return MapToGeoJSONPlugin(iface)
