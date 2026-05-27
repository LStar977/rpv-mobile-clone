/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Tight"', "sans-serif"],
        body: ['"Inter Tight"', "sans-serif"],
        heading: ['"Inter Tight"', "sans-serif"],
      },
      colors: {
        ink: "#040707",
        gold: "#EABA58",
        offwhite: "#F2F2F0",
        primary: "#111111",
      },
      textColor: {
        muted: "rgba(0,0,0,0.55)",
      },
      borderColor: {
        subtle: "rgba(0,0,0,0.15)",
      },
      letterSpacing: {
        tightest: "-0.045em",
      },
    },
  },
  plugins: [],
};
