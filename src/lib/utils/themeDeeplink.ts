const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ThemeInstallDeeplinkPayload {
  themeId: string;
  apply?: boolean;
}

/** Parse theme install URLs (desqta:// or BetterSEQTA HTTPS links). */
export function parseThemeInstallDeeplink(url: string): ThemeInstallDeeplinkPayload | null {
  const trimmed = url.trim();

  const pathMatch = trimmed.match(/^desqta:\/\/theme\/install\/([^/?#]+)/i);
  if (pathMatch?.[1] && UUID_RE.test(pathMatch[1])) {
    return { themeId: pathMatch[1] };
  }

  const shortMatch = trimmed.match(/^desqta:\/\/theme\/([^/?#]+)/i);
  if (shortMatch?.[1] && shortMatch[1] !== 'install' && UUID_RE.test(shortMatch[1])) {
    return { themeId: shortMatch[1] };
  }

  for (const prefix of [
    'desqta://theme/install?',
    'desqta://theme/install/?',
    'https://betterseqta.org/desqta/theme/install?',
    'https://www.betterseqta.org/desqta/theme/install?',
  ]) {
    if (trimmed.startsWith(prefix)) {
      const query = trimmed.slice(prefix.length);
      const params = new URLSearchParams(query.split('#')[0]);
      const themeId = params.get('id') ?? params.get('theme_id') ?? params.get('themeId');
      if (themeId && UUID_RE.test(themeId)) {
        return { themeId };
      }
    }
  }

  for (const prefix of [
    'https://betterseqta.org/desqta/theme/',
    'https://www.betterseqta.org/desqta/theme/',
  ]) {
    if (trimmed.startsWith(prefix)) {
      const segment = trimmed.slice(prefix.length).split(/[?#]/)[0];
      if (segment && segment !== 'install' && UUID_RE.test(segment)) {
        return { themeId: segment };
      }
    }
  }

  return null;
}

/** Build a shareable link that opens DesQTA and previews the theme. */
export function buildThemeInstallDeeplink(
  themeId: string,
  options?: { web?: boolean },
): string {
  if (options?.web) {
    return `https://betterseqta.org/desqta/theme/install?id=${encodeURIComponent(themeId)}`;
  }

  return `desqta://theme/install?id=${encodeURIComponent(themeId)}`;
}

/** Copy a theme install link to the clipboard. */
export async function copyThemeInstallLink(themeId: string): Promise<void> {
  const { toast } = await import('svelte-sonner');
  const link = buildThemeInstallDeeplink(themeId);
  await navigator.clipboard.writeText(link);
  toast.success('Install link copied');
}
