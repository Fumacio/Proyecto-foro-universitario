/**
 * Archivos adjuntos: tipos permitidos, verificación del contenido real (magic bytes),
 * saneado del nombre y cabeceras de descarga. Los archivos viven en UPLOAD_DIR/files/<storedName>,
 * que NO se sirve por el estático público /uploads: solo por /api/attachments/:id/download|view.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { env } from '../env.js';
import { HttpError } from './errors.js';
import type { AttachmentKind } from './types.js';

export const FILES_DIR = path.join(env.UPLOAD_DIR, 'files');
fs.mkdirSync(FILES_DIR, { recursive: true });

export const MB = 1024 * 1024;
export const maxUploadBytes = (): number => Math.round(env.MAX_UPLOAD_MB * MB);
export const dailyQuotaBytes = (): number => Math.round(env.UPLOAD_QUOTA_MB_PER_DAY * MB);

type Signature = 'png' | 'jpeg' | 'gif' | 'webp' | 'pdf' | 'zip' | 'ole2' | 'rtf' | 'rar' | '7z' | 'text';

interface FileType {
  kind: AttachmentKind;
  mime: string;
  sig: Signature;
}

const TEXT_PLAIN = 'text/plain';
const text = (kind: AttachmentKind = 'TEXT', mime = TEXT_PLAIN): FileType => ({ kind, mime, sig: 'text' });

/** Extensión (en minúsculas) → tipo. Todo lo que no esté acá se rechaza (SVG incluido). */
export const FILE_TYPES: Readonly<Record<string, FileType>> = {
  png: { kind: 'IMAGE', mime: 'image/png', sig: 'png' },
  jpg: { kind: 'IMAGE', mime: 'image/jpeg', sig: 'jpeg' },
  jpeg: { kind: 'IMAGE', mime: 'image/jpeg', sig: 'jpeg' },
  gif: { kind: 'IMAGE', mime: 'image/gif', sig: 'gif' },
  webp: { kind: 'IMAGE', mime: 'image/webp', sig: 'webp' },
  pdf: { kind: 'PDF', mime: 'application/pdf', sig: 'pdf' },
  doc: { kind: 'DOCUMENT', mime: 'application/msword', sig: 'ole2' },
  docx: { kind: 'DOCUMENT', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sig: 'zip' },
  odt: { kind: 'DOCUMENT', mime: 'application/vnd.oasis.opendocument.text', sig: 'zip' },
  rtf: { kind: 'DOCUMENT', mime: 'application/rtf', sig: 'rtf' },
  xls: { kind: 'SPREADSHEET', mime: 'application/vnd.ms-excel', sig: 'ole2' },
  xlsx: { kind: 'SPREADSHEET', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', sig: 'zip' },
  ods: { kind: 'SPREADSHEET', mime: 'application/vnd.oasis.opendocument.spreadsheet', sig: 'zip' },
  csv: text('SPREADSHEET', 'text/csv'),
  ppt: { kind: 'PRESENTATION', mime: 'application/vnd.ms-powerpoint', sig: 'ole2' },
  pptx: { kind: 'PRESENTATION', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', sig: 'zip' },
  odp: { kind: 'PRESENTATION', mime: 'application/vnd.oasis.opendocument.presentation', sig: 'zip' },
  zip: { kind: 'ARCHIVE', mime: 'application/zip', sig: 'zip' },
  rar: { kind: 'ARCHIVE', mime: 'application/vnd.rar', sig: 'rar' },
  '7z': { kind: 'ARCHIVE', mime: 'application/x-7z-compressed', sig: '7z' },
  txt: text(),
  md: text(),
  c: text(),
  h: text(),
  cpp: text(),
  hpp: text(),
  cs: text(),
  java: text(),
  py: text(),
  js: text(),
  ts: text(),
  sql: text(),
  json: text(),
  xml: text(),
  html: text(),
  css: text(),
  ipynb: text(),
};

const bytes = (...b: number[]) => Buffer.from(b);
const SIGNATURES: Partial<Record<Signature, Buffer[]>> = {
  png: [bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)],
  jpeg: [bytes(0xff, 0xd8, 0xff)],
  gif: [Buffer.from('GIF87a'), Buffer.from('GIF89a')],
  pdf: [Buffer.from('%PDF-')],
  zip: [bytes(0x50, 0x4b, 0x03, 0x04)],
  ole2: [bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)],
  rtf: [Buffer.from('{\\rtf')],
  rar: [bytes(0x52, 0x61, 0x72, 0x21, 0x1a, 0x07)],
  '7z': [bytes(0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c)],
};

function matchesSignature(head: Buffer, sig: Signature): boolean {
  if (sig === 'webp') {
    return head.length >= 12 && head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP';
  }
  return (SIGNATURES[sig] ?? []).some((s) => head.length >= s.length && head.subarray(0, s.length).equals(s));
}

