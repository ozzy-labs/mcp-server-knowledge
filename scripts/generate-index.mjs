#!/usr/bin/env node
// Generates knowledge/INDEX.md from the articles under knowledge/.
// Walks the directory tree recursively, supports nested categories
// (e.g. ai/agents/), and emits a tag-based index in addition to per-directory
// tables. The output is git-ignored; this script is for local human browsing
// only. AI agents consume the same data via the MCP `list` tool.
// Invoked manually via `pnpm run generate-index`.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = fileURLToPath(new URL(".", import.meta.url));
const KNOWLEDGE_DIR = join(SCRIPT_DIR, "..", "knowledge");
const INDEX_PATH = join(KNOWLEDGE_DIR, "INDEX.md");

// Labels for known directories. Unknown directories are auto-labelled by name.
const DIR_LABELS = {
  tools: "CLI・SDK・ライブラリ",
  standards: "規約・設計原則・プロトコル",
  languages: "言語別",
  platforms: "プラットフォーム",
  ai: "AI 駆動開発",
  "ai/agents": "AI エージェント CLI",
  "ai/platform": "AI プラットフォーム・SDK・プロトコル",
  "ai/workflow": "AI 駆動開発ワークフロー",
  "ai/practice": "AI 駆動開発の手法",
};

const STABILITY_ORDER = ["ga", "beta", "research-preview", "deprecated"];

/** Parse minimal YAML frontmatter (flat `key: value` plus inline / block lists). */
function parseFrontmatter(lines) {
  const fm = {};
  if (lines[0]?.trim() !== "---") return { frontmatter: fm, cursor: 0 };
  let cursor = 1;
  let blockKey = null;
  let blockList = [];
  const flushBlock = () => {
    if (blockKey !== null) {
      fm[blockKey] = [...blockList];
      blockList = [];
      blockKey = null;
    }
  };
  while (cursor < lines.length && lines[cursor].trim() !== "---") {
    const line = lines[cursor];
    const blockItem = line.match(/^\s+-\s+(.*)$/);
    if (blockItem && blockKey !== null) {
      blockList.push(blockItem[1].trim().replace(/^["']|["']$/g, ""));
      cursor++;
      continue;
    }
    flushBlock();
    const kv = line.match(/^([\w-]+):\s*(.*?)\s*$/);
    if (kv) {
      const [, key, raw] = kv;
      if (raw === "") {
        blockKey = key;
      } else if (raw.startsWith("[")) {
        const inner = raw.replace(/^\[|\]$/g, "").trim();
        fm[key] =
          inner === ""
            ? []
            : inner.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
      } else {
        fm[key] = raw.replace(/^["']|["']$/g, "");
      }
    }
    cursor++;
  }
  flushBlock();
  if (cursor < lines.length) cursor++;
  return { frontmatter: fm, cursor };
}

/** Read a single article and extract metadata for the INDEX. */
async function extractMeta(absPath) {
  const content = await readFile(absPath, "utf8");
  const lines = content.split("\n");
  const { frontmatter, cursor: afterFm } = parseFrontmatter(lines);

  let cursor = afterFm;
  let title = "";
  for (; cursor < lines.length; cursor++) {
    const m = lines[cursor].match(/^#\s+(.+?)\s*$/);
    if (m) {
      title = m[1];
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

  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
  const aliases = Array.isArray(frontmatter.aliases) ? frontmatter.aliases : [];
  const stability = frontmatter.stability ?? "ga";
  const reviewed = frontmatter.reviewed ?? "";

  return { title, summary, reviewed, tags, aliases, stability };
}

/** Recursively walk knowledge/ and group articles by their parent directory. */
async function walkArticles(rootDir) {
  const grouped = new Map();
  async function visit(absDir) {
    const entries = await readdir(absDir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const abs = join(absDir, entry.name);
      if (entry.isDirectory()) {
        await visit(abs);
      } else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "INDEX.md") {
        const rel = relative(rootDir, abs);
        const dir = relative(rootDir, absDir).replace(/\\/g, "/");
        if (!grouped.has(dir)) grouped.set(dir, []);
        grouped.get(dir).push({ name: entry.name, relPath: rel.replace(/\\/g, "/") });
      }
    }
  }
  await visit(rootDir);
  return grouped;
}

function labelFor(dir) {
  return DIR_LABELS[dir] ?? dir;
}

function escapeCell(value) {
  return value.replace(/\|/g, "\\|");
}

function formatTags(tags) {
  if (!tags || tags.length === 0) return "—";
  return tags.map((t) => `\`${escapeCell(t)}\``).join(" ");
}

function warnFrontmatter(relPath, meta) {
  const warnings = [];
  if (!meta.reviewed) warnings.push("missing reviewed");
  if (meta.reviewed && !/^\d{4}-\d{2}-\d{2}$/.test(meta.reviewed)) {
    warnings.push(`malformed reviewed: ${meta.reviewed}`);
  }
  if (!STABILITY_ORDER.includes(meta.stability)) {
    warnings.push(`unknown stability: ${meta.stability}`);
  }
  for (const w of warnings) {
    console.error(`[generate-index] WARN ${relPath}: ${w}`);
  }
}

async function main() {
  const grouped = await walkArticles(KNOWLEDGE_DIR);
  const dirs = [...grouped.keys()].sort();

  const sections = [
    "# 記事一覧",
    "",
    "<!-- このファイルは `scripts/generate-index.mjs` によって自動生成されます。手動で編集せず、対応する記事を修正してから再生成してください。 -->",
    "",
  ];

  let total = 0;
  const tagIndex = new Map();

  for (const dir of dirs) {
    const articles = grouped.get(dir);
    if (!articles || articles.length === 0) continue;
    total += articles.length;
    sections.push(`## \`${dir}/\` — ${labelFor(dir)} (${articles.length})`);
    sections.push("");
    sections.push("| 記事 | reviewed | stability | tags | 概要 |");
    sections.push("|---|---|---|---|---|");

    for (const article of articles) {
      const meta = await extractMeta(join(KNOWLEDGE_DIR, article.relPath));
      warnFrontmatter(article.relPath, meta);
      const stability = meta.stability && meta.stability !== "ga" ? `\`${meta.stability}\`` : "—";
      sections.push(
        `| [${escapeCell(meta.title)}](${article.relPath}) | ${meta.reviewed || "—"} | ${stability} | ${formatTags(meta.tags)} | ${meta.summary} |`,
      );
      for (const tag of meta.tags) {
        if (!tagIndex.has(tag)) tagIndex.set(tag, []);
        tagIndex.get(tag).push({ title: meta.title, path: article.relPath });
      }
    }
    sections.push("");
  }

  const sortedTags = [...tagIndex.keys()].sort();
  if (sortedTags.length > 0) {
    sections.push("## タグ別索引");
    sections.push("");
    sections.push(
      "| タグ | 記事数 | 記事 |",
      "|---|---|---|",
    );
    for (const tag of sortedTags) {
      const items = tagIndex.get(tag);
      const links = items
        .map((i) => `[${escapeCell(i.title)}](${i.path})`)
        .join(" / ");
      sections.push(`| \`${escapeCell(tag)}\` | ${items.length} | ${links} |`);
    }
    sections.push("");
  }

  sections.push(`_Total: ${total} articles._`);
  sections.push("");

  await writeFile(INDEX_PATH, sections.join("\n"), "utf8");
  console.log(`[generate-index] wrote ${INDEX_PATH} (${total} articles, ${sortedTags.length} tags)`);
}

main().catch((err) => {
  console.error("[generate-index] failed:", err);
  process.exit(1);
});
