import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif"
};

export type StoredAvatar = {
  storageKey: string;
  url: string;
};

export type StoredAvatarContent = {
  data: Buffer;
  mimeType: string;
};

export interface AvatarStorageClient {
  saveAvatar(params: { userId: string; mimeType: string; data: Buffer }): Promise<StoredAvatar>;
  readAvatar(storageKey: string): Promise<StoredAvatarContent | null>;
  deleteAvatar(storageKey: string): Promise<void>;
}

export class LocalAvatarStorageClient implements AvatarStorageClient {
  constructor(
    private readonly baseDirectory: string,
    private readonly publicBaseUrl: string
  ) {}

  async saveAvatar(params: { userId: string; mimeType: string; data: Buffer }): Promise<StoredAvatar> {
    const extension = MIME_TO_EXTENSION[params.mimeType];
    if (!extension) {
      throw new Error("Unsupported avatar mime type.");
    }

    await mkdir(this.baseDirectory, { recursive: true });
    const storageKey = `${params.userId}-${randomUUID()}.${extension}`;
    const filePath = path.join(this.baseDirectory, storageKey);
    await writeFile(filePath, params.data);

    return {
      storageKey,
      url: `${this.publicBaseUrl}/${storageKey}`
    };
  }

  async readAvatar(storageKey: string): Promise<StoredAvatarContent | null> {
    const safeKey = path.basename(storageKey);
    const filePath = path.join(this.baseDirectory, safeKey);

    try {
      const data = await readFile(filePath);
      const extension = path.extname(safeKey).replace(".", "").toLowerCase();
      return {
        data,
        mimeType: EXTENSION_TO_MIME[extension] ?? "application/octet-stream"
      };
    } catch {
      return null;
    }
  }

  async deleteAvatar(storageKey: string): Promise<void> {
    const safeKey = path.basename(storageKey);
    const filePath = path.join(this.baseDirectory, safeKey);
    try {
      await unlink(filePath);
    } catch {
      // Intentionally ignore missing files for idempotent delete behavior.
    }
  }
}
