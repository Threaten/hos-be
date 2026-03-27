import { GlobalConfig } from "payload";

export const Settings: GlobalConfig = {
  slug: "settings",
  fields: [
    {
      name: "light-icon",
      type: "upload",
      relationTo: "media",
    },
    {
      name: "dark-icon",
      type: "upload",
      relationTo: "media",
    },
  ],
};
