---
reviewed: 2026-06-29
tags: [ai-platform, spec, markdown, gcp]
aliases: [OKF, Open Knowledge Format]
stability: research-preview
---

# Open Knowledge Format (OKF)

An open specification for representing "curated knowledge" passed to AI agents (table definitions, metric formulas, runbooks, API specs, etc.) as a directory of YAML-frontmatter Markdown files. Google Cloud published v0.1 on 2026-06-13. It formalizes the LLM-wiki pattern (managing a knowledge base readable by both humans and AI in Git) into a portable format independent of any specific vendor, SDK, or runtime. The spec itself is published on GitHub (`GoogleCloudPlatform/knowledge-catalog`) under the Apache License 2.0.

## Background and Goals

Solves the problem of re-solving "context assembly" from scratch every time an agent is built (internal knowledge scattered across mutually incompatible systems). OKF provides a lingua franca for knowledge exchange, so knowledge survives across systems, organizations, and tools.

- **Difference from RAG**: RAG derives knowledge at query time, while OKF lets agents directly read and write "version-controlled, curated concepts."
- **Difference from AGENTS.md**: [[agents-md]] provides per-repository "instructions and policy for agents," while OKF is a "bundle of domain knowledge" shared across organizations. Different layers, no conflict.

## Basic Concepts

| Term | Definition |
|---|---|
| **Knowledge Bundle** | A self-contained, hierarchical collection of knowledge documents. The unit of exchange |
| **Concept** | A single Markdown document representing one unit of knowledge (1 file = 1 concept) |
| **Concept ID** | The file path with `.md` removed (e.g., `tables/users.md` → `tables/users`) |

Concepts are linked to each other via Markdown links, forming a graph that spans beyond the directory's parent-child structure.

## File Structure

A bundle is a directory of Markdown files representing concepts.

```text
sales/
├── index.md
├── datasets/
│   ├── index.md
│   └── orders_db.md
├── tables/
│   ├── index.md
│   ├── orders.md
│   └── customers.md
└── metrics/
    ├── index.md
    └── weekly_active_users.md
```

## Frontmatter

Each concept consists of YAML frontmatter delimited by `---` and free-form Markdown body.

| Field | Required | Content |
|---|---|---|
| `type` | **Required** (the only one) | A descriptive string for the concept's type (e.g., `BigQuery Table`, `Playbook`). Values are defined by the producer and are not registered in any central registry |
| `title` | Recommended | Human-readable display name |
| `description` | Recommended | One-sentence summary |
| `resource` | Recommended | URI uniquely pointing to the underlying asset |
| `tags` | Recommended | YAML list for cross-cutting classification |
| `timestamp` | Recommended | ISO 8601 datetime of last update |

Producers may add arbitrary custom keys (minimally constrained, freely extensible).

```yaml
---
type: BigQuery Table
title: Orders
description: One row per completed customer order.
resource: https://console.cloud.google.com/bigquery?p=acme&d=sales&t=orders
tags: [sales, revenue]
timestamp: 2026-05-28T14:30:00Z
---
```

## Reserved File Names

| File name | Role |
|---|---|
| `index.md` | Directory index without frontmatter. Supports progressive disclosure |
| `log.md` | Chronological update history grouped by ISO 8601 date |

Every `.md` file other than the reserved names is treated as a concept document.

## Linking Convention

- **Absolute (bundle-relative)**: Links starting with `/` resolve from the bundle root. Recommended for stability.
- **Relative**: Ordinary Markdown relative paths.

Both represent untyped relationships; meaning emerges from surrounding prose.

## Conformance (v0.1)

A bundle conforms to OKF v0.1 when it satisfies all of the following:

1. Every `.md` file other than the reserved names has parseable YAML frontmatter
2. All frontmatter includes a non-empty `type` field
3. Reserved files, where present, follow the prescribed structure

### Consumer Obligations

Consumers (agents, tools) are required to behave leniently.

- **MUST**: Tolerate unknown `type` values / tolerate broken cross-links / preserve unknown frontmatter keys on round-trip
- **SHOULD**: Not reject documents with unrecognized fields / consume unrecognized OKF versions on a best-effort basis / treat constraints beyond the conformance conditions as soft guidance

This lenient model enables incremental evolution as bundles grow and as agents generate content.

## Reference Implementations

Published alongside the spec:

- **Enrichment agent**: Crawls BigQuery datasets and drafts OKF documents with schema and citations attached
- **Static HTML visualizer**: Renders an OKF bundle as an interactive graph view
- **Sample bundles**: GA4 e-commerce / Stack Overflow / Bitcoin datasets

## Design Principles

- **Minimally opinioned**: `type` is the only required field. No content model is prescribed
- **Producer/consumer independence**: The format is the contract; tooling on either end can be swapped independently
- **Format, not platform**: Independent of cloud, database, model provider, and framework

## References

- OKF spec (GitHub, Apache-2.0): <https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf>
- Google Cloud Blog, "How the Open Knowledge Format can improve data sharing": <https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing>
