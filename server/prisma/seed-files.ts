/**
 * Archivos de ejemplo que genera el seed (sin dependencias): un PDF de varias páginas armado a mano,
 * un PNG con un gráfico y algunos archivos de texto/código.
 */
import zlib from 'node:zlib';

// ---------- PDF ----------

type PdfLine = { text: string; size?: number; bold?: boolean; color?: [number, number, number]; gap?: number; indent?: number; col2?: string };

const WIN_ANSI: Record<string, number> = {
  '€': 0x80, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
};

/** Texto → string PDF en WinAnsiEncoding (1 char = 1 byte) con escapes. */
function pdfText(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    let byte: number;
    if (code >= 0x20 && code <= 0x7e) byte = code;
    else if (code >= 0xa0 && code <= 0xff) byte = code;
    else byte = WIN_ANSI[ch] ?? 0x3f; // '?'
    const c = String.fromCharCode(byte);
    out += c === '(' || c === ')' || c === '\\' ? `\\${c}` : c;
  }
  return out;
}

/** Strings del diccionario Info: UTF-16BE con BOM (hex), para acentos y guiones largos. */
function pdfUtf16(s: string): string {
  const buf = Buffer.from(s, 'utf16le');
  buf.swap16();
  return `<FEFF${buf.toString('hex').toUpperCase()}>`;
}

const BRAND: [number, number, number] = [0.427, 0.365, 0.988];
const INK: [number, number, number] = [0.12, 0.13, 0.2];
const MUTED: [number, number, number] = [0.42, 0.44, 0.53];

function pageStream(title: string, pageNo: number, total: number, lines: PdfLine[]): string {
  const W = 595;
  const H = 842;
  const ops: string[] = [];
  // Banda de encabezado
  ops.push(`${BRAND.join(' ')} rg 0 ${H - 70} ${W} 70 re f`);
  ops.push(`BT /F2 11 Tf 1 1 1 rg 50 ${H - 30} Td (${pdfText('Foro UTN · Apuntes y Recursos')}) Tj ET`);
  ops.push(`BT /F2 16 Tf 1 1 1 rg 50 ${H - 54} Td (${pdfText(title)}) Tj ET`);
  let y = H - 110;
  for (const l of lines) {
    const size = l.size ?? 11;
    y -= l.gap ?? size * 1.55;
    const color = l.color ?? INK;
    ops.push(`BT /${l.bold ? 'F2' : 'F1'} ${size} Tf ${color.join(' ')} rg ${50 + (l.indent ?? 0)} ${y.toFixed(1)} Td (${pdfText(l.text)}) Tj ET`);
    if (l.col2) ops.push(`BT /${l.bold ? 'F2' : 'F1'} ${size} Tf ${color.join(' ')} rg 300 ${y.toFixed(1)} Td (${pdfText(l.col2)}) Tj ET`);
  }
  // Pie
  ops.push(`${MUTED.join(' ')} RG 0.5 w 50 50 m ${W - 50} 50 l S`);
  ops.push(`BT /F1 9 Tf ${MUTED.join(' ')} rg 50 36 Td (${pdfText('Sofía Romero · Ayudante alumna de Análisis Matemático I · UTN FRT')}) Tj ET`);
  ops.push(`BT /F1 9 Tf ${MUTED.join(' ')} rg ${W - 110} 36 Td (${pdfText(`Página ${pageNo} de ${total}`)}) Tj ET`);
  return ops.join('\n');
}

