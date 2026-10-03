/**
 * Preuves photo (§13, §15, §26).
 *
 * « Idéalement prise directement avec l'appareil photo de l'application afin d'éviter
 * l'utilisation d'anciennes photos de galerie. »
 *
 * Un drapeau « prise dans l'app » envoyé par le client se falsifie en une ligne. Le seul
 * signal qui vaille est l'horodatage EXIF écrit par le capteur, que l'on lit ici côté
 * serveur et que l'on compare à l'heure d'arrivée de l'opérateur.
 *
 * LIMITE ASSUMÉE : le web ne permet pas de *garantir* qu'un fichier vient du capteur. La
 * combinaison horodatage + position + délai depuis l'arrivée rend la fraude détectable et
 * traçable, pas impossible. Un verrou dur demanderait une application native.
 */

const JPEG_SOI = 0xffd8;
const APP1 = 0xffe1;
const TAG_EXIF_IFD_POINTER = 0x8769;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TYPE_ASCII = 2;

/** Localise le segment APP1 « Exif\0\0 » et retourne l'offset de son en-tête TIFF. */
function findExifTiffOffset(buffer: Buffer): number | null {
  if (buffer.length < 4 || buffer.readUInt16BE(0) !== JPEG_SOI) return null;

  let offset = 2;
  while (offset + 4 <= buffer.length) {
    const marker = buffer.readUInt16BE(offset);
    if ((marker & 0xff00) !== 0xff00) return null;

    const length = buffer.readUInt16BE(offset + 2);
    if (marker === APP1) {
      const header = offset + 4;
      if (buffer.toString("ascii", header, header + 6) === "Exif\0\0") return header + 6;
    }

    // SOS : les données image commencent, plus aucun segment de métadonnées après.
    if (marker === 0xffda) return null;
    offset += 2 + length;
  }
  return null;
}

type Reader = {
  u16: (at: number) => number;
  u32: (at: number) => number;
};

function readerFor(buffer: Buffer, tiff: number): Reader | null {
  const byteOrder = buffer.toString("ascii", tiff, tiff + 2);
  if (byteOrder === "II") {
    return { u16: (at) => buffer.readUInt16LE(at), u32: (at) => buffer.readUInt32LE(at) };
  }
  if (byteOrder === "MM") {
    return { u16: (at) => buffer.readUInt16BE(at), u32: (at) => buffer.readUInt32BE(at) };
  }
  return null;
}

/** Parcourt un IFD et retourne la valeur brute de `wantedTag`, s'il s'y trouve. */
function findTag(
  buffer: Buffer,
  read: Reader,
  tiff: number,
  ifdOffset: number,
  wantedTag: number,
): { type: number; count: number; valueOffset: number } | null {
  const ifd = tiff + ifdOffset;
  if (ifd + 2 > buffer.length) return null;

  const entries = read.u16(ifd);
  for (let i = 0; i < entries; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > buffer.length) return null;

    if (read.u16(entry) === wantedTag) {
      const type = read.u16(entry + 2);
      const count = read.u32(entry + 4);
      const inline = count * (type === TYPE_ASCII ? 1 : 4) <= 4;
      return { type, count, valueOffset: inline ? entry + 8 : tiff + read.u32(entry + 8) };
    }
  }
  return null;
}

/**
 * Horodatage de prise de vue (`DateTimeOriginal`), en heure locale de l'appareil.
 * Retourne `null` si la photo n'a pas d'EXIF — ce qui est en soi un signal.
 */
export function readExifTakenAt(buffer: Buffer): Date | null {
  try {
    const tiff = findExifTiffOffset(buffer);
    if (tiff === null) return null;

    const read = readerFor(buffer, tiff);
    if (!read) return null;

    const ifd0 = read.u32(tiff + 4);
    const pointer = findTag(buffer, read, tiff, ifd0, TAG_EXIF_IFD_POINTER);
    if (!pointer) return null;

    const exifIfd = read.u32(pointer.valueOffset);
    const tag = findTag(buffer, read, tiff, exifIfd, TAG_DATETIME_ORIGINAL);
    if (!tag || tag.type !== TYPE_ASCII) return null;

    // Format EXIF : « 2026:09:15 14:32:07 »
    const raw = buffer.toString("ascii", tag.valueOffset, tag.valueOffset + 19);
    const match = raw.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!match) return null;

    const [, year, month, day, hour, minute, second] = match;
    const date = new Date(
      `${year}-${month}-${day}T${hour}:${minute}:${second}`,
    );
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

export type PhotoVerdict = {
  /** `false` quand la photo est manifestement antérieure à l'arrivée sur place. */
  accepted: boolean;
  reason?: string;
  exifTakenAt: Date | null;
  /** Signaux à conserver pour l'audit, même quand la photo est acceptée. */
  flags: string[];
};

/** Tolérance sur l'horloge de l'appareil, souvent décalée de quelques minutes. */
const CLOCK_TOLERANCE_MIN = 15;

export function verifyPhoto(input: {
  buffer: Buffer;
  arrivedAt: Date | null;
  now: Date;
  declaredInApp: boolean;
}): PhotoVerdict {
  const exifTakenAt = readExifTakenAt(input.buffer);
  const flags: string[] = [];

  if (!input.declaredInApp) flags.push("import depuis la galerie déclaré");
  if (!exifTakenAt) {
    // Sans EXIF, on ne peut rien prouver ; on le note plutôt que de refuser, car
    // certains navigateurs retirent les métadonnées.
    flags.push("aucun horodatage EXIF");
    return { accepted: true, exifTakenAt: null, flags };
  }

  if (input.arrivedAt) {
    const minutesBeforeArrival =
      (input.arrivedAt.getTime() - exifTakenAt.getTime()) / 60_000;

    if (minutesBeforeArrival > CLOCK_TOLERANCE_MIN) {
      return {
        accepted: false,
        exifTakenAt,
        flags: [...flags, "antérieure à l'arrivée"],
        reason:
          `Cette photo a été prise ${Math.round(minutesBeforeArrival)} min avant votre arrivée. ` +
          "Prenez-la maintenant avec l'appareil photo.",
      };
    }
  }

  const minutesInFuture = (exifTakenAt.getTime() - input.now.getTime()) / 60_000;
  if (minutesInFuture > CLOCK_TOLERANCE_MIN) flags.push("horloge de l'appareil en avance");

  return { accepted: true, exifTakenAt, flags };
}
