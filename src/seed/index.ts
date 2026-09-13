import {
  getPayload,
  type Payload,
  type RequiredDataFromCollectionSlug,
  type Where,
} from "payload";
import config from "../payload.config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { access } from "node:fs/promises";
import gallery from "./gallery.json";
import type { Tenant, Gallery } from "../payload-types";
import { fillMissing } from "./fillMissing";

const assets = fileURLToPath(new URL("./assets/", import.meta.url));
type ContentCollection = "media" | "tenants" | "gallery";

async function ensureContent<C extends ContentCollection>(
  payload: Payload,
  collection: C,
  where: Where,
  data: RequiredDataFromCollectionSlug<C>,
  filePath?: string,
): Promise<{ id: string }> {
  const existing = await payload.find({
    collection,
    where,
    limit: 1,
    sort: "createdAt",
    depth: 0,
    overrideAccess: true,
  });
  if (existing.docs[0]) {
    if (collection === "media") return existing.docs[0];
    const merged = fillMissing(existing.docs[0], data);
    if (collection === "tenants") {
      return payload.update({
        collection: "tenants",
        id: existing.docs[0].id,
        data: merged as Partial<Tenant>,
        overrideAccess: true,
      });
    }
    return payload.update({
      collection: "gallery",
      id: existing.docs[0].id,
      data: merged as Partial<Gallery>,
      overrideAccess: true,
    });
  }
  return payload.create({ collection, data, filePath, overrideAccess: true });
}

