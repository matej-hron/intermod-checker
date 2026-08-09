export function mhzToKHz(mhz: number): number {
  return Math.round(mhz * 1000);
}

export function kHzToMHzText(khz: number): string {
  return (khz / 1000).toFixed(3);
}

export function parseFrequencyMHz(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '') return null;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}