export function buildPdf(title: string, author: string, pages: PdfLine[][]): Buffer {
  const objects: string[] = [];
  const pageIds: number[] = [];
  // 1 catálogo, 2 páginas, 3-4 fuentes, 5 info; después página+contenido por cada una
  let next = 6;
  const pageObjs: { id: number; contentId: number; stream: string }[] = [];
  pages.forEach((lines, i) => {
    const id = next++;
    const contentId = next++;
    pageIds.push(id);
    pageObjs.push({ id, contentId, stream: pageStream(title, i + 1, pages.length, lines) });
  });
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  objects[5] = `<< /Title ${pdfUtf16(title)} /Author ${pdfUtf16(author)} /Producer (Foro UTN seed) >>`;
  for (const p of pageObjs) {
    objects[p.id] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${p.contentId} 0 R >>`;
    objects[p.contentId] = `<< /Length ${p.stream.length} >>\nstream\n${p.stream}\nendstream`;
  }

  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets: number[] = [];
  for (let id = 1; id < next; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${next}\n0000000000 65535 f \n`;
  for (let id = 1; id < next; id++) out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${next} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const h = (text: string): PdfLine => ({ text, size: 14, bold: true, color: BRAND, gap: 30 });
const p = (text: string, indent = 0): PdfLine => ({ text, indent });
const b = (text: string): PdfLine => ({ text, bold: true, gap: 20 });
const sp = (gap = 8): PdfLine => ({ text: '', gap });
const two = (a: string, c: string): PdfLine => ({ text: a, col2: c, indent: 12 });

export function resumenAnalisisPdf(): Buffer {
  return buildPdf('Resumen Análisis I – Límites y derivadas', 'Sofía Romero', [
    [
      h('1. Límites: la idea'),
      p('lím f(x) cuando x tiende a a = L significa que f(x) se acerca a L tanto como queramos'),
      p('tomando x suficientemente cerca de a (sin importar lo que pase exactamente en x = a).'),
      sp(),
      b('Propiedades (si los límites existen)'),
      p('• lím [f(x) ± g(x)] = lím f(x) ± lím g(x)', 12),
      p('• lím [f(x) · g(x)] = lím f(x) · lím g(x)', 12),
      p('• lím [f(x) / g(x)] = lím f(x) / lím g(x), siempre que lím g(x) != 0', 12),
      p('• lím [k · f(x)] = k · lím f(x)', 12),
      sp(),
      b('Límites notables'),
      p('• lím (x->0) sen(x) / x = 1', 12),
      p('• lím (x->0) (1 - cos x) / x = 0', 12),
      p('• lím (x->inf) (1 + 1/x)^x = e', 12),
      p('• lím (x->0) sen(kx) / x = k      (por ejemplo, sen(3x)/x -> 3)', 12),
      sp(),
      b('Indeterminaciones'),
      p('0/0 · inf/inf · 0·inf · inf - inf · 1^inf · 0^0 · inf^0'),
      p('No significan "no existe": hay que trabajar la expresión (factorizar, racionalizar,'),
      p('usar un límite notable o L’Hôpital) antes de evaluar.'),
      sp(),
      b('Ejemplo resuelto'),
      p('lím (x->2) (x² - 4) / (x - 2) = lím (x->2) (x - 2)(x + 2) / (x - 2) = lím (x->2) (x + 2) = 4'),
    ],
    [
      h('2. Derivada'),
      p('f’(a) = lím (h->0) [f(a + h) - f(a)] / h'),
      p('Geométricamente: pendiente de la recta tangente al gráfico de f en (a, f(a)).'),
      p('Recta tangente: y = f(a) + f’(a) · (x - a)'),
      sp(),
      b('Reglas de derivación'),
      two('• Suma', '(f + g)’ = f’ + g’'),
      two('• Producto', '(f · g)’ = f’ · g + f · g’'),
      two('• Cociente', '(f / g)’ = (f’ · g - f · g’) / g²'),
      two('• Cadena', '[f(g(x))]’ = f’(g(x)) · g’(x)'),
      sp(),
      b('Tabla de derivadas'),
      two('• (k)’ = 0', '• (x^n)’ = n · x^(n-1)'),
      two('• (e^x)’ = e^x', '• (a^x)’ = a^x · ln a'),
      two('• (ln x)’ = 1 / x', '• (sen x)’ = cos x'),
      two('• (cos x)’ = -sen x', '• (tg x)’ = 1 / cos² x'),
      two('• (arctg x)’ = 1 / (1 + x²)', '• (raíz de x)’ = 1 / (2 · raíz de x)'),
      sp(),
      b('Ejemplo con regla de la cadena'),
      p('f(x) = sen(x² + 1)   ->   f’(x) = cos(x² + 1) · 2x'),
      sp(),
      b('Derivable implica continua'),
      p('Si f es derivable en a, entonces es continua en a. La recíproca es falsa:'),
      p('|x| es continua en 0 pero no derivable (punto anguloso).'),
    ],
    [
      h('3. Regla de L’Hôpital'),
      p('Si lím f(x)/g(x) da 0/0 o inf/inf, y existe lím f’(x)/g’(x), entonces'),
      p('lím f(x)/g(x) = lím f’(x)/g’(x).'),
      p('Se deriva numerador y denominador POR SEPARADO (no es la regla del cociente).'),
      sp(),
      b('Ejemplos'),
      p('• lím (x->0) sen(3x) / x  =  lím (x->0) 3 cos(3x) / 1  =  3', 12),
      p('• lím (x->inf) ln x / x   =  lím (x->inf) (1/x) / 1   =  0', 12),
      p('• lím (x->0) (e^x - 1) / x = lím (x->0) e^x / 1 = 1', 12),
      sp(),
      b('Cuándo NO conviene'),
      p('• Si no hay indeterminación: evaluá directo.', 12),
      p('• Si un límite notable lo resuelve en un paso.', 12),
      p('• Si al derivar la expresión se complica más (probá reescribir primero).', 12),
      sp(),
      h('4. Tips para el parcial'),
      p('1. Antes de aplicar nada, reemplazá y fijate qué tipo de indeterminación tenés.'),
      p('2. Escribí cada paso: en el parcial se corrige el procedimiento, no solo el resultado.'),
      p('3. Revisá dominio y continuidad antes de derivar funciones partidas.'),
      p('4. Practicá con la guía de la cátedra: los ejercicios 12 a 20 suelen tomarse.'),
      sp(18),
      { text: '¡Éxitos en el parcial! Cualquier duda, pregunten en la comunidad de Análisis Matemático I.', bold: true, color: BRAND },
    ],
  ]);
}

// ---------- PNG ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width: number, height: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * width * 3, width * 3).copy(raw, y * (width * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Gráfico de f(x) = sen(3x)/x en [-4, 4] con la asíntota del límite (y = 3) punteada. */
export function graficoSen3xPng(): Buffer {
  const W = 560;
  const H = 340;
  const px = new Uint8Array(W * H * 3).fill(255);
  const set = (x: number, y: number, c: [number, number, number]) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (Math.round(y) * W + Math.round(x)) * 3;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
  };
  const xmin = -4;
  const xmax = 4;
  const ymin = -1.5;
  const ymax = 3.6;
  const sx = (x: number) => 30 + ((x - xmin) / (xmax - xmin)) * (W - 60);
  const sy = (y: number) => H - 25 - ((y - ymin) / (ymax - ymin)) * (H - 50);
  const grid: [number, number, number] = [232, 232, 242];
  for (let gx = xmin; gx <= xmax; gx += 0.5) for (let y = 25; y < H - 25; y++) set(sx(gx), y, grid);
  for (let gy = -1.5; gy <= 3.5; gy += 0.5) for (let x = 30; x < W - 30; x++) set(x, sy(gy), grid);
  const axis: [number, number, number] = [60, 62, 80];
  for (let x = 30; x < W - 30; x++) set(x, sy(0), axis);
  for (let y = 25; y < H - 25; y++) set(sx(0), y, axis);
  // asíntota del límite (y = 3), punteada en violeta
  for (let x = 30; x < W - 30; x++) if (Math.floor(x / 6) % 2 === 0) for (let t = -1; t <= 1; t++) set(x, sy(3) + t, [139, 92, 246]);
  // curva
  const brand: [number, number, number] = [109, 93, 252];
  let prev: [number, number] | null = null;
  for (let i = 0; i <= 4000; i++) {
    const x = xmin + ((xmax - xmin) * i) / 4000;
    const y = Math.abs(x) < 1e-9 ? 3 : Math.sin(3 * x) / x;
    const p2: [number, number] = [sx(x), sy(y)];
    if (prev) {
      const steps = Math.max(1, Math.ceil(Math.hypot(p2[0] - prev[0], p2[1] - prev[1])));
      for (let s = 0; s <= steps; s++) {
        const cx = prev[0] + ((p2[0] - prev[0]) * s) / steps;
        const cy = prev[1] + ((p2[1] - prev[1]) * s) / steps;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) set(cx + dx, cy + dy, brand);
      }
    }
    prev = p2;
  }
  // punto "hueco" en x = 0 (la función no está definida ahí)
  for (let a = 0; a < 360; a += 2) {
    const r = 5;
    set(sx(0) + r * Math.cos((a * Math.PI) / 180), sy(3) + r * Math.sin((a * Math.PI) / 180), [220, 38, 38]);
  }
  return encodePng(W, H, px);
}

