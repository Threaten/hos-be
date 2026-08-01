import {
  formatContactNotification,
  formatReservationNotification,
} from "@/hooks/sendTelegramNotification";
import type {
  ContactMessage,
  Customer,
  Reservation,
  Tenant,
} from "@/payload-types";
import { sendTelegramMessage } from "@/utilities/telegram";
import { sendZaloMessage } from "@/utilities/zalo";
import { afterEach, describe, expect, it, vi } from "vitest";

const timestamp = "2026-07-15T10:00:00.000Z";
const customer = {
  id: "customer-1",
  customerName: "Nguyen Van An",
  customerPhone: "0901234567",
  createdAt: timestamp,
  updatedAt: timestamp,
} satisfies Customer;
const branch = {
  id: "tenant-1",
  name: "House of Senses",
} as Tenant;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Telegram notifications", () => {
  it("posts a plain-text message to the configured chat", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendTelegramMessage("New reservation", {
        botToken: "test-token",
        chatId: "-100123",
      }),
    ).resolves.toBe("sent");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bottest-token/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          chat_id: "-100123",
          text: "New reservation",
        }),
      }),
    );
  });

  it("formats reservation details", () => {
    const reservation = {
      id: "reservation-1",
      customer,
      branch,
      reservationDateTime: "2026-07-15T12:30:00.000Z",
      numberOfGuests: 4,
      specialRequests: "Window table",
      status: "Pending",
      createdAt: timestamp,
      updatedAt: timestamp,
    } satisfies Reservation;

    const notification = formatReservationNotification({
      reservation,
      customer,
      branch,
    });
    expect(notification).toContain("Guests: 4");
    expect(notification).toContain("Special requests: Window table");
  });

  it("formats contact details without interpreting customer markup", () => {
    const contactMessage = {
      id: "message-1",
      customer,
      branch,
      message: "Please call me <soon>",
      status: "Pending",
      createdAt: timestamp,
      updatedAt: timestamp,
    } satisfies ContactMessage;

    expect(
      formatContactNotification({ contactMessage, customer, branch }),
    ).toContain("Message: Please call me <soon>");
  });
});

describe("Zalo notifications", () => {
  it("sends the message through the standard Zalo channel", async () => {
    const runCommand = vi.fn().mockResolvedValue(undefined);

    await expect(
      sendZaloMessage(
        "New reservation; $(must-not-run)",
        {
          executable: "/usr/local/bin/openclaw",
          target: "zalo:zgr-e19c14aa8ec767993ed6",
        },
        runCommand,
      ),
    ).resolves.toBe("sent");

    expect(runCommand).toHaveBeenCalledOnce();
    const [executable, args] = runCommand.mock.calls[0];
    expect(executable).toBe("/usr/local/bin/openclaw");
    expect(args.slice(0, 7)).toEqual([
      "gateway",
      "call",
      "send",
      "--json",
      "--timeout",
      "10000",
      "--params",
    ]);
    expect(JSON.parse(args[7])).toEqual({
      to: "zgr-e19c14aa8ec767993ed6",
      message: "New reservation; $(must-not-run)",
      channel: "zalo",
      accountId: "default",
      idempotencyKey: expect.any(String),
    });
  });

  it("skips delivery when no Zalo target is configured", async () => {
    await expect(
      sendZaloMessage("New reservation", null),
    ).resolves.toBe("not-configured");
  });
});
