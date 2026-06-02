import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        nova: {
          50: "#f7f7f7",
          100: "#ececec",
          200: "#d8d8d8",
          300: "#b4b4b4",
          400: "#8d8d8d",
          500: "#6d6d6d",
          600: "#555555",
          700: "#3f3f3f",
          800: "#1b1b1d",
          850: "#121214",
          900: "#0d0d0f",
          950: "#060607"
        },
        cosmos: {
          100: "#d8e4ff",
          200: "#a8c0ff",
          300: "#7e98ff",
          400: "#756cf9",
          500: "#4a64ff",
          600: "#2e46ba"
        }
      },
      fontFamily: {
        display: ["Segoe UI", "sans-serif"],
        body: ["Segoe UI", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.08), 0 12px 50px rgba(255,255,255,0.04)",
        panel: "0 24px 60px rgba(0, 0, 0, 0.42)",
        cosmos: "0 0 0 1px rgba(126, 152, 255, 0.14), 0 30px 80px rgba(51, 72, 204, 0.24)"
      },
      backgroundImage: {
        "nova-grid":
          "radial-gradient(circle at top, rgba(255,255,255,0.08), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0.02), transparent 40%)",
        "nova-aurora":
          "radial-gradient(circle at 20% 20%, rgba(126,152,255,0.2), transparent 28%), radial-gradient(circle at 78% 18%, rgba(117,108,249,0.16), transparent 24%), radial-gradient(circle at 50% 100%, rgba(255,255,255,0.08), transparent 40%)"
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" }
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 0 0 rgba(255,255,255,0)" },
          "50%": { boxShadow: "0 0 0 1px rgba(255,255,255,0.18), 0 0 32px rgba(255,255,255,0.08)" }
        },
        sheen: {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(120%)" }
        },
        drift: {
          "0%, 100%": { transform: "translate3d(0px, 0px, 0px)" },
          "50%": { transform: "translate3d(8px, -8px, 0px)" }
        }
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "pulse-glow": "pulseGlow 3s ease-in-out infinite",
        sheen: "sheen 2.2s ease-in-out infinite",
        drift: "drift 14s ease-in-out infinite"
      },
      borderRadius: {
        "4xl": "2rem"
      }
    }
  },
  plugins: [tailwindcssAnimate]
} satisfies Config;
