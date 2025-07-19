import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Crop, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ImageCropperProps {
  isOpen: boolean;
  onClose: () => void;
  imageFile: File;
  onCropComplete: (croppedBlob: Blob) => void;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null;

export const ImageCropper: React.FC<ImageCropperProps> = ({
  isOpen,
  onClose,
  imageFile,
  onCropComplete,
}) => {
  console.log('ImageCropper rendered with isOpen:', isOpen, 'imageFile:', imageFile);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropArea, setCropArea] = useState<CropArea>({ x: 50, y: 50, width: 200, height: 200 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const { toast } = useToast();
  // Add a state to detect if the user is using touch
  const [isTouch, setIsTouch] = useState(false);
  const [rotation, setRotation] = useState(0); // degrees: 0, 90, 180, 270

  // Update handle size based on input type
  const getHandleSize = () => (isTouch ? 24 : 12);

  // Load and display image
  useEffect(() => {
    console.log('🔄 Image loading useEffect triggered');
    console.log('isOpen:', isOpen);
    console.log('imageFile:', imageFile);
    
    if (!isOpen || !imageFile) {
      console.log('❌ Early return - isOpen or imageFile missing');
      return;
    }
    
    // Add a small delay to ensure canvas is rendered
    const loadImage = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        console.log('❌ Canvas ref not available, retrying...');
        setTimeout(loadImage, 50);
        return;
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.log('❌ Could not get canvas context');
        return;
      }

      console.log('✅ Starting image load for:', imageFile.name);
      setImageError(null);
      setImageLoaded(false);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        console.log('✅ Image loaded successfully:', img.width, 'x', img.height);
        
        // Calculate optimal canvas size
        const maxWidth = 600;
        const maxHeight = 400;
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        console.log('✅ Canvas size set to:', canvas.width, 'x', canvas.height);
        
        // Clear canvas and draw image
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        console.log('✅ Image drawn to canvas');
        
        imageRef.current = img;
        
        // Set initial crop area
        const initialSize = Math.min(200, canvas.width * 0.5, canvas.height * 0.5);
        setCropArea({
          x: (canvas.width - initialSize) / 2,
          y: (canvas.height - initialSize) / 2,
          width: initialSize,
          height: initialSize,
        });
        
        setImageLoaded(true);
        setImageError(null);
        
        console.log('✅ Image loaded and ready for cropping');
        
        // Draw the crop overlay
        setTimeout(() => {
          console.log('🔄 Drawing crop overlay');
          drawCanvas();
        }, 10);
      };
      
      img.onerror = (error) => {
        console.error('❌ Image failed to load:', error);
        setImageError('Failed to load image. Please try again.');
        setImageLoaded(false);
      };
      
      try {
        console.log('🔄 Setting image src');
        img.src = URL.createObjectURL(imageFile);
      } catch (err) {
        console.error('❌ Error setting image src:', err);
        setImageError('Invalid image file.');
        setImageLoaded(false);
      }
    };
    
    // Start the image loading process
    loadImage();
    
    return () => {
      // Cleanup will be handled by the loadImage function
    };
  }, [isOpen, imageFile]);

