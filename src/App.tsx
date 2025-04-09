import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import JSZip from 'jszip';
import { Download, Upload, Image as ImageIcon, Loader2 } from 'lucide-react';

interface ProcessedImage {
  name: string;
  url: string;
  size: number;
  originalSize: number;
}

function App() {
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const processImage = async (file: File): Promise<ProcessedImage> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
  
          // Resize if width is greater than 1600px
          if (width > 1600) {
            const ratio = 1600 / width;
            width = 1600;
            height = height * ratio;
          }
  
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
  
          // Start with a default quality
          let quality = 0.8;
          let webpUrl = canvas.toDataURL('image/webp', quality);
          let response = await fetch(webpUrl);
          let blob = await response.blob();
  
          // Dynamically adjust quality if compressed size is larger
          while (blob.size > file.size && quality > 0.1) {
            quality -= 0.1;
            webpUrl = canvas.toDataURL('image/webp', quality);
            response = await fetch(webpUrl);
            blob = await response.blob();
          }
  
          // Use original image if compression is not effective
          if (blob.size >= file.size) {
            resolve({
              name: file.name,
              url: e.target?.result as string,
              size: file.size,
              originalSize: file.size,
            });
          } else {
            resolve({
              name: file.name.replace(/\.[^/.]+$/, '') + '-optimized.webp',
              url: webpUrl,
              size: blob.size,
              originalSize: file.size,
            });
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsProcessing(true);
    const processed = await Promise.all(
      acceptedFiles.map(file => processImage(file))
    );
    setProcessedImages(processed);
    setIsProcessing(false);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif']
    }
  });

  const downloadAll = async () => {
    const zip = new JSZip();
    
    // Add all images to the zip
    processedImages.forEach(image => {
      // Convert base64 to blob
      const base64Data = image.url.split(',')[1];
      zip.file(image.name, base64Data, { base64: true });
    });

    // Generate and download zip
    const content = await zip.generateAsync({ type: 'blob' });
    const url = window.URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'optimized-images.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const calculateTotalSavings = () => {
    const totalOriginal = processedImages.reduce((acc, img) => acc + img.originalSize, 0);
    const totalCompressed = processedImages.reduce((acc, img) => acc + img.size, 0);
    const savings = ((totalOriginal - totalCompressed) / totalOriginal * 100).toFixed(1);
    return savings;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Image Compressor</h1>
          <p className="mt-2 text-gray-600">Optimize your images with WebP compression</p>
        </div>

        <div 
          {...getRootProps()} 
          className={`mt-4 p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-600">
            {isDragActive ? 'Drop the images here' : 'Drag & drop images here, or click to select'}
          </p>
          <p className="text-sm text-gray-500 mt-1">Supports PNG, JPG, JPEG, GIF</p>
        </div>

        {isProcessing && (
          <div className="mt-8 text-center">
            <Loader2 className="animate-spin h-8 w-8 mx-auto text-blue-500" />
            <p className="mt-2 text-gray-600">Processing images...</p>
          </div>
        )}

        {processedImages.length > 0 && !isProcessing && (
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Processed Images ({processedImages.length})
              </h2>
              <button
                onClick={downloadAll}
                className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Download className="h-5 w-5 mr-2" />
                Download All
              </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <p className="text-sm text-gray-600">
                  Total space saved: <span className="font-semibold">{calculateTotalSavings()}%</span>
                </p>
              </div>

              <ul className="divide-y divide-gray-200">
                {processedImages.map((image, index) => (
                  <li key={index} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <img 
                          src={image.url} 
                          alt={image.name}
                          className="h-16 w-16 object-cover rounded"
                        />
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-900">{image.name}</p>
                          <p className="text-sm text-gray-500">
                            Original: {formatSize(image.originalSize)} → Compressed: {formatSize(image.size)}
                          </p>
                        </div>
                      </div>
                      <a
                        href={image.url}
                        download={image.name}
                        className="text-blue-500 hover:text-blue-600"
                      >
                        <Download className="h-5 w-5" />
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;