# Changelog

## [0.1.0](https://github.com/ozzy-labs/mcp-server-knowledge/compare/mcp-server-knowledge-v0.1.0...mcp-server-knowledge-v0.1.0) (2026-05-10)


### ⚠ BREAKING CHANGES

* rename package to @ozzylabs/knowledge-mcp-server ([#31](https://github.com/ozzy-labs/mcp-server-knowledge/issues/31))

### Features

* add /refresh skill with reviewed-date frontmatter ([#20](https://github.com/ozzy-labs/mcp-server-knowledge/issues/20)) ([346132e](https://github.com/ozzy-labs/mcp-server-knowledge/commit/346132eebf7a0437569bf1610b4be197fdfdfc6e))
* implement MCP server with list, read, and search tools ([#3](https://github.com/ozzy-labs/mcp-server-knowledge/issues/3)) ([5353568](https://github.com/ozzy-labs/mcp-server-knowledge/commit/535356876339ea65193535b27c7e652951000c70))
* **knowledge:** refactor personal identifiers for public release ([#184](https://github.com/ozzy-labs/mcp-server-knowledge/issues/184)) ([083db51](https://github.com/ozzy-labs/mcp-server-knowledge/commit/083db51e8f8e32f9c433335439a4a2727d9bfab4))
* rename package to @ozzylabs/knowledge-mcp-server ([#31](https://github.com/ozzy-labs/mcp-server-knowledge/issues/31)) ([8a1869c](https://github.com/ozzy-labs/mcp-server-knowledge/commit/8a1869c328145e89451febc04da43eeeec9f9d8b))
* rename project to mcp-server-knowledge ([#193](https://github.com/ozzy-labs/mcp-server-knowledge/issues/193)) ([2c96ada](https://github.com/ozzy-labs/mcp-server-knowledge/commit/2c96adaa0cf07da8a95d2f3020ff352882540d82))
* **routines:** add daily/weekly/monthly routine prompts and operational README ([#97](https://github.com/ozzy-labs/mcp-server-knowledge/issues/97)) ([c441ac2](https://github.com/ozzy-labs/mcp-server-knowledge/commit/c441ac20fcbacedc0eda15c3ca9eae15f8bfc517))
* **server:** add search filters and related tool ([#81](https://github.com/ozzy-labs/mcp-server-knowledge/issues/81)) ([e832ceb](https://github.com/ozzy-labs/mcp-server-knowledge/commit/e832cebd28274d9f53e076ff94f64515c14a5a88))
* **server:** MCP server v2 core — Zod schema + recursive list/search ([#80](https://github.com/ozzy-labs/mcp-server-knowledge/issues/80)) ([c743246](https://github.com/ozzy-labs/mcp-server-knowledge/commit/c7432461101c58c9eca7cfba19143827fccb88e4))
* **skills-sync:** migrate to adapter-aware @ozzylabs/skills sync ([#37](https://github.com/ozzy-labs/mcp-server-knowledge/issues/37)) ([96e299c](https://github.com/ozzy-labs/mcp-server-knowledge/commit/96e299c225aeee0995c3c886f8137be7eb295ac0)), closes [#36](https://github.com/ozzy-labs/mcp-server-knowledge/issues/36)
* **skills:** extend /update with --non-interactive --auto-ship --staleness-group ([#96](https://github.com/ozzy-labs/mcp-server-knowledge/issues/96)) ([368cea7](https://github.com/ozzy-labs/mcp-server-knowledge/commit/368cea78f2a4d9c9d0e17e11f8dd04afbf0cd0c8))
* **staleness:** add status.sh + manual workflow doc ([#99](https://github.com/ozzy-labs/mcp-server-knowledge/issues/99)) ([8239470](https://github.com/ozzy-labs/mcp-server-knowledge/commit/82394707dd189284c50b33b725fd380143535cef))
* **staleness:** scaffold sources.yaml + JSON Schema + setup.sh ([#95](https://github.com/ozzy-labs/mcp-server-knowledge/issues/95)) ([293ce55](https://github.com/ozzy-labs/mcp-server-knowledge/commit/293ce55316c9903c0a7ffd6cc11a62bc0bd38908))
* support private knowledge and custom knowledge directory via env var ([#190](https://github.com/ozzy-labs/mcp-server-knowledge/issues/190)) ([6bcae85](https://github.com/ozzy-labs/mcp-server-knowledge/commit/6bcae85e0b08569abcfe6254eebe6b6a8a6276db))
* **test:** add e2e tests and fix tag schema inconsistencies ([#188](https://github.com/ozzy-labs/mcp-server-knowledge/issues/188)) ([6e7bbd9](https://github.com/ozzy-labs/mcp-server-knowledge/commit/6e7bbd9645f0c94085928629f4ebf42ffec97941))
* **test:** improve robustness against path traversal and malformed frontmatter ([#185](https://github.com/ozzy-labs/mcp-server-knowledge/issues/185)) ([1276bb3](https://github.com/ozzy-labs/mcp-server-knowledge/commit/1276bb36fa6ec92979f860e677bc58b20ebb7b7a))


### Bug Fixes

* **ci:** align biome schema with 2.4.14 and reformat renovate.json ([#153](https://github.com/ozzy-labs/mcp-server-knowledge/issues/153)) ([92d065a](https://github.com/ozzy-labs/mcp-server-knowledge/commit/92d065a06d1bd1f67a0ae3d2d91c9db3c664c1f0))
* correct release-please config structure ([#197](https://github.com/ozzy-labs/mcp-server-knowledge/issues/197)) ([3e949e9](https://github.com/ozzy-labs/mcp-server-knowledge/commit/3e949e9e0e78e2c4d001eb85162a606ea234e64f))
* final markdown lint cleanup ([#201](https://github.com/ozzy-labs/mcp-server-knowledge/issues/201)) ([d41ce6d](https://github.com/ozzy-labs/mcp-server-knowledge/commit/d41ce6d2650460fc58216ba359ca4cfcd7008b54))
* initial release trigger ([#196](https://github.com/ozzy-labs/mcp-server-knowledge/issues/196)) ([97d470e](https://github.com/ozzy-labs/mcp-server-knowledge/commit/97d470e94cf8dd71c3617e8946dac4c314b3ed19))
* lint errors (markdown and biome config) ([#200](https://github.com/ozzy-labs/mcp-server-knowledge/issues/200)) ([0f18a00](https://github.com/ozzy-labs/mcp-server-knowledge/commit/0f18a0008980d11036b966a4cfe408b91b222cb9))
* **routines:** move pnpm install from setup_script to instructions ([#145](https://github.com/ozzy-labs/mcp-server-knowledge/issues/145)) ([fd3bd1b](https://github.com/ozzy-labs/mcp-server-knowledge/commit/fd3bd1b18d7e972ab60ff91cae4ada999bcaaa03))
* **skill:** allow assistant to invoke skills via Skill tool ([#114](https://github.com/ozzy-labs/mcp-server-knowledge/issues/114)) ([d8c53bb](https://github.com/ozzy-labs/mcp-server-knowledge/commit/d8c53bba91ca00f93ba35e1a0cb02af7368eca65)), closes [#109](https://github.com/ozzy-labs/mcp-server-knowledge/issues/109)
* **staleness:** simplify setup.sh for cloud Routines environment ([#98](https://github.com/ozzy-labs/mcp-server-knowledge/issues/98)) ([bc53def](https://github.com/ozzy-labs/mcp-server-knowledge/commit/bc53defbb2b4cf85ecff3be5da70d1a5f85c16b9))
* sync pnpm-lock.yaml overrides with package.json ([#199](https://github.com/ozzy-labs/mcp-server-knowledge/issues/199)) ([d46eb0b](https://github.com/ozzy-labs/mcp-server-knowledge/commit/d46eb0bbb24ffbed19643d293297440365d41522))
* **test:** use permanent fixtures instead of temporary files ([#187](https://github.com/ozzy-labs/mcp-server-knowledge/issues/187)) ([6f95219](https://github.com/ozzy-labs/mcp-server-knowledge/commit/6f95219412591247f629fc694c274de6a5dd8a4a))
