import { dirname, join } from "node:path";
import { mkdir, readFile } from "node:fs/promises";
import type { AuthConfiguration, RuntimeConfig } from "../../../shared/types";
import {
  DEFAULT_DISCORD_RPC_CLIENT_ID,
  DEFAULT_MICROSOFT_CLIENT_ID,
  DEFAULT_MICROSOFT_REDIRECT_URI
} from "../../../shared/constants";
import { JsonStore } from "./jsonStore";

const parseEnvFile = async (filePath: string): Promise<Record<string, string>> => {
  try {
    const raw = await readFile(filePath, "utf8");
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .reduce<Record<string, string>>((acc, line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
        acc[key] = value;
        return acc;
      }, {});
  } catch {
    return {};
  }
};

export class RuntimeConfigService {
  private readonly store: JsonStore<RuntimeConfig>;
  private cache?: RuntimeConfig;

  constructor(private readonly userDataPath: string) {
    this.store = new JsonStore<RuntimeConfig>(join(userDataPath, "runtime-config.json"));
  }

  private async loadEnvConfig(): Promise<Partial<RuntimeConfig>> {
    const envFiles = [
      join(process.cwd(), ".env"),
      join(process.cwd(), "nova-launcher.env"),
      join(dirname(process.execPath), ".env"),
      join(dirname(process.execPath), "nova-launcher.env")
    ];

    const merged: Record<string, string> = {};
    for (const filePath of envFiles) {
      Object.assign(merged, await parseEnvFile(filePath));
    }

    return {
      microsoftClientId:
        process.env.MICROSOFT_CLIENT_ID ?? merged.MICROSOFT_CLIENT_ID ?? DEFAULT_MICROSOFT_CLIENT_ID,
      microsoftRedirectUri:
        process.env.MICROSOFT_REDIRECT_URI ?? merged.MICROSOFT_REDIRECT_URI ?? DEFAULT_MICROSOFT_REDIRECT_URI,
      discordRpcClientId:
        process.env.DISCORD_RPC_CLIENT_ID ?? merged.DISCORD_RPC_CLIENT_ID ?? DEFAULT_DISCORD_RPC_CLIENT_ID
    };
  }

  private normalize(config?: Partial<RuntimeConfig>): RuntimeConfig {
    return {
      microsoftClientId: config?.microsoftClientId?.trim() || DEFAULT_MICROSOFT_CLIENT_ID,
      microsoftRedirectUri: config?.microsoftRedirectUri?.trim() || DEFAULT_MICROSOFT_REDIRECT_URI,
      discordRpcClientId: config?.discordRpcClientId?.trim() || DEFAULT_DISCORD_RPC_CLIENT_ID
    };
  }

  async get(): Promise<RuntimeConfig> {
    if (this.cache) {
      return structuredClone(this.cache);
    }

    const [stored, envConfig] = await Promise.all([this.store.read(), this.loadEnvConfig()]);
    const merged = this.normalize({
      ...stored,
      ...envConfig
    });

    this.cache = merged;
    return structuredClone(merged);
  }

  async update(patch: Partial<RuntimeConfig>): Promise<RuntimeConfig> {
    const current = await this.get();
    const next = this.normalize({ ...current, ...patch });
    this.cache = next;
    await mkdir(dirname(join(this.userDataPath, "runtime-config.json")), { recursive: true });
    await this.store.write(next);
    return structuredClone(next);
  }

  async getAuthConfiguration(): Promise<AuthConfiguration> {
    const config = await this.get();
    return {
      configured:
        Boolean(config.microsoftClientId) && config.microsoftRedirectUri === DEFAULT_MICROSOFT_REDIRECT_URI,
      clientId: config.microsoftClientId || undefined,
      redirectUri: config.microsoftRedirectUri
    };
  }
}
