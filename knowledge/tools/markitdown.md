---
reviewed: 2026-05-04
tags: [data-cli, python, markdown]
---

# MarkItDown

Microsoft 製の Python ユーティリティ。PDF / Office / 画像 / 音声 / HTML / CSV / JSON / XML / ZIP / EPub / YouTube URL などを Markdown に変換する。LLM への取り込み（RAG・コンテキストウィンドウ投入）を主目的に設計されており、トークン効率とドキュメント構造保持を両立する。AI エージェントが「PDF を読ませたい」「画像の中の文字を渡したい」場面で第一候補になる。

公式: [microsoft/markitdown](https://github.com/microsoft/markitdown)

## インストール

> Python 3.10 以上が必要 (`requires-python = ">=3.10"`)。

```bash
# 全フォーマット対応（推奨）
pip install 'markitdown[all]'

# サブセット
pip install 'markitdown[pdf,docx,pptx]'

# uv 経由（隔離・PATH 自動）
uv tool install 'markitdown[all]'
uvx markitdown file.pdf      # ワンショット実行

# pipx
pipx install 'markitdown[all]'
```

`[all]` は依存が多い（OCR の `tesseract`、音声書き起こしの `whisper` 等）。CI で軽くしたいなら必要な extras だけ入れる。

### extras 一覧

| extras | 対応フォーマット |
|---|---|
| `pdf` | PDF |
| `docx` | Word |
| `pptx` | PowerPoint |
| `xlsx` / `xls` | Excel |
| `outlook` | Outlook .msg |
| `audio-transcription` | 音声 → テキスト（whisper） |
| `youtube-transcription` | YouTube 字幕取得 |
| `az-doc-intel` | Azure Document Intelligence 統合 |

## CLI 使用

```bash
markitdown report.pdf > report.md
markitdown deck.pptx -o deck.md
markitdown image.png > image.md           # OCR + EXIF
markitdown https://youtu.be/<id> > video.md

# プラグイン有効化
markitdown --use-plugins file.docx

# Azure Document Intelligence
markitdown -d -e https://<endpoint>.cognitiveservices.azure.com/ scan.pdf
```

stdin / stdout でパイプ可能なので、AI エージェントのツールチェインに組み込みやすい。

## Python API

```python
from markitdown import MarkItDown

md = MarkItDown(enable_plugins=False)
result = md.convert("report.pdf")
print(result.text_content)        # Markdown 本体
print(result.title)               # 抽出タイトル（あれば）
```

LLM で画像説明を生成したい場合:

```python
from openai import OpenAI
from markitdown import MarkItDown

client = OpenAI()
md = MarkItDown(llm_client=client, llm_model="gpt-4o")
result = md.convert("diagram.png")    # 画像の説明文を Markdown に含める
```

OpenAI 互換クライアント（OpenAI / Azure OpenAI / OpenRouter / Ollama 等）を渡せば、画像認識を任意モデルに委譲できる。

## 対応フォーマット

| 種別 | 入力 | 抽出される内容 |
|---|---|---|
| PDF | `.pdf` | 本文 / 表 / メタデータ。Azure Doc Intel 連携で複雑レイアウト対応 |
| Word | `.docx` | 見出し / 表 / リスト / コメント |
| PowerPoint | `.pptx` | スライドテキスト / ノート / 表 |
| Excel | `.xlsx` / `.xls` | 各シートを Markdown 表として |
| 画像 | `.png` / `.jpg` / `.tiff` | EXIF + OCR（tesseract）+ LLM による説明 |
| 音声 | `.mp3` / `.wav` / `.m4a` | 書き起こし（whisper） |
| HTML | `.html` / `.htm` | 構造保持して Markdown 化 |
| 表形式 | `.csv` / `.tsv` | Markdown 表 |
| 構造化 | `.json` / `.xml` | コードブロック内に整形 |
| アーカイブ | `.zip` / `.epub` | 中身を再帰的に変換 |
| Web | YouTube URL | 字幕 + メタデータ |
| Outlook | `.msg` | 件名・本文・添付情報 |

## OCR を伴う画像処理

```bash
# tesseract 必須
brew install tesseract tesseract-lang     # macOS
sudo apt-get install tesseract-ocr tesseract-ocr-jpn   # Ubuntu

markitdown scan.png > scan.md
```

日本語 OCR は `tesseract-ocr-jpn` が必要。bootstrap が同梱しているのはこの理由。

## Azure Document Intelligence 連携

ローカル `pdfminer` ベースだと崩れる「複数段組 PDF」「画像内の表」は Azure Document Intelligence で精度が大きく上がる:

```bash
markitdown -d -e "https://<name>.cognitiveservices.azure.com/" scan.pdf > scan.md
```

API 課金が発生するため CI で全 PDF に当てるのは避ける。LLM への投入精度が問題になったときに切り替える運用が現実的。

## プラグイン

```bash
# 例: PowerPoint の埋め込み画像を全部抽出するプラグイン（仮）
pip install markitdown-plugin-pptx-images
markitdown --use-plugins deck.pptx
```

`markitdown_plugin` という entry point group で実装する。社内独自フォーマット対応に有効。

## RAG / AI エージェント用途での使い分け

| 状況 | 推奨 |
|---|---|
| PDF / Office を 1 度きりで取り込みたい | `markitdown` CLI で十分 |
| 大量ドキュメントを継続インデックス化 | LangChain / LlamaIndex の document loader と並列化 |
| 表構造を厳密に維持 | Azure Doc Intel + markitdown |
| 機密文書 | LLM 連携をオフ（`llm_client` 渡さない）+ ローカル OCR |
| Claude Code / Codex CLI に直接渡したい | `markitdown file.pdf \| head -c 100000` で先頭だけ送るパターン |

## AI エージェントがよくやるミス

1. **`pip install markitdown` だけで extras を入れない** — PDF / DOCX が読めず「対応外フォーマット」エラー。`[all]` または該当 extras を指定
2. **画像 OCR で日本語が文字化け** — `tesseract-ocr-jpn` が未インストール。OS パッケージで追加
3. **`llm_client` に API キーを渡さず画像説明が空** — OpenAI クライアント未設定。`OPENAI_API_KEY` を環境変数に設定
4. **巨大 PDF を丸ごと LLM コンテキストに投入** — 数百ページの PDF は数百万トークンになる。チャンク化 / 抜粋を挟む
5. **stdout のバイナリ取り扱い** — Markdown は通常テキストだが、画像埋め込み Markdown を出すプラグイン使用時はバイナリ混入注意
6. **`--use-plugins` を忘れる** — プラグインインストール済みでもデフォルト無効
7. **`whisper` で 1 時間音声を 1 ファイルで処理** — メモリ枯渇。事前に `ffmpeg` で分割

## 関連

- [`languages/python.md`](../languages/python.md) — 実行環境
- [`tools/uv.md`](uv.md) — `uv tool install` で隔離インストール
- [`platforms/docker.md`](../platforms/docker.md) — tesseract / whisper を含むイメージで再現性確保

## 参考

- [microsoft/markitdown](https://github.com/microsoft/markitdown)
- [Azure Document Intelligence](https://learn.microsoft.com/azure/ai-services/document-intelligence/)
- [tesseract-ocr](https://github.com/tesseract-ocr/tesseract)
- [whisper](https://github.com/openai/whisper)
