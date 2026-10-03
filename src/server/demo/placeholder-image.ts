import { deflateSync } from "node:zlib";

/**
 * Images de remplacement du jeu de démonstration.
 *
 * Les preuves photo sont ce que l'espace admin donne à voir : sans elles, le dossier
 * d'un impayé (§36) et l'historique d'un véhicule s'affichent vides, et l'écran ne
 * démontre plus rien. On fabrique donc des vignettes — pas des photographies de
 * voitures : une image inventée qui se ferait passer pour une preuve n'aurait pas sa
 * place, même dans une démonstration. Ce sont des aplats graphite reconnaissables comme
 * tels, que l'interface légende avec l'angle et l'horodatage.
 *
 * Encodeur PNG minimal, écrit ici pour n'ajouter aucune dépendance : en-tête, IHDR,
 * IDAT compressé par `zlib`, IEND.
 */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/**
 * Vignette 320 × 240 : un dégradé graphite traversé d'une lumière rasante, teintée
 * selon `seed` pour que les huit angles d'un rendez-vous ne soient pas identiques.
 */
export function placeholderPhoto(seed: number): Buffer {
  const width = 320;
  const height = 240;
  const hue = (seed * 47) % 360;

  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    // Octet de filtre PNG : 0 = aucun.
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x++) {
      const diagonal = (x / width) * 0.6 + (1 - y / height) * 0.4;
      const base = 18 + diagonal * 26;
      const light = Math.exp(-(((x / width) - 0.25) ** 2 + ((y / height) - 0.1) ** 2) * 6) * 22;
      const level = base + light;

      // Teinte froide légère, décalée par `seed`.
      const r = Math.round(level * (0.9 + 0.2 * Math.cos((hue * Math.PI) / 180)));
      const g = Math.round(level * 0.95);
      const b = Math.round(level * (1.05 + 0.2 * Math.sin((hue * Math.PI) / 180)));

      const offset = 1 + x * 3;
      row[offset] = Math.min(255, Math.max(0, r));
      row[offset + 1] = Math.min(255, Math.max(0, g));
      row[offset + 2] = Math.min(255, Math.max(0, b));
    }
    rows.push(row);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits par canal
  ihdr[9] = 2; // couleur vraie, sans alpha
  // Les trois octets suivants — compression, filtre, entrelacement — restent à 0.

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Paraphe manuscrit, dans le repère 1000 × 300 qu'utilise le pavé de signature.
 *
 * Une sinusoïde amortie et bruitée : le tracé n'est pas régulier, ce qu'aucune main
 * ne produit non plus.
 */
export function placeholderSignature(seed: number): string {
  const points: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const x = 120 + t * 720;
    const wobble = Math.sin(t * 14 + seed) * 46 * Math.exp(-t * 1.2);
    const drift = Math.sin(t * 3.1 + seed * 0.7) * 22;
    points.push(`${x.toFixed(1)},${(170 + wobble + drift).toFixed(1)}`);
  }
  return JSON.stringify([`M ${points.join(" L ")}`]);
}