// ---------- texto y código ----------

export const RECORRER_ARRAY_C = `#include <stdio.h>

/* TP de vectores — versión que me da "Segmentation fault" a veces */

int main(void) {
    int notas[5] = {7, 8, 6, 9, 10};
    int suma = 0;

    for (int i = 0; i <= 5; i++) {   /* ¿será esto? */
        suma += notas[i];
    }

    printf("Promedio: %d\\n", suma / 5);
    return 0;
}
`;

export const RECORRER_ARRAY_CORREGIDO_C = `#include <stdio.h>

#define CANT_NOTAS 5

/*
 * Versión corregida (Ing. García):
 *  - El for va de 0 a CANT_NOTAS - 1 (condición i < CANT_NOTAS).
 *  - El promedio se calcula con double para no perder los decimales.
 *  - Compilen siempre con: gcc -Wall -Wextra -g -fsanitize=address recorrer_array.c
 */

int main(void) {
    int notas[CANT_NOTAS] = {7, 8, 6, 9, 10};
    int suma = 0;

    for (int i = 0; i < CANT_NOTAS; i++) {
        suma += notas[i];
    }

    double promedio = (double) suma / CANT_NOTAS;
    printf("Promedio: %.2f\\n", promedio);
    return 0;
}
`;

export const CLIENTES_PEDIDOS_CSV = `tabla,id,cliente_id,nombre,fecha,total
cliente,1,,Ana Paz,,
cliente,2,,Bruno Díaz,,
cliente,3,,Carla Gómez,,
cliente,4,,Diego Ruiz,,
cliente,5,,Elena Sosa,,
pedido,101,1,,2026-08-02,15400.50
pedido,102,1,,2026-08-19,3200.00
pedido,103,3,,2026-09-01,8900.75
pedido,104,4,,2026-09-12,1250.00
pedido,105,4,,2026-10-03,46000.00
`;

