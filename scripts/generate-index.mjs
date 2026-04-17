#!/usr/bin/env node
// Auto-generates knowledge/INDEX.md from the articles under knowledge/.
// Invoked by `pnpm run generate-index` and by lefthook pre-commit.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = fileURLToPath(new URL(".", import.meta.url));
const KNOWLEDGE_DIR = join(SCRIPT_DIR, "..", "knowledge");
const INDEX_PATH = join(KNOWLEDGE_DIR, "INDEX.md");

const CATEGORIES = [
  { dir: "tools", label: "CLI・SDK・ライブラリ" },
  { dir: "standards", label: "規約・設計原則・プロトコル" },
  { dir: "languages", label: "言語別" },
  { dir: "platforms", label: "プラットフォーム" },
];

/** Parse minimal YAML frontmatter (flat `key: value` pairs) at file start. */
function parseFrontmatter(lines) {
  const frontmatter = {};
  let cursor = 0;
  if (lines[0]?.trim() !== "---") return { frontmatter, cursor };
  cursor = 1;
  while (cursor < lines.length && lines[cursor].trim() !== "---") {
    const match = lines[cursor].match(/^(\w[\w-]*):\s*(.*?)\s*$/);
    if (match) frontmatter[match[1]] = match[2].replace(/^["']|["']$/g, "");
    cursor++;
  }
  if (cursor < lines.length) cursor++;
  return { frontmatter, cursor };
}

/** Read a single article and extract `{ title, summary, reviewed }`. */
async function extractMeta(filePath) {
  const content = await readFile(filePath, "utf8");
  const lines = content.split("\n");

  const { frontmatter, cursor: afterFrontmatter } = parseFrontmatter(lines);
  let cursor = afterFrontmatter;

  let title = "";
  for (; cursor < lines.length; cursor++) {
    const match = lines[cursor].match(/^#\s+(.+?)\s*$/);
    if (match) {
      title = match[1];
      cursor++;
      break;
    }
  }

  const summaryLines = [];
  for (; cursor < lines.length; cursor++) {
    const line = lines[cursor];
    const trimmed = line.trim();
    if (trimmed === "") {
      if (summaryLines.length > 0) break;
      continue;
    }
    if (line.startsWith("#") || line.startsWith("```")) break;
    if (/^(公式|Canonical|Reference|Source)s?[:：]/i.test(trimmed)) break;
    summaryLines.push(trimmed);
  }

  const summary = summaryLines.join(" ").replace(/\s+/g, " ").replace(/\|/g, "\\|").trim();
  return { title, summary, reviewed: frontmatter.reviewed ?? "" };
}

/** List categories and their article filenames (sorted, excluding INDEX.md). */
async function listArticles() {
  const result = new Map();
  for (const { dir } of CATEGORIES) {
    const categoryDir = join(KNOWLEDGE_DIR, dir);
    let entries;
    try {
      entries = await readdir(categoryDir, { withFileTypes: true });
    } catch {
      continue;
    }
    const names = entries
      .filter((e) => e.isFile() && e.name.endsWith(".md") && e.name !== "INDEX.md")
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));
    if (names.length > 0) result.set(dir, names);
  }
  return result;
}

async function main() {
  const byCategory = await listArticles();

  const sections = [
    "# 記事一覧",
    "",
    "<!-- このファイルは `scripts/generate-index.mjs` によって自動生成されます。手動で編集せず、対応する記事を修正してから再生成してください。 -->",
    "",
  ];

  let total = 0;

  for (const { dir, label } of CATEGORIES) {
    const articles = byCategory.get(dir);
    if (!articles) continue;
    total += articles.length;

    sections.push(`## \`${dir}/\` — ${label} (${articles.length})`);
    sections.push("");
    sections.push("| 記事 | reviewed | 概要 |");
    sections.push("|---|---|---|");

    for (const name of articles) {
      const path = `${dir}/${name}`;
      const { title, summary, reviewed } = await extractMeta(join(KNOWLEDGE_DIR, path));
      sections.push(`| [${title}](${path}) | ${reviewed || "—"} | ${summary} |`);
    }
    sections.push("");
  }

  sections.push(`_Total: ${total} articles._`);
  sections.push("");

  await writeFile(INDEX_PATH, sections.join("\n"), "utf8");
  console.log(`[generate-index] wrote ${INDEX_PATH} (${total} articles)`);
}

main().catch((err) => {
  console.error("[generate-index] failed:", err);
  process.exit(1);
});
