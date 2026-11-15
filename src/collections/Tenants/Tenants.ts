import type { CollectionConfig, Field } from "payload";
import { openingHours } from "./openingHours";

import {
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  LinkFeature,
  lexicalEditor,
  EXPERIMENTAL_TableFeature,
} from "@payloadcms/richtext-lexical";

import { isSuperAdminAccess } from "@/access/isSuperAdmin";
import { updateAndDeleteAccess } from "./access/updateAndDelete";

/**
 * A branch ("home") of House of Senses. Each one is served on its own
 * subdomain and every page of that site is filled from this document.
 *
 * The admin is grouped into tabs that follow the public site from top to
 * bottom.
 *
 * Photos live in `photoSets`: each set is one filter of the home page photo
 * index and the Gallery page ("The room", "The table", "Moments"…). This
 * replaces the old fixed lists (heroImagesList, shortAboutCollages) and the
 * separate Gallery collection; src/scripts/migratePhotoSets.ts moves
 * existing content over.
 */

/** Several photos picked or uploaded at once, kept in the order given */
const photos = (name: string, label: string, description: string, extra: Partial<Field> = {}): Field =>
  ({
    name,
    label,
    type: "upload",
    relationTo: "media",
    hasMany: true,
    filterOptions: { mimeType: { contains: "image" } },
    admin: { description },
    ...extra,
  }) as Field;

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export const Tenants: CollectionConfig = {
  slug: "tenants",
  labels: { singular: "Branch", plural: "Branches" },
  access: {
    create: isSuperAdminAccess,
    delete: updateAndDeleteAccess,
    read: () => true,
    update: updateAndDeleteAccess,
  },
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "status", "domain", "openingHours"],
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        // 0,0 is the default the number inputs fall back to, not a real place
        // (it is in the Gulf of Guinea). Store "no coordinates" instead so the
        // site locates the branch by its address.
        const loc = data?.location;
        if (loc && !Number(loc.latitude) && !Number(loc.longitude)) {
          data.location = { latitude: null, longitude: null };
        }
        return data;
      },
    ],
  },
  fields: [
    {
      type: "tabs",
      tabs: [
        // ─── Branch ──────────────────────────────────────────────────────
        {
          label: "Branch",
          description: "Who this branch is and how it looks across its site.",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "name",
                  type: "text",
                  required: true,
                  admin: {
                    width: "50%",
                    description:
                      "Shown in lowercase as the wordmark in the header and footer, and in the Homes list.",
                  },
                },
                {
                  name: "domain",
                  type: "text",
                  required: true,
                  unique: true,
                  index: true,
                  admin: {
                    width: "50%",
                    placeholder: "red-space",
                    description:
                      "Subdomain of houseofsenses.vn, e.g. red-space → red-space.houseofsenses.vn.",
                  },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "mainColor",
                  type: "text",
                  label: "Branch colour",
                  validate: (value: unknown) =>
                    !value || HEX_COLOR.test(String(value)) || "Use a hex colour such as #81180E.",
                  admin: {
                    width: "50%",
                    placeholder: "#81180E",
                    description:
                      "The only accent colour on the site: headline, links, buttons and the menu wheel. Pick something dark enough to read on cream.",
                  },
                },
                {
                  name: "logo",
                  type: "upload",
                  relationTo: "media",
                  admin: {
                    width: "50%",
                    description:
                      "Used on the houseofsenses.vn welcome page and in search/social previews. The branch site itself uses the name as its wordmark.",
                  },
                },
              ],
            },
            {
              name: "topbarNotification",
              type: "group",
              label: "Announcement bar",
              admin: {
                description: "A strip in the branch colour above the header, on every page.",
              },
              fields: [
                {
                  name: "enabled",
                  type: "checkbox",
                  label: "Show announcement",
                  defaultValue: false,
                },
                {
                  name: "message",
                  type: "text",
                  admin: {
                    description: "Keep it to one short sentence; it wraps on phones.",
                    condition: (_, siblingData) => siblingData?.enabled,
                  },
                },
              ],
            },
          ],
        },

        // ─── Home page ───────────────────────────────────────────────────
        {
          label: "Home page",
          description: "Top to bottom: headline, photo index, the house, follow along.",
          fields: [
            {
              type: "collapsible",
              label: "Headline",
              fields: [
                {
                  name: "heroTitle",
                  label: "Headline",
                  type: "text",
                  required: true,
                  admin: {
                    placeholder: "red_space",
                    description:
                      "The very large words at the top, shown in lowercase. Use an underscore where the line should break, e.g. red_space.",
                  },
                },
                {
                  name: "heroSubtitle",
                  label: "Tagline",
                  type: "text",
                  required: true,
                  admin: {
                    description:
                      "Small capitals beside the headline. Also repeated under the wordmark in the footer.",
                  },
                },
                {
                  name: "heroDescription",
                  label: "Introduction",
                  type: "textarea",
                  required: true,
                  admin: {
                    description:
                      "Two or three sentences beside the headline, followed by today's hours and the address. Also used as the search description.",
                  },
                },
              ],
            },
            {
              type: "collapsible",
              label: "The house",
              admin: {
                description: "The short story section under the photos.",
              },
              fields: [
                {
                  name: "shortAboutTitle",
                  label: "Statement",
                  type: "text",
                  required: true,
                  admin: { description: "One sentence, shown large." },
                },
                {
                  name: "shortAboutText",
                  label: "Statement text",
                  type: "text",
                  required: true,
                  admin: {
                    description:
                      "A line under the statement. Hidden if it repeats the introduction word for word.",
                  },
                },
                {
                  type: "row",
                  fields: [
                    {
                      name: "galleryTitle",
                      label: "Note title",
                      type: "text",
                      admin: {
                        width: "50%",
                        description: "Small heading beside the statement, above the Our story / Menu buttons.",
                      },
                    },
                    {
                      name: "galleryText",
                      label: "Note text",
                      type: "textarea",
                      admin: { width: "50%" },
                    },
                  ],
                },
              ],
            },
            {
              type: "collapsible",
              label: "Visit block",
              admin: {
                initCollapsed: true,
                description:
                  "The “Visit” invitation that closes the home, About, Menu, Gallery and Contact pages.",
              },
              fields: [
                {
                  name: "ctaTitle",
                  label: "Title",
                  type: "text",
                  admin: { placeholder: "Come and stay a while" },
                },
                {
                  name: "ctaText",
                  label: "Text",
                  type: "text",
                },
              ],
            },
          ],
        },

        // ─── Photos ──────────────────────────────────────────────────────
        {
          label: "Photos",
          description:
            "Each set is one filter on the home page photo index and the Gallery page, in this order, after “All”. Name the sets however suits the branch. The first photo of the first set is the social share image unless the SEO tab sets one.",
          fields: [
            {
              name: "photoSets",
              label: "Photo sets",
              type: "array",
              maxRows: 8,
              labels: { singular: "Set", plural: "Sets" },
              admin: {
                initCollapsed: true,
                components: { RowLabel: "@/collections/Tenants/PhotoSetRowLabel#PhotoSetRowLabel" },
              },
              fields: [
                {
                  name: "title",
                  type: "text",
                  required: true,
                  maxLength: 32,
                  admin: {
                    placeholder: "The room",
                    description: "Filter name, e.g. The room, The table, Moments, Private dining.",
                  },
                },
                photos(
                  "photos",
                  "Photos",
                  "Drag to reorder. A photo's Caption (set on the photo itself) shows under it and in the viewer, and doubles as alt text.",
                  { required: true },
                ),
              ],
            },
          ],
        },

        // ─── About page ──────────────────────────────────────────────────
        {
          label: "About page",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "aboutTitle",
                  label: "Headline",
                  type: "text",
                  admin: { width: "50%", placeholder: "about red space" },
                },
                {
                  name: "aboutSubtitle",
                  label: "Introduction",
                  type: "text",
                  admin: { width: "50%" },
                },
              ],
            },
            {
              name: "aboutusHero",
              label: "Lead photo",
              type: "upload",
              relationTo: "media",
              required: true,
              admin: {
                description:
                  "Shown wide (16:9) under the headline.",
              },
            },
            photos(
              "aboutPhotos",
              "Story photos",
              "Shown between the passages of “How it began”, one beside every few paragraphs, in this order. If there are fewer than the story needs, photos from the photo sets fill in.",
              { maxRows: 12 },
            ),
            {
              name: "aboutus",
              label: "How it began",
              type: "richText",
              editor: lexicalEditor({
                features: ({ defaultFeatures }) => [
                  ...defaultFeatures,
                  HeadingFeature({ enabledHeadingSizes: ["h1", "h2", "h3", "h4", "h5", "h6"] }),
                  FixedToolbarFeature({}),
                  InlineToolbarFeature(),
                  HorizontalRuleFeature(),
                  LinkFeature(),
                  EXPERIMENTAL_TableFeature(),
                ],
              }),
            },
          ],
        },

        // ─── Menu ────────────────────────────────────────────────────────
        {
          label: "Menu",
          fields: [
            {
              name: "menu",
              label: "Menu file",
              type: "upload",
              relationTo: "media",
              admin: {
                description:
                  "A PDF, opened as a flip book on the Menu page. A single image works too.",
              },
            },
            {
              name: "menuPages",
              label: "Menu pages (images)",
              type: "array",
              labels: { singular: "Page", plural: "Pages" },
              admin: {
                initCollapsed: true,
                description:
                  "Optional. Upload each page as an image, in order, to use instead of the file above. Sharper on phones than a PDF.",
              },
              fields: [{ name: "image", type: "upload", relationTo: "media", required: true }],
            },
            {
              name: "newMenu",
              label: "What's new",
              type: "array",
              labels: { singular: "Slide", plural: "Slides" },
              admin: {
                initCollapsed: true,
                description:
                  "Event or new-menu posters. When there is at least one, they open in a pop-up the first time someone visits the home page.",
              },
              fields: [{ name: "src", label: "Image", type: "upload", relationTo: "media", required: true }],
            },
          ],
        },

        // ─── Visit & contact ─────────────────────────────────────────────
        {
          label: "Visit & contact",
          description: "Shown in the header, home headline, footer map and contacts, and on the Contact and Reservation pages.",
          fields: [
            openingHours,
            {
              name: "address",
              type: "text",
              admin: {
                description: "Also what the footer map and every “directions” link search for.",
              },
            },
            {
              name: "location",
              type: "group",
              label: "Map coordinates",
              admin: {
                description:
                  "Optional. Only used for search engines. Leave both empty unless you have the exact numbers; 0, 0 is cleared on save.",
              },
              fields: [
                {
                  type: "row",
                  fields: [
                    {
                      name: "latitude",
                      type: "number",
                      min: -90,
                      max: 90,
                      admin: { width: "50%", placeholder: "10.7769", step: 0.000001 },
                    },
                    {
                      name: "longitude",
                      type: "number",
                      min: -180,
                      max: 180,
                      admin: { width: "50%", placeholder: "106.7009", step: 0.000001 },
                    },
                  ],
                },
              ],
            },
            {
              type: "row",
              fields: [
                { name: "phone", type: "text", admin: { width: "50%" } },
                { name: "email", type: "email", admin: { width: "50%" } },
              ],
            },
            {
              type: "collapsible",
              label: "Social links",
              admin: {
                description:
                  "Full profile URLs. Each one filled in becomes an icon in the footer and a big link in “Follow along”.",
              },
              fields: [
                {
                  type: "row",
                  fields: [
                    { name: "instagram", type: "text", admin: { width: "50%", placeholder: "https://instagram.com/…" } },
                    { name: "facebook", type: "text", admin: { width: "50%", placeholder: "https://facebook.com/…" } },
                  ],
                },
                {
                  type: "row",
                  fields: [
                    { name: "tiktok", type: "text", admin: { width: "50%", placeholder: "https://tiktok.com/@…" } },
                    { name: "youtube", type: "text", admin: { width: "50%", placeholder: "https://youtube.com/@…" } },
                  ],
                },
              ],
            },
          ],
        },

        // ─── Lucky wheel ─────────────────────────────────────────────────
        {
          label: "Lucky wheel",
          fields: [
            {
              name: "spinWheelPrizes",
              type: "array",
              label: "Prizes",
              labels: { singular: "Prize", plural: "Prizes" },
              minRows: 2,
              maxRows: 12,
              defaultValue: [
                { label: "Free Dessert" },
                { label: "10% Off" },
                { label: "Free Cocktail" },
                { label: "5% Off" },
                { label: "Free Starter" },
                { label: "3% Off" },
                { label: "Free Drink" },
                { label: "Chef's Surprise" },
              ],
              admin: {
                description:
                  "One slice of the wheel each, in this order; every slice is equally likely. Keep labels short (two or three words). Name a prize “Try Again” for a no-win slice.",
              },
              fields: [
                {
                  name: "label",
                  type: "text",
                  label: "Prize",
                  required: true,
                  maxLength: 24,
                },
              ],
            },
          ],
        },
      ],
    },

    // ─── Sidebar ───────────────────────────────────────────────────────────
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "open",
      options: [
        { label: "Open", value: "open" },
        { label: "Closed", value: "closed" },
        { label: "Temporarily closed", value: "temporarily-closed" },
      ],
      admin: {
        position: "sidebar",
        description:
          "“Temporarily closed” shows “We'll be back soon” everywhere instead of today's hours.",
      },
    },
    {
      name: "allowPublicRead",
      type: "checkbox",
      admin: {
        description:
          "If checked, logging in is not required to read. Useful for building public pages.",
        position: "sidebar",
      },
      defaultValue: false,
      index: true,
    },
  ],
};
