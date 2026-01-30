"""
Map to GeoJSON - QGIS Plugin
Main plugin class and UI
"""

import os
from qgis.PyQt.QtCore import Qt
from qgis.PyQt.QtWidgets import (
    QAction, QDialog, QVBoxLayout, QHBoxLayout, QLabel,
    QComboBox, QSpinBox, QDoubleSpinBox, QCheckBox,
    QPushButton, QProgressBar, QGroupBox, QMessageBox
)
from qgis.PyQt.QtGui import QIcon
from qgis.core import (
    QgsProject, QgsVectorLayer, QgsFeature, QgsGeometry,
    QgsField, QgsFields, QgsWkbTypes, QgsCoordinateReferenceSystem,
    QgsRasterLayer, QgsPointXY
)
from qgis.core import QgsVectorFileWriter
from PyQt5.QtCore import QVariant

try:
    import cv2
    import numpy as np
    from scipy import ndimage
    HAS_CV = True
except ImportError:
    HAS_CV = False


class MapToGeoJSONPlugin:
    """Main plugin class"""

    def __init__(self, iface):
        self.iface = iface
        self.plugin_dir = os.path.dirname(__file__)
        self.action = None

    def initGui(self):
        """Initialize plugin GUI"""
        icon_path = os.path.join(self.plugin_dir, 'icon.png')
        icon = QIcon(icon_path) if os.path.exists(icon_path) else QIcon()

        self.action = QAction(icon, 'Map to GeoJSON', self.iface.mainWindow())
        self.action.triggered.connect(self.run)
        self.action.setStatusTip('Extract polygons from colored map images')

        self.iface.addToolBarIcon(self.action)
        self.iface.addPluginToRasterMenu('&Map to GeoJSON', self.action)

    def unload(self):
        """Cleanup on plugin unload"""
        self.iface.removePluginRasterMenu('&Map to GeoJSON', self.action)
        self.iface.removeToolBarIcon(self.action)

    def run(self):
        """Show the plugin dialog"""
        if not HAS_CV:
            QMessageBox.critical(
                self.iface.mainWindow(),
                'Missing Dependencies',
                'This plugin requires OpenCV and NumPy.\n\n'
                'Install with: pip install opencv-python-headless numpy scipy'
            )
            return

        dialog = MapToGeoJSONDialog(self.iface)
        dialog.exec_()


