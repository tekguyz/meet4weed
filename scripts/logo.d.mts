// Types for scripts/logo.mjs, so its test typechecks.

export interface BrandColours {
  bg: string;
  primary: string;
  secondary: string;
  ink: string;
  inkMuted: string;
}

export const MARK_RADIUS: number;
export const MASKABLE_SCALE: number;

export function markSvg(options: {
  colours: Pick<BrandColours, "primary" | "secondary">;
  field?: string;
  scale?: number;
  lightColours?: Pick<BrandColours, "primary" | "secondary">;
  size?: number;
}): string;

export function oklchToHex(value: string): string;

export function readBrandColours(css: string): { dark: BrandColours; light: BrandColours };

export function icoFromPngs(images: { size: number; png: Buffer }[]): Buffer;

export function woffToSfnt(woff: Buffer): Buffer;
