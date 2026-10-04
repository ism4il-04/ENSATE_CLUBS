"use client";

import { useEffect, useRef, useState } from "react";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/**
 * Lecteur de QR par la caméra arrière.
 * Utilise BarcodeDetector (Chrome / Android) et se rabat sur jsQR (iPhone, Firefox).
 */
export function QrScanner({ active, onScan }: { active: boolean; onScan: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const last = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const onScanRef = useRef(onScan);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval>;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const emit = (text: string) => {
      const now = Date.now();
      if (text === last.current.text && now - last.current.at < 2500) return; // évite les doubles lectures
      last.current = { text, at: now };
      onScanRef.current(text);
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();

        const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
        const detector = BD ? new BD({ formats: ["qr_code"] }) : null;
        const jsQR = detector ? null : (await import("jsqr")).default;

        timer = setInterval(async () => {
          if (!video.videoWidth) return;
          if (detector) {
            const codes = await detector.detect(video).catch(() => []);
            if (codes[0]?.rawValue) emit(codes[0].rawValue);
          } else if (jsQR && ctx) {
            const w = 480;
            const h = Math.round((video.videoHeight / video.videoWidth) * w);
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(video, 0, 0, w, h);
            const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
            if (code?.data) emit(code.data);
          }
        }, 250);
      } catch {
        setError("Caméra indisponible : autorise l'accès à la caméra, ou utilise la recherche par nom.");
      }
    })();

    return () => {
      stopped = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active]);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-[30px] bg-[radial-gradient(circle_at_50%_40%,#232636_0%,#101119_70%)]">
      {active && <video ref={videoRef} playsInline muted className="absolute inset-0 size-full object-cover" />}
      {(["top-8 left-8 border-t-[5px] border-l-[5px] rounded-tl-2xl", "top-8 right-8 border-t-[5px] border-r-[5px] rounded-tr-2xl", "bottom-8 left-8 border-b-[5px] border-l-[5px] rounded-bl-2xl", "bottom-8 right-8 border-b-[5px] border-r-[5px] rounded-br-2xl"] as const).map((c) => (
        <span key={c} aria-hidden className={`absolute size-12 border-accent ${c}`} />
      ))}
      <span className="absolute inset-x-0 bottom-3 text-center text-[13px] font-bold text-muted">{error ?? (active ? "Vise le QR du billet" : "Caméra en pause")}</span>
    </div>
  );
}
