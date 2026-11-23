import type { Field } from "payload";

/**
 * Search titles and descriptions for a branch's other pages, in the SEO tab next to the
 * home page's (meta.title / meta.description). Every field is optional: left empty, the
 * website writes one from the branch name and city.
 */
const PAGES: { name: string; label: string }[] = [
  { name: "menu", label: "Menu page" },
  { name: "reservation", label: "Book a table page" },
  { name: "about", label: "About page" },
  { name: "contact", label: "Contact page" },
  { name: "gallery", label: "Gallery page" },
];

export const pageSeoField: Field = {
  name: "pages",
  label: "Other pages",
  type: "group",
  admin: {
    description:
      "Optional. What Google shows for each page. Title: about 50–60 characters. Description: about 120–155 characters. Empty fields use a sensible default.",
  },
  fields: PAGES.map(({ name, label }) => ({
    name,
    label,
    type: "collapsible",
    admin: { initCollapsed: true },
    fields: [
      {
        name,
        type: "group",
        label: false,
        fields: [
          { name: "title", type: "text", admin: { placeholder: "Leave empty for the default" } },
          { name: "description", type: "textarea", admin: { rows: 2, placeholder: "Leave empty for the default" } },
        ],
      },
    ],
  })) as Field[],
};
