#!/usr/bin/env node
// PostToolUse hook (Write|Edit): run Prettier --write and, for JS/TS files,
// ESLint --fix on the file that was just created or edited.
//
// Node instead of a shell one-liner because this machine has no `jq`, and so the
// same script works from Git Bash and from PowerShell. Registered in
// .claude/settings.local.json — scoped to this project only.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const OK = (obj) => {
  if (obj) process.stdout.write(JSON.stringify(obj));
  process.exit(0);
};

// 1. Read the hook payload from stdin.
let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  OK(); // No parseable input — nothing to do.
}

const filePath =
  payload?.tool_response?.filePath ?? payload?.tool_input?.file_path;
if (!filePath) OK();

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const abs = path.resolve(projectDir, filePath);

// 2. Skip anything outside the project or inside generated/vendored trees.
const rel = path.relative(projectDir, abs);
if (rel.startsWith("..") || path.isAbsolute(rel)) OK();
const segments = rel.split(/[\\/]/);
if (
  segments.some((s) => s === "node_modules" || s === ".next" || s === ".git")
) {
  OK();
}

const bin = (...p) => path.join(projectDir, "node_modules", ...p);
const run = (jsFile, args) =>
  spawnSync(process.execPath, [jsFile, ...args], {
    cwd: projectDir,
    encoding: "utf8",
  });

// 3. Prettier — --ignore-unknown means unsupported file types are skipped
//    silently, covering "any created file".
const prettierBin = bin("prettier", "bin", "prettier.cjs");
if (existsSync(prettierBin)) {
  run(prettierBin, ["--write", "--ignore-unknown", abs]);
} else {
  OK({
    systemMessage:
      "format-and-lint hook: prettier no está instalado (npm i -D prettier).",
  });
}

// 4. ESLint --fix, only for lintable extensions.
const LINT_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
if (!LINT_EXT.has(path.extname(abs))) OK({ suppressOutput: true });

const eslintBin = bin("eslint", "bin", "eslint.js");
if (!existsSync(eslintBin)) OK({ suppressOutput: true });

// --max-warnings 0 so unfixed warnings (e.g. no-unused-vars) also exit non-zero
// and get reported, not just errors.
const res = run(eslintBin, ["--fix", "--max-warnings", "0", abs]);

// 5. ESLint exits non-zero when problems remain after --fix. Feed them back to
//    Claude as context without blocking the turn.
if (res.status !== 0) {
  const detail = [res.stdout, res.stderr].filter(Boolean).join("\n").trim();
  OK({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: `ESLint reporta problemas sin corregir en ${rel}:\n${detail}`,
    },
  });
}

OK({ suppressOutput: true });
