import { createHash, randomBytes } from "node:crypto";
import { request as httpsRequest } from "node:https";
import http from "node:http";
import type { TLSSocket } from "node:tls";
import { shell } from "electron";
import type {
  AccountSecurePayload,
  AuthConfiguration,
  LauncherAccount,
  MicrosoftProfile
} from "../../../shared/types";
import { DEFAULT_MICROSOFT_REDIRECT_URI } from "../../../shared/constants";
import { LauncherRepository } from "../storage/launcherRepository";
import { RuntimeConfigService } from "../storage/runtimeConfigService";
import { SecureStore } from "../storage/secureStore";

type MicrosoftTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

type XboxAuthResponse = {
  Token: string;
  DisplayClaims: { xui: Array<{ uhs: string }> };
};

type MinecraftAuthResponse = {
  access_token: string;
  expires_in: number;
  username: string;
};

type TlsDiagnosticResult = {
  ok: boolean;
  process: string;
  host: string;
  path: string;
  statusCode?: number;
  certificateSubject?: string;
  certificateIssuer?: string;
  authorizationError?: string;
  errorCode?: string;
  errorMessage?: string;
  proxyEnv: Record<string, string | undefined>;
};

const scope = "XboxLive.signin offline_access";
const authorizeEndpoint = "https://login.live.com/oauth20_authorize.srf";
const tokenEndpoint = "https://login.live.com/oauth20_token.srf";

const base64Url = (value: Buffer) =>
  value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const sha256 = (value: string) => createHash("sha256").update(value).digest();

export class AuthService {
  constructor(
    private readonly repository: LauncherRepository,
    private readonly secureStore: SecureStore,
    private readonly runtimeConfig: RuntimeConfigService
  ) {}

  async getConfiguration(): Promise<AuthConfiguration> {
    return this.runtimeConfig.getAuthConfiguration();
  }

  private getProcessLabel(): string {
    return process.type === "browser" ? "main" : process.type || "node";
  }

  private log(step: string, message: string): void {
    console.info(`[Nova Auth] [${this.getProcessLabel()}] [${step}] ${message}`);
  }

  private logError(step: string, message: string): void {
    console.error(`[Nova Auth] [${this.getProcessLabel()}] [${step}] ${message}`);
  }

  private describeUrl(url: string): string {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  }

  private normalizeCertificateName(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }

  private isCertificateError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const code =
      "code" in error && typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : "";
    const causeCode =
      "cause" in error &&
      error.cause &&
      typeof error.cause === "object" &&
      "code" in (error.cause as { code?: unknown }) &&
      typeof (error.cause as { code?: unknown }).code === "string"
        ? (error.cause as { code: string }).code
        : "";
    const message = `${error.message} ${causeCode} ${code}`.toLowerCase();

