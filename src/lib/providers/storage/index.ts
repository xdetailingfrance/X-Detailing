import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

/**
 * Stockage des preuves photo (§13, §15, §26, §32).
 *
 * Les photos sont des données personnelles : véhicule, plaque, domicile du client
 * (§31). Elles ne sont donc **jamais** écrites dans `public/`, où elles seraient
 * servies sans authentification à qui devine l'URL. Elles sortent par une route
 * contrôlée, qui vérifie le rôle de l'appelant.
 */

export type StoredFile = {
  /** Chemin logique, stocké en base. Jamais une URL publique. */
  key: string;
  bytes: number;
  sha256: string;
};

export interface StorageProvider {
  readonly name: string;
  put(data: Buffer, options: { extension: string; prefix: string }): Promise<StoredFile>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

class LocalStorageProvider implements StorageProvider {
  readonly name = "local";

  constructor(private readonly root: string) {}

  /** Empêche qu'une clé venue de la base ne remonte hors du répertoire de stockage. */
  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) {
      throw new Error("Clé de stockage hors du répertoire autorisé");
    }
    return full;
  }

  async put(data: Buffer, options: { extension: string; prefix: string }): Promise<StoredFile> {
    const key = path.join(options.prefix, `${randomUUID()}.${options.extension}`);
    const full = this.resolve(key);

    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);

    return {
      key,
      bytes: data.byteLength,
      sha256: createHash("sha256").update(data).digest("hex"),
    };
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async remove(key: string): Promise<void> {
    await unlink(this.resolve(key)).catch(() => undefined);
  }
}

/**
 * Stockage en base.
 *
 * Nécessaire dès que l'hébergeur n'offre pas de disque persistant : sur Vercel et la
 * plupart des plateformes serverless, un fichier écrit sur disque disparaît entre deux
 * requêtes. Une preuve photo ne peut pas dépendre de ça.
 *
 * Le prix est connu : les images transitent par la base. Acceptable pour une
 * démonstration et un réseau de quelques opérateurs ; au-delà, S3 ou R2.
 */
class DatabaseStorageProvider implements StorageProvider {
  readonly name = "database";

  async put(data: Buffer, options: { extension: string; prefix: string }): Promise<StoredFile> {
    const { prisma } = await import("@/server/db");

    const key = path.posix.join(options.prefix, `${randomUUID()}.${options.extension}`);
    const sha256 = createHash("sha256").update(data).digest("hex");

    await prisma.storedFile.create({
      data: { key, data: new Uint8Array(data), bytes: data.byteLength, sha256 },
    });

    return { key, bytes: data.byteLength, sha256 };
  }

  async get(key: string): Promise<Buffer> {
    const { prisma } = await import("@/server/db");
    const file = await prisma.storedFile.findUnique({ where: { key }, select: { data: true } });
    if (!file) throw new Error(`Fichier absent du stockage : ${key}`);
    return Buffer.from(file.data);
  }

  async remove(key: string): Promise<void> {
    const { prisma } = await import("@/server/db");
    await prisma.storedFile.deleteMany({ where: { key } });
  }
}

let cached: StorageProvider | null = null;

export function storageProvider(): StorageProvider {
  if (cached) return cached;

  // Par défaut en base : c'est le seul choix qui fonctionne partout. Le disque local
  // reste préférable en développement, où il permet d'inspecter les fichiers.
  cached =
    (process.env.STORAGE_PROVIDER ?? "database") === "local"
      ? new LocalStorageProvider(
          process.env.STORAGE_LOCAL_PATH ?? path.join(process.cwd(), ".data", "photos"),
        )
      : new DatabaseStorageProvider();

  return cached;
}
