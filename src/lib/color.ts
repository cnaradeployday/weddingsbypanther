export function darken(hex: string, amount: number): string {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return hex;
  const [, r, g, b] = match;
  const scale = (channel: string) =>
    Math.max(0, Math.round(parseInt(channel, 16) * (1 - amount)))
      .toString(16)
      .padStart(2, "0");
  return `#${scale(r)}${scale(g)}${scale(b)}`;
}