/** Texto: UTF-8 válido (todo el archivo) y sin bytes nulos. */
async function isUtf8Text(filePath: string): Promise<boolean> {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    for await (const chunk of fs.createReadStream(filePath, { highWaterMark: 64 * 1024 })) {
      const buf = chunk as Buffer;
      if (buf.includes(0)) return false;
      decoder.decode(buf, { stream: true });
    }
    decoder.decode();
    return true;
  } catch {
    return false;
  }
}

async function readHead(filePath: string, length = 16): Promise<Buffer> {
  const fh = await fsp.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(length);
    const { bytesRead } = await fh.read(buf, 0, length, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : '';
}

export function fileTypeFor(filename: string): FileType | null {
  const ext = extensionOf(filename);
  return Object.hasOwn(FILE_TYPES, ext) ? FILE_TYPES[ext]! : null;
}

/** Verifica que el contenido real coincida con la extensión. */
export async function contentMatches(filePath: string, type: FileType): Promise<boolean> {
  if (type.sig === 'text') return isUtf8Text(filePath);
  return matchesSignature(await readHead(filePath), type.sig);
}

const STRIP_CHARS = /[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/g;

/**
 * Nombre original saneado: sin rutas ni caracteres de control/bidi, máx 120 caracteres
 * conservando la extensión. Nunca devuelve "".
 */
export function sanitizeFilename(raw: string, maxLength = 120): string {
  let name = (raw || '').normalize('NFC');
  name = name.split(/[\\/]/).pop() ?? '';
  name = name.replace(STRIP_CHARS, '');
  name = name.replace(/[<>:"|?*]/g, '_');
  name = name.replace(/\s+/g, ' ').trim();
  name = name.replace(/^[.\s]+/, '').replace(/[.\s]+$/, '');
  const dot = name.lastIndexOf('.');
  let base = dot > 0 ? name.slice(0, dot).trim() : name;
  const ext = dot > 0 ? name.slice(dot + 1).trim() : '';
  if (!base) base = 'archivo';
  const room = ext ? maxLength - ext.length - 1 : maxLength;
  const chars = Array.from(base);
  if (chars.length > room) base = chars.slice(0, Math.max(1, room)).join('').trimEnd();
  const full = ext ? `${base}.${ext}` : base;
  return Array.from(full).slice(0, maxLength).join('');
}

/** `Content-Disposition` con fallback ASCII y `filename*` UTF-8 (RFC 6266 / 5987). */
export function contentDisposition(type: 'attachment' | 'inline', filename: string): string {
  const fallback =
    filename
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7e]/g, '_')
      .replace(/["\\%]/g, '_')
      .trim() || 'archivo';
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

const STORED_NAME_RE = /^[a-f0-9]{32}$/;

export function storedFilePath(storedName: string): string | null {
  return STORED_NAME_RE.test(storedName) ? path.join(FILES_DIR, storedName) : null;
}

/** Borra archivos del disco (ignora los que no existen). */
export async function removeStoredFiles(storedNames: Iterable<string>): Promise<void> {
  await Promise.all(
    [...storedNames].map(async (name) => {
      const file = storedFilePath(name);
      if (file) await fsp.unlink(file).catch(() => undefined);
    }),
  );
}

export const notAllowedError = () =>
  new HttpError(400, 'VALIDATION', 'Tipo de archivo no permitido', { file: 'Tipo de archivo no permitido' });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, FILES_DIR),
  filename: (_req, _file, cb) => cb(null, crypto.randomBytes(16).toString('hex')),
});

/** multer a disco (UPLOAD_DIR/files), campo `file`. Rechaza por extensión antes de escribir. */
export const attachmentUpload: RequestHandler = (req, res, next) => {
  const limitMb = env.MAX_UPLOAD_MB;
  multer({
    storage,
    limits: { fileSize: maxUploadBytes(), files: 1, fields: 5, parts: 10 },
    // Los navegadores mandan el nombre en UTF-8 (multer por defecto lo lee como latin1).
    defParamCharset: 'utf8',
    fileFilter: (_req, file, cb) => {
      if (fileTypeFor(sanitizeFilename(file.originalname))) cb(null, true);
      else cb(notAllowedError());
    },
  }).single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      const msg =
        err.code === 'LIMIT_FILE_SIZE'
          ? `El archivo supera el máximo de ${limitMb} MB`
          : err.code === 'LIMIT_UNEXPECTED_FILE'
            ? 'El archivo tiene que venir en el campo "file"'
            : err.code === 'LIMIT_FILE_COUNT'
              ? 'Subí un solo archivo por vez'
              : 'No se pudo procesar el archivo';
      next(new HttpError(400, 'VALIDATION', msg, { file: msg }));
      return;
    }
    next(err as Error | undefined);
  });
};
