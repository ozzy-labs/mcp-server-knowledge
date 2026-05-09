import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { type Frontmatter, parseFrontmatter, validateFrontmatter } from "./schema.js";

function assertWithinDir(knowledgeDir: string, resolved: string): void {
  const normalized = path.resolve(resolved);
  const base = path.resolve(knowledgeDir);
  if (!normalized.startsWith(base + path.sep) && normalized !== base) {
    throw new Error("Path traversal detected");
  }
}

function sanitizePath(filePath: string): string {
  if (filePath.includes("\0")) {
    throw new Error("Invalid path: null byte detected");
  }
  if (
    path.isAbsolute(filePath) ||
    filePath.startsWith("/") ||
    filePath.startsWith("\\") ||
    filePath.includes("\\")
  ) {
    throw new Error("Path traversal detected");
  }
  return filePath;
}

export interface ListEntries {
  directories: string[];
  files: string[];
}

export async function listEntries(knowledgeDir: string, subPath = ""): Promise<ListEntries> {
  const sanitized = sanitizePath(subPath);
  const target = sanitized === "" ? knowledgeDir : path.join(knowledgeDir, sanitized);
  assertWithinDir(knowledgeDir, target);
  const entries = await readdir(target, { withFileTypes: true });
  const directories = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith(".md") && e.name !== "INDEX.md")
    .map((e) => e.name.replace(/\.md$/, ""))
    .sort();
  return { directories, files };
}

export async function listCategories(knowledgeDir: string): Promise<string[]> {
  const { directories } = await listEntries(knowledgeDir, "");
  return directories;
}

export async function listFiles(knowledgeDir: string, category: string): Promise<string[]> {
  const { files } = await listEntries(knowledgeDir, category);
  return files;
}

export interface ArticleEntry {
  /** Path relative to knowledgeDir without `.md` (e.g. `ai/agents/claude-code`). */
  path: string;
  /** Absolute filesystem path. */
  absolutePath: string;
}

export async function* walkArticles(
  knowledgeDir: string,
  subPath = "",
): AsyncGenerator<ArticleEntry> {
  const sanitized = sanitizePath(subPath);
  const target = sanitized === "" ? knowledgeDir : path.join(knowledgeDir, sanitized);
  assertWithinDir(knowledgeDir, target);
  const entries = await readdir(target, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const childRel = subPath === "" ? entry.name : `${subPath}/${entry.name}`;
    if (entry.isDirectory()) {
      yield* walkArticles(knowledgeDir, childRel);
    } else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "INDEX.md") {
      yield {
        path: childRel.replace(/\.md$/, ""),
        absolutePath: path.join(target, entry.name),
      };
    }
  }
}

export async function readKnowledge(knowledgeDir: string, filePath: string): Promise<string> {
  const sanitized = sanitizePath(filePath);
  const resolved = path.join(knowledgeDir, `${sanitized}.md`);
  assertWithinDir(knowledgeDir, resolved);
  return readFile(resolved, "utf-8");
}

interface ArticleSnapshot {
  path: string;
  basename: string;
  parentDir: string;
  content: string;
  body: string;
  frontmatter: Frontmatter | null;
}

async function loadArticle(article: ArticleEntry): Promise<ArticleSnapshot> {
  const content = await readFile(article.absolutePath, "utf-8");
  const { frontmatter, bodyOffset } = parseFrontmatter(content);
  const validated = validateFrontmatter(frontmatter);
  const lines = content.split("\n");
  const body = lines.slice(bodyOffset).join("\n");
  return {
    path: article.path,
    basename: path.basename(article.path),
    parentDir: path.dirname(article.path) === "." ? "" : path.dirname(article.path),
    content,
    body,
    frontmatter: validated.data ?? null,
  };
}

export interface SearchOptions {
  /** Filter to articles whose path starts with this prefix (e.g. "ai/"). */
  category?: string;
  /** Require all of these tags to be present on the article. */
  tags?: string[];
  /** Restrict to these stability values. */
  stability?: string[];
  /** Limit the number of returned results. */
  limit?: number;
}

export interface SearchResult {
  path: string;
  score: number;
  matches: string[];
}

function normalizePrefix(prefix: string): string {
  if (prefix === "") return "";
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}

