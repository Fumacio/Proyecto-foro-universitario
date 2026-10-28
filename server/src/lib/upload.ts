import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { env } from '../env.js';
import { HttpError } from './errors.js';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME: Record<string, ImageKind> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

type ImageKind = 'png' | 'jpg' | 'webp' | 'gif';

mkdirSync(env.UPLOAD_DIR, { recursive: true });

/** multer en memoria: validamos los magic bytes antes de escribir a disco. */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 5 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME[file.mimetype.toLowerCase()]) cb(null, true);
    else cb(new HttpError(400, 'VALIDATION', 'Solo se permiten imágenes PNG, JPG, WEBP o GIF', { file: 'Formato no permitido' }));
  },
}).single('file');

/** Detecta el tipo real del archivo por sus primeros bytes. */
export function detectImageKind(buf: Buffer): ImageKind | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 6) {
    const head = buf.subarray(0, 6).toString('ascii');
    if (head === 'GIF87a' || head === 'GIF89a') return 'gif';
  }
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'webp';
  }
  return null;
}

/** Valida y guarda la imagen; devuelve la URL pública (`/uploads/xxxx.ext`). */
export async function saveImage(file: Express.Multer.File | undefined): Promise<string> {
  if (!file) throw new HttpError(400, 'VALIDATION', 'Elegí una imagen para subir', { file: 'Elegí una imagen para subir' });
  const declared = ALLOWED_MIME[file.mimetype.toLowerCase()];
  const kind = detectImageKind(file.buffer);
  if (!declared || !kind) {
    throw new HttpError(400, 'VALIDATION', 'El archivo no es una imagen válida', { file: 'El archivo no es una imagen válida' });
  }
  const name = `${crypto.randomBytes(16).toString('hex')}.${kind}`;
  await fs.writeFile(path.join(env.UPLOAD_DIR, name), file.buffer, { flag: 'wx' });
  return `/uploads/${name}`;
}

/** Guarda una imagen ya descargada (p. ej. la foto de Google). null si no es una imagen válida. */
export async function saveImageBuffer(buf: Buffer): Promise<string | null> {
  if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES) return null;
  const kind = detectImageKind(buf);
  if (!kind) return null;
  const name = `${crypto.randomBytes(16).toString('hex')}.${kind}`;
  await fs.writeFile(path.join(env.UPLOAD_DIR, name), buf, { flag: 'wx' });
  return `/uploads/${name}`;
}

const UPLOAD_URL_RE = /^\/uploads\/[A-Za-z0-9_-]+\.(?:png|jpg|jpeg|webp|gif)$/;
/** Nombres que sirve el estático público /uploads (solo imágenes en la raíz, nunca files/). */
export const PUBLIC_UPLOAD_PATH_RE = /^\/[A-Za-z0-9_-]+\.(?:png|jpg|jpeg|webp|gif)$/;

export function isUploadUrl(url: string): boolean {
  return UPLOAD_URL_RE.test(url);
}

/** Borra un archivo subido (ignora URLs ajenas o archivos inexistentes). */
export async function deleteUpload(url: string | null | undefined): Promise<void> {
  if (!url || !isUploadUrl(url)) return;
  const file = path.join(env.UPLOAD_DIR, path.basename(url));
  await fs.unlink(file).catch(() => undefined);
}
