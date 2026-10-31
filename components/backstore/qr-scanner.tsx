"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { CameraOff } from "lucide-react";

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
declare global {
  // Chrome / Android ship a native QR decoder; Safari doesn't, so jsQR reads the frames there.
  var BarcodeDetector: (new (opts: { formats: string[] }) => Detector) | undefined;
}

/** Live camera view that calls `onScan` with each QR code it reads (same code at most once every 2 s). */
export function QrScanner({ onScan, paused = false }: { onScan: (text: string) => void; paused?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  const pausedRef = useRef(paused);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
    pausedRef.current = paused;
  });

  useEffect(() => {
    let stream: MediaStream | undefined;
    let frame = 0;
    let stopped = false;
    let last = { text: "", at: 0 };
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const native = globalThis.BarcodeDetector ? new globalThis.BarcodeDetector({ formats: ["qr_code"] }) : null;

    async function read(v: HTMLVideoElement) {
      if (native) return (await native.detect(v))[0]?.rawValue;
      if (!ctx) return;
      // Decoding a downscaled frame is plenty for a label held near the camera, and much faster.
      const scale = Math.min(1, 640 / v.videoWidth);
      canvas.width = v.videoWidth * scale;
      canvas.height = v.videoHeight * scale;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data;
    }

    async function tick() {
      if (stopped) return;
      const v = video.current;
      if (v && v.readyState >= 2 && !pausedRef.current) {
        try {
          const text = await read(v);
          const now = Date.now();
          if (text && (text !== last.text || now - last.at > 2000)) {
            last = { text, at: now };
            onScanRef.current(text);
          }
        } catch {
          // A frame that can't be read is just skipped.
        }
      }
      frame = window.setTimeout(() => requestAnimationFrame(tick), 150);
    }

    // navigator.mediaDevices only exists on HTTPS (and localhost).
    const media = navigator.mediaDevices;
    (media ? media.getUserMedia({ video: { facingMode: "environment" }, audio: false }) : Promise.reject(null))
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
        tick();
      })
      .catch(() =>
        setError(
          media
            ? "Camera not available — allow camera access, or type / scan the serial below."
            : "Camera needs HTTPS — type or use a USB scanner below.",
        ),
      );

    return () => {
      stopped = true;
      clearTimeout(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (error) {
    return (
      <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        <CameraOff className="size-6" />
        {error}
      </div>
    );
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black">
      <video ref={video} muted playsInline className="size-full object-cover" />
      <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-white/80 shadow-[0_0_0_100vmax_rgba(0,0,0,0.35)]" />
    </div>
  );
}
