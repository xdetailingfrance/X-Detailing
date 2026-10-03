import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Génère les JPEG de référence des tests photo.
 *
 * Écrits à la main plutôt qu'engendrés par une librairie : on veut contrôler exactement
 * la structure EXIF que le parseur doit savoir lire.
 */

const OUT = path.join(process.cwd(), "tests", "fixtures", "photos");

/** JPEG minimal valide : SOI, un APP0 JFIF, puis EOI. */
function baseJpeg(): Buffer {
  return Buffer.from([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00,
    0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xd9,
  ]);
}

/** Insère un segment APP1 Exif portant DateTimeOriginal. */
function withDateTimeOriginal(value: string): Buffer {
  const ascii = Buffer.from(`${value}\0`, "ascii");

  // En-tête TIFF little-endian, IFD0 à l'offset 8.
  const tiff = Buffer.alloc(8);
  tiff.write("II", 0, "ascii");
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);

  // IFD0 : une entrée, le pointeur vers l'IFD Exif.
  const ifd0 = Buffer.alloc(2 + 12 + 4);
  ifd0.writeUInt16LE(1, 0);
  ifd0.writeUInt16LE(0x8769, 2); // ExifIFDPointer
  ifd0.writeUInt16LE(4, 4); // LONG
  ifd0.writeUInt32LE(1, 6);
  ifd0.writeUInt32LE(8 + ifd0.length, 10); // offset de l'IFD Exif
  ifd0.writeUInt32LE(0, 14); // pas d'IFD suivant

  // IFD Exif : une entrée, DateTimeOriginal, valeur hors ligne.
  const exifIfd = Buffer.alloc(2 + 12 + 4);
  exifIfd.writeUInt16LE(1, 0);
  exifIfd.writeUInt16LE(0x9003, 2); // DateTimeOriginal
  exifIfd.writeUInt16LE(2, 4); // ASCII
  exifIfd.writeUInt32LE(ascii.length, 6);
  exifIfd.writeUInt32LE(8 + ifd0.length + exifIfd.length, 10);
  exifIfd.writeUInt32LE(0, 14);

  const payload = Buffer.concat([
    Buffer.from("Exif\0\0", "ascii"),
    tiff,
    ifd0,
    exifIfd,
    ascii,
  ]);

  const app1 = Buffer.alloc(4);
  app1.writeUInt16BE(0xffe1, 0);
  app1.writeUInt16BE(payload.length + 2, 2);

  const base = baseJpeg();
  return Buffer.concat([base.subarray(0, 2), app1, payload, base.subarray(2)]);
}

async function main() {
  await mkdir(OUT, { recursive: true });

  await writeFile(path.join(OUT, "avec-exif.jpg"), withDateTimeOriginal("2026:09:15 14:32:07"));
  await writeFile(path.join(OUT, "sans-exif.jpg"), baseJpeg());
  await writeFile(
    path.join(OUT, "pas-jpeg.bin"),
    Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]),
  );

  console.info(`Fichiers de référence écrits dans ${OUT}`);
}

main();
