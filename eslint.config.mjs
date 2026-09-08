import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Babel-in-browser prototype templates: window globals, <script type="text/babel">.
    // Reference material only — not compiled, not shipped. See SPEC 01.
    "references/**",
  ]),
  {
    // The SessionProvider hydrates `user` from localStorage inside a useEffect
    // (never during the initial render) to stay SSR-safe — mandated by SPEC 01.
    // The fake GamePlayer scoreboard likewise advances state from timers/effects.
    // Both conflict with react-hooks/set-state-in-effect, so it is disabled here.
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