export async function searchKnowledge(
  knowledgeDir: string,
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  const lowerQuery = query.toLowerCase();
  const requiredTags = (options.tags ?? []).map((t) => t.toLowerCase());
  const allowedStability = options.stability ?? [];
  const prefix = normalizePrefix(options.category ?? "");
  const collected: SearchResult[] = [];

  for await (const article of walkArticles(knowledgeDir)) {
    if (prefix !== "" && !`${article.path}/`.startsWith(prefix)) continue;
    const snapshot = await loadArticle(article);

    const fmTags = (snapshot.frontmatter?.tags ?? []).map((t) => t.toLowerCase());
    if (requiredTags.length > 0 && !requiredTags.every((t) => fmTags.includes(t))) continue;

    if (
      allowedStability.length > 0 &&
      snapshot.frontmatter &&
      !allowedStability.includes(snapshot.frontmatter.stability)
    ) {
      continue;
    }

    let score = 0;
    const matches: string[] = [];

    if (snapshot.basename.toLowerCase().includes(lowerQuery)) {
      score += 5;
      matches.push(`(filename match: ${snapshot.basename})`);
    }

    const aliases = (snapshot.frontmatter?.aliases ?? []).map((a) => a.toLowerCase());
    if (aliases.some((a) => a.includes(lowerQuery))) {
      score += 3;
      matches.push(`(alias match)`);
    }

    const fmHaystack = [
      ...(snapshot.frontmatter?.tags ?? []),
      ...(snapshot.frontmatter?.aliases ?? []),
    ]
      .join(" ")
      .toLowerCase();
    if (fmHaystack.includes(lowerQuery)) {
      score += 2;
    }

    const bodyLines = snapshot.body.split("\n");
    let bodyHits = 0;
    for (let i = 0; i < bodyLines.length; i++) {
      if (bodyLines[i].toLowerCase().includes(lowerQuery)) {
        bodyHits++;
        const start = Math.max(0, i - 1);
        const end = Math.min(bodyLines.length, i + 2);
        matches.push(bodyLines.slice(start, end).join("\n"));
      }
    }
    if (bodyHits > 0) score += 1;

    if (score > 0) {
      collected.push({ path: snapshot.path, score, matches });
    }
  }

  collected.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return options.limit ? collected.slice(0, options.limit) : collected;
}

export interface RelatedOptions {
  limit?: number;
}

export interface RelatedResult {
  path: string;
  score: number;
  reasons: string[];
}

export async function findRelated(
  knowledgeDir: string,
  targetPath: string,
  options: RelatedOptions = {},
): Promise<RelatedResult[]> {
  const limit = options.limit ?? 5;
  const targetContent = await readKnowledge(knowledgeDir, targetPath);
  const { frontmatter: targetFmRaw } = parseFrontmatter(targetContent);
  const targetFm = validateFrontmatter(targetFmRaw).data ?? null;
  const targetTags = new Set((targetFm?.tags ?? []).map((t) => t.toLowerCase()));
  const targetAliases = new Set((targetFm?.aliases ?? []).map((a) => a.toLowerCase()));
  const targetParent = path.dirname(targetPath) === "." ? "" : path.dirname(targetPath);
  const targetBase = path.basename(targetPath).toLowerCase();

  const candidates: RelatedResult[] = [];

  for await (const article of walkArticles(knowledgeDir)) {
    if (article.path === targetPath) continue;
    const snapshot = await loadArticle(article);
    let score = 0;
    const reasons: string[] = [];

    const parentDir = path.dirname(snapshot.path) === "." ? "" : path.dirname(snapshot.path);
    if (parentDir === targetParent && targetParent !== "") {
      score += 3;
      reasons.push("same directory");
    }

    const otherTags = (snapshot.frontmatter?.tags ?? []).map((t) => t.toLowerCase());
    const sharedTags = otherTags.filter((t) => targetTags.has(t));
    if (sharedTags.length > 0) {
      score += sharedTags.length * 2;
      reasons.push(`shared tags: ${sharedTags.join(", ")}`);
    }

    const otherAliases = (snapshot.frontmatter?.aliases ?? []).map((a) => a.toLowerCase());
    if (
      otherAliases.some((a) => targetAliases.has(a)) ||
      otherAliases.includes(targetBase) ||
      targetAliases.has(snapshot.basename.toLowerCase())
    ) {
      score += 1;
      reasons.push("alias overlap");
    }

    if (score > 0) {
      candidates.push({ path: snapshot.path, score, reasons });
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return candidates.slice(0, limit);
}

export interface FrontmatterValidationIssue {
  path: string;
  errors: string[];
}

/**
 * Walk all articles and validate their frontmatter against the schema.
 * Returns a list of articles whose frontmatter failed validation.
 */
export async function validateAllFrontmatter(
  knowledgeDir: string,
): Promise<FrontmatterValidationIssue[]> {
  const issues: FrontmatterValidationIssue[] = [];
  for await (const article of walkArticles(knowledgeDir)) {
    const content = await readFile(article.absolutePath, "utf-8");
    const { frontmatter } = parseFrontmatter(content);
    const validated = validateFrontmatter(frontmatter);
    if (!validated.ok) {
      issues.push({ path: article.path, errors: validated.errors ?? [] });
    }
  }
  return issues;
}

export async function readArticleFrontmatter(
  knowledgeDir: string,
  filePath: string,
): Promise<Frontmatter | null> {
  const content = await readKnowledge(knowledgeDir, filePath);
  const { frontmatter } = parseFrontmatter(content);
  const validated = validateFrontmatter(frontmatter);
  return validated.data ?? null;
}