export const NORMALIZACION_SQL = `-- Normalización hasta 3FN: esquema final del ejemplo de inscripciones
-- Base de Datos — Ing. Marcela García (UTN FRT)

CREATE TABLE carrera (
    id      INT PRIMARY KEY,
    nombre  VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE alumno (
    legajo      INT PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    carrera_id  INT NOT NULL REFERENCES carrera(id)
);

CREATE TABLE docente (
    id      INT PRIMARY KEY,
    nombre  VARCHAR(100) NOT NULL
);

CREATE TABLE materia (
    codigo      VARCHAR(10) PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    docente_id  INT NOT NULL REFERENCES docente(id)
);

-- La inscripción solo depende de la clave completa (legajo, materia): 3FN.
CREATE TABLE inscripcion (
    legajo          INT NOT NULL REFERENCES alumno(legajo),
    cod_materia     VARCHAR(10) NOT NULL REFERENCES materia(codigo),
    fecha           DATE NOT NULL,
    PRIMARY KEY (legajo, cod_materia)
);
`;

export const CHULETA_GIT_TXT = `CHULETA DE GIT PARA LOS TPs GRUPALES
====================================

Antes de empezar a trabajar:
  git switch main
  git pull

Para cada tarea, una rama nueva:
  git switch -c feature/nombre-corto

Guardar cambios (seguido y con mensajes claros):
  git add -p            # revisás qué agregás
  git commit -m "Agrega validación de legajo"

Subir la rama y abrir un Pull Request:
  git push -u origin feature/nombre-corto

Si main avanzó mientras trabajabas:
  git fetch
  git rebase origin/main     # o git merge origin/main

Nunca:
  - git push --force a main
  - commitear el .env o la carpeta node_modules

¿Conflicto? Abrí el archivo, buscá <<<<<<< y >>>>>>>, decidí qué queda,
git add <archivo> y seguí con git rebase --continue (o git commit si era un merge).
`;

export const DER_NOTAS_TXT = `DER — Sistema de préstamos de la biblioteca (TP de modelado)
Grupo: Lucía Fernández, Rodrigo Álvarez, Micaela Gómez

ENTIDADES
- Socio (nro_socio PK, nombre, email, teléfono, fecha_alta)
- Libro (isbn PK, título, editorial, año)
- Autor (id_autor PK, nombre)
- Ejemplar (id_ejemplar PK, isbn FK, estado)   -> un libro tiene muchos ejemplares

RELACIONES
- Escribe: Autor N:M Libro
- Préstamo: Socio N:M Ejemplar, con atributos fecha_prestamo, fecha_devolucion_prevista,
  fecha_devolucion_real
  -> clave: (nro_socio, id_ejemplar, fecha_prestamo), así un socio puede pedir el mismo
     ejemplar más de una vez en distintas fechas.

MULTAS
- No las guardamos: se calculan en una vista a partir de fecha_devolucion_real -
  fecha_devolucion_prevista (días de atraso x monto diario).

PENDIENTE
- Preguntar a la profe si hace falta modelar las reservas.
`;

export const PUNTEROS_MD = `# Punteros en C sin miedo

## 1. ¿Qué es un puntero?
Una variable que guarda una **dirección de memoria**.

\`\`\`c
int x = 10;
int *p = &x;   // p apunta a x
*p = 20;       // ahora x vale 20
\`\`\`

## 2. Errores típicos
- Usar un puntero sin inicializar
- Devolver la dirección de una variable local
- Olvidarse del \`free\` (o hacerlo dos veces)

## 3. TODO
- [ ] Ejemplo con arrays y aritmética de punteros
- [ ] Punteros a funciones (¿entra en el parcial?)
`;
