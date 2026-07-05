---
reviewed: 2026-05-10
tags: [vscode, typescript]
aliases: [vscode-ext]
---

# VS Code Extensions

A mechanism for extending the functionality of Visual Studio Code (VS Code). Using TypeScript/JavaScript, you can add editor UI, language support, debugging, tool integrations, and more.

Official: [code.visualstudio.com/api](https://code.visualstudio.com/api)

## Basic Concepts

A VS Code extension consists of three main components.

### 1. Activation Events

Defines when an extension is loaded into memory and activated (`activationEvents` in `package.json`).

- `onCommand:commandId` — when a command is executed
- `onLanguage:languageId` — when a file of a specific language is opened
- `onFileSystem:scheme` — when accessing a specific file system (e.g. `sftp`)
- `*` — always activated at VS Code startup (be careful of performance degradation)

### 2. Contribution Points

Statically declares what the extension adds to the VS Code UI or functionality (`contributes` in `package.json`).

- `commands` — commands displayed in the command palette, etc.
- `menus` — right-click menus, editor title menus
- `keybindings` — keyboard shortcuts
- `languages` — new language definitions (file extensions, icons, grammar, etc.)
- `viewsContainers` / `views` — adding views to the sidebar or panels

### 3. VS Code API

The API for writing the actual logic.

- `vscode.window` — UI operations such as message display, Webview, TreeView
- `vscode.workspace` — file operations, configuration management, document lifecycle
- `vscode.commands` — registering and executing commands
- `vscode.languages` — language features such as completion (IntelliSense), go-to-definition, hover

## Getting Started with Development

### 1. Generating a Project

Use the official Yeoman generator.

```bash
npx --package yo --package generator-code -- yo code
```

- It is recommended to select `New Extension (TypeScript)`.
- The necessary files (`package.json`, `src/extension.ts`, `tsconfig.json`, etc.) are generated.

### 2. Running and Debugging

1. Open the generated project in VS Code.
2. Press `F5`.
3. The **Extension Development Host** window launches, loading the extension under development.
4. Open the command palette with `Ctrl+Shift+P` and run `Hello World` to verify it works.

## Key Tools

### vsce (Visual Studio Code Extensions)

A command-line tool for packaging and publishing extensions.

```bash
# Install
npm install -g @vscode/vsce

# Package (generate a .vsix file)
vsce package

# Publish
vsce publish
```

## Testing

Tests for VS Code extensions run by launching an actual VS Code instance in the background.

- **Integration tests**: Use `@vscode/test-electron` to verify that the VS Code API behaves as expected.
- **Unit tests**: Pure logic that does not depend on the API can be run with a standard test runner such as Mocha.

```bash
# Run tests in the generated project
npm test
```

## Publishing Steps

1. **Create a publisher**: Create an account on the [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage).
2. **Obtain a Personal Access Token (PAT)**: Create a token with `Marketplace (Publish)` scope in Azure DevOps.
3. **Log in**: `vsce login <publisher>`
4. **Publish**: `vsce publish`

## Best Practices

- **Performance**: Narrow down `activationEvents` as much as possible to reduce startup time.
- **UX guidelines**: Follow the [UX Guidelines](https://code.visualstudio.com/api/ux-guidelines) to maintain a native look and feel.
- **Webview constraints**: Webviews are powerful but carry high security and performance costs, so prefer native UI (TreeView, QuickPick) whenever possible.
- **Security**: Store API keys and secrets safely using `vscode.SecretStorage`.

## References

- [Extension API Overview](https://code.visualstudio.com/api/get-started/extension-capabilities)
- [Extension Samples (GitHub)](https://github.com/microsoft/vscode-extension-samples)
- [vsce Documentation](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
