import { useCallback, useRef, useState } from 'react';

interface ImageUploadProps {
  onUpload: (imageData: string, width: number, height: number) => void;
  disabled?: boolean;
}

function ImageUpload({ onUpload, disabled }: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      // For local files, read directly
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          onUpload(result, img.width, img.height);
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
    },
    [onUpload]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <>
      <div
        className={`file-drop ${isDragging ? 'active' : ''}`}
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <p>Drop image here or click to browse</p>
        <p style={{ fontSize: '0.7rem', color: '#666' }}>
          Supports PNG, JPG, PDF
        </p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="file-input"
        accept="image/png,image/jpeg,image/jpg,application/pdf"
        onChange={handleFileChange}
        disabled={disabled}
      />
    </>
  );
}

export default ImageUpload;
