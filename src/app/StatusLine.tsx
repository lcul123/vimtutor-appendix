interface Props {
  mode: string;
  fileName: string;
  line: number;
  ch: number;
}

function modeKind(mode: string): string {
  if (mode.startsWith('visual')) return 'visual';
  if (mode === 'insert' || mode === 'replace') return mode;
  return 'normal';
}

export function StatusLine({ mode, fileName, line, ch }: Props) {
  const kind = modeKind(mode);
  return (
    <div className="statusline" data-testid="statusline">
      <span className={`mode-pill mode-pill--${kind}`}>{mode.toUpperCase()}</span>
      <span className="statusline__file">{fileName}</span>
      <span className="statusline__pos">
        {line + 1}:{ch + 1}
      </span>
    </div>
  );
}
