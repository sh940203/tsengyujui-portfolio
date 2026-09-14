import { VARIANT_WIDTHS } from "./constants";

/**
 * Custom next/image loader (SPEC.md §1.3). `src` is `media.baseKey`
 * (`{slug}/{kind}/{cuid}`, no size suffix or extension) — maps the
 * requested width to the closest pre-generated variant and points at the
 * public R2 URL. `original.*` is never reachable through this loader.
 */
export default function r2ImageLoader({
  src,
  width,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  const target =
    VARIANT_WIDTHS.find((w) => w >= width) ??
    VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1];

  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";
  return `${base}/${src}/${target}.webp`;
}
