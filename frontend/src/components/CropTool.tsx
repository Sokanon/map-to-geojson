import { useState, useCallback, useRef, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { CropArea } from '../types';

interface CropToolProps {
  imageData: string;
  crop: CropArea | null;
  onCropChange: (crop: CropArea | null) => void;
}

function CropTool({ imageData, crop, onCropChange }: CropToolProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [reactCrop, setReactCrop] = useState<Crop | undefined>(
    crop
      ? {
          unit: 'px',
          x: crop.x,
          y: crop.y,
          width: crop.width,
          height: crop.height,
        }
      : undefined
  );

  const handleCropChange = useCallback(
    (_crop: Crop, pixelCrop: PixelCrop) => {
      setReactCrop(_crop);

      if (pixelCrop.width > 0 && pixelCrop.height > 0) {
        onCropChange({
          x: Math.round(pixelCrop.x),
          y: Math.round(pixelCrop.y),
          width: Math.round(pixelCrop.width),
          height: Math.round(pixelCrop.height),
        });
      } else {
        onCropChange(null);
      }
    },
    [onCropChange]
  );

  // Scale crop coordinates when image loads
  useEffect(() => {
    if (crop && imgRef.current) {
      const img = imgRef.current;
      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;

      setReactCrop({
        unit: 'px',
        x: crop.x / scaleX,
        y: crop.y / scaleY,
        width: crop.width / scaleX,
        height: crop.height / scaleY,
      });
    }
  }, [crop]);

  return (
    <div className="crop-container">
      <ReactCrop
        crop={reactCrop}
        onChange={handleCropChange}
        minWidth={50}
        minHeight={50}
      >
        <img
          ref={imgRef}
          src={imageData}
          alt="Map to crop"
          style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 150px)' }}
        />
      </ReactCrop>
    </div>
  );
}

export default CropTool;
