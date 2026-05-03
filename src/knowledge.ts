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

export interface ListEntries {
  directories: string[];
  files: string[];
}

export async function listEntries(knowledgeDir: string, subPath = ""): Promise<ListEntries> {
  const target = subPath === "" ? knowledgeDir : path.join(knowledgeDir, subPath);
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
  const target = subPath === "" ? knowledgeDir : path.join(knowledgeDir, subPath);
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
  const resolved = path.join(knowledgeDir, `${filePath}.md`);
  assertWithinDir(knowledgeDir, resolved);
  return readFile(resolved, "utf-8");
}

export interface SearchResult {
  path: string;
  matches: string[];
}

export async function searchKnowledge(
  knowledgeDir: string,
  query: string,
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  for await (const article of walkArticles(knowledgeDir)) {
    const content = await readFile(article.absolutePath, "utf-8");
    const lines = content.split("\n");
    const matchingLines: string[] = [];
    const fileBaseName = path.basename(article.path);
    const nameMatch = fileBaseName.toLowerCase().includes(lowerQuery);

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(lowerQuery)) {
        const start = Math.max(0, i - 1);
        const end = Math.min(lines.length, i + 2);
        matchingLines.push(lines.slice(start, end).join("\n"));
      }
    }

    if (nameMatch || matchingLines.length > 0) {
      results.push({
        path: article.path,
        matches:
          matchingLines.length > 0
            ? matchingLines
            : nameMatch
              ? [`(filename match: ${fileBaseName})`]
              : [],
      });
    }
  }

  return results;
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
