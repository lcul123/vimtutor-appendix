export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(totalSeconds < 10 ? 2 : 1)}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}m ${seconds.toFixed(0).padStart(2, '0')}s`;
}

/** Running clock: `12.4s` under a minute, `2:37.1` after that. */
export function formatClock(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const total = Math.max(0, ms);
  const minutes = Math.floor(total / 60_000);
  const seconds = (total % 60_000) / 1000;
  if (minutes === 0) return `${seconds.toFixed(1)}s`;
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
}

export function formatKeys(keys: number | undefined): string {
  if (keys === undefined) return '—';
  return `${keys} ${keys === 1 ? 'key' : 'keys'}`;
}
