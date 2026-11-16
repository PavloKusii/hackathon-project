export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        olive: {
          50: "#f4f5ec",
          100: "#e6e8d4",
          200: "#ced4aa",
          300: "#aeb87a",
          400: "#8d9a4a",
          500: "#6b7a30",
          600: "#59662a",
          700: "#4b5320",
          800: "#33391b",
          900: "#222612",
          950: "#14170c"
        }
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "Segoe UI", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
        display: ["Barlow Condensed", "Arial Narrow", "sans-serif"]
      }
    }
  },
  plugins: []
};
