import { describe, expect, it } from 'vitest';
import {
  buffersMatch,
  cursorAt,
  diffBuffers,
  normalizeBuffer,
  nthChar,
  nthIndex,
} from '../src/engine/text';

describe('normalizeBuffer', () => {
  it('strips trailing newlines but keeps interior ones', () => {
    expect(normalizeBuffer('a\n\nb\n\n')).toBe('a\n\nb');
    expect(normalizeBuffer('a\n\nb')).toBe('a\n\nb');
  });

  it('normalises CRLF line endings', () => {
    expect(normalizeBuffer('a\r\nb\r\n')).toBe('a\nb');
  });

  it('preserves trailing spaces on a line', () => {
    expect(normalizeBuffer('a  \nb')).toBe('a  \nb');
  });

  it('handles an empty buffer', () => {
    expect(normalizeBuffer('')).toBe('');
    expect(normalizeBuffer('\n\n')).toBe('');
  });
});

describe('buffersMatch', () => {
  it('accepts identical buffers', () => {
    expect(buffersMatch('hello\n', 'hello\n')).toBe(true);
  });

  it('ignores a missing or extra trailing newline', () => {
    expect(buffersMatch('hello', 'hello\n')).toBe(true);
    expect(buffersMatch('hello\n\n\n', 'hello\n')).toBe(true);
  });

  it('rejects a trailing space', () => {
    expect(buffersMatch('hello \n', 'hello\n')).toBe(false);
  });

  it('rejects reordered or missing lines', () => {
    expect(buffersMatch('b\na\n', 'a\nb\n')).toBe(false);
    expect(buffersMatch('a\n', 'a\nb\n')).toBe(false);
  });

  it('treats an empty buffer and a single blank line as equal', () => {
    expect(buffersMatch('', '\n')).toBe(true);
  });

  it('is case sensitive', () => {
    expect(buffersMatch('Hello\n', 'hello\n')).toBe(false);
  });
});

describe('diffBuffers', () => {
  it('marks nothing changed when the buffers match', () => {
    const diff = diffBuffers('a\nb\n', 'a\nb\n');
    expect(diff.equal).toBe(true);
    expect(diff.expected.every((l) => !l.changed)).toBe(true);
    expect(diff.actual.every((l) => !l.changed)).toBe(true);
  });

  it('marks the differing lines on both sides', () => {
    const diff = diffBuffers('a\nX\nc\n', 'a\nb\nc\n');
    expect(diff.equal).toBe(false);
    expect(diff.expected.map((l) => l.changed)).toEqual([false, true, false]);
    expect(diff.actual.map((l) => l.changed)).toEqual([false, true, false]);
    expect(diff.expected[1].text).toBe('b');
  });

  it('marks missing lines as changed', () => {
    const diff = diffBuffers('a\n', 'a\nb\n');
    expect(diff.expected.map((l) => l.text)).toEqual(['a', 'b']);
    expect(diff.expected.map((l) => l.changed)).toEqual([false, true]);
    expect(diff.actual).toEqual([{ text: 'a', changed: false }]);
  });

  it('ignores trailing newline differences when deciding equality', () => {
    expect(diffBuffers('a', 'a\n').equal).toBe(true);
  });
});

describe('cursor helpers', () => {
  it('converts an index into a line/ch pair', () => {
    expect(cursorAt('abc\ndef', 0)).toEqual({ line: 0, ch: 0 });
    expect(cursorAt('abc\ndef', 3)).toEqual({ line: 0, ch: 3 });
    expect(cursorAt('abc\ndef', 5)).toEqual({ line: 1, ch: 1 });
  });

  it('finds the nth occurrence', () => {
    expect(nthIndex('a-b-c-d', '-', 1)).toBe(1);
    expect(nthIndex('a-b-c-d', '-', 3)).toBe(5);
    expect(nthIndex('a-b-c-d', '-', 4)).toBe(-1);
    expect(nthChar('abc\ndef\nghi', 'g', 1)).toEqual({ line: 2, ch: 0 });
  });

  it('throws a helpful error when the occurrence is missing', () => {
    expect(() => nthChar('abc', 'z', 1)).toThrow(/Could not find occurrence 1 of "z"/);
  });
});
