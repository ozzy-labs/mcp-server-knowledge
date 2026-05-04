#!/usr/bin/env node
// staleness-researcher の JSON 出力を JSON Schema で検証する。
// stdin から JSON を受け取り、valid なら exit 0、invalid なら schema error を stderr に出して exit 1。
// /update スキルが各 sub-agent 出力をパイプして使う想定。

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

const SCHEMA_PATH = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"agent-output.schema.json",
);

export function validateAgentOutput(payload) {
	const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
	const ajv = new Ajv2020({ allErrors: true, strict: false });
	const validate = ajv.compile(schema);
	const ok = validate(payload);
	return {
		ok,
		errors: validate.errors ?? [],
	};
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
		console.error("validate-output: no JSON received on stdin");
		process.exit(1);
	}
	let payload;
	try {
		payload = JSON.parse(raw);
	} catch (err) {
		console.error(`validate-output: invalid JSON: ${err.message}`);
		process.exit(1);
	}
	const { ok, errors } = validateAgentOutput(payload);
	if (!ok) {
		console.error("validate-output: schema validation failed:");
		for (const e of errors) {
			console.error(`  ${e.instancePath || "/"}: ${e.message}`);
		}
		process.exit(1);
	}
	process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
