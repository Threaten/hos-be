import type { TextField } from "payload";

export const openingHours: TextField = {
  name: "openingHours",
  label: "Opening Hours",
  type: "text",
  admin: {
    placeholder: "11:00–22:00",
    description: "One opening-hours description, shown when the branch is open.",
  },
};
