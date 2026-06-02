import { memo, useEffect, useMemo, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { cn } from "@renderer/lib/cn";

export type TerminalLine = {
  id: string;
  text: string;
};

type TerminalConsoleProps = {
  lines: TerminalLine[];
  autoScroll?: boolean;
  className?: string;
  scrollback?: number;
  streamKey?: string;
};

export const TerminalConsole = memo(function TerminalConsole({
  lines,
  autoScroll = true,
  className,
  scrollback = 2500,
  streamKey = "default"
}: TerminalConsoleProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastRenderedLineIdRef = useRef<string | undefined>();
  const hasWrittenRef = useRef(false);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const terminal = new Terminal({
      convertEol: true,
      disableStdin: true,
      allowTransparency: true,
      cursorBlink: false,
      cursorInactiveStyle: "none",
      fontFamily: "Consolas, 'Cascadia Code', 'Fira Code', monospace",
      fontSize: 12,
      lineHeight: 1.3,
      letterSpacing: 0,
      scrollback,
      theme: {
        background: "#050506",
        foreground: "#e5e7eb",
        black: "#050506",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#f59e0b",
        blue: "#60a5fa",
        magenta: "#a78bfa",
        cyan: "#22d3ee",
        white: "#f8fafc",
        brightBlack: "#6b7280",
        brightRed: "#f87171",
        brightGreen: "#4ade80",
        brightYellow: "#fbbf24",
        brightBlue: "#93c5fd",
        brightMagenta: "#c4b5fd",
        brightCyan: "#67e8f9",
        brightWhite: "#ffffff"
      }
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(hostRef.current);
    fitAddon.fit();

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(hostRef.current);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      lastRenderedLineIdRef.current = undefined;
      hasWrittenRef.current = false;
    };
  }, [scrollback]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }

    terminal.clear();
    lastRenderedLineIdRef.current = undefined;
    hasWrittenRef.current = false;
  }, [streamKey]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }

    if (lines.length === 0) {
      if (hasWrittenRef.current) {
        terminal.clear();
        hasWrittenRef.current = false;
        lastRenderedLineIdRef.current = undefined;
      }
      return;
    }

    const previousLineId = lastRenderedLineIdRef.current;
    const previousIndex = previousLineId ? lines.findIndex((line) => line.id === previousLineId) : -1;

    if (previousIndex === -1) {
      terminal.clear();
      terminal.write(lines.map((line) => line.text).join("\r\n"));
      hasWrittenRef.current = true;
    } else if (previousIndex < lines.length - 1) {
      const nextLines = lines.slice(previousIndex + 1).map((line) => line.text);
      if (nextLines.length > 0) {
        terminal.write(`${hasWrittenRef.current ? "\r\n" : ""}${nextLines.join("\r\n")}`);
        hasWrittenRef.current = true;
      }
    }

    lastRenderedLineIdRef.current = lines[lines.length - 1]?.id;

    if (autoScroll) {
      terminal.scrollToBottom();
    }
  }, [autoScroll, lines]);

  const empty = useMemo(() => lines.length === 0, [lines.length]);

  return (
    <div className={cn("relative h-[560px] overflow-hidden rounded-md border border-white/10 bg-[#050506]", className)}>
      {empty ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-nova-500">
          No output yet.
        </div>
      ) : null}
      <div ref={hostRef} className="h-full w-full px-2 py-2" />
    </div>
  );
});
