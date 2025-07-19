import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Upload, Download, Image as ImageIcon, FileImage, Zap, Crop, Camera } from 'lucide-react';
import { ImageCropper } from './ImageCropper';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface CompressionSettings {
  targetSize: number; // in KB
  format: 'jpeg' | 'png' | 'webp';
  quality: number; // 0-1
}

interface ImageFile {
  file: File;
  preview: string;
  originalSize: number;
  compressedSize?: number;
  compressedBlob?: Blob;
  fileName?: string;
}

const ImageCompressor: React.FC = () => {
  const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);
  const [settings, setSettings] = useState<CompressionSettings>({
    // targetSize: 100,
    format: 'jpeg',
    quality: 0.8,
  });
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Debug state changes
  useEffect(() => {
    console.log('State changed - selectedImageIndex:', selectedImageIndex, 'cropperOpen:', cropperOpen);
  }, [selectedImageIndex, cropperOpen]);

  const handleFileUpload = useCallback((files: FileList | null) => {
    if (!files) return;

    const newFiles: ImageFile[] = [];
    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const preview = URL.createObjectURL(file);
        newFiles.push({
          file,
          preview,
          originalSize: file.size,
          fileName: `compressed_${file.name.split('.')[0]}`,
        });
      }
    });

    setImageFiles((prev) => [...prev, ...newFiles]);
  }, []);

  // Add this function to handle camera capture
  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files);
    }
  };

  const compressImage = async (imageFile: ImageFile): Promise<Blob> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate optimal dimensions
        const maxDimension = 1920;
        let { width, height } = img;
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          } else {
            width = (width * maxDimension) / height;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        // Binary search for optimal quality
        let minQuality = 0.1;
        let maxQuality = 1.0;
        let bestBlob: Blob | null = null;
        let attempts = 0;
        const maxAttempts = 10;

        const tryCompress = (quality: number) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) return;

              const sizeKB = blob.size / 1024;
              const targetKB = settings.targetSize;

              if (Math.abs(sizeKB - targetKB) <= targetKB * 0.1 || attempts >= maxAttempts) {
                // Close enough or max attempts reached
                resolve(blob);
                return;
              }

              attempts++;
              if (sizeKB > targetKB) {
                maxQuality = quality;
                tryCompress((minQuality + quality) / 2);
              } else {
                minQuality = quality;
                bestBlob = blob;
                tryCompress((quality + maxQuality) / 2);
              }
            },
            `image/${settings.format}`,
            quality
          );
        };

        tryCompress(settings.quality);
      };

      img.src = imageFile.preview;
    });
  };

  const handleCompress = async () => {
    if (imageFiles.length === 0) {
      toast({
        title: "No images selected",
        description: "Please upload some images first.",
        variant: "destructive",
      });
      return;
    }

    setIsCompressing(true);
    setProgress(0);

    const compressedFiles: ImageFile[] = [];

    for (let i = 0; i < imageFiles.length; i++) {
      const imageFile = imageFiles[i];
      try {
        const compressedBlob = await compressImage(imageFile);
        compressedFiles.push({
          ...imageFile,
          compressedBlob,
          compressedSize: compressedBlob.size,
        });
        setProgress(((i + 1) / imageFiles.length) * 100);
      } catch (error) {
        console.error('Compression failed for', imageFile.file.name, error);
        toast({
          title: "Compression failed",
          description: `Failed to compress ${imageFile.file.name}`,
          variant: "destructive",
        });
      }
    }

    setImageFiles(compressedFiles);
    setIsCompressing(false);
    toast({
      title: "Compression complete!",
      description: `Successfully compressed ${compressedFiles.length} images.`,
    });
  };

  const downloadImage = (imageFile: ImageFile) => {
    if (!imageFile.compressedBlob) return;

    const url = URL.createObjectURL(imageFile.compressedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${imageFile.fileName || 'compressed_' + imageFile.file.name.split('.')[0]}.${settings.format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAll = () => {
    imageFiles.forEach((imageFile) => {
      if (imageFile.compressedBlob) {
        setTimeout(() => downloadImage(imageFile), 100);
      }
    });
  };

  const handleCropImage = (index: number) => {
    console.log('Opening cropper for index:', index);
    setSelectedImageIndex(index);
    setCropperOpen(true);
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    if (selectedImageIndex === null) return;

    const croppedFile = new File([croppedBlob], `cropped_${imageFiles[selectedImageIndex].file.name}`, {
      type: croppedBlob.type,
    });

    const preview = URL.createObjectURL(croppedBlob);
    
    setImageFiles((prev) => 
      prev.map((file, index) => 
        index === selectedImageIndex
          ? {
              ...file,
              file: croppedFile,
              preview,
              originalSize: croppedBlob.size,
              compressedSize: undefined,
              compressedBlob: undefined,
            }
          : file
      )
    );

    setSelectedImageIndex(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gradient-subtle p-4">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-full bg-gradient-primary shadow-glow">
              <Zap className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Image Compressor
            </h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Compress your images to any target size while maintaining quality
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Section */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Images
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="h-5 w-5" />
                  Take Photo
                </Button>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleCameraCapture}
                />
              </div>
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-brand-primary transition-smooth cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFileUpload(e.dataTransfer.files);
                }}
                onDragOver={(e) => e.preventDefault()}
              >
                <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">Drop images here or click to browse</p>
                <p className="text-sm text-muted-foreground">
                  Supports JPEG, PNG, WebP formats
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                   required
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
              </div>

              {imageFiles.length > 0 && (
                <div className="mt-6 space-y-4">
                  {imageFiles.map((imageFile, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                      <img
                        src={imageFile.preview}
                        alt={`Preview ${index}`}
                        className="w-16 h-16 object-cover rounded-lg border"
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`filename-${index}`} className="text-sm font-medium">
                            File name:
                          </Label>
                          <Input
                            id={`filename-${index}`}
                            value={imageFile.fileName || ''}
                            onChange={(e) => {
                              setImageFiles(prev => 
                                prev.map((file, i) => 
                                  i === index ? { ...file, fileName: e.target.value } : file
                                )
                              );
                            }}
                            placeholder="Enter filename"
                            className="h-8 text-sm"
                          />
                          <span className="text-sm text-muted-foreground">.{settings.format}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{formatFileSize(imageFile.originalSize)}</span>
                          {imageFile.compressedSize && (
                            <span className="text-success">
                              → {formatFileSize(imageFile.compressedSize)}
                            </span>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCropImage(index)}
                            className="h-6 px-2 text-xs"
                          >
                            <Crop className="h-3 w-3 mr-1" />
                            Crop
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Settings Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileImage className="h-5 w-5" />
                Compression Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="targetSize">Target Size (KB)</Label>
                <Input
                  id="targetSize"
                  type="number"
                  value={settings.targetSize}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      targetSize: parseInt(e.target.value) || 100,
                    }))
                  }
                  min="1"
                  max="10000"
                />
              </div>

              <div>
                <Label htmlFor="format">Output Format</Label>
                <Select
                  value={settings.format}
                  onValueChange={(value) =>
                    setSettings((prev) => ({
                      ...prev,
                      format: value as 'jpeg' | 'png' | 'webp',
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="jpeg">JPEG</SelectItem>
                    <SelectItem value="png">PNG</SelectItem>
                    <SelectItem value="webp">WebP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="quality">Initial Quality: {Math.round(settings.quality * 100)}%</Label>
                <Input
                  id="quality"
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={settings.quality}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      quality: parseFloat(e.target.value),
                    }))
                  }
                  className="mt-2"
                />
              </div>

              {isCompressing && (
                <div>
                  <Label>Compression Progress</Label>
                  <Progress value={progress} className="mt-2" />
                  <p className="text-sm text-muted-foreground mt-1">
                    {Math.round(progress)}% complete
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Button
                  onClick={handleCompress}
                  disabled={imageFiles.length === 0 || isCompressing}
                  className="w-full bg-gradient-primary hover:shadow-glow transition-smooth"
                >
                  {isCompressing ? 'Compressing...' : 'Compress Images'}
                </Button>

                {imageFiles.some((f) => f.compressedBlob) && (
                  <Button
                    onClick={downloadAll}
                    variant="outline"
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download All
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Section */}
        {imageFiles.some((f) => f.compressedBlob) && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Compression Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {imageFiles
                  .filter((f) => f.compressedBlob)
                  .map((imageFile, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <img
                          src={imageFile.preview}
                          alt={`Result ${index}`}
                          className="w-16 h-16 object-cover rounded"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Input
                              value={imageFile.fileName || ''}
                              onChange={(e) => {
                                setImageFiles(prev => 
                                  prev.map((file, i) => 
                                    prev.indexOf(imageFile) === i ? { ...file, fileName: e.target.value } : file
                                  )
                                );
                              }}
                              placeholder="Enter filename"
                              className="h-8 text-sm font-medium"
                            />
                            <span className="text-sm text-muted-foreground">.{settings.format}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatFileSize(imageFile.originalSize)} →{' '}
                            {formatFileSize(imageFile.compressedSize!)}
                          </p>
                          <p className="text-sm text-success">
                            {Math.round(
                              ((imageFile.originalSize - imageFile.compressedSize!) /
                                imageFile.originalSize) *
                                100
                            )}% reduction
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => downloadImage(imageFile)}
                        size="sm"
                        variant="outline"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Image Cropper Dialog */}
        {selectedImageIndex !== null && (
          <>
            {console.log('Passing file to cropper:', imageFiles[selectedImageIndex]?.file)}
            <ImageCropper
              isOpen={cropperOpen}
              onClose={() => {
                console.log('Closing cropper dialog');
                setCropperOpen(false);
                setSelectedImageIndex(null);
              }}
              imageFile={imageFiles[selectedImageIndex]?.file}
              onCropComplete={handleCropComplete}
            />
          </>
        )}
        

      </div>
    </div>
  );
};

export default ImageCompressor;