    return (
      message.includes("err_cert_authority_invalid") ||
      message.includes("self signed") ||
      message.includes("unable to verify") ||
      message.includes("unable_to_verify") ||
      message.includes("untrustedroot") ||
      message.includes("certificate")
    );
  }

  private buildCertificateErrorMessage(step: string, diagnostic?: TlsDiagnosticResult): string {
    const issuer = diagnostic?.certificateIssuer ? ` Issuer: ${diagnostic.certificateIssuer}.` : "";
    const subject = diagnostic?.certificateSubject ? ` Subject: ${diagnostic.certificateSubject}.` : "";
    const proxy = Object.entries(diagnostic?.proxyEnv ?? {})
      .filter(([, value]) => Boolean(value))
      .map(([key, value]) => `${key}=${value}`)
      .join(", ");
    const proxyNote = proxy ? ` Proxy env: ${proxy}.` : "";

    return `${step} failed. Xbox Live TLS certificate was rejected. This is usually caused by antivirus HTTPS scanning, VPN/proxy filtering, incorrect system date/time, or running the request from the wrong Electron process.${issuer}${subject}${proxyNote}`;
  }

  private rewriteKnownAuthError(label: string, status: number, body: string): string {
    if (body.includes("Invalid app registration")) {
      return `${label} failed: status ${status}. Minecraft Services rejected this Microsoft app registration. The OAuth flow is working, but this app registration is not approved for Xbox/Minecraft sign-in. You need an app registration that is enabled for Xbox services. See https://aka.ms/AppRegInfo and the Xbox developer onboarding guidance at https://developer.microsoft.com/en-us/games/publish.`;
    }

    return `${label} failed: status ${status}. ${body}`;
  }

  private async diagnoseTlsEndpoint(url: string, step: string): Promise<TlsDiagnosticResult> {
    const target = new URL(url);
    this.log(step, `Running TLS diagnostic against ${target.hostname}${target.pathname}`);

    return new Promise<TlsDiagnosticResult>((resolve) => {
      const proxyEnv = {
        HTTPS_PROXY: process.env.HTTPS_PROXY,
        https_proxy: process.env.https_proxy,
        HTTP_PROXY: process.env.HTTP_PROXY,
        http_proxy: process.env.http_proxy,
        ALL_PROXY: process.env.ALL_PROXY,
        all_proxy: process.env.all_proxy,
        NO_PROXY: process.env.NO_PROXY,
        no_proxy: process.env.no_proxy
      };

      const request = httpsRequest(
        target,
        {
          method: "OPTIONS",
          timeout: 10_000
        },
        (response) => {
          const socket = response.socket as TLSSocket;
          const certificate = socket.getPeerCertificate();
          const result: TlsDiagnosticResult = {
            ok: true,
            process: this.getProcessLabel(),
            host: target.hostname,
            path: target.pathname,
            statusCode: response.statusCode,
            certificateSubject: this.normalizeCertificateName(certificate?.subject?.CN),
            certificateIssuer: this.normalizeCertificateName(certificate?.issuer?.CN),
            authorizationError:
              typeof socket.authorizationError === "string" ? socket.authorizationError : undefined,
            proxyEnv
          };

          this.log(
            step,
            `TLS diagnostic status ${response.statusCode ?? "unknown"} for ${target.hostname}${target.pathname}` +
              (result.certificateIssuer ? ` issuer=${result.certificateIssuer}` : "") +
              (result.certificateSubject ? ` subject=${result.certificateSubject}` : "")
          );

          response.resume();
          response.once("end", () => resolve(result));
        }
      );

      request.on("timeout", () => {
        request.destroy(new Error("TLS diagnostic timed out."));
      });

      request.on("error", (error: Error & { code?: string }) => {
        const result: TlsDiagnosticResult = {
          ok: false,
          process: this.getProcessLabel(),
          host: target.hostname,
          path: target.pathname,
          errorCode: error.code,
          errorMessage: error.message,
          proxyEnv
        };

        this.logError(
          step,
          `TLS diagnostic failed for ${target.hostname}${target.pathname}. ${error.code ?? "unknown"} ${error.message}`
        );
        resolve(result);
      });

      request.end();
    });
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

    await this.repository.writeData({ ...data, accounts: next });
    return active;
  }

  async getActiveSession(): Promise<{ account: LauncherAccount; secure: AccountSecurePayload } | undefined> {
    const data = await this.repository.getData();
    const account = data.accounts.find((item) => item.active);
    if (!account) {
      return undefined;
    }

    const secure = await this.secureStore.get<AccountSecurePayload>(`account:${account.id}`);
    if (!secure) {
      return undefined;
    }

    const session = await this.ensureValidSession(account, secure);
    if (!session) {
      return undefined;
    }

    return session;
  }

  private async ensureValidSession(
    account: LauncherAccount,
    secure: AccountSecurePayload
  ): Promise<{ account: LauncherAccount; secure: AccountSecurePayload } | undefined> {
    const expiresAt = new Date(secure.expiresAt).getTime();
    const refreshWindow = Date.now() + 5 * 60 * 1000;

    if (expiresAt > refreshWindow) {
      return { account, secure };
    }

    try {
      const refreshed = await this.refreshSession(account.id, secure.refreshToken);
      return { account, secure: refreshed };
    } catch {
      return undefined;
    }
  }

  private async refreshSession(accountId: string, refreshToken: string): Promise<AccountSecurePayload> {
    this.log("refresh", "Refreshing Microsoft account session.");
    const tokens = await this.refreshMicrosoftTokens(refreshToken);
    const xbl = await this.authenticateXbox(tokens.access_token);
    const xsts = await this.authorizeXsts(xbl.Token);
    const uhs = xbl.DisplayClaims.xui[0]?.uhs;

    if (!uhs) {
      throw new Error("Xbox Live user hash was missing from the refresh response.");
    }

    const minecraft = await this.authenticateMinecraft(uhs, xsts.Token);

    const securePayload: AccountSecurePayload = {
      accountId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? refreshToken,
      minecraftToken: minecraft.access_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    };

    await this.secureStore.set(`account:${accountId}`, securePayload);
    return securePayload;
  }

  private async refreshMicrosoftTokens(refreshToken: string): Promise<MicrosoftTokenResponse> {
    const config = await this.runtimeConfig.get();
    const params = new URLSearchParams({
      client_id: config.microsoftClientId,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      redirect_uri: config.microsoftRedirectUri,
      scope
    });

    const response = await this.performFetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params
    });

    if (!response.ok) {
      throw new Error(`Microsoft refresh token exchange failed (${response.status}). ${await response.text()}`);
    }

    return (await response.json()) as MicrosoftTokenResponse;
  }

  async getMinecraftAccessToken(): Promise<string | undefined> {
    const session = await this.getActiveSession();
    return session?.secure.minecraftToken;
  }

  async getMicrosoftProfile(): Promise<LauncherAccount | undefined> {
    const session = await this.getActiveSession();
    return session?.account;
  }

  async addMicrosoftAccount(): Promise<LauncherAccount> {
    const config = await this.runtimeConfig.get();

    if (!config.microsoftClientId) {
      throw new Error(
        "Microsoft auth is not configured. Add MICROSOFT_CLIENT_ID and MICROSOFT_REDIRECT_URI first."
      );
    }

    this.validateRedirectUri(config.microsoftRedirectUri);
    this.log("pkce", "Generating PKCE verifier and challenge.");

    const verifier = base64Url(randomBytes(32));
    const challenge = base64Url(sha256(verifier));
    const state = crypto.randomUUID();
    const code = await this.getAuthorizationCode(config.microsoftClientId, config.microsoftRedirectUri, state, challenge);

    this.log("microsoft-token", "Exchanging Microsoft code.");
    const tokens = await this.exchangeCodeForTokens(config.microsoftClientId, config.microsoftRedirectUri, code, verifier);
    const xbl = await this.authenticateXbox(tokens.access_token);
    const xsts = await this.authorizeXsts(xbl.Token);
    const uhs = xbl.DisplayClaims.xui[0]?.uhs;

    if (!uhs) {
      throw new Error("Xbox Live user hash was missing from the Microsoft login response.");
    }

    const minecraft = await this.authenticateMinecraft(uhs, xsts.Token);
    await this.ensureMinecraftOwnership(minecraft.access_token);
    const profile = await this.fetchProfile(minecraft.access_token);

    const accountId = crypto.randomUUID();
    const account: LauncherAccount = {
      id: accountId,
      type: "microsoft",
      username: profile.name,
      uuid: profile.id,
      avatarUrl: `https://mc-heads.net/avatar/${profile.id}/96`,
      active: true,
      xuid: minecraft.username,
      status: "ready"
    };

    const securePayload: AccountSecurePayload = {
      accountId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      minecraftToken: minecraft.access_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    };

    await this.secureStore.set(`account:${accountId}`, securePayload);

    const data = await this.repository.getData();
    const nextAccounts = [
      account,
      ...data.accounts
        .filter((item) => item.uuid !== account.uuid)
        .map((item) => ({ ...item, active: false }))
    ];

    await this.repository.writeData({ ...data, accounts: nextAccounts });
    return account;
  }

  private async getAuthorizationCode(
    clientId: string,
    redirectUri: string,
    state: string,
    challenge: string
  ): Promise<string> {
    const callback = new URL(redirectUri);
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
      prompt: "select_account"
    });

    const authUrl = `${authorizeEndpoint}?${params.toString()}`;

    return new Promise<string>((resolve, reject) => {
      let settled = false;

      const fail = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        void new Promise<void>((closeResolve) => server.close(() => closeResolve()));
        this.logError("callback", error.message);
        reject(error);
      };

      const succeed = (code: string) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        void new Promise<void>((closeResolve) => server.close(() => closeResolve()));
        this.log("callback", "Received authorization code.");
        resolve(code);
      };

      const timeout = setTimeout(() => {
        fail(new Error("Microsoft login timed out before a callback was received."));
      }, 120_000);

      const server = http.createServer((request, response) => {
        try {
          const requestUrl = new URL(request.url ?? "", redirectUri);
          if (requestUrl.pathname !== callback.pathname) {
            response.statusCode = 404;
            response.end("Not found");
            return;
          }
          this.log("callback", `Received callback request on ${requestUrl.pathname}.`);
          const returnedState = requestUrl.searchParams.get("state");
          const code = requestUrl.searchParams.get("code");
          const error = requestUrl.searchParams.get("error_description") ?? requestUrl.searchParams.get("error");

          response.statusCode = 200;
          response.setHeader("Content-Type", "text/html");
          response.end(
            "<html><body style='background:#060607;color:#fff;font-family:Segoe UI,sans-serif;display:grid;place-items:center;height:100vh;'><div><h1>Nova Launcher</h1><p>Microsoft login complete. You can return to Nova now.</p></div></body></html>"
          );

          if (error) {
            throw new Error(`Microsoft returned an error during login. ${error}`);
          }

          if (!code) {
            throw new Error("Microsoft returned no code.");
          }

          if (returnedState !== state) {
            throw new Error("The Microsoft login callback state did not match the original request.");
          }

          succeed(code);
        } catch (error) {
          fail(error as Error);
        }
      });

      server.on("error", (error) => {
        const portMessage =
          callback.port === "42813"
            ? "Could not start local callback server on port 42813."
            : `Could not start local callback server on port ${callback.port}.`;
        fail(new Error(`${portMessage} ${error.message}`));
      });

      server.listen(Number(callback.port), callback.hostname, () => {
        this.log("callback", `Callback server listening on ${redirectUri}`);
        this.log("browser", "Opening Microsoft login.");
        void shell
          .openExternal(authUrl)
          .catch((error: Error) => fail(new Error(`Nova could not open the browser. ${error.message}`)));
      });
    });
  }

  private async exchangeCodeForTokens(
    clientId: string,
    redirectUri: string,
    code: string,
    verifier: string
  ): Promise<MicrosoftTokenResponse> {
    const body = new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier
    });

    return this.fetchJson<MicrosoftTokenResponse>(
      tokenEndpoint,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
      },
      "Microsoft token exchange"
    );
  }

  private async authenticateXbox(msAccessToken: string): Promise<XboxAuthResponse> {
    this.log("xbox-live", "Authenticating Xbox Live.");
    await this.diagnoseTlsEndpoint("https://user.auth.xboxlive.com/user/authenticate", "xbox-live-tls");
    return this.fetchJson<XboxAuthResponse>("https://user.auth.xboxlive.com/user/authenticate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-xbl-contract-version": "1"
      },
      body: JSON.stringify({
        Properties: {
          AuthMethod: "RPS",
          SiteName: "user.auth.xboxlive.com",
          RpsTicket: `d=${msAccessToken}`
        },
        RelyingParty: "http://auth.xboxlive.com",
        TokenType: "JWT"
      })
    }, "Xbox Live authentication");
  }

  private async authorizeXsts(xblToken: string): Promise<XboxAuthResponse> {
    this.log("xsts", "Requesting XSTS.");
    return this.fetchJson<XboxAuthResponse>("https://xsts.auth.xboxlive.com/xsts/authorize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-xbl-contract-version": "1"
      },
      body: JSON.stringify({
        Properties: {
          SandboxId: "RETAIL",
          UserTokens: [xblToken]
        },
        RelyingParty: "rp://api.minecraftservices.com/",
        TokenType: "JWT"
      })
    }, "XSTS authorization");
  }

  private async authenticateMinecraft(userHash: string, xstsToken: string): Promise<MinecraftAuthResponse> {
    this.log("minecraft-token", "Requesting Minecraft token.");
    return this.fetchJson<MinecraftAuthResponse>("https://api.minecraftservices.com/authentication/login_with_xbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identityToken: `XBL3.0 x=${userHash};${xstsToken}`
      })
    }, "Minecraft Services authentication");
  }

  private async ensureMinecraftOwnership(minecraftToken: string): Promise<void> {
    this.log("minecraft-ownership", "Checking Minecraft ownership.");
    const response = await this.fetchResponse("https://api.minecraftservices.com/entitlements/mcstore", {
      headers: {
        Authorization: `Bearer ${minecraftToken}`
      }
    }, "Minecraft ownership check");

    const payload = (await response.json()) as { items?: Array<{ name: string }> };
    if (!payload.items?.length) {
      throw new Error("This Microsoft account does not appear to own Minecraft Java Edition.");
    }
  }

  private async fetchProfile(minecraftToken: string): Promise<MicrosoftProfile> {
    this.log("minecraft-profile", "Fetching Minecraft profile.");
    return this.fetchJson<MicrosoftProfile>("https://api.minecraftservices.com/minecraft/profile", {
      headers: {
        Authorization: `Bearer ${minecraftToken}`
      }
    }, "Minecraft profile fetch");
  }

  private validateRedirectUri(redirectUri: string): void {
    const parsed = new URL(redirectUri);
    if (parsed.toString() !== DEFAULT_MICROSOFT_REDIRECT_URI) {
      throw new Error(
        `Microsoft redirect URI must be exactly ${DEFAULT_MICROSOFT_REDIRECT_URI}.`
      );
    }
  }

  private performFetch(url: string, init: RequestInit): Promise<Response> {
    if (typeof globalThis.fetch !== "function") {
      throw new Error("Node fetch is unavailable in the Electron main process.");
    }

    const request = {
      ...init,
      body: init.body instanceof URLSearchParams ? init.body.toString() : init.body,
      signal: AbortSignal.timeout(30_000)
    };

    return globalThis.fetch(url, request);
  }

  private async fetchResponse(url: string, init: RequestInit, label: string): Promise<Response> {
    const target = this.describeUrl(url);
    this.log(label, `Requesting ${target}`);
    try {
      const response = await this.performFetch(url, init);

      if (!response.ok) {
        const message = await response.text();
        this.logError(label, `HTTP ${response.status} from ${target}. ${message}`);
        throw new Error(this.rewriteKnownAuthError(label, response.status, message));
      }

      this.log(label, `Received HTTP ${response.status} from ${target}`);
      return response;
    } catch (error) {
      if (this.isCertificateError(error)) {
        const diagnostic = await this.diagnoseTlsEndpoint(url, `${label}-tls`);
        this.logError(
          label,
          `TLS certificate error while requesting ${target}.` +
            (diagnostic.certificateIssuer ? ` issuer=${diagnostic.certificateIssuer}` : "") +
            (diagnostic.certificateSubject ? ` subject=${diagnostic.certificateSubject}` : "") +
            (diagnostic.errorCode ? ` diagnosticCode=${diagnostic.errorCode}` : "")
        );
        throw new Error(this.buildCertificateErrorMessage(label, diagnostic));
      }

      if (error instanceof Error) {
        this.logError(label, `${target} -> ${error.message}`);
        throw new Error(`${label} failed. ${error.message}`);
      }
      throw error;
    }
  }

  private async fetchJson<T>(url: string, init: RequestInit, label: string): Promise<T> {
    const response = await this.fetchResponse(url, init, label);
    return (await response.json()) as T;
  }
}
