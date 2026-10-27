import { GlobalConfig } from "payload";
import { anyone } from "@/access/roles";
import { isSuperAdminAccess } from "@/access/isSuperAdmin";

export const Settings: GlobalConfig = {
  slug: "settings",
  access: {
    read: anyone,
    update: isSuperAdminAccess,
  },
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
