import React from "react";
import { getPayload } from "payload";
import config from "@payload-config";
import { Media } from "@/payload-types";
import Image from "next/image";

export const Logos = async () => {
  const payload = await getPayload({ config });
  const settings = await payload.findGlobal({ slug: "settings" });
  const lightLogo = settings?.["light-icon"] as Media;
  const darkLogo = settings?.["dark-icon"] as Media;

  return (
    <>
      <Image
        src={lightLogo?.url || ""}
        alt="Light Logo"
        width={260}
        height={260}
        className={"light-mode-image"}
      />
      <Image
        src={darkLogo?.url || ""}
        alt="Dark Logo"
        width={260}
        height={260}
        className={"dark-mode-image"}
      />
    </>
  );
};
