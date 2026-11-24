import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { CollectionAfterChangeHook, Payload } from "payload";

/**
 * Fills a branch's "Menu as text" from its menu file (PDF or image) or menu
 * page images, by having the Codex CLI read the menu and sort the dishes into
 * sections ("Salads", "Main courses"…).
 *
 * Runs after a save, in the background, when the menu file or pages change,
 * or when the text is still empty. The save itself is not held up; the text
 * appears in the admin a few minutes later (reload the page to see it).
 *
 * Needs, on the server, for the user the backend runs as:
 * - the Codex CLI, logged in: `npm i -g @openai/codex && codex login --device-auth`
 * - `pdftoppm` to turn PDF pages into images: `sudo apt install poppler-utils`
 * Set MENU_TEXT_CODEX=off to turn it off everywhere, or untick
 * "Fill the menu text automatically" on a branch.
 */

const run = promisify(execFile);
/** Path to the Codex CLI, if it is not on the PATH of the backend process */
const CODEX_BIN = process.env.CODEX_BIN || "codex";
/** Optional: a specific model, e.g. CODEX_MODEL=gpt-5.5; otherwise Codex's default */
const CODEX_MODEL = process.env.CODEX_MODEL;
/** Reading a long menu can take a few minutes */
const CODEX_TIMEOUT_MS = 10 * 60 * 1000;
/** Pages beyond this are not read (menus rarely have more) */
const MAX_PAGES = 24;
/** Resolution PDF pages are rendered at: sharp enough for small print */
const PDF_DPI = 130;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

/** Skip the hook for the save that writes the extracted text back */
export const SKIP_MENU_TEXT = "skipMenuTextExtraction";

type MenuSection = {
  title: string;
  items: Array<{ name: string; description: string; price: string }>;
};

const MENU_SCHEMA = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                price: { type: "string" },
              },
              required: ["name", "description", "price"],
              additionalProperties: false,
            },
          },
        },
        required: ["title", "items"],
        additionalProperties: false,
      },
    },
  },
  required: ["sections"],
  additionalProperties: false,
};

const INSTRUCTIONS = `The attached images are the pages of a restaurant's menu, in order. Do not run any commands or open any files: just read the images. Transcribe every dish and drink on it into sections, for a text version of the menu on the restaurant's website (read by guests, search engines and screen readers).

- Use the menu's own section headings, in the menu's order, written as they appear (e.g. "Appetizers", "Salads", "Main courses", "Desserts", "Drinks"). If the menu has no headings, group the dishes into sensible sections like those.
- Keep names, descriptions and prices in the menu's own language and wording. Do not translate, invent or embellish. If a dish is listed in two languages, keep both in the name, e.g. "Gỏi cuốn / Fresh spring rolls".
- description: the short description printed on the menu, or "" if there is none.
- price: as printed, including the currency or unit (e.g. "120k", "85.000 ₫"), or "" if there is none. If a dish has several sizes or prices, put them all in one price, e.g. "S 45k / L 65k".
- Leave out everything that is not a dish or drink: the restaurant's name, address, opening hours, Wi-Fi passwords, service charge notes, page numbers.`;

/** Same format the site parses: "## Section" headings, then "Name | description | price" */
export function sectionsToMenuText(sections: MenuSection[]): string {
  const clean = (s: string) => s.replace(/\|/g, "/").replace(/\s+/g, " ").trim();
  return sections
    .filter((section) => section.items.length)
    .map((section) => {
      const lines = section.items
        .filter((item) => clean(item.name))
        .map((item) => {
          const parts = [clean(item.name), clean(item.description), clean(item.price)];
          // Keep an empty description slot only when a price follows it
          while (parts.length > 1 && !parts[parts.length - 1]) parts.pop();
          return parts.join(" | ");
        });
      return [`## ${clean(section.title) || "Menu"}`, ...lines].join("\n");
    })
    .join("\n\n");
}

export type MenuFile = { data: Buffer; mimeType: string; filename: string };

/** Every menu page as an image file in `dir`: PDFs are rendered page by page, images copied */
async function writePageImages(files: MenuFile[], dir: string): Promise<string[]> {
  const pages: string[] = [];
  for (const [i, file] of files.entries()) {
    if (pages.length >= MAX_PAGES) break;
    if (file.mimeType === "application/pdf") {
      const pdfPath = path.join(dir, `menu-${i}.pdf`);
      await fs.writeFile(pdfPath, file.data);
      const prefix = path.join(dir, `menu-${i}-page`);
      const last = String(MAX_PAGES - pages.length);
      await run("pdftoppm", ["-png", "-r", String(PDF_DPI), "-l", last, pdfPath, prefix], { timeout: 120_000 });
      const rendered = (await fs.readdir(dir))
        .filter((name) => name.startsWith(`menu-${i}-page`) && name.endsWith(".png"))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      pages.push(...rendered.map((name) => path.join(dir, name)));
    } else {
      const ext = file.mimeType.split("/")[1] || "png";
      const imagePath = path.join(dir, `menu-${i}.${ext}`);
      await fs.writeFile(imagePath, file.data);
      pages.push(imagePath);
    }
  }
  return pages.slice(0, MAX_PAGES);
}

