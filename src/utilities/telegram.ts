const TELEGRAM_API_BASE_URL = "https://api.telegram.org";
const TELEGRAM_REQUEST_TIMEOUT_MS = 5_000;

interface TelegramSendMessageResponse {
  ok: boolean;
  description?: string;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export type TelegramSendResult = "sent" | "not-configured";

const getTelegramConfig = (): TelegramConfig | null => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!botToken && !chatId) return null;

  if (!botToken || !chatId) {
    throw new Error(
      "Telegram notifications require both TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID",
    );
  }

  return { botToken, chatId };
};

/**
 * Sends a plain-text Telegram message. Keeping parse_mode unset ensures customer
 * input is never interpreted as Telegram HTML or Markdown.
 */
export const sendTelegramMessage = async (
  text: string,
  config: TelegramConfig | null = getTelegramConfig(),
): Promise<TelegramSendResult> => {
  if (!config) return "not-configured";

  let response: Response;

  try {
    response = await fetch(
      `${TELEGRAM_API_BASE_URL}/bot${config.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: config.chatId,
          text,
        }),
        signal: AbortSignal.timeout(TELEGRAM_REQUEST_TIMEOUT_MS),
      },
    );
  } catch {
    // Do not include the request URL in the error because it contains the bot token.
    throw new Error("Unable to reach the Telegram Bot API");
  }

  const result = (await response.json().catch(() => null)) as
    | TelegramSendMessageResponse
    | null;

  if (!response.ok || !result?.ok) {
    const details = result?.description
      ? `: ${result.description}`
      : ` (HTTP ${response.status})`;
    throw new Error(`Telegram rejected the notification${details}`);
  }

  return "sent";
};
