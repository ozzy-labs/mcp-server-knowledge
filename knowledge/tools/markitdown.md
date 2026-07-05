---
reviewed: 2026-05-04
tags: [data-cli, python, markdown]
---

# MarkItDown

A Python utility from Microsoft that converts PDF / Office / images / audio / HTML / CSV / JSON / XML / ZIP / EPub / YouTube URLs into Markdown. It is designed primarily for ingestion into LLMs (RAG, context window insertion), balancing token efficiency with preservation of document structure. It's the go-to choice for AI agents when facing "I want to feed a PDF" or "I want to pass text from inside an image" scenarios.

Official: [microsoft/markitdown](https://github.com/microsoft/markitdown)

## Installation

> Requires Python 3.10 or higher (`requires-python = ">=3.10"`).

```bash
# Support for all formats (recommended)
pip install 'markitdown[all]'

# Subset
pip install 'markitdown[pdf,docx,pptx]'

# Via uv (isolated, auto PATH)
uv tool install 'markitdown[all]'
uvx markitdown file.pdf      # one-shot execution

# pipx
pipx install 'markitdown[all]'
```

`[all]` pulls in many dependencies (`tesseract` for OCR, `whisper` for audio transcription, etc.). Install only the extras you need if you want to keep CI lightweight.

### Extras list

| Extra | Supported format |
|---|---|
| `pdf` | PDF |
| `docx` | Word |
| `pptx` | PowerPoint |
| `xlsx` / `xls` | Excel |
| `outlook` | Outlook .msg |
| `audio-transcription` | Audio → text (whisper) |
| `youtube-transcription` | YouTube caption retrieval |
| `az-doc-intel` | Azure Document Intelligence integration |

## CLI usage

```bash
markitdown report.pdf > report.md
markitdown deck.pptx -o deck.md
markitdown image.png > image.md           # OCR + EXIF
markitdown https://youtu.be/<id> > video.md

# Enable plugins
markitdown --use-plugins file.docx

# Azure Document Intelligence
markitdown -d -e https://<endpoint>.cognitiveservices.azure.com/ scan.pdf
```

It can be piped via stdin/stdout, making it easy to embed in an AI agent's toolchain.

## Python API

```python
from markitdown import MarkItDown

md = MarkItDown(enable_plugins=False)
result = md.convert("report.pdf")
print(result.text_content)        # Markdown body
print(result.title)               # extracted title (if any)
```

To have an LLM generate image descriptions:

```python
from openai import OpenAI
from markitdown import MarkItDown

client = OpenAI()
md = MarkItDown(llm_client=client, llm_model="gpt-4o")
result = md.convert("diagram.png")    # include the image description in the Markdown
```

By passing an OpenAI-compatible client (OpenAI / Azure OpenAI / OpenRouter / Ollama, etc.), you can delegate image recognition to any model.

## Supported formats

| Type | Input | Extracted content |
|---|---|---|
| PDF | `.pdf` | Body text / tables / metadata. Complex layouts supported via Azure Doc Intel integration |
| Word | `.docx` | Headings / tables / lists / comments |
| PowerPoint | `.pptx` | Slide text / notes / tables |
| Excel | `.xlsx` / `.xls` | Each sheet as a Markdown table |
| Image | `.png` / `.jpg` / `.tiff` | EXIF + OCR (tesseract) + LLM-generated description |
| Audio | `.mp3` / `.wav` / `.m4a` | Transcription (whisper) |
| HTML | `.html` / `.htm` | Converted to Markdown while preserving structure |
| Tabular | `.csv` / `.tsv` | Markdown table |
| Structured | `.json` / `.xml` | Formatted inside a code block |
| Archive | `.zip` / `.epub` | Contents converted recursively |
| Web | YouTube URL | Captions + metadata |
| Outlook | `.msg` | Subject, body, attachment info |

## Image processing with OCR

```bash
# tesseract required
brew install tesseract tesseract-lang     # macOS
sudo apt-get install tesseract-ocr tesseract-ocr-jpn   # Ubuntu

markitdown scan.png > scan.md
```

Japanese OCR requires `tesseract-ocr-jpn`. This is why bootstrap bundles it.

## Azure Document Intelligence integration

For cases where a local `pdfminer`-based approach breaks down — "multi-column PDFs" or "tables embedded in images" — Azure Document Intelligence significantly improves accuracy:

```bash
markitdown -d -e "https://<name>.cognitiveservices.azure.com/" scan.pdf > scan.md
```

Since this incurs API charges, avoid applying it to every PDF in CI. A more realistic approach is to switch to it when LLM ingestion accuracy becomes an issue.

## Plugins

```bash
# Example: a plugin (hypothetical) that extracts all embedded images from a PowerPoint file
pip install markitdown-plugin-pptx-images
markitdown --use-plugins deck.pptx
```

Implemented via an entry point group called `markitdown_plugin`. Useful for supporting proprietary internal formats.

## Choosing an approach for RAG / AI agent use cases

| Situation | Recommendation |
|---|---|
| One-off ingestion of a PDF / Office document | The `markitdown` CLI is sufficient |
| Continuous indexing of large volumes of documents | Parallelize with a LangChain / LlamaIndex document loader |
| Strict preservation of table structure | Azure Doc Intel + markitdown |
| Confidential documents | Turn off LLM integration (don't pass `llm_client`) + local OCR |
| Passing directly to Claude Code / Codex CLI | Pattern of sending only the head with `markitdown file.pdf \| head -c 100000` |

## Common mistakes AI agents make

1. **Running `pip install markitdown` alone, without extras** — PDF / DOCX can't be read, causing an "unsupported format" error. Specify `[all]` or the relevant extras
2. **Japanese text becomes garbled during image OCR** — `tesseract-ocr-jpn` isn't installed. Add it via the OS package manager
3. **Image descriptions come back empty because no API key was passed to `llm_client`** — the OpenAI client isn't configured. Set `OPENAI_API_KEY` as an environment variable
4. **Feeding an entire huge PDF into the LLM context** — a several-hundred-page PDF can amount to millions of tokens. Insert chunking / excerpting
5. **Handling of binary data on stdout** — Markdown output is normally text, but watch for binary content mixed in when using plugins that emit Markdown with embedded images
6. **Forgetting `--use-plugins`** — plugins are disabled by default even when installed
7. **Processing a 1-hour audio file with `whisper` as a single file** — leads to memory exhaustion. Split it beforehand with `ffmpeg`

## Related

- [`languages/python/python.md`](../languages/python/python.md) — runtime environment
- [`languages/python/uv.md`](../languages/python/uv.md) — isolated installation via `uv tool install`
- [`platforms/docker/docker.md`](../platforms/docker/docker.md) — ensuring reproducibility with an image that includes tesseract / whisper

## References

- [microsoft/markitdown](https://github.com/microsoft/markitdown)
- [Azure Document Intelligence](https://learn.microsoft.com/azure/ai-services/document-intelligence/)
- [tesseract-ocr](https://github.com/tesseract-ocr/tesseract)
- [whisper](https://github.com/openai/whisper)
