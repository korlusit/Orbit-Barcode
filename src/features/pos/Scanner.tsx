import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ScannerProps {
  onScan: (decodedText: string) => void;
  cameraId?: string | null;
  className?: string;
}

// --- Native BarcodeDetector ---
interface BarcodeDetectorResult {
  rawValue: string;
  format: string;
}

declare class BarcodeDetector {
  constructor(options?: { formats: string[] });
  detect(source: ImageBitmapSource): Promise<BarcodeDetectorResult[]>;
  static getSupportedFormats(): Promise<string[]>;
}

const NATIVE_FORMATS = [
  "ean_13", "ean_8", "upc_a", "upc_e",
  "code_128", "code_39", "code_93",
  "itf", "codabar", "qr_code",
];

const HTML5_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.QR_CODE,
];

const hasNativeBarcodeDetector = () =>
  typeof globalThis !== "undefined" && "BarcodeDetector" in globalThis;

export const Scanner = ({ onScan, cameraId, className }: ScannerProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannerMode, setScannerMode] = useState<"native" | "fallback" | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const html5ScannerRef = useRef<Html5Qrcode | null>(null);
  const scanningRef = useRef(false);
  const processingRef = useRef(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const cameraIdRef = useRef(cameraId);
  cameraIdRef.current = cameraId; // Her render'da güncelle — asla stale olmaz
  const lastCodeRef = useRef("");
  const lastScanTimeRef = useRef(0);

  // Debounce: aynı barkodu çok hızlı tekrar okumayı engelle
  const emitScan = useCallback((code: string) => {
    const now = Date.now();
    // Aynı kod 2sn içinde tekrar okunmasın, farklı kod ise hemen geçsin
    if (code === lastCodeRef.current && now - lastScanTimeRef.current < 2000) return;
    lastCodeRef.current = code;
    lastScanTimeRef.current = now;
    onScanRef.current(code);
  }, []);

  // ========================
  //  NATIVE BARKOD OKUMA — OffscreenCanvas ile merkez kırpma
  // ========================
  const startNativeScanner = useCallback(async () => {
    // --- Kamerayı aç (720p — barkod için ideal, hızlı işlenir) ---
    const videoConstraints: MediaTrackConstraints & Record<string, unknown> = {
      width: { min: 640, ideal: 1280, max: 1920 },
      height: { min: 480, ideal: 720, max: 1080 },
      focusMode: "continuous",
      frameRate: { ideal: 30, max: 60 },
    };

    const currentCameraId = cameraIdRef.current;
    if (currentCameraId) {
      videoConstraints.deviceId = { exact: currentCameraId };
    } else {
      videoConstraints.facingMode = "environment";
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: false,
    });
    streamRef.current = stream;

    // Torch (flaş) aç — karanlık ortamlarda barkod daha iyi okunur
    try {
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as any;
      if (capabilities?.torch) {
        await track.applyConstraints({ advanced: [{ torch: true } as any] });
      }
    } catch { /* torch desteklenmiyor, sorun değil */ }

    const video = videoRef.current!;
    video.srcObject = stream;
    await video.play();

    // Canvas: kırpılmış bölge için
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    const detector = new BarcodeDetector({ formats: NATIVE_FORMATS });
    detectorRef.current = detector;
    scanningRef.current = true;

    // --- HIZLI TARAMA DÖNGÜSÜ ---
    const scanFrame = async () => {
      if (!scanningRef.current) return;

      // Video henüz hazır değilse bekle
      if (video.readyState < 2) {
        requestAnimationFrame(scanFrame);
        return;
      }

      // Önceki frame hâlâ işleniyorsa atla (yığılmayı engelle)
      if (processingRef.current) {
        requestAnimationFrame(scanFrame);
        return;
      }

      processingRef.current = true;

      try {
        const vw = video.videoWidth;
        const vh = video.videoHeight;

        // Merkez %70'ini kırp — daha az piksel = çok daha hızlı analiz
        const cropW = Math.floor(vw * 0.7);
        const cropH = Math.floor(vh * 0.5);
        const cropX = Math.floor((vw - cropW) / 2);
        const cropY = Math.floor((vh - cropH) / 2);

        canvas.width = cropW;
        canvas.height = cropH;
        ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        // Kırpılmış canvas'tan barkod oku
        const barcodes = await detector.detect(canvas);
        if (barcodes.length > 0) {
          emitScan(barcodes[0].rawValue);
        }
      } catch {
        // Frame hata — devam
      }

      processingRef.current = false;
      requestAnimationFrame(scanFrame);
    };

    requestAnimationFrame(scanFrame);
    setScannerMode("native");
    setIsScanning(true);
  }, [emitScan]); // cameraIdRef kullanıldığı için cameraId dependency'ye gerek yok

  // ========================
  //  FALLBACK: Html5Qrcode
  // ========================
  const startFallbackScanner = useCallback(async () => {
    if (html5ScannerRef.current) {
      try { await html5ScannerRef.current.stop(); } catch { /* */ }
      await html5ScannerRef.current.clear();
    }

    const html5QrCode = new Html5Qrcode("reader-fallback", {
      formatsToSupport: HTML5_FORMATS,
      verbose: false,
    });
    html5ScannerRef.current = html5QrCode;

    const config = {
      fps: 20, // Maksimum FPS
      qrbox: (vw: number, vh: number) => ({
        width: Math.floor(vw * 0.85),
        height: Math.floor(vh * 0.6),
      }),
      disableFlip: true,
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      videoConstraints: {
        focusMode: "continuous",
        width: { min: 640, ideal: 1280, max: 1920 },
        height: { min: 480, ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 60 },
      } as MediaTrackConstraints & Record<string, unknown>,
    };

    const currentCameraId = cameraIdRef.current;
    const cameraConfig = currentCameraId
      ? { deviceId: { exact: currentCameraId } }
      : { facingMode: "environment" as const };

    await html5QrCode.start(
      cameraConfig,
      config,
      (decodedText) => emitScan(decodedText),
      () => {}
    );

    setScannerMode("fallback");
    setIsScanning(true);
  }, [emitScan]); // cameraIdRef kullanıldığı için cameraId dependency'ye gerek yok

  // ========================
  //  ANA BAŞLATMA
  // ========================
  const startScanning = useCallback(async () => {
    if (hasNativeBarcodeDetector()) {
      try {
        await startNativeScanner();
        console.log("⚡ Native BarcodeDetector aktif — donanım hızlandırmalı");
        return;
      } catch (e) {
        console.warn("Native başarısız:", e);
      }
    }
    try {
      await startFallbackScanner();
      console.log("📦 Html5Qrcode fallback aktif");
    } catch {
      alert("Kamera hatası! İzinleri kontrol edin veya sayfayı yenileyin.");
    }
  }, [startNativeScanner, startFallbackScanner]);

  // ========================
  //  DURDURMA
  // ========================
  const stopScanning = useCallback(async () => {
    scanningRef.current = false;
    processingRef.current = false;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    detectorRef.current = null;

    if (html5ScannerRef.current) {
      try { await html5ScannerRef.current.stop(); } catch { /* */ }
    }

    setScannerMode(null);
    setIsScanning(false);
  }, []);

  // Kamera değişince yeniden başlat
  useEffect(() => {
    if (isScanning) {
      const restart = async () => {
        await stopScanning();
        // Küçük gecikme: eski stream tamamen kapansın
        await new Promise(r => setTimeout(r, 300));
        await startScanning();
      };
      restart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraId]);

  // Unmount temizlik
  useEffect(() => {
    return () => {
      scanningRef.current = false;
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (html5ScannerRef.current) html5ScannerRef.current.stop().catch(() => {});
    };
  }, []);

  return (
    <Card className={`p-0 overflow-hidden bg-black border-none relative ${className}`}>
      {/* Native mod: kendi video ve canvas'ımız */}
      <video
        ref={videoRef}
        className={`w-full h-full object-cover ${scannerMode === "native" ? "" : "hidden"}`}
        playsInline
        muted
        autoPlay
      />
      {/* Kırpma işlemi için gizli canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Tarama bölgesi göstergesi (native mod) */}
      {scannerMode === "native" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div
            className="border-2 border-white/50 rounded-lg"
            style={{ width: "70%", height: "50%" }}
          >
            {/* Tarama çizgisi animasyonu */}
            <div className="absolute inset-x-0 h-0.5 bg-red-500/80 animate-scan-line" />
          </div>
        </div>
      )}

      {/* Fallback mod container */}
      <div
        id="reader-fallback"
        className={`w-full h-full bg-black ${scannerMode === "native" || scannerMode === null ? "hidden" : ""}`}
      />

      {/* Mod göstergesi */}
      {isScanning && scannerMode && (
        <div className="absolute top-2 left-2 z-20 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/60 text-white backdrop-blur-sm">
          {scannerMode === "native" ? "⚡ Hızlı" : "📦 Standart"}
        </div>
      )}

      {/* Başlat butonu */}
      {!isScanning && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <Button
            onClick={startScanning}
            variant="ios"
            size="lg"
            className="rounded-full px-8 py-6 text-xl shadow-2xl animate-pulse"
          >
            Kamerayı Aç
          </Button>
        </div>
      )}

      {/* Durdurma butonu */}
      {isScanning && (
        <Button
          onClick={stopScanning}
          variant="destructive"
          size="sm"
          className="absolute top-2 right-2 z-20 opacity-80 hover:opacity-100"
        >
          Kapat
        </Button>
      )}
    </Card>
  );
};