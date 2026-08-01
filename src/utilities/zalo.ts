import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";

const OPENCLAW_REQUEST_TIMEOUT_MS = 10_000;
const ZALO_CHANNEL = "zalo";
const DEFAULT_ZALO_ACCOUNT_ID = "default";

export interface ZaloConfig {
  executable: string;
  target: string;
}

export type ZaloSendResult = "sent" | "not-configured";

export type OpenClawCommandRunner = (
  executable: string,
  args: string[],
) => Promise<void>;

const getZaloConfig = (): ZaloConfig | null => {
  const target = process.env.OPENCLAW_ZALO_TARGET?.trim();
  const executable = process.env.OPENCLAW_EXECUTABLE?.trim() || "openclaw";

  if (!target) return null;

  return { executable, target };
};

const runOpenClawCommand: OpenClawCommandRunner = (executable, args) =>
  new Promise((resolve, reject) => {
    execFile(
      executable,
      args,
      {
        timeout: OPENCLAW_REQUEST_TIMEOUT_MS,
        windowsHide: true,
      },
      (error, stdout) => {
        if (error) {
          let details = "";

          try {
            const response = JSON.parse(stdout) as {
              error?: { message?: string };
            };
            details = response.error?.message?.trim() || "";
          } catch {
            // OpenClaw did not return its usual JSON error envelope.
          }

          reject(
            new Error(
              details
                ? `OpenClaw failed to deliver the Zalo message: ${details}`
                : "OpenClaw failed to deliver the Zalo message",
            ),
          );
          return;
        }

        resolve();
      },
    );
  });

/**
 * Sends text through an authenticated OpenClaw gateway and the standard Zalo
 * Bot API channel. Arguments are passed without a shell so submitted customer
 * data cannot be interpreted as command-line code.
 */
export const sendZaloMessage = async (
  text: string,
  config: ZaloConfig | null = getZaloConfig(),
  runCommand: OpenClawCommandRunner = runOpenClawCommand,
): Promise<ZaloSendResult> => {
  if (!config) return "not-configured";

  // Gateway channel selection understands the `zalo:` prefix, but the
  // standard Zalo adapter expects the raw `zgr-...` group id when sending.
  const target = config.target.replace(/^zalo:/, "");

  await runCommand(config.executable, [
    "gateway",
    "call",
    "send",
    "--json",
    "--timeout",
    String(OPENCLAW_REQUEST_TIMEOUT_MS),
    "--params",
    JSON.stringify({
      to: target,
      message: text,
      channel: ZALO_CHANNEL,
      accountId: DEFAULT_ZALO_ACCOUNT_ID,
      idempotencyKey: randomUUID(),
    }),
  ]);

  return "sent";
};
