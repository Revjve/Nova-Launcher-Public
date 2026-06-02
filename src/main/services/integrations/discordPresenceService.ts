import RPC, { Client as DiscordRpcClient } from "discord-rpc";
import type { Instance, LaunchStatusEvent, LauncherAccount } from "../../../shared/types";
import { LauncherRepository } from "../storage/launcherRepository";
import { RuntimeConfigService } from "../storage/runtimeConfigService";

const runningStates = new Set<LaunchStatusEvent["state"]>([
  "launching-game",
  "game-running"
]);

type RpcActivity = {
  details?: string;
  state?: string;
  startTimestamp?: number;
  instance?: boolean;
};

export class DiscordPresenceService {
  private client?: DiscordRpcClient;
  private clientId?: string;
  private ready = false;
  private lastActivityKey?: string;
  private lastStatus?: LaunchStatusEvent;

  constructor(
    private readonly repository: LauncherRepository,
    private readonly runtimeConfig: RuntimeConfigService
  ) {}

  async onLaunchStatus(status?: LaunchStatusEvent): Promise<void> {
    this.lastStatus = status;
    await this.refresh().catch(() => undefined);
  }

  async refresh(): Promise<void> {
    const [data, runtimeConfig] = await Promise.all([
      this.repository.getData(),
      this.runtimeConfig.get()
    ]);

    const clientId = runtimeConfig.discordRpcClientId.trim();
    if (!data.settings.discordRichPresence || !clientId) {
      await this.disconnect();
      return;
    }

    const account = data.accounts.find((entry) => entry.active);
    const instance = this.lastStatus
      ? data.instances.find((entry) => entry.id === this.lastStatus?.instanceId)
      : undefined;
    await this.ensureClient(clientId);
    if (!this.client || !this.ready) {
      return;
    }

    const activity = this.buildActivity(instance, account, this.lastStatus);
    const activityKey = JSON.stringify(activity);
    if (activityKey === this.lastActivityKey) {
      return;
    }

    await this.client.setActivity(activity);
    this.lastActivityKey = activityKey;
  }

  async disconnect(): Promise<void> {
    this.lastActivityKey = undefined;
    this.ready = false;

    if (!this.client) {
      return;
    }

    try {
      await this.client.clearActivity();
    } catch {
      // Ignore RPC cleanup failures.
    }

    try {
      await this.client.destroy();
    } catch {
      // Ignore RPC cleanup failures.
    }

    this.client = undefined;
    this.clientId = undefined;
  }

  private async ensureClient(clientId: string): Promise<void> {
    if (this.client && this.ready && this.clientId === clientId) {
      return;
    }

    if (this.clientId !== clientId || !this.client) {
      await this.disconnect();
      this.clientId = clientId;
      this.ready = false;
      RPC.register(clientId);
      this.client = await this.connectClient(clientId).catch(() => undefined);
    }

    if (!this.client || !this.ready) {
      return;
    }
  }

  private async connectClient(clientId: string): Promise<DiscordRpcClient> {
    const transports: Array<"ipc" | "websocket"> = ["ipc", "websocket"];
    let lastError: Error | undefined;

    for (const transport of transports) {
      const client = new RPC.Client({ transport });
      (client as DiscordRpcClient & {
        on?: (event: string, handler: (...args: unknown[]) => void) => void;
      }).on?.("error", () => {
        this.ready = false;
      });

      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error(`Discord RPC ${transport} timed out.`)), 5_000);
          client.once("ready", () => {
            clearTimeout(timeout);
            resolve();
          });
          client.login({ clientId }).catch((error: unknown) => {
            clearTimeout(timeout);
            reject(error instanceof Error ? error : new Error(String(error)));
          });
        });

        this.ready = true;
        return client;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        try {
          await client.destroy();
        } catch {
          // Ignore fallback cleanup failures.
        }
      }
    }

    throw lastError ?? new Error("Discord RPC could not connect.");
  }

  private buildActivity(
    instance: Instance | undefined,
    account: LauncherAccount | undefined,
    status: LaunchStatusEvent | undefined
  ): RpcActivity {
    if (!status || status.state === "idle") {
      return {
        details: "Playing Nova Launcher",
        state: account ? `Ready as ${account.displayName ?? account.username}` : "Ready to play",
        instance: false
      };
    }

    const launcherState = status.state.replace(/-/g, " ");
    if (runningStates.has(status.state)) {
      return {
        details: "Playing Nova Launcher",
        state: instance
          ? `Instance: ${instance.name}`
          : "Minecraft session",
        startTimestamp: new Date(status.timestamp).getTime(),
        instance: false
      };
    }

    return {
      details: "Playing Nova Launcher",
      state: status.message || launcherState,
      instance: false
    };
  }
}
