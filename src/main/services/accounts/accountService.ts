import { createHash } from "node:crypto";
import type { CreateOfflineDevAccountInput, LauncherAccount } from "../../../shared/types";
import { LauncherRepository } from "../storage/launcherRepository";
import { SecureStore } from "../storage/secureStore";

const normalizeUsername = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "DevPlayer";
  }

  return trimmed.replace(/\s+/g, " ").slice(0, 16);
};

const offlineUuidFromUsername = (username: string) => {
  const hash = createHash("md5").update(`OfflinePlayer:${username}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
};

export class AccountService {
  constructor(
    private readonly repository: LauncherRepository,
    private readonly secureStore: SecureStore
  ) {}

  async addOfflineDevAccount(input: CreateOfflineDevAccountInput): Promise<LauncherAccount> {
    const username = normalizeUsername(input.username);
    console.info("[nova][accounts] Creating offline dev account", { username });

    const account: LauncherAccount = {
      id: `offline-dev:${username.toLowerCase()}`,
      type: "offline-dev",
      username,
      displayName: username,
      uuid: offlineUuidFromUsername(username),
      avatarUrl: `https://mc-heads.net/avatar/${encodeURIComponent(username)}/96`,
      active: true,
      status: "ready",
      isOffline: true,
      devOnly: true
    };

    const data = await this.repository.getData();
    const nextAccounts = [
      account,
      ...data.accounts
        .filter((item) => item.id !== account.id)
        .map((item) => ({ ...item, active: false }))
    ];

    await this.repository.writeData({ ...data, accounts: nextAccounts });
    return account;
  }

  async removeAccount(accountId: string): Promise<boolean> {
    const data = await this.repository.getData();
    const remaining = data.accounts.filter((account) => account.id !== accountId);
    const nextAccounts =
      remaining.length > 0 && !remaining.some((account) => account.active)
        ? remaining.map((account, index) => ({ ...account, active: index === 0 }))
        : remaining;

    await this.repository.writeData({ ...data, accounts: nextAccounts });
    await this.secureStore.delete(`account:${accountId}`);
    return true;
  }

  async setActiveAccount(accountId: string): Promise<LauncherAccount> {
    const data = await this.repository.getData();
    const next = data.accounts.map((account) => ({
      ...account,
      active: account.id === accountId
    }));
    const active = next.find((account) => account.id === accountId);

    if (!active) {
      throw new Error("Account not found.");
    }

    if (active.type === "offline-dev") {
      console.info("[nova][accounts] Selected offline dev account", {
        accountId: active.id,
        username: active.username
      });
    }

    await this.repository.writeData({ ...data, accounts: next });
    return active;
  }
}
