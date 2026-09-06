import type {
  ContactMessage,
  Customer,
  Reservation,
  Tenant,
} from "@/payload-types";
import { sendTelegramMessage } from "@/utilities/telegram";
import { sendZaloMessage } from "@/utilities/zalo";
import type { CollectionAfterChangeHook, PayloadRequest } from "payload";

const TELEGRAM_TIME_ZONE =
  process.env.TELEGRAM_TIME_ZONE?.trim() || "Asia/Ho_Chi_Minh";

type Relationship<T extends { id: string }> = string | T | null | undefined;

const resolveRelationship = async <T extends Customer | Tenant>(
  relationship: Relationship<T>,
  collection: "customers" | "tenants",
  req: PayloadRequest,
): Promise<T | null> => {
  if (!relationship) return null;
  if (typeof relationship === "object") return relationship;

  return (await req.payload.findByID({
    collection,
    id: relationship,
    depth: 0,
    req,
  })) as T;
};

const valueOrFallback = (value: string | null | undefined): string =>
  value?.trim() || "Not provided";

export const formatReservationNotification = ({
  reservation,
  customer,
  branch,
}: {
  reservation: Reservation;
  customer: Customer | null;
  branch: Tenant | null;
}): string => {
  const reservationDateTime = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: TELEGRAM_TIME_ZONE,
  }).format(new Date(reservation.reservationDateTime));

  return [
    "🍽 New reservation",
    "",
    `Branch: ${valueOrFallback(branch?.name)}`,
    `Customer: ${valueOrFallback(customer?.customerName)}`,
    `Phone: ${valueOrFallback(customer?.customerPhone)}`,
    `Date/time: ${reservationDateTime}`,
    `Guests: ${reservation.numberOfGuests}`,
    `Special requests: ${valueOrFallback(reservation.specialRequests)}`,
    `Created at: ${new Intl.DateTimeFormat("vn-VN", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: TELEGRAM_TIME_ZONE,
    }).format(new Date(reservation.createdAt))}`,
  ].join("\n");
};

export const formatContactNotification = ({
  contactMessage,
  customer,
  branch,
}: {
  contactMessage: ContactMessage;
  customer: Customer | null;
  branch: Tenant | null;
}): string =>
  [
    "✉️ New contact message",
    "",
    `Branch: ${valueOrFallback(branch?.name)}`,
    `Customer: ${valueOrFallback(customer?.customerName)}`,
    `Phone: ${valueOrFallback(customer?.customerPhone)}`,
    `Message: ${valueOrFallback(contactMessage.message)}`,
  ].join("\n");

const deliverTelegramNotification = async (
  message: string,
  req: PayloadRequest,
): Promise<void> => {
  try {
    const result = await sendTelegramMessage(message);

    if (result === "not-configured") {
      req.payload.logger.warn(
        "Telegram notification skipped because TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are not configured",
      );
    }
  } catch (error) {
    req.payload.logger.error(
      { err: error },
      "Failed to send Telegram notification",
    );
  }
};

const deliverZaloNotification = async (
  message: string,
  req: PayloadRequest,
): Promise<void> => {
  try {
    const result = await sendZaloMessage(message);

    if (result === "not-configured") {
      req.payload.logger.warn(
        "Zalo notification skipped because OPENCLAW_ZALO_TARGET is not configured",
      );
    }
  } catch (error) {
    req.payload.logger.error(
      { err: error },
      "Failed to send Zalo notification",
    );
  }
};

export const sendReservationTelegramNotification: CollectionAfterChangeHook<
  Reservation
> = async ({ doc, operation, req }) => {
  if (operation !== "create") return doc;

  try {
    const [customer, branch] = await Promise.all([
      resolveRelationship<Customer>(doc.customer, "customers", req),
      resolveRelationship<Tenant>(doc.branch, "tenants", req),
    ]);

    const message = formatReservationNotification({
      reservation: doc,
      customer,
      branch,
    });

    await Promise.all([
      deliverTelegramNotification(message, req),
      deliverZaloNotification(message, req),
    ]);
  } catch (error) {
    req.payload.logger.error(
      { err: error },
      "Failed to prepare Telegram reservation notification",
    );
  }

  return doc;
};

export const sendContactTelegramNotification: CollectionAfterChangeHook<
  ContactMessage
> = async ({ doc, operation, req }) => {
  if (operation !== "create") return doc;

  try {
    const [customer, branch] = await Promise.all([
      resolveRelationship<Customer>(doc.customer, "customers", req),
      resolveRelationship<Tenant>(doc.branch, "tenants", req),
    ]);

    const message = formatContactNotification({
      contactMessage: doc,
      customer,
      branch,
    });

    await Promise.all([
      deliverTelegramNotification(message, req),
      deliverZaloNotification(message, req),
    ]);
  } catch (error) {
    req.payload.logger.error(
      { err: error },
      "Failed to prepare Telegram contact notification",
    );
  }

  return doc;
};
