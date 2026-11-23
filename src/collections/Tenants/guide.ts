import type { Field, Tab } from "payload";

/**
 * Text written for people searching for a place to eat (and for search engines):
 * - "Guide & FAQ": an English section at the bottom of the branch home page.
 * - "Vietnamese page": the branch's page in Vietnamese at <branch>.houseofsenses.vn/vi.
 * Every field is optional; empty sections are simply not shown. The SEO agent fills
 * these through the API, and everything it writes can be edited or cleared here.
 */

/** Paragraphs separated by an empty line; an optional link under each block */
const sectionsField = (description: string): Field => ({
  name: "sections",
  label: "Sections",
  type: "array",
  labels: { singular: "Section", plural: "Sections" },
  admin: { initCollapsed: true, description },
  fields: [
    { name: "heading", type: "text" },
    {
      name: "body",
      type: "textarea",
      admin: { rows: 5, description: "Plain text. Leave an empty line between paragraphs." },
    },
    {
      type: "row",
      fields: [
        { name: "linkLabel", label: "Link text", type: "text", admin: { width: "50%" } },
        {
          name: "linkHref",
          label: "Link",
          type: "text",
          admin: { width: "50%", placeholder: "/menu", description: "A page of this site (/menu, /reservation…) or a full address." },
        },
      ],
    },
  ],
});

const faqField = (description: string): Field => ({
  name: "faq",
  label: "Questions & answers",
  type: "array",
  labels: { singular: "Question", plural: "Questions" },
  admin: { initCollapsed: true, description },
  fields: [
    { name: "question", type: "text" },
    { name: "answer", type: "textarea", admin: { rows: 3 } },
  ],
});

export const guideTab: Tab = {
  label: "Guide & FAQ",
  description:
    "Optional. A short guide and common questions at the bottom of the branch home page, in English. Only facts that are true for this branch.",
  fields: [
    {
      name: "guide",
      type: "group",
      label: false,
      fields: [
        {
          type: "row",
          fields: [
            { name: "label", label: "Side label", type: "text", defaultValue: "Good to know", admin: { width: "50%" } },
            { name: "title", label: "Heading", type: "text", admin: { width: "50%" } },
          ],
        },
        { name: "intro", label: "Introduction", type: "textarea", admin: { rows: 3 } },
        sectionsField("Short blocks, e.g. the food, the room, finding us in District 3, booking."),
        { name: "faqTitle", label: "Questions heading", type: "text", defaultValue: "Questions" },
        faqField("Real questions guests ask, with short, factual answers. Also shown to Google as FAQ data."),
      ],
    },
  ],
};

export const vietnameseTab: Tab = {
  label: "Vietnamese page",
  description:
    "The branch's page in Vietnamese at <branch>.houseofsenses.vn/vi, linked from the footer. It goes live when “Show the Vietnamese page” is ticked.",
  fields: [
    {
      name: "vi",
      type: "group",
      label: false,
      fields: [
        {
          name: "enabled",
          label: "Show the Vietnamese page",
          type: "checkbox",
          defaultValue: false,
        },
        {
          type: "row",
          fields: [
            {
              name: "metaTitle",
              label: "Search title",
              type: "text",
              admin: { width: "50%", description: "About 50–60 characters." },
            },
            {
              name: "metaDescription",
              label: "Search description",
              type: "textarea",
              admin: { width: "50%", rows: 2, description: "About 120–155 characters." },
            },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "label", label: "Side label", type: "text", defaultValue: "Giới thiệu", admin: { width: "50%" } },
            { name: "title", label: "Heading", type: "text", admin: { width: "50%" } },
          ],
        },
        { name: "intro", label: "Introduction", type: "textarea", admin: { rows: 3 } },
        sectionsField("In Vietnamese: the food, the room, the address in Quận 3, booking."),
        { name: "faqTitle", label: "Questions heading", type: "text", defaultValue: "Câu hỏi thường gặp" },
        faqField("In Vietnamese. Also shown to Google as FAQ data."),
        {
          type: "row",
          fields: [
            { name: "bookLabel", label: "Booking button", type: "text", defaultValue: "Đặt bàn", admin: { width: "33%" } },
            { name: "menuLabel", label: "Menu button", type: "text", defaultValue: "Xem thực đơn", admin: { width: "33%" } },
            {
              name: "switchLabel",
              label: "Footer link to this page",
              type: "text",
              defaultValue: "Tiếng Việt",
              admin: { width: "33%" },
            },
          ],
        },
        { name: "englishLabel", label: "Link back to the English site", type: "text", defaultValue: "English" },
      ],
    },
  ],
};
