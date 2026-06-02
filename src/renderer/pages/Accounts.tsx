import { useMemo, useState } from "react";
import { Login, Shield, Star1 } from "iconsax-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@renderer/components/ui/Tabs";
import { AccountCard } from "@renderer/components/ui/AccountCard";
import { Button } from "@renderer/components/ui/Button";
import { Card } from "@renderer/components/ui/Card";
import { EmptyState } from "@renderer/components/ui/EmptyState";
import { Input } from "@renderer/components/ui/Input";
import { PageHeader } from "@renderer/components/ui/PageHeader";
import { useLauncherStore } from "@renderer/state/useLauncherStore";

export const Accounts = () => {
  const [devUsername, setDevUsername] = useState("DevPlayer");
  const accounts = useLauncherStore((state) => state.accounts);
  const authConfigured = useLauncherStore((state) => state.authConfigured);
  const addMicrosoftAccount = useLauncherStore((state) => state.addMicrosoftAccount);
  const addOfflineDevAccount = useLauncherStore((state) => state.addOfflineDevAccount);
  const removeAccount = useLauncherStore((state) => state.removeAccount);
  const setActiveAccount = useLauncherStore((state) => state.setActiveAccount);

  const microsoftAccounts = useMemo(() => accounts.filter((account) => account.type === "microsoft"), [accounts]);
  const offlineAccounts = useMemo(() => accounts.filter((account) => account.type === "offline-dev"), [accounts]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Accounts" title="Accounts" description="Choose who you want to play as." />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="p-[var(--card-padding)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Microsoft</h3>
              <p className="mt-1 text-sm text-[var(--soft-text)]">
                {authConfigured ? "Add or switch a Microsoft account." : "Microsoft sign-in is unavailable right now."}
              </p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-[12px] border border-[var(--panel-border)] bg-[var(--surface-3)]">
              <Star1 size={18} variant="Bulk" className="text-[var(--accent-text)]" />
            </div>
          </div>
          <div className="mt-4">
            <Button size="sm" onClick={() => addMicrosoftAccount()} disabled={!authConfigured}>
              <Login size={18} variant="Bold" className="mr-2" />
              Sign in
            </Button>
          </div>
        </Card>

        <Card className="p-[var(--card-padding)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Offline Acounts</h3>
              <p className="mt-1 text-sm text-[var(--soft-text)]">Create a local testing account.</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-[12px] border border-[var(--panel-border)] bg-[var(--surface-3)]">
              <Shield size={18} variant="Bulk" className="text-amber-200" />
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <Input value={devUsername} onChange={(event) => setDevUsername(event.target.value)} placeholder="Username" />
            <Button size="sm" variant="secondary" onClick={() => addOfflineDevAccount(devUsername)}>
              <Shield size={18} variant="Linear" className="mr-2" />
              Create
            </Button>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="microsoft" className="space-y-4">
        <TabsList className="h-auto rounded-[12px] border border-[var(--panel-border)] bg-[var(--surface-3)] p-1">
          <TabsTrigger value="microsoft" className="rounded-[10px] px-4">
            Microsoft
            <span className="ml-2 text-xs text-nova-500">{microsoftAccounts.length}</span>
          </TabsTrigger>
          <TabsTrigger value="offline" className="rounded-[10px] px-4">
            Offline Acounts
            <span className="ml-2 text-xs text-nova-500">{offlineAccounts.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="microsoft" className="space-y-4">
          {microsoftAccounts.length === 0 ? (
            <EmptyState title="No Microsoft accounts" description="Add one to play online." />
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {microsoftAccounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onActivate={(accountId) => void setActiveAccount(accountId)}
                  onRemove={(accountId) => void removeAccount(accountId)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="offline" className="space-y-4">
          {offlineAccounts.length === 0 ? (
            <EmptyState title="No Offline Acounts" description="Create one for local testing." />
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {offlineAccounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onActivate={(accountId) => void setActiveAccount(accountId)}
                  onRemove={(accountId) => void removeAccount(accountId)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
