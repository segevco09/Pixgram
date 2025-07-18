import React, { useRef, useEffect, useState } from 'react';
import './ImageEditor.css';

const ImageEditor = ({ imageUrl, onSave, onCancel }) => {
  const canvasRef = useRef(null);
  const originalCanvasRef = useRef(null);
  const [currentFilter, setCurrentFilter] = useState('none');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false);
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState('#ff0000');

  useEffect(() => {
    loadImage();
  }, [imageUrl]);

  const loadImage = () => {
    const canvas = canvasRef.current;
    const originalCanvas = originalCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const originalCtx = originalCanvas.getContext('2d');
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      originalCanvas.width = img.width;
      originalCanvas.height = img.height;
      
      ctx.drawImage(img, 0, 0);
      originalCtx.drawImage(img, 0, 0);
    };
    img.src = imageUrl;
  };

  const applyFilter = (filterType) => {
    const canvas = canvasRef.current;
    const originalCanvas = originalCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const originalCtx = originalCanvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(originalCanvas, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    switch (filterType) {
      case 'grayscale':
        for (let i = 0; i < data.length; i += 4) {
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }
        break;
        
      case 'sepia':
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
          data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
          data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
        }
        break;
        
      case 'invert':
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i];
          data[i + 1] = 255 - data[i + 1];
          data[i + 2] = 255 - data[i + 2];
        }
        break;
        
      case 'blur':
        applyBoxBlur(imageData, 3);
        break;
        
      default:
        break;
    }
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, data[i] * (brightness / 100)));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * (brightness / 100)));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * (brightness / 100)));
      
      const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
      data[i] = Math.min(255, Math.max(0, contrastFactor * (data[i] - 128) + 128));
      data[i + 1] = Math.min(255, Math.max(0, contrastFactor * (data[i + 1] - 128) + 128));
      data[i + 2] = Math.min(255, Math.max(0, contrastFactor * (data[i + 2] - 128) + 128));
    }
    
    ctx.putImageData(imageData, 0, 0);
    setCurrentFilter(filterType);
  };

  const applyBoxBlur = (imageData, radius) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        let count = 0;
        
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const idx = (ny * width + nx) * 4;
              r += data[idx];
              g += data[idx + 1];
              b += data[idx + 2];
              a += data[idx + 3];
              count++;
            }
          }
        }
        
        const idx = (y * width + x) * 4;
        data[idx] = r / count;
        data[idx + 1] = g / count;
        data[idx + 2] = b / count;
        data[idx + 3] = a / count;
      }
    }
  };

  const handleMouseDown = (e) => {
    if (!drawingMode) return;
    
    setIsDrawing(true);
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !drawingMode) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = brushColor;
    ctx.lineCap = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    canvas.toBlob((blob) => {
      onSave(blob);
    }, 'image/jpeg', 0.9);
  };

  const resetImage = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setCurrentFilter('none');
    loadImage();
  };

  return (
    <div className="image-editor">
      <div className="editor-header">
        <h3>Edit Image</h3>
        <div className="editor-actions">
          <button onClick={resetImage} className="reset-button">Reset</button>
          <button onClick={onCancel} className="cancel-button">Cancel</button>
          <button onClick={handleSave} className="save-button">Save</button>
        </div>
      </div>
      
      <div className="editor-content">
        <div className="canvas-container">
          <canvas
            ref={canvasRef}
            className="edit-canvas"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{ cursor: drawingMode ? 'crosshair' : 'default' }}
          />
          <canvas ref={originalCanvasRef} style={{ display: 'none' }} />
        </div>
        
        <div className="editor-controls">
          <div className="control-section">
            <h4>Filters</h4>
            <div className="filter-buttons">
              <button 
                onClick={() => applyFilter('none')}
                className={currentFilter === 'none' ? 'active' : ''}
              >
                Original
              </button>
              <button 
                onClick={() => applyFilter('grayscale')}
                className={currentFilter === 'grayscale' ? 'active' : ''}
              >
                Grayscale
              </button>
              <button 
                onClick={() => applyFilter('sepia')}
                className={currentFilter === 'sepia' ? 'active' : ''}
              >
                Sepia
              </button>
              <button 
                onClick={() => applyFilter('invert')}
                className={currentFilter === 'invert' ? 'active' : ''}
              >
                Invert
              </button>
              <button 
                onClick={() => applyFilter('blur')}
                className={currentFilter === 'blur' ? 'active' : ''}
              >
                Blur
              </button>
            </div>
          </div>
          
          <div className="control-section">
            <h4>Adjustments</h4>
            <div className="slider-control">
              <label>Brightness: {brightness}%</label>
              <input
                type="range"
                min="0"
                max="200"
                value={brightness}
                onChange={(e) => {
                  setBrightness(e.target.value);
                  setTimeout(() => applyFilter(currentFilter), 100);
                }}
              />
            </div>
            <div className="slider-control">
              <label>Contrast: {contrast}%</label>
              <input
                type="range"
                min="0"
                max="200"
                value={contrast}
                onChange={(e) => {
                  setContrast(e.target.value);
                  setTimeout(() => applyFilter(currentFilter), 100);
                }}
              />
            </div>
          </div>
          
          <div className="control-section">
            <h4>Drawing Tools</h4>
            <div className="drawing-controls">
              <button 
                onClick={() => setDrawingMode(!drawingMode)}
                className={drawingMode ? 'active' : ''}
              >
                {drawingMode ? 'Exit Draw' : 'Draw Mode'}
              </button>
              
              {drawingMode && (
                <>
                  <div className="brush-controls">
                    <label>Brush Size: {brushSize}px</label>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={brushSize}
                      onChange={(e) => setBrushSize(e.target.value)}
                    />
                  </div>
                  <div className="color-control">
                    <label>Color:</label>
                    <input
                      type="color"
                      value={brushColor}
                      onChange={(e) => setBrushColor(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageEditor; 