const drawCanvas = useCallback(() => {
  const canvas = canvasRef.current;
  const ctx = canvas?.getContext('2d');
  const img = imageRef.current;
  if (!canvas || !ctx || !img || !imageLoaded) return;

  // Calculate correct canvas size for rotation
  let [drawWidth, drawHeight] = [img.width, img.height];
  let [canvasWidth, canvasHeight] = [drawWidth, drawHeight];

  if (rotation % 180 !== 0) {
    // 90 or 270: swap width/height
    [canvasWidth, canvasHeight] = [drawHeight, drawWidth];
  }

  // Resize canvas and optionally reset crop area if needed
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  // Clear canvas before drawing
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw rotated image centered in canvas
  ctx.save();
  switch (rotation) {
    case 0:
      ctx.drawImage(img, 0, 0, drawWidth, drawHeight);
      break;
    case 90:
      ctx.translate(canvasWidth, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, 0, 0, drawWidth, drawHeight);
      break;
    case 180:
      ctx.translate(canvasWidth, canvasHeight);
      ctx.rotate(Math.PI);
      ctx.drawImage(img, 0, 0, drawWidth, drawHeight);
      break;
    case 270:
      ctx.translate(0, canvasHeight);
      ctx.rotate(3 * Math.PI / 2);
      ctx.drawImage(img, 0, 0, drawWidth, drawHeight);
      break;
    default:
      ctx.drawImage(img, 0, 0, drawWidth, drawHeight);
  }
  ctx.restore();

  // Draw overlay (darken area outside crop)
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Show original image in crop area (clear overlay)
  ctx.save();
  ctx.beginPath();
  ctx.rect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
  ctx.clip();
  // Redraw the image in the crop area, with the same rotation
  ctx.save();
  switch (rotation) {
    case 0:
      ctx.drawImage(img, 0, 0, drawWidth, drawHeight);
      break;
    case 90:
      ctx.translate(canvasWidth, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, 0, 0, drawWidth, drawHeight);
      break;
    case 180:
      ctx.translate(canvasWidth, canvasHeight);
      ctx.rotate(Math.PI);
      ctx.drawImage(img, 0, 0, drawWidth, drawHeight);
      break;
    case 270:
      ctx.translate(0, canvasHeight);
      ctx.rotate(3 * Math.PI / 2);
      ctx.drawImage(img, 0, 0, drawWidth, drawHeight);
      break;
    default:
      ctx.drawImage(img, 0, 0, drawWidth, drawHeight);
  }
  ctx.restore();
  ctx.restore();

  // Draw crop border and handles as before...
  // (keep your existing code for border/handles)
}, [cropArea, imageLoaded, rotation]);

  useEffect(() => {
    if (imageLoaded) {
      drawCanvas();
    }
  }, [imageLoaded, cropArea, drawCanvas]);

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const getResizeHandle = (x: number, y: number): ResizeHandle => {
    const handleSize = getHandleSize();
    const { x: cx, y: cy, width, height } = cropArea;
    
    // Corner handles
    if (x >= cx - handleSize && x <= cx + handleSize && y >= cy - handleSize && y <= cy + handleSize) return 'nw';
    if (x >= cx + width - handleSize && x <= cx + width + handleSize && y >= cy - handleSize && y <= cy + handleSize) return 'ne';
    if (x >= cx - handleSize && x <= cx + handleSize && y >= cy + height - handleSize && y <= cy + height + handleSize) return 'sw';
    if (x >= cx + width - handleSize && x <= cx + width + handleSize && y >= cy + height - handleSize && y <= cy + height + handleSize) return 'se';
    
    // Edge handles
    if (x >= cx + handleSize && x <= cx + width - handleSize && y >= cy - handleSize && y <= cy + handleSize) return 'n';
    if (x >= cx + handleSize && x <= cx + width - handleSize && y >= cy + height - handleSize && y <= cy + height + handleSize) return 's';
    if (x >= cx + width - handleSize && x <= cx + width + handleSize && y >= cy + handleSize && y <= cy + height - handleSize) return 'e';
    if (x >= cx - handleSize && x <= cx + handleSize && y >= cy + handleSize && y <= cy + height - handleSize) return 'w';
    
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    const handle = getResizeHandle(pos.x, pos.y);
    
    if (handle) {
      setIsResizing(true);
      setResizeHandle(handle);
    } else if (pos.x >= cropArea.x && pos.x <= cropArea.x + cropArea.width && 
               pos.y >= cropArea.y && pos.y <= cropArea.y + cropArea.height) {
      setIsDragging(true);
    }
    
    setDragStart(pos);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    if (isResizing && resizeHandle) {
      const deltaX = pos.x - dragStart.x;
      const deltaY = pos.y - dragStart.y;
      
      setCropArea(prev => {
        let newArea = { ...prev };
        
        switch (resizeHandle) {
          case 'nw':
            newArea.x = Math.max(0, Math.min(prev.x + deltaX, prev.x + prev.width - 50));
            newArea.y = Math.max(0, Math.min(prev.y + deltaY, prev.y + prev.height - 50));
            newArea.width = Math.max(50, prev.width - deltaX);
            newArea.height = Math.max(50, prev.height - deltaY);
            break;
          case 'ne':
            newArea.y = Math.max(0, Math.min(prev.y + deltaY, prev.y + prev.height - 50));
            newArea.width = Math.max(50, Math.min(prev.width + deltaX, canvas.width - prev.x));
            newArea.height = Math.max(50, prev.height - deltaY);
            break;
          case 'sw':
            newArea.x = Math.max(0, Math.min(prev.x + deltaX, prev.x + prev.width - 50));
            newArea.width = Math.max(50, prev.width - deltaX);
            newArea.height = Math.max(50, Math.min(prev.height + deltaY, canvas.height - prev.y));
            break;
          case 'se':
            newArea.width = Math.max(50, Math.min(prev.width + deltaX, canvas.width - prev.x));
            newArea.height = Math.max(50, Math.min(prev.height + deltaY, canvas.height - prev.y));
            break;
          case 'n':
            newArea.y = Math.max(0, Math.min(prev.y + deltaY, prev.y + prev.height - 50));
            newArea.height = Math.max(50, prev.height - deltaY);
            break;
          case 's':
            newArea.height = Math.max(50, Math.min(prev.height + deltaY, canvas.height - prev.y));
            break;
          case 'e':
            newArea.width = Math.max(50, Math.min(prev.width + deltaX, canvas.width - prev.x));
            break;
          case 'w':
            newArea.x = Math.max(0, Math.min(prev.x + deltaX, prev.x + prev.width - 50));
            newArea.width = Math.max(50, prev.width - deltaX);
            break;
        }
        
        return newArea;
      });
    } else if (isDragging) {
      const deltaX = pos.x - dragStart.x;
      const deltaY = pos.y - dragStart.y;
      
      setCropArea(prev => ({
        ...prev,
        x: Math.max(0, Math.min(prev.x + deltaX, canvas.width - prev.width)),
        y: Math.max(0, Math.min(prev.y + deltaY, canvas.height - prev.height)),
      }));
    }
    
    setDragStart(pos);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
  };

