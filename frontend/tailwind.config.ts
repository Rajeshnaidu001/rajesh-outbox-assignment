import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-hover": "var(--surface-hover)",
        border: "var(--border)",
        muted: "var(--muted)",
        fg: "var(--fg)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "accent-fg": "var(--accent-fg)",
        "accent-soft": "var(--accent-soft)",
        "accent-soft-fg": "var(--accent-soft-fg)",
        success: "var(--success)",
        danger: "var(--danger)",
        warning: "var(--warning)",
        "warning-soft": "var(--warning-soft)",
        "sidebar-bg": "var(--sidebar-bg)",
        "sidebar-fg": "var(--sidebar-fg)",
        "sidebar-muted": "var(--sidebar-muted)",
        "sidebar-border": "var(--sidebar-border)",
        "sidebar-hover": "var(--sidebar-hover)",
        "sidebar-active-bg": "var(--sidebar-active-bg)",
        "sidebar-active-fg": "var(--sidebar-active-fg)",
      },
      borderRadius: {
        lg: "0.75rem",
        xl: "1rem",
      },
    },
  },
  plugins: [],
};

export default config;
