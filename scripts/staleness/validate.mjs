#!/usr/bin/env node
// Validates scripts/staleness/sources.yaml against sources.schema.json.
// Invoked by lefthook pre-commit (when sources.yaml or schema changes) and CI.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv from "ajv";
import { parse as parseYaml } from "yaml";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const YAML_PATH = join(SCRIPT_DIR, "sources.yaml");
const SCHEMA_PATH = join(SCRIPT_DIR, "sources.schema.json");

const [yamlText, schemaText] = await Promise.all([
  readFile(YAML_PATH, "utf8"),
  readFile(SCHEMA_PATH, "utf8"),
]);

const data = parseYaml(yamlText);
const schema = JSON.parse(schemaText);

const ajv = new Ajv({ allErrors: true, strict: true, strictRequired: false });
const validate = ajv.compile(schema);

if (validate(data)) {
  console.log(`OK: ${YAML_PATH} matches schema`);
  process.exit(0);
}

console.error(`FAIL: ${YAML_PATH} does not match schema`);
for (const err of validate.errors ?? []) {
  console.error(`  ${err.instancePath || "/"} ${err.message}`);
  if (err.params && Object.keys(err.params).length > 0) {
    console.error(`    params: ${JSON.stringify(err.params)}`);
  }
}
process.exit(1);
