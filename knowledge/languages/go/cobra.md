---
reviewed: 2026-05-04
tags: [go, cli, framework]
---

# Cobra

Go で本格的な CLI を構築するためのデファクト・スタンダードなライブラリ。`APPNAME VERB NOUN --ADJECTIVE`（例: `kubectl get pods --namespace=default`）パターンに従い、サブコマンド階層・POSIX 準拠フラグ・自動 help 生成・シェル補完を備える。

公式: [GitHub](https://github.com/spf13/cobra) / [User Guide](https://github.com/spf13/cobra/blob/main/site/content/user_guide.md)

採用プロジェクト: kubectl / Kubernetes、GitHub CLI（`gh`）、Hugo、Helm、Istio、etcd、GoReleaser、Moby/Docker（distribution）等。

最新は **cobra v1.10.2**（2024-12）/ **cobra-cli v1.3.0**。cobra-cli は更新ペースが緩いが、生成されるコードは最新 cobra と互換。

## インストール

```bash
# ライブラリ
go get -u github.com/spf13/cobra@latest

# scaffolding ジェネレータ
go install github.com/spf13/cobra-cli@latest
```

`cobra-cli` は `$GOPATH/bin` に入る。

## スキャフォールド

```bash
mkdir myapp && cd myapp
go mod init github.com/me/myapp
cobra-cli init                           # root + main.go 生成
cobra-cli add serve                      # サブコマンド追加
cobra-cli add config -p serveCmd         # 親コマンド指定でネスト
```

生成構造:

```text
myapp/
├── cmd/
│   ├── root.go
│   ├── serve.go
│   └── config.go
├── main.go
└── go.mod
```

主要オプション: `--author`, `--license`（apache / MIT 等）, `--viper`（Viper 自動セットアップ）, `-p <parentCmd>`。

`~/.cobra.yaml` で `author` / `license` / `useViper` のデフォルトを設定可能。

## `cobra.Command` の主要フィールド

```go
&cobra.Command{
    Use:     "serve [flags]",
    Aliases: []string{"s"},
    Short:   "Run server",
    Long:    `Run the HTTP server with the given config.`,
    Example: `  myapp serve --port 8080`,

    Args: cobra.ExactArgs(0),
    ValidArgsFunction: completeFn,

    PersistentPreRunE: func(cmd *cobra.Command, args []string) error { return nil },
    PreRunE:           func(cmd *cobra.Command, args []string) error { return nil },
    RunE:              func(cmd *cobra.Command, args []string) error { return nil },

    SilenceErrors: true,
    SilenceUsage:  true,
}
```

実行順: `PersistentPreRun` → `PreRun` → `Run` → `PostRun` → `PersistentPostRun`。`*E` 版は `error` を返す。

## フラグ

```go
// ローカル（このコマンドのみ）
cmd.Flags().StringVarP(&source, "source", "s", "", "source path")
cmd.Flags().BoolP("verbose", "v", false, "verbose output")
cmd.Flags().IntP("port", "p", 8080, "port number")
cmd.Flags().StringSliceP("tags", "t", nil, "tags")

// Persistent（子コマンドへ伝播）
rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file path")

// 繰り返しフラグ
cmd.Flags().CountVarP(&verbosity, "verbose", "v", "verbosity (-v, -vv, -vvv)")
cmd.Flags().StringArrayVarP(&headers, "header", "H", nil, "headers (repeatable)")
```

### フラグ制約

```go
cmd.MarkFlagRequired("output")
cmd.MarkFlagsRequiredTogether("username", "password")
cmd.MarkFlagsMutuallyExclusive("json", "yaml", "xml")
cmd.MarkFlagsOneRequired("json", "yaml")
```

## 引数バリデーション

| バリデータ | 意味 |
|---|---|
| `cobra.NoArgs` | 引数禁止 |
| `cobra.ArbitraryArgs` | 任意（既定） |
| `cobra.MinimumNArgs(n)` / `MaximumNArgs(n)` | 最小/最大 |
| `cobra.ExactArgs(n)` | 完全一致 |
| `cobra.RangeArgs(min, max)` | 範囲 |
| `cobra.OnlyValidArgs` | `ValidArgs` の値のみ許可 |
| `cobra.MatchAll(...)` | 複数バリデータの合成 |

```go
Args: cobra.MatchAll(cobra.MinimumNArgs(1), cobra.OnlyValidArgs),
```

## シェル補完

`completion` サブコマンドが**自動で生やされる**:

```bash
myapp completion bash > /etc/bash_completion.d/myapp
myapp completion zsh > "${fpath[1]}/_myapp"
myapp completion fish > ~/.config/fish/completions/myapp.fish
myapp completion powershell > myapp.ps1
```

### 動的補完

```go
cmd.ValidArgsFunction = func(cmd *cobra.Command, args []string, toComplete string) ([]cobra.Completion, cobra.ShellCompDirective) {
    return []cobra.Completion{"foo", "bar"}, cobra.ShellCompDirectiveNoFileComp
}

cmd.RegisterFlagCompletionFunc("namespace", func(cmd *cobra.Command, args []string, toComplete string) ([]cobra.Completion, cobra.ShellCompDirective) {
    return listNamespaces(), cobra.ShellCompDirectiveNoFileComp
})
```

### `ShellCompDirective`

| 定数 | 意味 |
|---|---|
| `ShellCompDirectiveDefault` | シェル既定（ファイル補完含む） |
| `ShellCompDirectiveNoFileComp` | ファイル補完無効 |
| `ShellCompDirectiveNoSpace` | 補完後にスペース付加しない |
| `ShellCompDirectiveFilterFileExt` | 拡張子フィルタ |
| `ShellCompDirectiveFilterDirs` | ディレクトリのみ |
| `ShellCompDirectiveKeepOrder` | 順序保持 |

ビット OR で組み合わせ可。デバッグは `cobra.CompDebug()` / `cobra.CompError()`（stdout は補完スクリプトに解釈されるため使用不可）。

v1.9+ で `CompletionFunc` 型 / `CompletionWithDesc` ヘルパーが追加され、補完候補に説明文を付加できる。

## ヘルプ・バージョン

```go
rootCmd.Version = "1.2.3"
rootCmd.SetVersionTemplate("{{.Name}} {{.Version}}\n")
rootCmd.SetHelpTemplate(...)
rootCmd.SetUsageTemplate(...)
```

`Version` を設定すると `--version` フラグが自動追加される。`--help` / `-h` は常に自動。

## Viper 統合

設定ファイル + 環境変数 + フラグの優先順位を統合する。優先順位（高 → 低）: 明示フラグ > 環境変数 > 設定ファイル > Viper デフォルト。

```go
func init() {
    cobra.OnInitialize(initConfig)
    rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file")
    rootCmd.PersistentFlags().String("author", "", "author")
    viper.BindPFlag("author", rootCmd.PersistentFlags().Lookup("author"))
    viper.SetDefault("author", "NAME <EMAIL>")
}

func initConfig() {
    if cfgFile != "" {
        viper.SetConfigFile(cfgFile)
    } else {
        home, _ := os.UserHomeDir()
        viper.AddConfigPath(home)
        viper.SetConfigType("yaml")
        viper.SetConfigName(".myapp")
    }
    viper.AutomaticEnv()
    if err := viper.ReadInConfig(); err == nil {
        fmt.Println("Using config:", viper.ConfigFileUsed())
    }
}
```

## エラーハンドリング

```go
var rootCmd = &cobra.Command{
    Use:           "myapp",
    SilenceUsage:  true,   // error 時に Usage を出さない
    SilenceErrors: true,   // error の自動出力を抑制（自分で扱う）
    RunE: func(cmd *cobra.Command, args []string) error {
        if err := doWork(); err != nil {
            return fmt.Errorf("work failed: %w", err)
        }
        return nil
    },
}

func main() { cobra.CheckErr(rootCmd.Execute()) }
```

`cobra.CheckErr(err)` は err が nil 以外なら `"Error: ..."` を stderr に出して `os.Exit(1)`。

## アーキテクチャパターン

### 推奨レイアウト

```text
myapp/
├── cmd/                # Cobra コマンド定義
│   ├── root.go
│   └── serve.go
├── internal/           # ドメインロジック（Cobra に依存しない）
│   ├── server/
│   └── config/
├── main.go             # cmd.Execute() を呼ぶだけ
└── go.mod
```

### DI パターン

```go
func NewRootCmd(deps Deps) *cobra.Command {
    cmd := &cobra.Command{Use: "myapp"}
    cmd.AddCommand(newServeCmd(deps))
    return cmd
}
```

### テストパターン

```go
func TestServeCmd(t *testing.T) {
    buf := new(bytes.Buffer)
    root := NewRootCmd(testDeps())
    root.SetOut(buf)
    root.SetErr(buf)
    root.SetArgs([]string{"serve", "--port", "9090"})

    if err := root.Execute(); err != nil { t.Fatal(err) }
    got := strings.TrimSpace(buf.String())
    // assert ...
}
```

> **重要**: `SetOut` / `SetErr` は **Cobra の `cmd.Print*` 系**にのみ反映される。`fmt.Println` は直接 stdout に流れて捕捉できないため、ハンドラ内では `cmd.OutOrStdout()` / `cmd.ErrOrStderr()` または `fmt.Fprintln(cmd.OutOrStdout(), ...)` を使う。

## AI エージェントがよくやるミス

1. **`Run` の中で `fmt.Println` を直書き** — テスト時に `SetOut` で捕捉できない。`cmd.Println(...)` または `fmt.Fprintln(cmd.OutOrStdout(), ...)` を使う
2. **エラーを `Run` 内で `os.Exit` する** — テスト不能。`RunE` で error を返し、`main` 側で `cobra.CheckErr` する
3. **`SilenceUsage` / `SilenceErrors` 未設定** — エラー時にやたら長い Usage が出る。CLI ツールでは両方 `true` が定石
4. **Persistent と Local フラグの混同** — 子に伝えたいフラグは `PersistentFlags()`、当該コマンドのみなら `Flags()`
5. **Viper を使うなら `BindPFlag` が必要** — `viper.GetString(...)` だけでは PFlag の値を読めない
6. **`MarkFlagRequired` の呼び忘れ** — `Flag` を定義してから `MarkFlagRequired` を呼ぶ順序。`init()` 内で実行
7. **シェル補完を `ValidArgs` 静的指定で済ませる** — 動的（リソース一覧等）は `ValidArgsFunction`、フラグ値は `RegisterFlagCompletionFunc` を使う

## 参考

- [User Guide](https://github.com/spf13/cobra/blob/main/site/content/user_guide.md)
- [Shell Completions](https://github.com/spf13/cobra/blob/main/site/content/completions/_index.md)
- [pkg.go.dev](https://pkg.go.dev/github.com/spf13/cobra)
- [cobra-cli](https://github.com/spf13/cobra-cli)
- [Releases](https://github.com/spf13/cobra/releases)
