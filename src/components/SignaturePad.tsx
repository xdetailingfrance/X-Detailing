"use client";

import { useRef, useState } from "react";

// Capture de signature manuscrite au doigt/souris sur canvas — simulation
// locale (aucun service de signature électronique tiers) : le tracé est
// exporté en dataURL PNG et envoyé au serveur qui l'attache au RDV.
export default function SignaturePad({
  label,
  onValider,
  disabled,
}: {
  label: string;
  onValider: (dataUrl: string) => void;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dessineRef = useRef(false);
  const [aDessine, setADessine] = useState(false);
  const [envoi, setEnvoi] = useState(false);

   function position(e: React.PointerEvent<HTMLCanvasElement>) {
     const canvas = canvasRef.current!;
     const rect = canvas.getBoundingClientRect();
     return { x: e.clientX - rect.left, y: e.clientY - rect.top };
   }

   function demarrer(e: React.PointerEvent<HTMLCanvasElement>) {
     if (disabled) return;
     const ctx = canvasRef.current?.getContext("2d");
     if (!ctx) return;
     dessineRef.current = true;
     const { x, y } = position(e);
     ctx.beginPath();
     ctx.moveTo(x, y);
   }

   function tracer(e: React.PointerEvent<HTMLCanvasElement>) {
       if (!dessineRef.current || disabled) return;
       const ctx = canvasRef.current?.getContext("2d");
       if (!ctx) return;
       const { x, y } = position(e);
       ctx.lineWidth = 2.5;
       ctx.lineCap = "round";
       ctx.strokeStyle = "#111827";
       ctx.lineTo(x, y);
       ctx.stroke();
       setADessine(true);
   }

   function arreter() {
     dessineRef.current = false;
   }

   function effacer() {
     const canvas = canvasRef.current;
     const ctx = canvas?.getContext("2d");
     if (!canvas || !ctx) return;
     ctx.clearRect(0, 0, canvas.width, canvas.height);
     setADessine(false);
   }

   async function valider() {
     const canvas = canvasRef.current;
     if (!canvas || !aDessine) return;
     setEnvoi(true);
     const dataUrl = canvas.toDataURL("image/png");
     await onValider(dataUrl);
     setEnvoi(false);
   }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{label}</p>
      <canvas
        ref={canvasRef}
        width={320}
        height={140}
        onPointerDown={demarrer}
        onPointerMove={tracer}
        onPointerUp={arreter}
        onPointerLeave={arreter}
        className="rounded-md border border-[var(--border)] bg-white touch-none w-full max-w-sm"
        style={{ cursor: disabled ? "not-allowed" : "crosshair" }}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={effacer}
          disabled={disabled || envoi}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--surface-2)] disabled:opacity-50"
        >
          Effacer
        </button>
        <button
          type="button"
          onClick={valider}
          disabled={disabled || envoi || !aDessine}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--accent-2)] transition disabled:opacity-50"
        >
          {envoi ? "Enregistrement…" : "Valider la signature"}
        </button>
      </div>
    </div>
  );
}

