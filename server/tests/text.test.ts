import { describe, expect, it } from 'vitest';
import { excerpt, extractMentions, hotScore, slugify, stripMarkdown } from '../src/lib/text.js';

describe('stripMarkdown / excerpt', () => {
  it('quita markdown y conserva el texto', () => {
    const md = [
      '# Título',
      '',
      '> una cita con **negrita** y _itálica_',
      '',
      '- item con [un link](https://x.com) y ![img](/uploads/a.png)',
      '1. paso `npm i`',
      '',
      '~~~c',
      'int main() {}',
      '~~~',
      '',
      '```',
      'otro bloque',
      '```',
      'snake_case_var y ~~tachado~~ | tabla |',
    ].join('\n');
    expect(stripMarkdown(md)).toBe('Título una cita con negrita y itálica item con un link y paso npm i snake_case_var y tachado tabla');
  });

  it('trunca en ≤ 280 caracteres con "…"', () => {
    const long = 'palabra '.repeat(100);
    const out = excerpt(long);
    expect(out.length).toBeLessThanOrEqual(280);
    expect(out.endsWith('…')).toBe(true);
    expect(excerpt('corto')).toBe('corto');
  });
});

describe('extractMentions', () => {
  it('detecta @usuario, sin emails, sin código y sin repetir', () => {
    expect(extractMentions('Hola @Lucia_Dev y @tomi_ing, ¿y @lucia_dev? mail: a@b.com `@codigo` @ab')).toEqual(['lucia_dev', 'tomi_ing']);
  });

  it('máximo 10', () => {
    const text = Array.from({ length: 15 }, (_, i) => `@user${i}`).join(' ');
    expect(extractMentions(text)).toHaveLength(10);
  });
});

describe('hotScore', () => {
  it('sign(score)*log10(max(|score|,1)) + epoch/45000', () => {
    const d = new Date('2026-01-01T00:00:00Z');
    const base = d.getTime() / 1000 / 45000;
    expect(hotScore(0, d)).toBeCloseTo(base, 10);
    expect(hotScore(1, d)).toBeCloseTo(base, 10);
    expect(hotScore(10, d)).toBeCloseTo(base + 1, 10);
    expect(hotScore(-100, d)).toBeCloseTo(base - 2, 10);
  });
});

describe('slugify', () => {
  it('normaliza acentos y espacios', () => {
    expect(slugify('Análisis Matemático I')).toBe('analisis-matematico-i');
    expect(slugify('  ¿Trabajo Práctico? ')).toBe('trabajo-practico');
  });
});
