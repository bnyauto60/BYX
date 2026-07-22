import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0F1418",
        panel: "#161D23",
        panelAlt: "#1E262D",
        line: "#2A333B",
        text: "#EDEFF1",
        muted: "#9AA6B0",
        accent: "#3DA9A0",
        warn: "#D9A441",
        danger: "#D9553D",
        safe: "#4C9A6A"
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"]
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "14px"
      }
    }
  },
  plugins: []
};
export default config;
