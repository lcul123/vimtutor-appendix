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

export function formatKeys(keys: number | undefined): string {
  if (keys === undefined) return '—';
  return `${keys} ${keys === 1 ? 'key' : 'keys'}`;
}
