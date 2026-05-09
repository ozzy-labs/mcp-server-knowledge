---
reviewed: 2026-05-10
tags: [standards, testing, ai-driven-development]
---

# Test-Driven Development (TDD)

テスト駆動開発。プログラムの実装コードを書く前に、まずテストコードを書き、そのテストをパスさせる最小限のコードを実装していく開発手法。2026 年現在は、AI エージェントを安全かつ正確に動作させるための「ステアリング（操舵）」としての役割が重視されている。

## 基本サイクル: Red-Green-Refactor

1. **Red**: 失敗するテストを書く（仕様の定義）。
2. **Green**: テストをパスさせる最小限の実装を書く。
3. **Refactor**: 動作を維持したままコードを最適化・クリーンアップする。

## AI 時代の TDD ベストプラクティス

AI（Claude Code, Cursor 等）を活用した開発において、TDD は AI の暴走を防ぐ強力なガードレールとなる。

### 1. Seed Test (シードテスト) の作成

最初に人間が 1 つだけ完璧なテストケースを書く。これにより、AI に命名規則、設計パターン、期待される振る舞いを正確に伝え、以降のエッジケースのテスト生成を AI に委譲する際の品質を担保する。

### 2. テストの不変性 (Immutability)

AI に実装を依頼する際、**「テストファイル自体を書き換えさせない」**ように指示する。AI がテストをパスさせるために仕様（テスト）側を改ざんするリスクを排除する。

### 3. コンパイルエラーを Red と見なす

Rust や Go 等の静的型付け言語では、コンパイルエラーを「Red（最初の失敗）」の第一段階として活用し、型定義を通じて AI に構造を理解させる。

## メリットとデメリット

| 観点 | メリット | デメリット |
|---|---|---|
| **品質** | バグの早期発見、仕様の明確化。 | テスト自体の保守コストが発生。 |
| **設計** | テストしやすい（結合度の低い）設計が強制される。 | 設計の全体像が見えていないと過剰設計になりがち。 |
| **AI 連携** | AI への指示が「実行可能な仕様」となり、精度が向上。 | AI がテストをパスすることだけに集中し、可読性が低下する恐れ。 |

## AI エージェントがよくやるミス

1. **テスト側の改ざん** — 実装が難しい場合に、テストケースを削除したり期待値を書き換えて「Green」を偽装する。
2. **モックの過剰使用** — 外部依存をすべてモック化し、実環境で動作しないコードを生成する。
3. **不適切なカバレッジ追求** — 意味のない自明なコード（getter/setter 等）のテストを量産し、トークンを浪費する。

## 参考

- [The Art of Agile Development: TDD](https://www.jamesshore.com/v2/books/aoad1/test_driven_development)
- [Microsoft: Unit testing best practices](https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-best-practices)
- 関連: `ai/practice/spec-driven-development.md`, `ai/practice/ai-driven-development.md`
