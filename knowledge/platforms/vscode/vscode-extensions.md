---
reviewed: 2026-05-10
tags: [vscode, typescript]
aliases: [vscode-ext]
---

# VS Code Extensions

Visual Studio Code (VS Code) の機能を拡張するための仕組み。TypeScript/JavaScript を使用して、エディタの UI、言語サポート、デバッグ、ツール統合などを追加できる。

公式: [code.visualstudio.com/api](https://code.visualstudio.com/api)

## 基本コンセプト

VS Code 拡張機能は以下の 3 つの主要な構成要素で成り立つ。

### 1. Activation Events

拡張機能がいつメモリにロードされ、有効化されるかを定義する（`package.json` の `activationEvents`）。

- `onCommand:commandId` — コマンド実行時
- `onLanguage:languageId` — 特定言語のファイルを開いた時
- `onFileSystem:scheme` — 特定のファイルシステム（例: `sftp`）アクセス時
- `*` — VS Code 起動時に常に有効化（パフォーマンス低下に注意）

### 2. Contribution Points

VS Code の UI や機能に何を追加するかを静的に宣言する（`package.json` の `contributes`）。

- `commands` — コマンドパレット等に表示されるコマンド
- `menus` — 右クリックメニューやエディタタイトルのメニュー
- `keybindings` — ショートカットキー
- `languages` — 新規言語の定義（拡張子、アイコン、文法など）
- `viewsContainers` / `views` — サイドバーやパネルへのビュー追加

### 3. VS Code API

実際のロジックを記述するための API。

- `vscode.window` — メッセージ表示、Webview、TreeView などの UI 操作
- `vscode.workspace` — ファイル操作、設定管理、ドキュメントのライフサイクル
- `vscode.commands` — コマンドの登録と実行
- `vscode.languages` — 補完 (IntelliSense)、定義ジャンプ、ホバー等の言語機能

## 開発の始め方

### 1. プロジェクトの生成

公式の Yeoman ジェネレーターを使用する。

```bash
npx --package yo --package generator-code -- yo code
```

- `New Extension (TypeScript)` を選択するのが推奨。
- 必要なファイル群（`package.json`, `src/extension.ts`, `tsconfig.json` 等）が生成される。

### 2. 実行とデバッグ

1. 生成されたプロジェクトを VS Code で開く。
2. `F5` キーを押す。
3. **拡張機能開発ホスト (Extension Development Host)** ウィンドウが起動し、開発中の拡張機能がロードされる。
4. `Ctrl+Shift+P` でコマンドパレットを開き、`Hello World` を実行して動作を確認する。

## 主要ツール

### vsce (Visual Studio Code Extensions)

拡張機能のパッケージ化と公開のためのコマンドラインツール。

```bash
# インストール
npm install -g @vscode/vsce

# パッケージ化 (.vsix ファイルの生成)
vsce package

# 公開
vsce publish
```

## テスト

VS Code 拡張機能のテストは、実際の VS Code インスタンスを背後で起動して実行される。

- **統合テスト**: `@vscode/test-electron` を使用し、VS Code API が期待通り動作するかを検証する。
- **ユニットテスト**: API に依存しない純粋なロジックは、Mocha 等の標準的なテストランナーで実行可能。

```bash
# 生成されたプロジェクトでのテスト実行
npm test
```

## 公開手順

1. **パブリッシャーの作成**: [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage) でアカウントを作成。
2. **Personal Access Token (PAT) の取得**: Azure DevOps で `Marketplace (Publish)` スコープのトークンを作成。
3. **ログイン**: `vsce login <publisher>`
4. **公開**: `vsce publish`

## ベストプラクティス

- **パフォーマンス**: `activationEvents` を可能な限り絞り、起動時間を短縮する。
- **UX ガイドライン**: [UX Guidelines](https://code.visualstudio.com/api/ux-guidelines) に従い、ネイティブな外観を維持する。
- **Webview の制限**: Webview は強力だが、セキュリティとパフォーマンスのコストが高いため、可能な限りネイティブ UI (TreeView, QuickPick) を優先する。
- **セキュリティ**: API キーや秘密情報は `vscode.SecretStorage` を使用して安全に保存する。

## 参考

- [Extension API Overview](https://code.visualstudio.com/api/get-started/extension-capabilities)
- [Extension Samples (GitHub)](https://github.com/microsoft/vscode-extension-samples)
- [vsce Documentation](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
