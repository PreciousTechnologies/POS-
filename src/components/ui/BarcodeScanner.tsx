import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CameraOff, Loader2, ScanBarcode } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { Input } from "./Input";
import { Modal } from "./Modal";

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "codabar"];

type DetectedBarcode = { rawValue: string };

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
};

type BarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

type ScannerStatus = "idle" | "starting" | "scanning" | "unsupported" | "denied" | "error";

function getDetectorConstructor() {
  const ctor = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
  return typeof ctor === "function" ? ctor : null;
}

export function BarcodeScanner({
  open,
  onClose,
  onDetected,
  title = "Scan barcode",
  description = "Point the camera at a barcode, or type the code below.",
}: {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => boolean | Promise<boolean>;
  title?: string;
  description?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const frameRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);
  const onDetectedRef = useRef(onDetected);
  const onCloseRef = useRef(onClose);

  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    onDetectedRef.current = onDetected;
    onCloseRef.current = onClose;
  }, [onDetected, onClose]);

  const stopCamera = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    detectorRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const submitCode = useCallback(async (raw: string) => {
    const code = raw.trim();
    if (!code || busyRef.current) return;
    const now = Date.now();
    if (lastScanRef.current && lastScanRef.current.code === code && now - lastScanRef.current.at < 2500) {
      return;
    }
    lastScanRef.current = { code, at: now };
    busyRef.current = true;
    setMessage(null);
    try {
      const accepted = await onDetectedRef.current(code);
      if (accepted) {
        onCloseRef.current();
      } else {
        setMessage(`No product matched barcode ${code}.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Barcode lookup failed.");
    } finally {
      window.setTimeout(() => {
        busyRef.current = false;
      }, 600);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setMessage(null);
    setManual("");
    setStatus("starting");

    const start = async () => {
      const Ctor = getDetectorConstructor();
      if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setStatus("unsupported");
        return;
      }

      try {
        const available = Ctor.getSupportedFormats ? await Ctor.getSupportedFormats() : FORMATS;
        const formats = FORMATS.filter((format) => available.includes(format));
        try {
          detectorRef.current = new Ctor(formats.length ? { formats } : undefined);
        } catch {
          detectorRef.current = new Ctor();
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => undefined);
        if (cancelled) return;
        setStatus("scanning");

        let lastTick = 0;
        const tick = async (time: number) => {
          if (cancelled || !detectorRef.current || !videoRef.current) return;
          if (time - lastTick >= 220) {
            lastTick = time;
            if (videoRef.current.readyState >= 2) {
              try {
                const results = await detectorRef.current.detect(videoRef.current);
                const code = results[0]?.rawValue;
                if (code) void submitCode(code);
              } catch {
                // Ignore frames the detector cannot decode.
              }
            }
          }
          if (!cancelled) frameRef.current = requestAnimationFrame((next) => void tick(next));
        };
        frameRef.current = requestAnimationFrame((time) => void tick(time));
      } catch (error) {
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : "";
        const denied = name === "NotAllowedError" || name === "SecurityError";
        setStatus(denied ? "denied" : "error");
        setMessage(
          denied
            ? "Camera access was blocked. Allow camera permission or type the barcode below."
            : "The camera could not be started. Type the barcode below instead.",
        );
      }
    };

    void start();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, stopCamera, submitCode]);

  const handleManualSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitCode(manual);
  };

  const scanning = status === "scanning";

  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="sm">
      <div className="barcode-scanner">
        <div className={cn("barcode-viewport", !scanning && "is-idle")}>
          <video ref={videoRef} className="barcode-video" muted playsInline autoPlay />
          {scanning ? (
            <div className="barcode-reticle" aria-hidden="true" />
          ) : (
            <div className="barcode-placeholder">
              {status === "starting" || status === "idle" ? (
                <Loader2 size={22} className="spin" />
              ) : (
                <CameraOff size={22} />
              )}
              <span>
                {status === "unsupported"
                  ? "Camera scanning isn't supported on this browser."
                  : status === "denied"
                    ? "Camera permission is blocked."
                    : status === "error"
                      ? "Camera unavailable."
                      : "Starting camera…"}
              </span>
            </div>
          )}
        </div>

        {message && (
          <div className="barcode-message" role="status">
            {message}
          </div>
        )}

        <form className="barcode-manual" onSubmit={handleManualSubmit}>
          <Input
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            placeholder="Type or scan barcode"
            aria-label="Barcode"
            autoComplete="off"
          />
          <Button type="submit" disabled={!manual.trim()} leftIcon={<ScanBarcode size={14} />}>
            Add
          </Button>
        </form>
      </div>
    </Modal>
  );
}
