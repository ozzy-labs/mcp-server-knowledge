#!/usr/bin/env node
// staleness-researcher の出力を main セッションが受信した直後に正規化する。
// 「edits が空」「全ての edits が frontmatter (reviewed) のみ」の場合、
// confidence を high/medium と返してきても low に強制降格する。

export function normalizeAgentOutput(report) {
	const next = { ...report };
	if (next.confidence === "fail") {
		return next;
	}
	if (!Array.isArray(next.edits) || next.edits.length === 0) {
		next.confidence = "low";
		return next;
	}
	const nonFrontmatter = next.edits.filter((edit) => !isFrontmatterOnly(edit));
	if (nonFrontmatter.length === 0) {
		next.confidence = "low";
	}
	return next;
}

function isFrontmatterOnly(edit) {
	if (!edit || typeof edit !== "object") return false;
	const haystack = `${edit.locator ?? ""}\n${edit.old_string ?? ""}\n${edit.new_string ?? ""}`;
	// frontmatter フィールドのみを触る編集を識別する。
	// 現状は reviewed のみ対象（タグ/aliases/stability は意味的な変更なので降格しない）。
	return /(^|\n)reviewed:\s*\d{4}-\d{2}-\d{2}/.test(haystack)
		&& !hasMaterialChange(edit);
}

function hasMaterialChange(edit) {
	const oldLines = (edit.old_string ?? "").split("\n");
	const newLines = (edit.new_string ?? "").split("\n");
	for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
		const o = (oldLines[i] ?? "").trim();
		const n = (newLines[i] ?? "").trim();
		if (o === n) continue;
		// reviewed 行の差分は frontmatter 変更とみなす
		if (/^reviewed:\s*\d{4}-\d{2}-\d{2}$/.test(o) && /^reviewed:\s*\d{4}-\d{2}-\d{2}$/.test(n)) {
			continue;
		}
		// それ以外の差分があれば本文変更
		return true;
	}
	return false;
}

async function readStdin() {
	const chunks = [];
	for await (const chunk of process.stdin) {
		chunks.push(chunk);
	}
	return Buffer.concat(chunks).toString("utf8");
}

async function main() {
	const raw = (await readStdin()).trim();
	if (!raw) {
		console.error("normalize-output: no JSON received on stdin");
		process.exit(1);
	}
	let payload;
	try {
		payload = JSON.parse(raw);
	} catch (err) {
		console.error(`normalize-output: invalid JSON: ${err.message}`);
		process.exit(1);
	}
	const normalized = normalizeAgentOutput(payload);
	process.stdout.write(JSON.stringify(normalized, null, 2));
	process.stdout.write("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
