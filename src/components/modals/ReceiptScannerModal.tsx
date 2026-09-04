import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  X,
  Upload,
  Sparkles,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FlipHorizontal,
  FileText,
  DollarSign,
  Calendar,
  Tag,
  Store,
  Receipt,
  Eye,
} from 'lucide-react';
import { storageService } from '../../services/storage/storage.service';
import { useScrollLock } from '../../hooks/useScrollLock';
import { Category, TransactionType, PaymentMethod } from '../../types';

export interface ScannedReceiptData {
  merchant: string;
  amount: number;
  date: string;
  type: TransactionType;
  categoryId: string;
  categoryName?: string;
  paymentMethod: PaymentMethod;
  taxAmount?: number;
  notes?: string;
  tags?: string[];
  items?: { name: string; quantity?: number; price?: number }[];
  confidenceScore: number;
  detectedCurrency?: string;
  receiptImage?: string;
}

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReceiptScanned: (data: ScannedReceiptData) => void;
  currencySymbol: string;
}

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({
  isOpen,
  onClose,
  onReceiptScanned,
  currencySymbol,
}) => {
  useScrollLock(isOpen);

  const [mode, setMode] = useState<'camera' | 'upload'>('camera');
  const [isStreaming, setIsStreaming] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<ScannedReceiptData | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop current camera stream
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
    setTorchOn(false);
  }, []);

  // Check available cameras
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
      });
    }
  }, []);

  // Start camera stream
  const startCamera = useCallback(async () => {
    stopStream();
    setCameraError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API is not supported in this browser environment.');
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStreaming(true);
      }

      // Check if torch / flashlight is supported
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() as any;
      if (capabilities && 'torch' in capabilities) {
        setHasTorch(true);
      } else {
        setHasTorch(false);
      }
    } catch (err: any) {
      console.error('Camera stream error:', err);
      let message = 'Unable to access device camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Camera permission was denied. Please allow camera access in browser permissions or upload a receipt photo.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'No camera found on this device. You can upload a receipt photo instead.';
      }
      setCameraError(message);
      setMode('upload');
    }
  }, [facingMode, stopStream]);

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      const nextState = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch (err) {
      console.warn('Torch toggle not supported:', err);
    }
  };

  // Switch between front and back cameras
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Start camera when modal opens or facingMode changes
  useEffect(() => {
    if (isOpen && mode === 'camera' && !capturedImage) {
      startCamera();
    } else {
      stopStream();
    }

    return () => {
      stopStream();
    };
  }, [isOpen, mode, facingMode, capturedImage, startCamera, stopStream]);

  // Reset states on modal close/open
  useEffect(() => {
    if (!isOpen) {
      stopStream();
      setCapturedImage(null);
      setScannedResult(null);
      setAnalysisError(null);
      setCameraError(null);
      setIsAnalyzing(false);
    }
  }, [isOpen, stopStream]);

  // Capture photo from video stream
  const capturePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    stopStream();
    setCapturedImage(dataUrl);
    analyzeReceiptImage(dataUrl);
  };

  // Handle uploaded file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAnalysisError('Please upload an image file (JPEG, PNG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setCapturedImage(dataUrl);
      analyzeReceiptImage(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Drag & drop handlers
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setCapturedImage(dataUrl);
        analyzeReceiptImage(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  // Call server-side Gemini Vision OCR
  const analyzeReceiptImage = async (imageDataUrl: string) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setScannedResult(null);

    try {
      const categories = storageService.getCategories();
      const res = await fetch('/api/ai/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imageDataUrl,
          mimeType: 'image/jpeg',
          categories: categories.map((c) => ({ id: c.id, name: c.name })),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with status ${res.status}`);
      }

      const data: ScannedReceiptData = await res.json();
      const matchedCat = categories.find((c) => c.id === data.categoryId);
      const resultWithImage: ScannedReceiptData = {
        ...data,
        categoryName: matchedCat ? matchedCat.name : data.categoryName || 'Other',
        receiptImage: imageDataUrl,
      };

      setScannedResult(resultWithImage);
    } catch (err: any) {
      console.error('AI receipt scan error:', err);
      setAnalysisError(
        err.message || 'Failed to extract receipt details. You can retake or adjust the photo.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Apply scanned results to AddTransactionModal
  const handleApplyResult = () => {
    if (scannedResult) {
      onReceiptScanned(scannedResult);
      onClose();
    }
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedImage(null);
    setScannedResult(null);
    setAnalysisError(null);
    if (mode === 'camera') {
      startCamera();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isAnalyzing) onClose();
      }}
    >
      <div className="relative w-full max-w-xl rounded-2xl border border-[#262626] bg-[#141414] shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-white overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#262626] px-5 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400">
              <Camera size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Scan Physical Receipt</span>
                <span className="rounded bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
                  Gemini Vision AI
                </span>
              </h3>
              <p className="text-[11px] text-gray-400">
                Snap or upload a paper receipt to auto-extract merchant, total, date &amp; items
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isAnalyzing}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-[#262626] hover:text-white transition disabled:opacity-30 cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode Switcher Tabs (when not showing captured image) */}
        {!capturedImage && (
          <div className="flex border-b border-[#262626] bg-[#0d0d0d] px-5 shrink-0">
            <button
              onClick={() => {
                setMode('camera');
                setCameraError(null);
              }}
              className={`flex items-center gap-2 border-b-2 py-2.5 px-4 text-xs font-semibold transition cursor-pointer ${
                mode === 'camera'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Camera size={14} />
              <span>Live Camera</span>
            </button>
            <button
              onClick={() => {
                setMode('upload');
                stopStream();
              }}
              className={`flex items-center gap-2 border-b-2 py-2.5 px-4 text-xs font-semibold transition cursor-pointer ${
                mode === 'upload'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Upload size={14} />
              <span>Upload Photo / File</span>
            </button>
          </div>
        )}

        {/* Modal Body / Viewport */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* CAMERA STREAM VIEW */}
          {mode === 'camera' && !capturedImage && (
            <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl border border-[#333] bg-black shadow-inner flex items-center justify-center">
              {cameraError ? (
                <div className="p-6 text-center space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <AlertCircle size={24} />
                  </div>
                  <div className="text-xs text-rose-300 font-medium max-w-sm mx-auto">
                    {cameraError}
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      onClick={startCamera}
                      className="rounded-lg bg-[#262626] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#333] transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw size={13} /> Retry Camera
                    </button>
                    <button
                      onClick={() => setMode('upload')}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload size={13} /> Upload Image
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />

                  {/* Viewfinder Overlay */}
                  <div className="pointer-events-none absolute inset-6 sm:inset-10 rounded-xl border-2 border-dashed border-blue-400/70 bg-blue-500/5">
                    {/* Viewfinder Corner Accents */}
                    <div className="absolute -top-1 -left-1 h-5 w-5 border-t-3 border-l-3 border-blue-400 rounded-tl-sm" />
                    <div className="absolute -top-1 -right-1 h-5 w-5 border-t-3 border-r-3 border-blue-400 rounded-tr-sm" />
                    <div className="absolute -bottom-1 -left-1 h-5 w-5 border-b-3 border-l-3 border-blue-400 rounded-bl-sm" />
                    <div className="absolute -bottom-1 -right-1 h-5 w-5 border-b-3 border-r-3 border-blue-400 rounded-br-sm" />

                    <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[11px] text-blue-300 font-medium whitespace-nowrap border border-blue-500/20">
                      Align receipt inside frame
                    </div>
                  </div>

                  {/* Live Controls Bar */}
                  <div className="absolute bottom-4 inset-x-4 flex items-center justify-between">
                    {/* Camera switch button */}
                    {hasMultipleCameras ? (
                      <button
                        onClick={toggleFacingMode}
                        title="Switch Camera (Front/Rear)"
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-black/70 backdrop-blur-md text-white border border-white/20 hover:bg-black/90 transition cursor-pointer"
                      >
                        <FlipHorizontal size={18} />
                      </button>
                    ) : (
                      <div className="w-10" />
                    )}

                    {/* Shutter Capture Button */}
                    <button
                      onClick={capturePhoto}
                      title="Capture Receipt Photo"
                      className="group flex h-16 w-16 items-center justify-center rounded-full bg-white/20 p-1 backdrop-blur-md border-2 border-white transition hover:scale-105 active:scale-95 cursor-pointer shadow-lg shadow-black/50"
                    >
                      <div className="h-full w-full rounded-full bg-blue-600 group-hover:bg-blue-500 transition flex items-center justify-center text-white">
                        <Camera size={22} />
                      </div>
                    </button>

                    {/* Torch Button */}
                    {hasTorch ? (
                      <button
                        onClick={toggleTorch}
                        title="Toggle Flashlight"
                        className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md border transition cursor-pointer ${
                          torchOn
                            ? 'bg-amber-500 text-black border-amber-400 font-bold'
                            : 'bg-black/70 text-white border-white/20 hover:bg-black/90'
                        }`}
                      >
                        <Zap size={18} />
                      </button>
                    ) : (
                      <div className="w-10" />
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* FILE UPLOAD VIEW */}
          {mode === 'upload' && !capturedImage && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="relative aspect-4/3 w-full overflow-hidden rounded-xl border-2 border-dashed border-[#333] hover:border-blue-500/50 bg-[#0f0f0f] hover:bg-[#121212] transition flex flex-col items-center justify-center p-6 text-center cursor-pointer group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 group-hover:scale-110 transition mb-3">
                <Upload size={24} />
              </div>
              <div className="text-sm font-bold text-white mb-1">
                Click or Drag &amp; Drop Receipt Photo
              </div>
              <p className="text-xs text-gray-400 max-w-xs">
                Supports JPG, PNG, WEBP, and mobile photo captures up to 15MB
              </p>
            </div>
          )}

          {/* CAPTURED IMAGE & AI EXTRACTION STATUS */}
          {capturedImage && (
            <div className="space-y-4">
              <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl border border-[#333] bg-black">
                <img
                  src={capturedImage}
                  alt="Captured Receipt"
                  className="h-full w-full object-contain"
                />

                {/* AI Laser Scan Animation during extraction */}
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-blue-950/40 backdrop-blur-2xs flex flex-col items-center justify-center">
                    {/* Glowing scanning laser bar */}
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_15px_#3b82f6] animate-bounce duration-1000" />
                    <div className="rounded-2xl border border-blue-500/30 bg-[#0a0a0a]/90 px-5 py-4 shadow-2xl flex items-center gap-3 text-left">
                      <Loader2 size={24} className="text-blue-400 animate-spin shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>Gemini Vision Extracting Data...</span>
                          <Sparkles size={14} className="text-blue-400" />
                        </div>
                        <div className="text-[11px] text-gray-400">
                          Reading merchant, amounts, dates &amp; line items
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Error state */}
              {analysisError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-semibold">{analysisError}</span>
                  </div>
                </div>
              )}

              {/* SUCCESS RESULT CARD */}
              {scannedResult && !isAnalyzing && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-3.5 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={18} className="text-emerald-400" />
                      <span className="text-xs font-bold text-emerald-300">
                        AI Receipt Extraction Successful
                      </span>
                    </div>
                    <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                      {scannedResult.confidenceScore}% Confidence
                    </span>
                  </div>

                  {/* Extracted Key Fields Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="bg-[#141414] border border-[#262626] rounded-lg p-2.5">
                      <div className="text-[10px] text-gray-400 flex items-center gap-1 mb-1">
                        <Store size={11} className="text-blue-400" /> Merchant
                      </div>
                      <div className="font-bold text-white truncate" title={scannedResult.merchant}>
                        {scannedResult.merchant || 'Unknown Store'}
                      </div>
                    </div>

                    <div className="bg-[#141414] border border-[#262626] rounded-lg p-2.5">
                      <div className="text-[10px] text-gray-400 flex items-center gap-1 mb-1">
                        <DollarSign size={11} className="text-emerald-400" /> Total Amount
                      </div>
                      <div className="font-bold text-emerald-400 text-sm">
                        {currencySymbol}
                        {scannedResult.amount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>

                    <div className="bg-[#141414] border border-[#262626] rounded-lg p-2.5">
                      <div className="text-[10px] text-gray-400 flex items-center gap-1 mb-1">
                        <Calendar size={11} className="text-amber-400" /> Date
                      </div>
                      <div className="font-semibold text-white">{scannedResult.date}</div>
                    </div>

                    <div className="bg-[#141414] border border-[#262626] rounded-lg p-2.5">
                      <div className="text-[10px] text-gray-400 flex items-center gap-1 mb-1">
                        <Tag size={11} className="text-purple-400" /> Category
                      </div>
                      <div className="font-semibold text-purple-300 truncate">
                        {scannedResult.categoryName || scannedResult.categoryId}
                      </div>
                    </div>
                  </div>

                  {/* Line items snippet if available */}
                  {scannedResult.items && scannedResult.items.length > 0 && (
                    <div className="bg-[#141414] border border-[#262626] rounded-lg p-2.5 text-[11px] space-y-1">
                      <div className="text-gray-400 font-semibold flex items-center gap-1">
                        <Receipt size={11} /> Itemized Breakdown ({scannedResult.items.length} items):
                      </div>
                      <div className="max-h-20 overflow-y-auto space-y-1 pr-1 text-gray-300">
                        {scannedResult.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[11px]">
                            <span className="truncate">
                              {item.quantity ? `${item.quantity}x ` : ''}
                              {item.name}
                            </span>
                            {item.price !== undefined && (
                              <span className="font-mono text-gray-400">
                                {currencySymbol}
                                {item.price.toFixed(2)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes summary */}
                  {scannedResult.notes && (
                    <div className="text-[11px] text-gray-400 bg-[#141414] border border-[#262626] rounded-lg px-2.5 py-1.5">
                      <span className="text-gray-500 font-medium">Notes: </span>
                      {scannedResult.notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[#262626] bg-[#0d0d0d] px-5 py-3.5 shrink-0">
          {capturedImage ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                disabled={isAnalyzing}
                className="flex items-center gap-1.5 rounded-xl border border-[#333] bg-[#1a1a1a] px-4 py-2 text-xs font-semibold text-gray-300 hover:border-gray-500 hover:text-white transition disabled:opacity-40 cursor-pointer"
              >
                <RefreshCw size={13} />
                <span>Retake / Scan Another</span>
              </button>

              {scannedResult && (
                <button
                  type="button"
                  onClick={handleApplyResult}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-500 transition cursor-pointer"
                >
                  <Sparkles size={14} />
                  <span>Pre-fill &amp; Review Transaction</span>
                </button>
              )}
            </>
          ) : (
            <>
              <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
                <Sparkles size={12} className="text-blue-400" />
                <span>AI vision reads amounts, tax, dates &amp; merchants automatically</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#333] bg-[#1a1a1a] px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