class MapToGeoJSONDialog(QDialog):
    """Plugin dialog for extraction settings"""

    def __init__(self, iface):
        super().__init__(iface.mainWindow())
        self.iface = iface
        self.setWindowTitle('Map to GeoJSON - Extract Zones')
        self.setMinimumWidth(400)
        self.setup_ui()
        self.populate_layers()

    def setup_ui(self):
        """Build the dialog UI"""
        layout = QVBoxLayout()

        # Layer selection
        layer_group = QGroupBox('Input')
        layer_layout = QVBoxLayout()

        layer_row = QHBoxLayout()
        layer_row.addWidget(QLabel('Raster Layer:'))
        self.layer_combo = QComboBox()
        layer_row.addWidget(self.layer_combo)
        layer_layout.addLayout(layer_row)

        layer_group.setLayout(layer_layout)
        layout.addWidget(layer_group)

        # Extraction settings
        settings_group = QGroupBox('Extraction Settings')
        settings_layout = QVBoxLayout()

        # Color clusters
        clusters_row = QHBoxLayout()
        clusters_row.addWidget(QLabel('Color Clusters:'))
        self.clusters_spin = QSpinBox()
        self.clusters_spin.setRange(8, 64)
        self.clusters_spin.setValue(32)
        self.clusters_spin.setToolTip('Number of color groups for segmentation (more = finer detail)')
        clusters_row.addWidget(self.clusters_spin)
        settings_layout.addLayout(clusters_row)

        # Min area
        area_row = QHBoxLayout()
        area_row.addWidget(QLabel('Min Area (%):'))
        self.area_spin = QDoubleSpinBox()
        self.area_spin.setRange(0.01, 10.0)
        self.area_spin.setValue(0.1)
        self.area_spin.setSingleStep(0.05)
        self.area_spin.setToolTip('Minimum polygon size as % of image (filters noise)')
        area_row.addWidget(self.area_spin)
        settings_layout.addLayout(area_row)

        # Simplification
        simplify_row = QHBoxLayout()
        simplify_row.addWidget(QLabel('Simplification:'))
        self.simplify_spin = QDoubleSpinBox()
        self.simplify_spin.setRange(0.0, 20.0)
        self.simplify_spin.setValue(2.0)
        self.simplify_spin.setSingleStep(0.5)
        self.simplify_spin.setToolTip('Douglas-Peucker tolerance (higher = simpler shapes)')
        simplify_row.addWidget(self.simplify_spin)
        settings_layout.addLayout(simplify_row)

        # Checkboxes
        self.fill_holes_check = QCheckBox('Fill holes in polygons')
        self.fill_holes_check.setChecked(True)
        settings_layout.addWidget(self.fill_holes_check)

        self.smooth_check = QCheckBox('Smooth contours')
        self.smooth_check.setChecked(True)
        settings_layout.addWidget(self.smooth_check)

        settings_group.setLayout(settings_layout)
        layout.addWidget(settings_group)

        # Output settings
        output_group = QGroupBox('Output')
        output_layout = QVBoxLayout()

        self.add_to_map_check = QCheckBox('Add result to map')
        self.add_to_map_check.setChecked(True)
        output_layout.addWidget(self.add_to_map_check)

        output_group.setLayout(output_layout)
        layout.addWidget(output_group)

        # Progress bar
        self.progress = QProgressBar()
        self.progress.setVisible(False)
        layout.addWidget(self.progress)

        # Buttons
        button_row = QHBoxLayout()

        self.extract_btn = QPushButton('Extract Polygons')
        self.extract_btn.clicked.connect(self.run_extraction)
        button_row.addWidget(self.extract_btn)

        cancel_btn = QPushButton('Close')
        cancel_btn.clicked.connect(self.close)
        button_row.addWidget(cancel_btn)

        layout.addLayout(button_row)
        self.setLayout(layout)

    def populate_layers(self):
        """Fill layer combo with raster layers"""
        self.layer_combo.clear()
        for layer in QgsProject.instance().mapLayers().values():
            if isinstance(layer, QgsRasterLayer):
                self.layer_combo.addItem(layer.name(), layer.id())

    def get_selected_layer(self):
        """Get the currently selected raster layer"""
        layer_id = self.layer_combo.currentData()
        if layer_id:
            return QgsProject.instance().mapLayer(layer_id)
        return None

    def run_extraction(self):
        """Execute the polygon extraction"""
        layer = self.get_selected_layer()
        if not layer:
            QMessageBox.warning(self, 'No Layer', 'Please select a raster layer.')
            return

        self.progress.setVisible(True)
        self.progress.setValue(0)
        self.extract_btn.setEnabled(False)

        try:
            # Get settings
            settings = {
                'color_clusters': self.clusters_spin.value(),
                'min_area_percent': self.area_spin.value(),
                'simplify_tolerance': self.simplify_spin.value(),
                'fill_holes': self.fill_holes_check.isChecked(),
                'smooth_contours': self.smooth_check.isChecked(),
            }

            # Run extraction
            features = self.extract_polygons(layer, settings)
            self.progress.setValue(80)

            if not features:
                QMessageBox.warning(self, 'No Results', 'No polygons were extracted.')
                return

            # Create vector layer
            vector_layer = self.create_vector_layer(layer, features)
            self.progress.setValue(100)

            if self.add_to_map_check.isChecked():
                QgsProject.instance().addMapLayer(vector_layer)

            QMessageBox.information(
                self, 'Success',
                f'Extracted {len(features)} polygons with zone IDs.'
            )

        except Exception as e:
            QMessageBox.critical(self, 'Error', f'Extraction failed:\n{str(e)}')

        finally:
            self.progress.setVisible(False)
            self.extract_btn.setEnabled(True)

    def extract_polygons(self, layer, settings):
        """Extract polygons from raster layer using OpenCV"""
        self.progress.setValue(10)

        # Get raster as numpy array
        provider = layer.dataProvider()
        extent = layer.extent()
        width = layer.width()
        height = layer.height()

        # Read raster bands
        block_r = provider.block(1, extent, width, height)
        block_g = provider.block(2, extent, width, height) if provider.bandCount() >= 2 else block_r
        block_b = provider.block(3, extent, width, height) if provider.bandCount() >= 3 else block_r

        # Convert to numpy array
        img = np.zeros((height, width, 3), dtype=np.uint8)
        for y in range(height):
            for x in range(width):
                img[y, x, 2] = block_r.value(y, x)  # BGR order for OpenCV
                img[y, x, 1] = block_g.value(y, x)
                img[y, x, 0] = block_b.value(y, x)

        self.progress.setValue(30)

        # Color segmentation
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        pixels = lab.reshape(-1, 3).astype(np.float32)

        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
        _, labels, _ = cv2.kmeans(
            pixels, settings['color_clusters'], None,
            criteria, 10, cv2.KMEANS_PP_CENTERS
        )
        labels = labels.reshape(height, width)

        self.progress.setValue(50)

        # Extract contours from each color region
        img_area = width * height
        min_area = img_area * (settings['min_area_percent'] / 100)
        kernel = np.ones((3, 3), np.uint8)

        all_polygons = []

        for label_id in np.unique(labels):
            mask = (labels == label_id).astype(np.uint8) * 255

            # Morphological cleanup
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)

            if settings['fill_holes']:
                mask = ndimage.binary_fill_holes(mask).astype(np.uint8) * 255

            # Find contours
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            for contour in contours:
                area = cv2.contourArea(contour)
                if area < min_area:
                    continue

                if settings['smooth_contours']:
                    contour = cv2.approxPolyDP(contour, settings['simplify_tolerance'], True)

                if len(contour) >= 3:
                    all_polygons.append(contour)

        self.progress.setValue(70)

        # Sort by centroid (Y then X) and assign zone IDs
        polygon_data = []
        for contour in all_polygons:
            M = cv2.moments(contour)
            if M['m00'] > 0:
                cx = M['m10'] / M['m00']
                cy = M['m01'] / M['m00']
                polygon_data.append({'contour': contour, 'cx': cx, 'cy': cy})

        polygon_data.sort(key=lambda p: (p['cy'], p['cx']))

        # Convert to QgsFeatures with georeferenced coordinates
        features = []
        for i, data in enumerate(polygon_data, start=1):
            zone_id = f'ZONE_{i:04d}'
            contour = data['contour']

            # Convert pixel coords to geographic coords
            points = []
            for point in contour.squeeze():
                px, py = float(point[0]), float(point[1])
                # Transform pixel to geographic
                geo_x = extent.xMinimum() + (px / width) * extent.width()
                geo_y = extent.yMaximum() - (py / height) * extent.height()
                points.append(QgsPointXY(geo_x, geo_y))

            # Close the polygon
            if points and points[0] != points[-1]:
                points.append(points[0])

            if len(points) >= 4:
                geom = QgsGeometry.fromPolygonXY([points])
                feat = QgsFeature()
                feat.setGeometry(geom)
                feat.setAttributes([zone_id])
                features.append(feat)

        return features

    def create_vector_layer(self, raster_layer, features):
        """Create a vector layer from extracted features"""
        crs = raster_layer.crs()

        # Create memory layer
        layer = QgsVectorLayer(
            f'Polygon?crs={crs.authid()}',
            f'{raster_layer.name()}_zones',
            'memory'
        )

        # Add zone_id field
        provider = layer.dataProvider()
        provider.addAttributes([QgsField('zone_id', QVariant.String)])
        layer.updateFields()

        # Add features
        provider.addFeatures(features)
        layer.updateExtents()

        return layer
