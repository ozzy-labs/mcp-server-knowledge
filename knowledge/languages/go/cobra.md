---
reviewed: 2026-05-04
tags: [go, cli, framework]
---

# Cobra

The de facto standard library for building full-featured CLIs in Go. Follows the `APPNAME VERB NOUN --ADJECTIVE` pattern (e.g. `kubectl get pods --namespace=default`), with subcommand hierarchies, POSIX-compliant flags, automatic help generation, and shell completion.

Official: [GitHub](https://github.com/spf13/cobra) / [User Guide](https://github.com/spf13/cobra/blob/main/site/content/user_guide.md)

Projects using it: kubectl / Kubernetes, GitHub CLI (`gh`), Hugo, Helm, Istio, etcd, GoReleaser, Moby/Docker (distribution), etc.

Latest: **cobra v1.10.2** (2024-12) / **cobra-cli v1.3.0**. cobra-cli releases less frequently, but generated code stays compatible with the latest cobra.

## Installation

```bash
# Library
go get -u github.com/spf13/cobra@latest

# Scaffolding generator
go install github.com/spf13/cobra-cli@latest
```

`cobra-cli` is installed under `$GOPATH/bin`.

## Scaffolding

```bash
mkdir myapp && cd myapp
go mod init github.com/me/myapp
cobra-cli init                           # generate root + main.go
cobra-cli add serve                      # add subcommand
cobra-cli add config -p serveCmd         # nest under a specified parent command
```

Generated structure:

```text
myapp/
├── cmd/
│   ├── root.go
│   ├── serve.go
│   └── config.go
├── main.go
└── go.mod
```

Key options: `--author`, `--license` (apache / MIT, etc.), `--viper` (auto Viper setup), `-p <parentCmd>`.

`~/.cobra.yaml` lets you set defaults for `author` / `license` / `useViper`.

## Key `cobra.Command` fields

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

Execution order: `PersistentPreRun` → `PreRun` → `Run` → `PostRun` → `PersistentPostRun`. The `*E` variants return an `error`.

## Flags

```go
// Local (this command only)
cmd.Flags().StringVarP(&source, "source", "s", "", "source path")
cmd.Flags().BoolP("verbose", "v", false, "verbose output")
cmd.Flags().IntP("port", "p", 8080, "port number")
cmd.Flags().StringSliceP("tags", "t", nil, "tags")

// Persistent (propagates to child commands)
rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file path")

// Repeatable flags
cmd.Flags().CountVarP(&verbosity, "verbose", "v", "verbosity (-v, -vv, -vvv)")
cmd.Flags().StringArrayVarP(&headers, "header", "H", nil, "headers (repeatable)")
```

### Flag constraints

```go
cmd.MarkFlagRequired("output")
cmd.MarkFlagsRequiredTogether("username", "password")
cmd.MarkFlagsMutuallyExclusive("json", "yaml", "xml")
cmd.MarkFlagsOneRequired("json", "yaml")
```

## Argument validation

| Validator | Meaning |
|---|---|
| `cobra.NoArgs` | No arguments allowed |
| `cobra.ArbitraryArgs` | Any (default) |
| `cobra.MinimumNArgs(n)` / `MaximumNArgs(n)` | Minimum/maximum |
| `cobra.ExactArgs(n)` | Exact match |
| `cobra.RangeArgs(min, max)` | Range |
| `cobra.OnlyValidArgs` | Only values in `ValidArgs` allowed |
| `cobra.MatchAll(...)` | Compose multiple validators |

```go
Args: cobra.MatchAll(cobra.MinimumNArgs(1), cobra.OnlyValidArgs),
```

## Shell completion

A `completion` subcommand is **automatically generated**:

```bash
myapp completion bash > /etc/bash_completion.d/myapp
myapp completion zsh > "${fpath[1]}/_myapp"
myapp completion fish > ~/.config/fish/completions/myapp.fish
myapp completion powershell > myapp.ps1
```

### Dynamic completion

```go
cmd.ValidArgsFunction = func(cmd *cobra.Command, args []string, toComplete string) ([]cobra.Completion, cobra.ShellCompDirective) {
    return []cobra.Completion{"foo", "bar"}, cobra.ShellCompDirectiveNoFileComp
}

cmd.RegisterFlagCompletionFunc("namespace", func(cmd *cobra.Command, args []string, toComplete string) ([]cobra.Completion, cobra.ShellCompDirective) {
    return listNamespaces(), cobra.ShellCompDirectiveNoFileComp
})
```

### `ShellCompDirective`

| Constant | Meaning |
|---|---|
| `ShellCompDirectiveDefault` | Shell default (includes file completion) |
| `ShellCompDirectiveNoFileComp` | Disable file completion |
| `ShellCompDirectiveNoSpace` | Don't append a space after completion |
| `ShellCompDirectiveFilterFileExt` | Filter by file extension |
| `ShellCompDirectiveFilterDirs` | Directories only |
| `ShellCompDirectiveKeepOrder` | Preserve order |

Can be combined with bitwise OR. For debugging use `cobra.CompDebug()` / `cobra.CompError()` (stdout cannot be used since it's interpreted by the completion script).

v1.9+ adds the `CompletionFunc` type / `CompletionWithDesc` helper, letting completion candidates include descriptions.

## Help / version

```go
rootCmd.Version = "1.2.3"
rootCmd.SetVersionTemplate("{{.Name}} {{.Version}}\n")
rootCmd.SetHelpTemplate(...)
rootCmd.SetUsageTemplate(...)
```

Setting `Version` automatically adds a `--version` flag. `--help` / `-h` is always automatic.

## Viper integration

Unifies precedence across config file + environment variables + flags. Precedence (high → low): explicit flag > environment variable > config file > Viper default.

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

## Error handling

```go
var rootCmd = &cobra.Command{
    Use:           "myapp",
    SilenceUsage:  true,   // don't print Usage on error
    SilenceErrors: true,   // suppress automatic error output (handle it yourself)
    RunE: func(cmd *cobra.Command, args []string) error {
        if err := doWork(); err != nil {
            return fmt.Errorf("work failed: %w", err)
        }
        return nil
    },
}

func main() { cobra.CheckErr(rootCmd.Execute()) }
```

If `err` is non-nil, `cobra.CheckErr(err)` prints `"Error: ..."` to stderr and calls `os.Exit(1)`.

## Architecture patterns

### Recommended layout

```text
myapp/
├── cmd/                # Cobra command definitions
│   ├── root.go
│   └── serve.go
├── internal/           # Domain logic (no Cobra dependency)
│   ├── server/
│   └── config/
├── main.go             # Just calls cmd.Execute()
└── go.mod
```

### DI pattern

```go
func NewRootCmd(deps Deps) *cobra.Command {
    cmd := &cobra.Command{Use: "myapp"}
    cmd.AddCommand(newServeCmd(deps))
    return cmd
}
```

### Testing pattern

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

> **Important**: `SetOut` / `SetErr` only apply to **Cobra's `cmd.Print*` family**. `fmt.Println` writes directly to stdout and cannot be captured, so within handlers use `cmd.OutOrStdout()` / `cmd.ErrOrStderr()` or `fmt.Fprintln(cmd.OutOrStdout(), ...)`.

## Common mistakes made by AI agents

1. **Writing `fmt.Println` directly inside `Run`** — cannot be captured by `SetOut` during tests. Use `cmd.Println(...)` or `fmt.Fprintln(cmd.OutOrStdout(), ...)`
2. **Calling `os.Exit` inside `Run` on error** — makes it untestable. Return the error from `RunE` and call `cobra.CheckErr` in `main`
3. **Not setting `SilenceUsage` / `SilenceErrors`** — produces an overly long Usage dump on error. For CLI tools, setting both to `true` is the standard practice
4. **Confusing Persistent and Local flags** — use `PersistentFlags()` for flags that should propagate to children, `Flags()` for flags scoped to the current command only
5. **Using Viper without `BindPFlag`** — `viper.GetString(...)` alone won't read the PFlag's value
6. **Forgetting to call `MarkFlagRequired`** — the flag must be defined before calling `MarkFlagRequired`. Do this inside `init()`
7. **Relying on a static `ValidArgs` list for shell completion** — use `ValidArgsFunction` for dynamic values (e.g. a resource list) and `RegisterFlagCompletionFunc` for flag values

## References

- [User Guide](https://github.com/spf13/cobra/blob/main/site/content/user_guide.md)
- [Shell Completions](https://github.com/spf13/cobra/blob/main/site/content/completions/_index.md)
- [pkg.go.dev](https://pkg.go.dev/github.com/spf13/cobra)
- [cobra-cli](https://github.com/spf13/cobra-cli)
- [Releases](https://github.com/spf13/cobra/releases)
