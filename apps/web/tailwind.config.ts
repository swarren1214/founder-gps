import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#11203b",
        lagoon: "#0f6a74",
        ember: "#ff7a1a",
        paper: "#f7f0e2",
        mist: "#dbe5ec",
        current: "currentColor"
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"]
      },
      boxShadow: {
        panel: "0 24px 60px rgba(17, 32, 59, 0.12)",
        glow: "0 18px 40px rgba(255, 122, 26, 0.18)"
      },
      backgroundImage: {
        grain:
          "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18) 0, transparent 28%), radial-gradient(circle at 80% 0%, rgba(255,122,26,0.12) 0, transparent 22%), linear-gradient(135deg, rgba(15,106,116,0.06), rgba(17,32,59,0.03))"
      }
    }
  },
  plugins: []
};

export default config;