export async function extractMenuSections(files: MenuFile[]): Promise<MenuSection[]> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "menu-text-"));
  try {
    const pages = await writePageImages(files, dir);
    if (!pages.length) return [];

    const schemaPath = path.join(dir, "schema.json");
    const outputPath = path.join(dir, "output.json");
    await fs.writeFile(schemaPath, JSON.stringify(MENU_SCHEMA));

    const args = [
      "exec",
      "--skip-git-repo-check",
      "--ephemeral",
      // It only needs to look at the images; it must not change anything
      "--sandbox",
      "read-only",
      "-C",
      dir,
      "--output-schema",
      schemaPath,
      "-o",
      outputPath,
      ...(CODEX_MODEL ? ["-m", CODEX_MODEL] : []),
      ...pages.flatMap((page) => ["-i", page]),
      "--",
      INSTRUCTIONS,
    ];
    await run(CODEX_BIN, args, { timeout: CODEX_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });

    const output = (await fs.readFile(outputPath, "utf8")).trim();
    if (!output) throw new Error("Codex returned no answer");
    // The answer should be bare JSON; tolerate a ```json fence around it
    const json = output.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(json) as { sections?: MenuSection[] };
    return parsed.sections ?? [];
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

const idOf = (value: unknown): string | number | null => {
  if (value && typeof value === "object" && "id" in value) return (value as { id: string | number }).id;
  return typeof value === "string" || typeof value === "number" ? value : null;
};

/** The media the flip book shows: page images when there are any, otherwise the menu file */
function menuMediaIDs(doc: Record<string, unknown> | undefined): Array<string | number> {
  if (!doc) return [];
  const pages = Array.isArray(doc.menuPages) ? doc.menuPages : [];
  const pageIDs = pages
    .map((page) => idOf((page as { image?: unknown })?.image))
    .filter((id): id is string | number => id !== null);
  if (pageIDs.length) return pageIDs;
  const file = idOf(doc.menu);
  return file === null ? [] : [file];
}

async function loadMenuFiles(payload: Payload, ids: Array<string | number>): Promise<MenuFile[]> {
  const staticDir = payload.collections.media.config.upload.staticDir || "media";
  const files: MenuFile[] = [];
  for (const id of ids) {
    const media = await payload.findByID({ collection: "media", id, depth: 0 });
    const mimeType = media?.mimeType ?? "";
    if (!media?.filename) continue;
    if (mimeType !== "application/pdf" && !IMAGE_TYPES.includes(mimeType as ImageType)) continue;
    const data = await fs.readFile(path.resolve(staticDir, media.filename));
    files.push({ data, mimeType, filename: media.filename });
  }
  return files;
}

/** Branches being read right now, so two quick saves don't start two requests */
const inProgress = new Set<string>();

async function fillMenuText(payload: Payload, tenantID: string | number, sourceKey: string, textBefore: string) {
  const key = String(tenantID);
  if (inProgress.has(key)) return;
  inProgress.add(key);
  try {
    const files = await loadMenuFiles(payload, sourceKey.split(",").filter(Boolean));
    if (!files.length) return;

    payload.logger.info(`Menu text: reading ${files.map((f) => f.filename).join(", ")} for branch ${key}`);
    const sections = await extractMenuSections(files);
    const menuText = sectionsToMenuText(sections);
    if (!menuText) {
      payload.logger.warn(`Menu text: found no dishes in the menu of branch ${key}`);
      return;
    }

    // Someone may have edited the branch while Codex was reading: don't overwrite their changes
    const current = await payload.findByID({ collection: "tenants", id: tenantID, depth: 0 });
    const currentDoc = current as unknown as Record<string, unknown>;
    if (
      menuMediaIDs(currentDoc).join(",") !== sourceKey ||
      ((current.menuText as string | null | undefined) ?? "") !== textBefore ||
      current.menuTextAuto === false
    ) {
      payload.logger.info(`Menu text: branch ${key} changed while reading, leaving its text as it is`);
      return;
    }

    await payload.update({
      collection: "tenants",
      id: tenantID,
      data: { menuText },
      context: { [SKIP_MENU_TEXT]: true },
    });
    payload.logger.info(`Menu text: filled ${sections.length} sections for branch ${key}`);
  } catch (error) {
    payload.logger.error({ err: error }, `Menu text: could not read the menu of branch ${key}`);
  } finally {
    inProgress.delete(key);
  }
}

export const fillMenuTextAfterChange: CollectionAfterChangeHook = ({ doc, previousDoc, context, req }) => {
  if (context?.[SKIP_MENU_TEXT]) return doc;
  if (doc.menuTextAuto === false) return doc;

  const sourceKey = menuMediaIDs(doc).join(",");
  if (!sourceKey) return doc;

  const sourceChanged = sourceKey !== menuMediaIDs(previousDoc).join(",");
  const textBefore: string = doc.menuText ?? "";
  if (!sourceChanged && textBefore.trim()) return doc;

  if (process.env.MENU_TEXT_CODEX === "off") return doc;

  // In the background: reading a menu takes longer than a save should
  void fillMenuText(req.payload, doc.id, sourceKey, textBefore);
  return doc;
};
