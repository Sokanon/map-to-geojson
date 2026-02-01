import { useCallback } from 'react';
import { useDigitizerStore } from '../stores/digitizerStore';

function Toolbar() {
  const {
    useBoundaryMode,
    boundaryColor,
    boundaryTolerance,
    tolerance,
    ocrEngine,
    aiModel,
    setUseBoundaryMode,
    setBoundaryColor,
    setBoundaryTolerance,
    setTolerance,
    setOcrEngine,
    setAiModel,
    imageData,
  } = useDigitizerStore();

  const handleBoundaryColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setBoundaryColor(e.target.value);
    },
    [setBoundaryColor]
  );

  const handleBoundaryToleranceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setBoundaryTolerance(parseInt(e.target.value, 10));
    },
    [setBoundaryTolerance]
  );

  const handleToleranceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTolerance(parseInt(e.target.value, 10));
    },
    [setTolerance]
  );

  const handleModeToggle = useCallback(() => {
    setUseBoundaryMode(!useBoundaryMode);
  }, [useBoundaryMode, setUseBoundaryMode]);

  const handleOcrEngineChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setOcrEngine(e.target.value as 'tesseract' | 'ai');
    },
    [setOcrEngine]
  );

  const handleAiModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setAiModel(e.target.value);
    },
    [setAiModel]
  );

  if (!imageData) return null;

  return (
    <div className="toolbar-panel">
      {/* Mode Toggle */}
      <div className="mode-toggle">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={useBoundaryMode}
            onChange={handleModeToggle}
          />
          <span className="toggle-text">
            {useBoundaryMode ? 'Boundary Color Mode' : 'Tolerance Mode'}
          </span>
        </label>
      </div>

      {useBoundaryMode ? (
        <>
          {/* Boundary Color Picker */}
          <div className="color-picker-group">
            <label>
              <span>Boundary Color</span>
              <span className="color-value">{boundaryColor}</span>
            </label>
            <div className="color-picker-row">
              <input
                type="color"
                value={boundaryColor}
                onChange={handleBoundaryColorChange}
                className="color-input"
              />
              <input
                type="text"
                value={boundaryColor}
                onChange={handleBoundaryColorChange}
                className="color-text-input"
                pattern="^#[0-9A-Fa-f]{6}$"
              />
            </div>
          </div>

          {/* Boundary Tolerance */}
          <div className="slider-group">
            <label>
              <span>Boundary Tolerance</span>
              <span>{boundaryTolerance}</span>
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={boundaryTolerance}
              onChange={handleBoundaryToleranceChange}
            />
          </div>
        </>
      ) : (
        /* Color Tolerance (classic mode) */
        <div className="slider-group">
          <label>
            <span>Color Tolerance</span>
            <span>{tolerance}</span>
          </label>
          <input
            type="range"
            min="1"
            max="100"
            value={tolerance}
            onChange={handleToleranceChange}
          />
        </div>
      )}

      {/* OCR Settings Divider */}
      <div className="toolbar-divider" />

      {/* OCR Engine Selector */}
      <div className="select-group">
        <label>
          <span>OCR Engine</span>
        </label>
        <select value={ocrEngine} onChange={handleOcrEngineChange}>
          <option value="ai">AI (Recommended)</option>
          <option value="tesseract">Tesseract</option>
        </select>
      </div>

      {/* AI Model Selector - only shown when AI is selected */}
      {ocrEngine === 'ai' && (
        <div className="select-group">
          <label>
            <span>AI Model</span>
          </label>
          <select value={aiModel} onChange={handleAiModelChange}>
            <option value="google/gemini-2.0-flash-001">Gemini 2.0 Flash</option>
            <option value="google/gemini-2.0-flash-lite-001">Gemini 2.0 Flash Lite</option>
            <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
          </select>
        </div>
      )}
    </div>
  );
}

export default Toolbar;
