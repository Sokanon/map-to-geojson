import { useCallback } from 'react';
import { useDigitizerStore } from '../stores/digitizerStore';
import { exportToTopoJSON, exportToGeoJSON, downloadFile } from '../utils/topoJsonExport';

function ExportPanel() {
  const { buildings } = useDigitizerStore();

  const handleExportTopoJSON = useCallback(() => {
    const content = exportToTopoJSON(buildings);
    downloadFile(content, 'buildings.json');
  }, [buildings]);

  const handleExportGeoJSON = useCallback(() => {
    const content = exportToGeoJSON(buildings);
    downloadFile(content, 'buildings.geojson');
  }, [buildings]);

  return (
    <div className="export-panel">
      <div className="export-header">
        <span>Export</span>
      </div>
      <div className="export-buttons">
        <button
          className="btn btn-primary btn-full"
          onClick={handleExportTopoJSON}
          disabled={buildings.length === 0}
        >
          Export TopoJSON
        </button>
        <button
          className="btn btn-secondary btn-full"
          onClick={handleExportGeoJSON}
          disabled={buildings.length === 0}
        >
          Export GeoJSON
        </button>
      </div>
    </div>
  );
}

export default ExportPanel;
