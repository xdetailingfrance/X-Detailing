"use client";

import { useEffect, useRef } from "react";

export type EtatLola = "repos" | "ecoute" | "reflexion" | "parole";

// Énergie visée par état : la planète respire au repos, s'anime quand
// elle écoute, tourbillonne quand elle réfléchit et vibre quand elle parle.
const ENERGIE_CIBLE: Record<EtatLola, number> = {
  repos: 0.08,
  ecoute: 0.4,
  reflexion: 0.3,
  parole: 0.5,
};

type Particule = { rx: number; ry: number; angle: number; vitesse: number; taille: number; eclat: number };
type Continent = { lat: number; lon: number; rx: number; ry: number; alpha: number };

function aleatoire(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// Planète d'Lola, dessinée en canvas 2D. `impulsionRef` est incrémenté
// par le parent à chaque mot prononcé (événement `boundary` de la synthèse
// vocale) pour que la surface pulse au rythme de la voix.
export default function LolaPlanete({
  etat,
  impulsionRef,
}: {
  etat: EtatLola;
  impulsionRef: React.RefObject<number>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const etatRef = useRef(etat);

   useEffect(() => {
     etatRef.current = etat;
   }, [etat]);

   useEffect(() => {
     const canvas = canvasRef.current;
     const ctx = canvas?.getContext("2d");
     if (!canvas || !ctx) return;

      const mouvementReduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let taille = 0;
      const redimensionner = () => {
        const dpr = window.devicePixelRatio || 1;
        taille = canvas.clientWidth;
        canvas.width = taille * dpr;
        canvas.height = taille * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      redimensionner();
      const observateur = new ResizeObserver(redimensionner);
      observateur.observe(canvas);

      const particules: Particule[] = Array.from({ length: 70 }, () => {
        const rx = aleatoire(1.35, 1.95);
        return {
          rx,
          ry: rx * aleatoire(0.2, 0.3),
          angle: aleatoire(0, Math.PI * 2),
          vitesse: aleatoire(0.15, 0.45) / rx,
          taille: aleatoire(0.6, 2),
          eclat: aleatoire(0.3, 1),
        };
      });
      const continents: Continent[] = Array.from({ length: 9 }, () => ({
        lat: aleatoire(-1.1, 1.1),
        lon: aleatoire(0, Math.PI * 2),
        rx: aleatoire(0.12, 0.32),
        ry: aleatoire(0.06, 0.16),
        alpha: aleatoire(0.06, 0.16),
      }));

      const INCLINAISON = -0.32;
      let t = 0;
      let energie = 0.08;
      let precedent = performance.now();
      let animation = 0;

      const rayonBlob = (theta: number, R: number, amplitude: number) =>
        R *
        (1 +
          amplitude *
            (0.5 * Math.sin(3 * theta + t * 1.3) +
              0.3 * Math.sin(5 * theta - t * 1.7 + 1) +
              0.2 * Math.sin(7 * theta + t * 2.6 + 2)));

      const tracerBlob = (cx: number, cy: number, R: number, amplitude: number) => {
        ctx.beginPath();
        const N = 140;
        for (let i = 0; i <= N; i++) {
          const theta = (i / N) * Math.PI * 2;
          const r = rayonBlob(theta, R, amplitude);
          const x = cx + r * Math.cos(theta);
          const y = cy + r * Math.sin(theta);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      };

      const point = (cx: number, cy: number, x: number, y: number) => ({
        x: cx + x * Math.cos(INCLINAISON) - y * Math.sin(INCLINAISON),
        y: cy + x * Math.sin(INCLINAISON) + y * Math.cos(INCLINAISON),
      });

      const dessinerAnneau = (cx: number, cy: number, R: number, devant: boolean, alpha: number) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(INCLINAISON);
        for (const [echelle, largeur, a] of [
          [1.55, 2, 0.55],
          [1.75, 6, 0.12],
        ] as const) {
          ctx.beginPath();
          ctx.ellipse(0, 0, R * echelle, R * echelle * 0.24, 0, devant ? 0 : Math.PI, devant ? Math.PI : Math.PI *2);
             ctx.strokeStyle = `rgba(216, 180, 254, ${a * alpha})`;
             ctx.lineWidth = largeur;
             ctx.stroke();
        }
        ctx.restore();
      };

      const dessinerParticules = (cx: number, cy: number, R: number, devant: boolean) => {
        for (const p of particules) {
          const sin = Math.sin(p.angle);
          if (sin > 0 !== devant) continue;
          const { x, y } = point(cx, cy, Math.cos(p.angle) * p.rx * R, sin * p.ry * R);
          ctx.beginPath();
          ctx.arc(x, y, p.taille * (1 + energie * 0.8), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(233, 213, 255, ${p.eclat * (devant ? 0.9 : 0.35)})`;
          ctx.fill();
        }
      };

      const image = (maintenant: number) => {
        const dt = Math.min(0.05, (maintenant - precedent) / 1000) * (mouvementReduit ? 0.3 : 1);
        precedent = maintenant;
        const etatCourant = etatRef.current;

        // Impulsions de voix : décroissance exponentielle entre deux mots.
        const impulsion = impulsionRef.current ?? 0;
        impulsionRef.current = impulsion * Math.exp(-dt * 7);
        let cible = ENERGIE_CIBLE[etatCourant] + impulsion * 0.45;
        if (etatCourant === "parole") cible += 0.12 * Math.abs(Math.sin(t * 7.3) * Math.sin(t * 3.1));
        energie += (cible - energie) * Math.min(1, dt * 6);

        const vitesse = etatCourant === "reflexion" ? 3.2 : 1 + energie * 1.6;
        t += dt * vitesse;
        for (const p of particules) p.angle += p.vitesse * dt * vitesse;

        const cx = taille / 2;
        const cy = taille / 2;
        const R = taille * 0.25 * (1 + 0.015 * Math.sin(t * 1.2) + 0.06 * energie);
        const amplitude = 0.012 + 0.09 * energie;

        ctx.clearRect(0, 0, taille, taille);

        // Halo
        const halo = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 2.1);
        halo.addColorStop(0, `rgba(155, 92, 246, ${0.22 + 0.3 * energie})`);
        halo.addColorStop(1, "rgba(155, 92, 246, 0)");
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, taille, taille);

        // Ondes d'écoute
        if (etatCourant === "ecoute") {
          for (let i = 0; i < 3; i++) {
            const phase = (t * 0.35 + i / 3) % 1;
            ctx.beginPath();
            ctx.arc(cx, cy, R * (1.05 + phase * 0.95), 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(196, 165, 255, ${(1 - phase) * 0.45})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }

        const alphaAnneau = etatCourant === "reflexion" ? 0.6 + 0.4 * Math.sin(t * 4) : 0.8 + energie * 0.4;
        dessinerAnneau(cx, cy, R, false, alphaAnneau);
        dessinerParticules(cx, cy, R, false);

        // Planète
        ctx.save();
        tracerBlob(cx, cy, R, amplitude);
        const surface = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.05, cx, cy, R * 1.15);
        surface.addColorStop(0, "#f3e8ff");
        surface.addColorStop(0.25, "#b794f6");
        surface.addColorStop(0.6, "#7c3aed");
        surface.addColorStop(1, "#2e0a5c");
        ctx.fillStyle = surface;
        ctx.fill();
        ctx.clip();

        // Continents qui défilent avec la rotation
        const rotation = t * 0.25;
        for (const c of continents) {
          const lambda = c.lon + rotation;
          const profondeur = Math.cos(lambda);
          if (profondeur <= 0) continue;
          const x = cx + R * Math.cos(c.lat) * Math.sin(lambda);
             const y = cy + R * Math.sin(c.lat) * 0.92;
             ctx.beginPath();
             ctx.ellipse(x, y, R * c.rx * Math.max(0.15, profondeur), R * c.ry, 0, 0, Math.PI * 2);
             ctx.fillStyle = `rgba(255, 255, 255, ${c.alpha * profondeur})`;
             ctx.fill();
        }

        // Lueur intérieure quand Lola parle
        const coeur = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        coeur.addColorStop(0, `rgba(255, 255, 255, ${0.28 * energie})`);
        coeur.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = coeur;
        ctx.fillRect(cx - R * 1.2, cy - R * 1.2, R * 2.4, R * 2.4);

        // Ombre (face nuit)
        const ombre = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
        ombre.addColorStop(0.45, "rgba(8, 2, 24, 0)");
        ombre.addColorStop(1, "rgba(8, 2, 24, 0.65)");
        ctx.fillStyle = ombre;
        ctx.fillRect(cx - R * 1.2, cy - R * 1.2, R * 2.4, R * 2.4);
        ctx.restore();

        // Atmosphère
        ctx.save();
        tracerBlob(cx, cy, R, amplitude);
        ctx.shadowColor = "#a855f7";
        ctx.shadowBlur = 18 + 40 * energie;
        ctx.strokeStyle = `rgba(233, 213, 255, ${0.45 + 0.4 * energie})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        dessinerAnneau(cx, cy, R, true, alphaAnneau);
        dessinerParticules(cx, cy, R, true);

        animation = requestAnimationFrame(image);
      };
      animation = requestAnimationFrame(image);

      return () => {
        cancelAnimationFrame(animation);
        observateur.disconnect();
      };
    }, [impulsionRef]);

    return <canvas ref={canvasRef} className="aspect-square w-full" aria-hidden="true" />;
}

