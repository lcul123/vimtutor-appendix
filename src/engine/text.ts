export interface CursorPosition {
  /** 0-based line index. */
  line: number;
  /** 0-based character offset within the line. */
  ch: number;
}

/**
 * Compares buffers the way a Vim user expects: line endings are normalised and
 * trailing blank lines at the end of the buffer are ignored, but everything
 * else — including spaces at the end of a line — is significant.
 */
export function normalizeBuffer(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n+$/, '');
}

export function buffersMatch(actual: string, expected: string): boolean {
  return normalizeBuffer(actual) === normalizeBuffer(expected);
}

export interface DiffLine {
  text: string;
  changed: boolean;
}

export interface BufferDiff {
  expected: DiffLine[];
  actual: DiffLine[];
  /** True when the two buffers are identical after normalisation. */
  equal: boolean;
}

/**
 * A deliberately simple line-by-line diff: it compares lines at the same index.
 * Drill buffers are short and edits are local, so this highlights exactly the
 * lines that still need work without pulling in a diff library.
 */
export function diffBuffers(actual: string, expected: string): BufferDiff {
  const actualLines = normalizeBuffer(actual).split('\n');
  const expectedLines = normalizeBuffer(expected).split('\n');
  const equal = buffersMatch(actual, expected);
  return {
    equal,
    expected: expectedLines.map((text, i) => ({
      text,
      changed: !equal && actualLines[i] !== text,
    })),
    actual: actualLines.map((text, i) => ({
      text,
      changed: !equal && expectedLines[i] !== text,
    })),
  };
}

export function cursorAt(text: string, index: number): CursorPosition {
  const before = text.slice(0, Math.max(0, index));
  const lines = before.split('\n');
  return { line: lines.length - 1, ch: lines[lines.length - 1].length };
}

/** Index of the `n`th (1-based) occurrence of `needle`, or -1. */
export function nthIndex(text: string, needle: string, n: number): number {
  let from = 0;
  let found = -1;
  for (let i = 0; i < n; i += 1) {
    found = text.indexOf(needle, from);
    if (found === -1) return -1;
    from = found + needle.length;
  }
  return found;
}

/** Position of the first character of the `n`th (1-based) occurrence. */
export function nthChar(text: string, needle: string, n: number): CursorPosition {
  const index = nthIndex(text, needle, n);
  if (index === -1) {
    throw new Error(`Could not find occurrence ${n} of ${JSON.stringify(needle)}`);
  }
  return cursorAt(text, index);
}
