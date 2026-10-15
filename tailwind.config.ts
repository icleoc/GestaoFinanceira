import type { Config } from "tailwindcss";

// As cores vêm de variáveis CSS (app/globals.css), o que dá tema claro e escuro
// sem precisar repetir classes "dark:" em cada componente.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        surface: token("surface"),
        sunken: token("sunken"),
        ink: token("ink"),
        muted: token("muted"),
        line: token("line"),
        primary: token("primary"),
        "on-primary": token("on-primary"),
        accent: token("accent"),
        neg: token("neg"),
        warn: token("warn"),
        // Faixas escuras da página inicial: iguais nos temas claro e escuro.
        deep: token("deep"),
        paper: token("paper"),
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
      },
    },
  },
  plugins: [],
};

export default config;
