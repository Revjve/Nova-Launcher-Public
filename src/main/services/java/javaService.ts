import { access, mkdir, readdir, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";
import type { JavaInstallation, JavaRuntimeDownloadOption } from "../../../shared/types";

const execFileAsync = promisify(execFile);

const COMMON_WINDOWS_DIRS = [
  "C:\\Program Files\\Java",
  "C:\\Program Files\\Eclipse Adoptium",
  "C:\\Program Files\\Microsoft",
  "C:\\Program Files\\Zulu"
];

const guessRecommendedVersions = (major: number): string[] => {
  if (major <= 8) {
    return ["1.12.2", "1.16.5"];
  }

  if (major <= 17) {
    return ["1.18.2", "1.20.1"];
  }

  return ["1.20.5", "1.21.5"];
};

type AdoptiumBinary = {
  package?: {
    checksum?: string;
    link: string;
    name: string;
    size?: number;
  };
  scm_ref?: string;
};

export class JavaService {
  constructor(private readonly managedRuntimeRoot: string) {}

  async listInstallations(): Promise<JavaInstallation[]> {
    const candidates = new Set<string>();

    const pathEntries = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
    for (const entry of pathEntries) {
      candidates.add(join(entry, "java.exe"));
    }

    for (const dir of COMMON_WINDOWS_DIRS) {
      await this.collectJavaCandidates(dir, candidates, 2);
    }

    await this.collectJavaCandidates(this.managedRuntimeRoot, candidates, 4);

    const results: JavaInstallation[] = [];

    for (const candidate of candidates) {
      const source = candidate.startsWith(this.managedRuntimeRoot) ? "bundled" : "path";
      const installation = await this.inspect(candidate, source).catch(() => undefined);
      if (installation && !results.some((item) => item.path.toLowerCase() === installation.path.toLowerCase())) {
        results.push(installation);
      }
    }

    return results.sort((a, b) => b.majorVersion - a.majorVersion || a.path.localeCompare(b.path));
  }

  async resolveJavaPath(preferredPath?: string, preferredMajor?: number): Promise<string | undefined> {
    if (preferredPath) {
      const installation = await this.inspect(preferredPath).catch(() => undefined);
      if (installation && (!preferredMajor || installation.majorVersion >= preferredMajor)) {
        return installation.path;
      }
    }

    const available = await this.listInstallations();
    if (!preferredMajor) {
      return available[0]?.path;
    }

    const ranked = available
      .map((item) => ({
        item,
        score:
          item.majorVersion === preferredMajor
            ? 0
            : item.majorVersion > preferredMajor
              ? 100 + (item.majorVersion - preferredMajor)
              : 1000 + (preferredMajor - item.majorVersion)
      }))
      .sort((left, right) => left.score - right.score);

    return ranked[0]?.item.path;
  }

  async listDownloads(majorVersion: number): Promise<JavaRuntimeDownloadOption[]> {
    const [adoptium, microsoft] = await Promise.all([
      this.listAdoptiumDownloads(majorVersion).catch(() => []),
      this.listMicrosoftDownloads(majorVersion)
    ]);

    return [...adoptium, ...microsoft];
  }

  async installDownloadedRuntime(
    option: JavaRuntimeDownloadOption,
    downloadedPath: string
  ): Promise<JavaInstallation> {
    if (option.packageType !== "zip") {
      throw new Error("Automatic Java installation currently supports ZIP packages only.");
    }

    const installRoot = join(this.managedRuntimeRoot, option.vendor, `java-${option.majorVersion}`);
    await rm(installRoot, { recursive: true, force: true });
    await mkdir(installRoot, { recursive: true });
    await this.extractZip(downloadedPath, installRoot);

    const javaPath = await this.findJavaExecutable(installRoot);
    if (!javaPath) {
      throw new Error("Nova downloaded Java, but could not find java.exe after extraction.");
    }

    return this.inspect(javaPath, "bundled");
  }

  private async listAdoptiumDownloads(majorVersion: number): Promise<JavaRuntimeDownloadOption[]> {
    const url = `https://api.adoptium.net/v3/assets/feature_releases/${majorVersion}/ga?architecture=x64&heap_size=normal&image_type=jdk&jvm_impl=hotspot&os=windows&vendor=eclipse`;
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) {
      throw new Error(`Adoptium metadata failed with status ${response.status}.`);
    }
    const payload = (await response.json()) as AdoptiumBinary[];
    const latest = payload[0];
    if (!latest?.package) {
      return [];
    }

    const versionLabel = latest.scm_ref?.replace(/_/g, " ") ?? `JDK ${majorVersion}`;
    return [
      {
        id: `adoptium-${majorVersion}-zip`,
        vendor: "adoptium",
        majorVersion,
        versionLabel,
        packageType: "zip",
        fileName: latest.package.name,
        url: latest.package.link,
        checksumSha256: latest.package.checksum,
        sizeBytes: latest.package.size,
        recommended: true
      }
    ];
  }

  private async listMicrosoftDownloads(majorVersion: number): Promise<JavaRuntimeDownloadOption[]> {
    return [
      {
        id: `microsoft-${majorVersion}-zip`,
        vendor: "microsoft",
        majorVersion,
        versionLabel: `Microsoft Build of OpenJDK ${majorVersion}`,
        packageType: "zip",
        fileName: `microsoft-jdk-${majorVersion}-windows-x64.zip`,
        url: `https://aka.ms/download-jdk/microsoft-jdk-${majorVersion}-windows-x64.zip`,
        recommended: true
      }
    ];
  }

  async inspect(
    candidatePath: string,
    source: JavaInstallation["source"] = "path"
  ): Promise<JavaInstallation> {
    await access(candidatePath);

    const { stderr } = await execFileAsync(candidatePath, ["-version"]);
    const output = stderr || "";
    const versionMatch = output.match(/version "([^"]+)"/i);
    const version = versionMatch?.[1] ?? "unknown";
    const majorVersion = Number(version.split(".")[0] === "1" ? version.split(".")[1] : version.split(".")[0]);
    const archMatch = output.match(/(64-Bit|32-Bit)/i);

    return {
      path: candidatePath,
      version,
      majorVersion: Number.isFinite(majorVersion) ? majorVersion : 0,
      architecture: archMatch?.[1],
      source,
      recommendedFor: guessRecommendedVersions(Number.isFinite(majorVersion) ? majorVersion : 0)
    };
  }

  private async collectJavaCandidates(root: string, candidates: Set<string>, depth: number): Promise<void> {
    if (depth < 0) {
      return;
    }

    candidates.add(join(root, "bin", "java.exe"));

    const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      await this.collectJavaCandidates(join(root, entry.name), candidates, depth - 1);
    }
  }

  private async findJavaExecutable(root: string): Promise<string | undefined> {
    const candidates = new Set<string>();
    await this.collectJavaCandidates(root, candidates, 4);

    for (const candidate of [...candidates].sort((left, right) => left.length - right.length)) {
      const exists = await access(candidate)
        .then(() => true)
        .catch(() => false);
      if (exists) {
        return candidate;
      }
    }

    return undefined;
  }

  private async extractZip(archivePath: string, destination: string): Promise<void> {
    const escape = (value: string) => value.replace(/'/g, "''");
    await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `Expand-Archive -LiteralPath '${escape(archivePath)}' -DestinationPath '${escape(destination)}' -Force`
    ]);
  }
}
