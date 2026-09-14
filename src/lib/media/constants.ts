// Shared between server-only code (variants.ts) and the next/image custom
// loader, which Next.js also bundles for the client — this file must stay
// free of server-only imports (sharp, AWS SDK, "server-only").
export const VARIANT_WIDTHS = [400, 800, 1600, 2400] as const;
export type VariantWidth = (typeof VARIANT_WIDTHS)[number];
