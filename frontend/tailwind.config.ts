import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./modules/**/*.{ts,tsx}",
    "./context/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "topic-deployment": "#3b82f6",
        "topic-monitoring": "#10b981",
        "topic-mlops": "#a855f7",
        "topic-sysdesign": "#f59e0b",
      },
    },
  },
  plugins: [],
};

export default config;