export async function seed(payload: Payload) {
  const files = [
    ...new Set([
      ...gallery.map((item) => item.file),
      "red-logo.webp",
      "blue-logo.webp",
      "red-menu.pdf",
      "blue-menu.pdf",
      "hos-light.png",
      "hos-dark.png",
    ]),
  ];
  // Validate all bundled assets before writing anything.
  await Promise.all(files.map((file) => access(path.join(assets, file))));
  const media = new Map<string, string>();
  for (const file of files) {
    const item = gallery.find((item) => item.file === file);
    const caption = `hos-seed:${file}`;
    const doc = await ensureContent(
      payload,
      "media",
      { caption: { equals: caption } },
      {
        alt:
          item?.description || file.replace(/[-_]/g, " ").replace(".webp", ""),
        caption,
      },
      path.join(assets, file),
    );
    media.set(file, doc.id);
  }
  const imageID = (file: string) => {
    const id = media.get(file);
    if (!id) throw new Error(`Missing seed media: ${file}`);
    return id;
  };

  for (const color of ["red", "blue"] as const) {
    const name = color === "red" ? "Red Bistro" : "Blue Bistro";
    const photos = gallery.filter((item) => item.branch === name);
    const description = `Welcome to ${name}, part of House of Senses. Gather around the table for thoughtfully prepared food, warm hospitality, and moments worth sharing.`;
    const tenant = await ensureContent(
      payload,
      "tenants",
      {
        or: [
          { domain: { equals: `${color}-bistro` } },
          { name: { equals: name } },
          { logo: { equals: imageID(`${color}-logo.webp`) } },
        ],
      },
      {
        name,
        domain: `${color}-bistro`,
        status: "open",
        mainColor: color === "red" ? "#9B2C35" : "#245A81",
        logo: imageID(`${color}-logo.webp`),
        heroImagesList: photos
          .slice(0, 10)
          .map((photo) => ({ image: imageID(photo.file) })),
        heroTitle: name,
        heroSubtitle: "A House of Senses dining experience",
        heroDescription: description,
        shortAboutCollages: photos
          .slice(0, 4)
          .map((photo) => ({ image: imageID(photo.file) })),
        shortAboutTitle: `Welcome to ${name}`,
        shortAboutText: description,
        galleryTitle: "A glimpse into our culinary world",
        galleryText:
          "Explore our spaces, dishes, and moments around the table.",
        homeGalleryImage: imageID(photos[4].file),
        ctaTitle: `Experience ${name} Today`,
        ctaText: "Join us for an unforgettable culinary journey.",
        aboutTitle: `About ${name}`,
        aboutSubtitle: "Food, hospitality, and shared moments",
        aboutusHero: imageID(photos[0].file),
        aboutus: {
          root: {
            type: "root",
            format: "",
            indent: 0,
            version: 1,
            direction: "ltr",
            children: [
              description,
              "Our story begins with a simple idea: a meal can be more than a pause in the day. It can be a reason to gather.",
              "We make space for long conversations, small celebrations, and the pleasure of being together.",
              "Our kitchen takes inspiration from familiar flavors and the curiosity to try something new.",
              "Thoughtful details shape the experience, from the first welcome to the last moment at the table.",
              "Visit with friends, bring the family, or settle into a quiet meal of your own.",
              "Explore the gallery for a glimpse of our dining room and the dishes that inspire us.",
              "Our menu is a starting point for discovery. Ask the team about the latest dishes and seasonal additions.",
              "Planning a celebration? Contact the branch to discuss your group, occasion, and preferences.",
              "We look forward to welcoming you back and making another memory together.",
            ].map((text) => ({
              type: "paragraph",
              format: "" as const,
              indent: 0,
              version: 1,
              direction: "ltr" as const,
              children: [
                {
                  type: "text",
                  text,
                  format: 0,
                  detail: 0,
                  mode: "normal",
                  style: "",
                  version: 1,
                },
              ],
            })),
          },
        },
        menu: imageID(`${color}-menu.pdf`),
        newMenu: photos.map((photo) => ({ src: imageID(photo.file) })),
        address: `Demo address for ${name} — replace with your street address`,
        location: { latitude: 0, longitude: 0 },
        openingHours: "11:00–22:00",
        phone: "0000000000",
        email: `${color}-bistro@example.com`,
        facebook: `https://example.com/${color}-bistro/facebook`,
        instagram: `https://example.com/${color}-bistro/instagram`,
        tiktok: `https://example.com/${color}-bistro/tiktok`,
        youtube: `https://example.com/${color}-bistro/youtube`,
        spinWheelPrizes: [
          "Free Dessert",
          "10% Off",
          "Free Cocktail",
          "5% Off",
          "Free Starter",
          "3% Off",
          "Free Drink",
          "Chef's Surprise",
          "Free Coffee",
          "Free Tea",
          "Free Side Dish",
          "15% Off",
        ].map((label) => ({ label })),
        heroMarqueeWords: [
          "Food",
          "Friends",
          "Shared moments",
          "Seasonal flavors",
          "Warm welcomes",
          "Around the table",
          "Fresh ingredients",
          "Slow evenings",
          "Good company",
          "Little celebrations",
          "Made with care",
          "House of Senses",
        ].map((word) => ({ word })),
        topbarNotification: {
          enabled: true,
          message: `Welcome to ${name} — discover our latest menu and reserve your table.`,
        },
        allowPublicRead: true,
        meta: {
          title: `${name} | House of Senses`,
          description,
          image: imageID(photos[0].file),
        },
      },
    );
    for (const photo of photos) {
      await ensureContent(
        payload,
        "gallery",
        {
          and: [
            { branch: { equals: tenant.id } },
            { image: { equals: imageID(photo.file) } },
          ],
        },
        {
          branch: tenant.id,
          image: imageID(photo.file),
          caption: photo.caption,
        },
      );
    }
    payload.logger.info(`Seeded content for ${name}`);
  }

  const home = await payload.findGlobal({ slug: "home-information", depth: 0 });
  const homeDefaults = {
    name: "House of Senses",
    logo: imageID("hos-light.png"),
    "quote(s)": [
      "Good food brings people together.",
      "Every visit is a new memory.",
      "Come for the food. Stay for the company.",
      "A seat at our table, a place in our story.",
      "Let the evening unfold one course at a time.",
      "Little moments taste better together.",
      "Make room for something delicious.",
      "The best conversations happen around a table.",
      "A warm welcome is always on the menu.",
      "Find your favorite corner of House of Senses.",
    ].map((quote) => ({ quote })),
    "Catch Phrase 1": "A place for every sense",
    "Catch Phrase Image 1": imageID(gallery[0].file),
    "Catch Phrase 2": "Two bistros. One shared passion.",
    "Catch Phrase Image 2": imageID(gallery[1].file),
    "Background Image (for Mobile)": imageID(gallery[2].file),
  };
  await payload.updateGlobal({
    slug: "home-information",
    data: fillMissing(home, homeDefaults) as typeof homeDefaults,
  });
  const settings = await payload.findGlobal({ slug: "settings", depth: 0 });
  const settingsDefaults = {
    "light-icon": imageID("hos-light.png"),
    "dark-icon": imageID("hos-dark.png"),
  };
  await payload.updateGlobal({
    slug: "settings",
    data: fillMissing(settings, settingsDefaults) as typeof settingsDefaults,
  });
  payload.logger.info(
    "Seed complete. Missing fields filled and short arrays extended; editor changes preserved.",
  );
}

const payload = await getPayload({ config });
try {
  await seed(payload);
} finally {
  await payload.destroy();
}
