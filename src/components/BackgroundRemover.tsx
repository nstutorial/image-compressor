import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Eraser, Palette, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = false;

interface BackgroundRemoverProps {
  isOpen: boolean;
  onClose: () => void;
  imageFile: File;
  onBackgroundRemoved: (processedBlob: Blob) => void;
}

const MAX_IMAGE_DIMENSION = 1024;

const PRESET_COLORS = [
  '#ffffff', '#f8f9fa', '#e9ecef', '#dee2e6', '#ced4da',
  '#495057', '#343a40', '#212529', '#000000',
  '#007bff', '#6c757d', '#28a745', '#dc3545', '#ffc107',
  '#17a2b8', '#6f42c1', '#e83e8c', '#fd7e14'
];

function resizeImageIfNeeded(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, image: HTMLImageElement) {
  let width = image.naturalWidth;
  let height = image.naturalHeight;

  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    if (width > height) {
      height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
      width = MAX_IMAGE_DIMENSION;
    } else {
      width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
      height = MAX_IMAGE_DIMENSION;
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(image, 0, 0, width, height);
    return true;
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(image, 0, 0);
  return false;
}

export const BackgroundRemover: React.FC<BackgroundRemoverProps> = ({
  isOpen,
  onClose,
  imageFile,
  onBackgroundRemoved,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const { toast } = useToast();

  const removeBackground = useCallback(async (imageElement: HTMLImageElement): Promise<Blob> => {
    try {
      console.log('Starting background removal process...');
      setProgress(20);
      
      const segmenter = await pipeline('image-segmentation', 'Xenova/segformer-b0-finetuned-ade-512-512', {
        device: 'webgpu',
      });
      
      setProgress(40);
      
      // Convert HTMLImageElement to canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) throw new Error('Could not get canvas context');
      
      // Resize image if needed and draw it to canvas
      const wasResized = resizeImageIfNeeded(canvas, ctx, imageElement);
      console.log(`Image ${wasResized ? 'was' : 'was not'} resized. Final dimensions: ${canvas.width}x${canvas.height}`);
      
      setProgress(60);
      
      // Get image data as base64
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      console.log('Image converted to base64');
      
      // Process the image with the segmentation model
      console.log('Processing with segmentation model...');
      const result = await segmenter(imageData);
      
      setProgress(80);
      
      console.log('Segmentation result:', result);
      
      if (!result || !Array.isArray(result) || result.length === 0 || !result[0].mask) {
        throw new Error('Invalid segmentation result');
      }
      
      // Create a new canvas for the masked image
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = canvas.width;
      outputCanvas.height = canvas.height;
      const outputCtx = outputCanvas.getContext('2d');
      
      if (!outputCtx) throw new Error('Could not get output canvas context');
      
      // Fill with background color
      outputCtx.fillStyle = backgroundColor;
      outputCtx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
      
      // Draw original image
      outputCtx.drawImage(canvas, 0, 0);
      
      // Apply the mask
      const outputImageData = outputCtx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
      const data = outputImageData.data;
      
      // Apply inverted mask to alpha channel
      for (let i = 0; i < result[0].mask.data.length; i++) {
        // Invert the mask value (1 - value) to keep the subject instead of the background
        const alpha = Math.round((1 - result[0].mask.data[i]) * 255);
        data[i * 4 + 3] = alpha;
      }
      
      outputCtx.putImageData(outputImageData, 0, 0);
      
      // Create final canvas with new background
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = outputCanvas.width;
      finalCanvas.height = outputCanvas.height;
      const finalCtx = finalCanvas.getContext('2d');
      
      if (!finalCtx) throw new Error('Could not get final canvas context');
      
      // Fill with selected background color
      finalCtx.fillStyle = backgroundColor;
      finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
      
      // Draw the masked image on top
      finalCtx.drawImage(outputCanvas, 0, 0);
      
      setProgress(100);
      console.log('Background removal completed');
      
      // Convert canvas to blob
      return new Promise((resolve, reject) => {
        finalCanvas.toBlob(
          (blob) => {
            if (blob) {
              console.log('Successfully created final blob');
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob'));
            }
          },
          'image/png',
          1.0
        );
      });
    } catch (error) {
      console.error('Error removing background:', error);
      throw error;
    }
  }, [backgroundColor]);

  const loadImage = useCallback((file: Blob): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }, []);

  const handleRemoveBackground = async () => {
    setIsProcessing(true);
    setProgress(0);
    setPreviewImage(null);
    setProcessedBlob(null);

    try {
      const imageElement = await loadImage(imageFile);
      const result = await removeBackground(imageElement);
      
      setProcessedBlob(result);
      const previewUrl = URL.createObjectURL(result);
      setPreviewImage(previewUrl);
      
      toast({
        title: "Success!",
        description: "Background removed successfully. You can now change the background color or apply the changes.",
      });
    } catch (error) {
      console.error('Background removal failed:', error);
      toast({
        title: "Error",
        description: "Failed to remove background. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleColorChange = async (newColor: string) => {
    setBackgroundColor(newColor);
    
    if (processedBlob) {
      // Re-process with new background color
      try {
        const imageElement = await loadImage(imageFile);
        const result = await removeBackground(imageElement);
        
        setProcessedBlob(result);
        if (previewImage) {
          URL.revokeObjectURL(previewImage);
        }
        const previewUrl = URL.createObjectURL(result);
        setPreviewImage(previewUrl);
      } catch (error) {
        console.error('Error updating background color:', error);
      }
    }
  };

  const handleApply = () => {
    if (processedBlob) {
      onBackgroundRemoved(processedBlob);
      onClose();
      toast({
        title: "Applied!",
        description: "Background changes have been applied to your image.",
      });
    }
  };

  const handleReset = () => {
    setPreviewImage(null);
    setProcessedBlob(null);
    setProgress(0);
    setBackgroundColor('#ffffff');
  };

  const handleClose = () => {
    if (previewImage) {
      URL.revokeObjectURL(previewImage);
    }
    setPreviewImage(null);
    setProcessedBlob(null);
    setProgress(0);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eraser className="h-5 w-5" />
            Remove & Replace Background
          </DialogTitle>
          <DialogDescription>
            Remove the background and choose a new color. This process uses AI and may take a moment.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Background Color Picker */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Background Color
            </Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    backgroundColor === color 
                      ? 'border-primary scale-110' 
                      : 'border-gray-300 hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => handleColorChange(color)}
                />
              ))}
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-12 h-8 p-0 border-0 rounded-full overflow-hidden cursor-pointer"
                />
                <Input
                  type="text"
                  value={backgroundColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-20 h-8 text-xs"
                  placeholder="#ffffff"
                />
              </div>
            </div>
          </div>

          {/* Preview Area */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Original Image */}
            <div className="space-y-2">
              <Label>Original</Label>
              <div className="border border-border rounded-lg overflow-hidden bg-gray-100">
                <img
                  src={URL.createObjectURL(imageFile)}
                  alt="Original"
                  className="w-full h-64 object-contain"
                />
              </div>
            </div>

            {/* Processed Image */}
            <div className="space-y-2">
              <Label>With New Background</Label>
              <div className="border border-border rounded-lg overflow-hidden bg-gray-100 relative">
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt="Processed"
                    className="w-full h-64 object-contain"
                  />
                ) : (
                  <div className="w-full h-64 flex items-center justify-center text-muted-foreground">
                    {isProcessing ? (
                      <div className="text-center space-y-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                        <p className="text-sm">Processing...</p>
                      </div>
                    ) : (
                      <p className="text-sm">Click "Remove Background" to see preview</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          {isProcessing && (
            <div className="space-y-2">
              <Label>Processing Progress</Label>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                {progress < 20 && "Initializing AI model..."}
                {progress >= 20 && progress < 40 && "Loading segmentation model..."}
                {progress >= 40 && progress < 60 && "Preparing image..."}
                {progress >= 60 && progress < 80 && "Analyzing image..."}
                {progress >= 80 && progress < 100 && "Applying background..."}
                {progress >= 100 && "Complete!"}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isProcessing || !previewImage}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button
            variant="outline"
            onClick={handleRemoveBackground}
            disabled={isProcessing}
            className="flex items-center gap-2"
          >
            <Eraser className="h-4 w-4" />
            {isProcessing ? 'Processing...' : 'Remove Background'}
          </Button>
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button 
            onClick={handleApply} 
            disabled={!processedBlob || isProcessing}
            className="bg-gradient-primary"
          >
            Apply Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
