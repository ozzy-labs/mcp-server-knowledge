import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

function assertWithinDir(knowledgeDir: string, resolved: string): void {
  const normalized = path.resolve(resolved);
  const base = path.resolve(knowledgeDir);
  if (!normalized.startsWith(base + path.sep) && normalized !== base) {
    throw new Error("Path traversal detected");
  }
}

export async function listCategories(knowledgeDir: string): Promise<string[]> {
  const entries = await readdir(knowledgeDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

export async function listFiles(knowledgeDir: string, category: string): Promise<string[]> {
  const categoryDir = path.join(knowledgeDir, category);
  assertWithinDir(knowledgeDir, categoryDir);
  const entries = await readdir(categoryDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => e.name.replace(/\.md$/, ""))
    .sort();
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
  const categories = await listCategories(knowledgeDir);

  for (const category of categories) {
    const files = await listFiles(knowledgeDir, category);
    for (const file of files) {
      const filePath = `${category}/${file}`;
      const content = await readFile(path.join(knowledgeDir, `${filePath}.md`), "utf-8");
      const lines = content.split("\n");
      const matchingLines: string[] = [];

      const nameMatch = file.toLowerCase().includes(lowerQuery);

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(lowerQuery)) {
          const start = Math.max(0, i - 1);
          const end = Math.min(lines.length, i + 2);
          matchingLines.push(lines.slice(start, end).join("\n"));
        }
      }

      if (nameMatch || matchingLines.length > 0) {
        results.push({
          path: filePath,
          matches:
            matchingLines.length > 0
              ? matchingLines
              : nameMatch
                ? [`(filename match: ${file})`]
                : [],
        });
      }
    }
  }

  return results;
}