const handleCrop = () => {
  const canvas = canvasRef.current;
  const img = imageRef.current;

  if (!canvas || !img) {
    toast({
      title: "Error",
      description: "Unable to crop image. Please try again.",
      variant: "destructive",
    });
    return;
  }

  try {
    // Calculate scale
    const scaleX = img.width / canvas.width;
    const scaleY = img.height / canvas.height;

    // Get crop area on the canvas
    let { x, y, width, height } = cropArea;

    // Calculate crop area in original image coordinates
    let sx = 0, sy = 0, sw = 0, sh = 0;
    let tmp;

    switch (rotation) {
      case 0:
        sx = Math.round(x * scaleX);
        sy = Math.round(y * scaleY);
        sw = Math.round(width * scaleX);
        sh = Math.round(height * scaleY);
        break;
      case 90:
        // Swap x/y and width/height, account for origin shift
        sx = Math.round(y * scaleY);
        sy = Math.round(img.width - (x + width) * scaleX);
        sw = Math.round(height * scaleY);
        sh = Math.round(width * scaleX);
        break;
      case 180:
        sx = Math.round(img.width - (x + width) * scaleX);
        sy = Math.round(img.height - (y + height) * scaleY);
        sw = Math.round(width * scaleX);
        sh = Math.round(height * scaleY);
        break;
      case 270:
        sx = Math.round(img.height - (y + height) * scaleY);
        sy = Math.round(x * scaleX);
        sw = Math.round(height * scaleY);
        sh = Math.round(width * scaleX);
        break;
      default:
        // fallback to no rotation
        sx = Math.round(x * scaleX);
        sy = Math.round(y * scaleY);
        sw = Math.round(width * scaleX);
        sh = Math.round(height * scaleY);
        break;
    }

    // Create temp canvas for crop result
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sw;
    tempCanvas.height = sh;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) throw new Error('Unable to get canvas context');

    // Draw the correct region of the original image to temp canvas
    tempCtx.save();
    switch (rotation) {
      case 0:
        tempCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        break;
      case 90:
        tempCtx.translate(sw, 0);
        tempCtx.rotate(Math.PI / 2);
        tempCtx.drawImage(img, sx, sy, sh, sw, 0, 0, sh, sw);
        break;
      case 180:
        tempCtx.translate(sw, sh);
        tempCtx.rotate(Math.PI);
        tempCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        break;
      case 270:
        tempCtx.translate(0, sh);
        tempCtx.rotate(3 * Math.PI / 2);
        tempCtx.drawImage(img, sx, sy, sh, sw, 0, 0, sh, sw);
        break;
    }
    tempCtx.restore();

    tempCanvas.toBlob((blob) => {
      if (blob) {
        onCropComplete(blob);
        onClose();
        toast({
          title: "Success",
          description: "Image cropped successfully!",
        });
      }
    }, 'image/jpeg', 1.0);
  } catch (error) {
    toast({
      title: "Error",
      description: "Failed to crop image. Please try again.",
      variant: "destructive",
    });
  }
};
  
  const resetCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const initialSize = Math.min(200, canvas.width * 0.5, canvas.height * 0.5);
    setCropArea({
      x: (canvas.width - initialSize) / 2,
      y: (canvas.height - initialSize) / 2,
      width: initialSize,
      height: initialSize,
    });
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    setIsTouch(true);
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      // Simulate a mouse event object
      const fakeEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        preventDefault: () => e.preventDefault(),
      } as unknown as React.MouseEvent<HTMLCanvasElement>;
      handleMouseDown(fakeEvent);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const fakeEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        preventDefault: () => e.preventDefault(),
      } as unknown as React.MouseEvent<HTMLCanvasElement>;
      handleMouseMove(fakeEvent);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    handleMouseUp();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crop className="h-5 w-5" />
            Crop Image
          </DialogTitle>
          <DialogDescription>
            Click and drag to move the crop area, then apply the crop.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-4">
          <div className="border border-border rounded-lg overflow-hidden bg-gray-100 flex justify-center items-center">
            <canvas
              ref={canvasRef}
              className="max-w-full"
              style={{ 
                minWidth: 300, 
                minHeight: 200, 
                // background: '#f3f3f3',
                display: 'block',
                cursor: isResizing ? 'grabbing' : isDragging ? 'grabbing' : 'default'
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
            />
          </div>
          {imageError && (
            <p className="text-sm text-red-500 text-center">{imageError}</p>
          )}
          <p className="text-sm text-muted-foreground text-center">
            Click and drag the crop area to adjust, then click "Apply Crop"
          </p>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
            className="flex items-center gap-2"
            title="Rotate Left"
          >
            <RotateCcw className="h-4 w-4" />
            Left
          </Button>
          <Button
            variant="outline"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="flex items-center gap-2"
            title="Rotate Right"
          >
            <RotateCcw className="h-4 w-4 transform rotate-180" />
            Right
          </Button>
          <Button
            variant="outline"
            onClick={resetCrop}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCrop} className="bg-gradient-primary">
            Apply Crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
