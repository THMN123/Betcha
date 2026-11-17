/** Formats a play-credit amount, e.g. 5 -> "5 cr", 4.75 -> "4.75 cr". */
export function cr(amount: number): string {
  const n = Number(amount) || 0;
  const text = Number.isInteger(n) ? n.toString() : n.toFixed(2);
  return `${text} cr`;
}

export function inviteUrl(code: string): string {
  return `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(code)}`;
}

/** Shares an invite with the native share sheet on phones, otherwise copies it. Returns what happened. */
export async function shareInvite(code: string, title: string): Promise<'shared' | 'copied' | 'failed'> {
  const url = inviteUrl(code);
  if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ title: 'Betcha challenge', text: `Join my Betcha match "${title}"`, url });
      return 'shared';
    } catch {
      // user cancelled the share sheet: fall through to copy
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
