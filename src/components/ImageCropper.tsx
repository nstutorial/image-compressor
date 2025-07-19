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
    console.log('🔄 drawCanvas called');
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imageRef.current;
    
    console.log('Canvas:', !!canvas, 'Context:', !!ctx, 'Image:', !!img, 'ImageLoaded:', imageLoaded);
    
    if (!canvas || !ctx || !img || !imageLoaded) {
      console.log('❌ drawCanvas early return - missing dependencies');
      return;
    }

    console.log('✅ Drawing canvas with crop area:', cropArea);
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save context state
    ctx.save();

    // Move to center for rotation
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    // Draw image centered, accounting for rotation
    let drawWidth = canvas.width;
    let drawHeight = canvas.height;
    if (rotation % 180 !== 0) {
      // Swap width/height for 90/270
      [drawWidth, drawHeight] = [drawHeight, drawWidth];
    }
    ctx.drawImage(
      img,
      -drawWidth / 2,
      -drawHeight / 2,
      drawWidth,
      drawHeight
    );

    ctx.restore();

    // Draw overlay (darken area outside crop)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Clear crop area to show original image clearly
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
    
    // Reset composite operation
    ctx.globalCompositeOperation = 'source-over';
    
    // Draw crop border
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#007acc';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
    
    // Draw resize handles
    ctx.setLineDash([]);
    const handleSize = getHandleSize();
    
    // Corner handles
    const cornerHandles = [
      { x: cropArea.x - handleSize/2, y: cropArea.y - handleSize/2 }, // nw
      { x: cropArea.x + cropArea.width - handleSize/2, y: cropArea.y - handleSize/2 }, // ne
      { x: cropArea.x - handleSize/2, y: cropArea.y + cropArea.height - handleSize/2 }, // sw
      { x: cropArea.x + cropArea.width - handleSize/2, y: cropArea.y + cropArea.height - handleSize/2 }, // se
    ];
    
    // Edge handles
    const edgeHandles = [
      { x: cropArea.x + cropArea.width/2 - handleSize/2, y: cropArea.y - handleSize/2 }, // n
      { x: cropArea.x + cropArea.width/2 - handleSize/2, y: cropArea.y + cropArea.height - handleSize/2 }, // s
      { x: cropArea.x + cropArea.width - handleSize/2, y: cropArea.y + cropArea.height/2 - handleSize/2 }, // e
      { x: cropArea.x - handleSize/2, y: cropArea.y + cropArea.height/2 - handleSize/2 }, // w
    ];
    
    // Draw all handles
    [...cornerHandles, ...edgeHandles].forEach(handle => {
      ctx.fillStyle = '#007acc';
      ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
    });
    
    console.log('✅ Canvas drawing complete');
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
      // Calculate crop area relative to original image
      const scaleX = img.width / canvas.width;
      const scaleY = img.height / canvas.height;
      
      const cropX = Math.round(cropArea.x * scaleX);
      const cropY = Math.round(cropArea.y * scaleY);
      const cropWidth = Math.round(cropArea.width * scaleX);
      const cropHeight = Math.round(cropArea.height * scaleY);

      console.log('Cropping with dimensions:', { cropX, cropY, cropWidth, cropHeight });

      // Create temporary canvas for cropping
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      
      if (!tempCtx) throw new Error('Unable to get canvas context');

      // Set canvas size to exact crop dimensions
      tempCanvas.width = cropWidth;
      tempCanvas.height = cropHeight;

      // Disable image smoothing for crisp results
      tempCtx.imageSmoothingEnabled = false;
      tempCtx.imageSmoothingQuality = 'high';

      // Draw cropped portion with exact pixel mapping
      tempCtx.save();
      // Move to center of crop area
      tempCtx.translate(cropWidth / 2, cropHeight / 2);
      tempCtx.rotate((rotation * Math.PI) / 180);
      // Draw rotated image so crop area matches preview
      let drawWidth = img.width;
      let drawHeight = img.height;
      let sx = cropX;
      let sy = cropY;
      if (rotation % 180 !== 0) {
        [drawWidth, drawHeight] = [img.height, img.width];
        // Adjust sx, sy for 90/270 rotation
        if (rotation === 90) {
          sx = cropY;
          sy = img.width - cropX - cropWidth;
        } else if (rotation === 270) {
          sx = img.height - cropY - cropHeight;
          sy = cropX;
        }
      }
      tempCtx.drawImage(
        img,
        sx,
        sy,
        cropWidth,
        cropHeight,
        -cropWidth / 2,
        -cropHeight / 2,
        cropWidth,
        cropHeight
      );
      tempCtx.restore();

      // Convert to blob with maximum quality
      tempCanvas.toBlob((blob) => {
        if (blob) {
          console.log('Crop completed, blob size:', blob.size);
          onCropComplete(blob);
          onClose();
          toast({
            title: "Success",
            description: "Image cropped successfully!",
          });
        }
      }, 'image/jpeg', 1.0); // Maximum quality (1.0 instead of 0.9)
    } catch (error) {
      console.error('Crop failed:', error);
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
