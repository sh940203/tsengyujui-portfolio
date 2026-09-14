import path from "node:path";

/**
 * Read-only source of the designer's original photo/scan assets.
 * Nested directly under the project root, matching SPEC.md §11.1. Only
 * this constant needs to change if the folder is ever moved.
 */
export const ASSET_SOURCE_DIR = path.join(process.cwd(), "服飾設計");
