export type Platform = 'mac' | 'other';

/** Cmd on macOS, Ctrl everywhere else. Ctrl+` stays Ctrl on every platform, matching VS Code. */
export function detectPlatform(nav: { platform?: string; userAgent?: string } = navigator): Platform {
  const platform = nav.platform ?? '';
  const agent = nav.userAgent ?? '';
  if (/Mac|iPhone|iPad|iPod/i.test(platform) || /Mac OS X/i.test(agent)) return 'mac';
  return 'other';
}

export function modName(platform: Platform): 'Cmd' | 'Ctrl' {
  return platform === 'mac' ? 'Cmd' : 'Ctrl';
}
