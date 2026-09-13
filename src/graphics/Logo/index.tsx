import React from "react";
import { getPayload } from "payload";
import config from "@payload-config";
import type { Media } from "@/payload-types";
import Image from "next/image";

export const Logos = async () => {
  const payload = await getPayload({ config });
  const settings = await payload.findGlobal({ slug: "settings" });
  const light = settings["light-icon"] as Media | null;
  const dark = settings["dark-icon"] as Media | null;
  const lightURL = light?.url || dark?.url;
  const darkURL = dark?.url || light?.url;

  if (!lightURL || !darkURL) {
    return (
      <span
        style={{
          fontFamily: "Georgia, serif",
          fontSize: "1.5rem",
          letterSpacing: "0.06em",
        }}
      >
        house of senses
      </span>
    );
  }
  return (
    <>
      <Image
        src={lightURL}
        alt="House of Senses"
        width={260}
        height={100}
        className="light-mode-image"
        style={{ objectFit: "contain" }}
      />
      <Image
        src={darkURL}
        alt="House of Senses"
        width={260}
        height={100}
        className="dark-mode-image"
        style={{ objectFit: "contain" }}
      />
    </>
  );
};
