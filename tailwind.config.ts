import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        deep: "#173d2c",
        green: {
          DEFAULT: "#2e7d57",
          hover: "#246644",
          light: "#e6f2e8",
          dark: "#173d2c",
        },
        bg: "#f4f5f1",
        surface: "#ffffff",
        surface2: "#e9ede7",
        ink: "#151817",
        muted: "#6b746e",
        border: "#d8ddd7",
        amber: "#b7791f",
        rust: {
          DEFAULT: "#a3512b",
          hover: "#8c4422",
          light: "#fff2ed",
        },
        paper: {
          DEFAULT: "#f4f5f1",
          light: "#ffffff",
          dark: "#e9ede7",
          border: "#d8ddd7",
        },
        charcoal: {
          DEFAULT: "#151817",
          light: "#2c332f",
          muted: "#6b746e",
        },
        forest: {
          DEFAULT: "#2e7d57",
          hover: "#246644",
          light: "#e6f2e8",
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          '"SFMono-Regular"',
          'Consolas',
          '"Liberation Mono"',
          'Menlo',
          'Courier',
          'monospace',
        ],
      },
      borderRadius: {
        DEFAULT: "3px",
        sm: "2px",
        md: "4px",
      },
    },
  },
  plugins: [],
};
export default config;
