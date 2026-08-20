/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0e1a",
        panel: "#11151d",
        line: "#252c38",
        teal: "#2dd4bf",
        cobalt: "#5b7cff",
        glass: {
          bg: "var(--glass-bg)",
          border: "var(--glass-border)",
          highlight: "var(--glass-highlight)",
        },
      },
      backdropBlur: {
        glass: "20px",
      },
      boxShadow: {
        glass: "var(--shadow-glass)",
        glow: "0 0 40px rgba(45, 212, 191, 0.12)",
      },
      borderRadius: {
        "2xl": "1.5rem",
        full: "9999px",
      },
    },
  },
  plugins: [],
};
