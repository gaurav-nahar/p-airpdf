# GPU Summary Service

This folder contains a standalone FastAPI service for PDF summarization using your own Qwen model on a GPU machine.

## What it does

- Supports either local `ollama` models or `transformers` models
- Accepts extracted PDF text over HTTP
- Produces a structured markdown summary instead of a plain paragraph
- Handles longer PDFs by chunking first and combining into one final summary

## API

### `GET /health`

Returns service status, model info, and whether CUDA is available.

### `POST /summarize`

Request:

```json
{
  "text": "full extracted pdf text"
}
```

Response:

```json
{
  "summary": "# PDF Summary\n...",
  "chunks_used": 3,
  "model": "/models/Qwen2.5-7B-Instruct"
}
```

## Setup on your GPU server

1. Create and activate a virtual environment.
2. Install the dependencies:

```bash
cd summary
pip install -r requirements.txt
```

3. Copy `.env.example` to `.env`.
4. If you are using Ollama, make sure `ollama serve` is running and your model appears in `ollama list`.
5. Start the service:

```bash
cd summary
uvicorn app:app --host 0.0.0.0 --port 8010
```

## Important environment variables

- `SUMMARY_PROVIDER`: `ollama` or `transformers`
- `SUMMARY_PORT`: API port, default `8010`
- `OLLAMA_BASE_URL`: Usually `http://127.0.0.1:11434`
- `OLLAMA_MODEL`: Example `qwen2.5:14b`
- `SUMMARY_MODEL_NAME_OR_PATH`: Used only when `SUMMARY_PROVIDER=transformers`
- `SUMMARY_DEVICE_MAP`: Usually `auto`
- `SUMMARY_MODEL_DTYPE`: `auto`, `float16`, `bfloat16`, or `float32`
- `SUMMARY_MAX_SOURCE_CHARS`: Safety cap for very long PDFs
- `SUMMARY_CHUNK_TARGET_CHARS`: Chunk size before the service does a second-pass merge

## Ollama setup

Use this if `ollama list` already shows your models.

```env
SUMMARY_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:14b
SUMMARY_HOST=0.0.0.0
SUMMARY_PORT=8010
```

Then run:

```bash
ollama serve
uvicorn app:app --host 0.0.0.0 --port 8010
```

## Keep it running after closing PuTTY

Use `systemd` on the GPU machine so the service keeps running after logout and after reboot.

1. Copy [summary.service](/home/gaurav/liquidtext_clone/liquid-text/summary/summary.service#L1) to `/etc/systemd/system/summary.service`
2. Adjust the `User`, `WorkingDirectory`, `EnvironmentFile`, and `ExecStart` paths if your server paths are different
3. Enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable summary
sudo systemctl start summary
sudo systemctl status summary
```

If you also run Ollama locally on that machine, make sure `ollama serve` is running as a service too.

## Transformers setup

Use this only if you have an actual Hugging Face model folder on disk.

```env
SUMMARY_PROVIDER=transformers
SUMMARY_MODEL_NAME_OR_PATH=/absolute/path/to/your/model-folder
SUMMARY_HOST=0.0.0.0
SUMMARY_PORT=8010
```

For a local model path, use the full absolute path beginning with `/`.

## Connect it to the main backend

In `liquid-text/backend`, set:

```env
SUMMARY_SERVICE_URL=http://YOUR_GPU_SERVER:8010/summarize
```

The existing frontend can continue calling `POST /pdfs/summarize` exactly as before.
