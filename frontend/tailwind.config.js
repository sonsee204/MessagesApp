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
        // Tokens từ hệ thống thiết kế UI/UX Pro Max.
        // Toàn bộ trỏ về biến CSS khai báo trong src/index.css để đổi được theo theme.
        // Dạng `hsl(var(--x) / <alpha-value>)` là cú pháp chuẩn của Tailwind cho màu
        // bằng biến CSS — nhờ đó các lớp như bg-uupm-accent/10 mới hoạt động đúng.
        uupm: {
          page: "hsl(var(--uupm-page) / <alpha-value>)",
          surface: "hsl(var(--uupm-surface) / <alpha-value>)",
          "surface-hover": "hsl(var(--uupm-surface-hover) / <alpha-value>)",
          "surface-strong": "hsl(var(--uupm-surface-strong) / <alpha-value>)",
          ink: "hsl(var(--uupm-ink) / <alpha-value>)",
          "ink-soft": "hsl(var(--uupm-ink-soft) / <alpha-value>)",
          "ink-muted": "hsl(var(--uupm-ink-muted) / <alpha-value>)",
          line: "hsl(var(--uupm-line) / <alpha-value>)",
          accent: "hsl(var(--uupm-accent) / <alpha-value>)",
          "accent-hover": "hsl(var(--uupm-accent-hover) / <alpha-value>)",
          "accent-soft": "hsl(var(--uupm-accent-soft) / <alpha-value>)",
          "accent-soft-hover": "hsl(var(--uupm-accent-soft-hover) / <alpha-value>)",
          "accent-text": "hsl(var(--uupm-accent-text) / <alpha-value>)",
          danger: "hsl(var(--uupm-danger) / <alpha-value>)",
          "danger-hover": "hsl(var(--uupm-danger-hover) / <alpha-value>)",
          "danger-ink": "hsl(var(--uupm-danger-ink) / <alpha-value>)",
          "danger-text": "hsl(var(--uupm-danger-text) / <alpha-value>)",
          "warn-soft": "hsl(var(--uupm-warn-soft) / <alpha-value>)",
          "warn-soft-ink": "hsl(var(--uupm-warn-soft-ink) / <alpha-value>)",
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
      // Bóng đổ Tactile Neo-Brutalist. Màu bóng lấy từ token --uupm-line (viền),
      // KHÔNG phải --uupm-ink (chữ) — nếu lấy màu chữ thì ở theme tối khối bóng
      // sẽ là màu trắng #f2f3f5 và lấn át cả giao diện.
      boxShadow: {
        "uupm-1":
          "hsl(var(--uupm-line) / 1) 6px 6px 0px 0px, rgba(0, 0, 0, 0.1) 0px -4px 0px 0px inset",
        "uupm-2": "hsl(var(--uupm-line) / 1) 4px 4px 0px 0px",
        "uupm-active": "hsl(var(--uupm-line) / 1) 1px 1px 0px 0px",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        tactile: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
