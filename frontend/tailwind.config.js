/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        primary: ["Nunito", "sans-serif"],
        sans: ["Nunito", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // Tokens từ hệ thống thiết kế UI/UX Pro Max
        uupm: {
          textPrimary: "#0f172a",
          textSecondary: "#64748b",
          borderMuted: "#2d3748",
          borderDefault: "#e2e8f0",
          surfaceMuted: "#ffffff",
          surfaceBase: "#000000",
          surfaceRaised: "#22c55e",
          surfaceStrong: "#add8e6",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        xs: "12px",
        sm: "16px",
        md: "24px",
        lg: "var(--radius)",
      },
      boxShadow: {
        "uupm-1": "rgb(45, 55, 72) 6px 6px 0px 0px, rgba(0, 0, 0, 0.1) 0px -4px 0px 0px inset",
        "uupm-2": "rgb(45, 55, 72) 4px 4px 0px 0px",
        "uupm-active": "rgb(45, 55, 72) 1px 1px 0px 0px",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        tactile: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
