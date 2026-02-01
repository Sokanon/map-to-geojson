import { useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
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

  const handleModeChange = useCallback((value: string) => {
    setUseBoundaryMode(value === 'boundary');
  }, [setUseBoundaryMode]);

  const handleOcrEngineChange = useCallback(
    (value: string) => {
      setOcrEngine(value as 'tesseract' | 'ai');
    },
    [setOcrEngine]
  );

  const handleAiModelChange = useCallback(
    (value: string) => {
      setAiModel(value);
    },
    [setAiModel]
  );

  if (!imageData) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* Selection Mode */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Selection Mode</Label>
        <Select value={useBoundaryMode ? 'boundary' : 'tolerance'} onValueChange={handleModeChange}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="boundary">Boundary Color</SelectItem>
            <SelectItem value="tolerance">Color Tolerance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {useBoundaryMode ? (
        <>
          {/* Boundary Color Picker */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <Label className="text-xs text-muted-foreground">Boundary Color</Label>
              <span className="text-xs text-muted-foreground font-mono uppercase">{boundaryColor}</span>
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={boundaryColor}
                onChange={handleBoundaryColorChange}
                className="w-10 h-8"
              />
              <Input
                type="text"
                value={boundaryColor}
                onChange={handleBoundaryColorChange}
                className="flex-1 h-8 font-mono text-xs uppercase"
                pattern="^#[0-9A-Fa-f]{6}$"
              />
            </div>
          </div>

          {/* Boundary Tolerance */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <Label className="text-xs text-muted-foreground">Boundary Tolerance</Label>
              <span className="text-xs text-muted-foreground">{boundaryTolerance}</span>
            </div>
            <Slider
              value={[boundaryTolerance]}
              onValueChange={(value) => setBoundaryTolerance(value[0])}
              min={1}
              max={50}
              step={1}
            />
          </div>
        </>
      ) : (
        /* Color Tolerance (classic mode) */
        <div className="flex flex-col gap-1">
          <div className="flex justify-between">
            <Label className="text-xs text-muted-foreground">Color Tolerance</Label>
            <span className="text-xs text-muted-foreground">{tolerance}</span>
          </div>
          <Slider
            value={[tolerance]}
            onValueChange={(value) => setTolerance(value[0])}
            min={1}
            max={100}
            step={1}
          />
        </div>
      )}

      {/* OCR Settings Divider */}
      <Separator className="my-1" />

      {/* OCR Engine Selector */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">OCR Engine</Label>
        <Select value={ocrEngine} onValueChange={handleOcrEngineChange}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ai">AI (Recommended)</SelectItem>
            <SelectItem value="tesseract">Tesseract</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* AI Model Selector - only shown when AI is selected */}
      {ocrEngine === 'ai' && (
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">AI Model</Label>
          <Select value={aiModel} onValueChange={handleAiModelChange}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="google/gemini-2.0-flash-001">Gemini 2.0 Flash</SelectItem>
              <SelectItem value="google/gemini-2.0-flash-lite-001">Gemini 2.0 Flash Lite</SelectItem>
              <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

export default Toolbar;
