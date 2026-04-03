---
name: summon_translator
description: Translate any file (JSON, XLIFF, Markdown, .strings, .po, and more) into one or more languages using Summon Translator AI. Supports Claude, GPT-4o, Gemini, and DeepSeek. Pay-as-you-go.
version: 1.0.0
author: Summon Translator <support@summontranslator.com>
homepage: https://summontranslator.com
pricing: pay-as-you-go — $0.007/word + AI cost, $5 minimum/job
auth: bearer_token
metadata:
  openclaw:
    requires:
      config:
        - SUMMON_API_KEY
---

# Summon Translator Skill

Use this skill when the user wants to translate a file to one or more languages.

## Prerequisites

1. Create an account at https://summontranslator.com
2. Add a payment method at https://summontranslator.com/billing
3. Generate an API key at https://summontranslator.com/account
4. Set the environment variable: `SUMMON_API_KEY=st_live_<your-key>`

## Verify your key is working

```bash
curl -s https://summontranslator.com/api/v1/ping \
  -H "Authorization: Bearer $SUMMON_API_KEY"
```

Expected response: `{"ok":true,"version":"1",...}`

---

## translate_file — Translate a local file

Use this command when the user asks to translate a file.

Parameters:
- `file_path` — path to the file on disk (required)
- `target_languages` — comma-separated BCP-47 codes, e.g. `ja-JP,fr-FR,de-DE` (required)
- `model` — AI model to use (optional, default: `claude-haiku-4-5-20251001`)
- `provider` — `anthropic` | `openai` | `gemini` | `deepseek` (optional, inferred from model)
- `source_language` — source language BCP-47 code (optional, default: `en-US`)
- `output_dir` — directory to save translated files (optional, default: same dir as input)

### Step 1 — Submit the translation job

```bash
curl -s -X POST https://summontranslator.com/api/v1/jobs \
  -H "Authorization: Bearer $SUMMON_API_KEY" \
  -F "file=@{file_path}" \
  -F "provider={provider}" \
  -F "model={model}" \
  -F "targetLanguages={target_languages}" \
  -F "sourceLanguage={source_language}" \
  -F "name=$(basename {file_path})"
```

Save the `jobId` from the response.

### Step 2 — Poll for completion

```bash
curl -s https://summontranslator.com/api/v1/jobs/{jobId} \
  -H "Authorization: Bearer $SUMMON_API_KEY"
```

Repeat every 15 seconds until `status` is `"completed"` or `"failed"`.
Each task in the `tasks` array shows per-language progress.

### Step 3 — Download each translated file

For each completed task, use the `downloadUrl` from the poll response:

```bash
curl -s -L -o "{output_dir}/{taskId}.{ext}" \
  -H "Authorization: Bearer $SUMMON_API_KEY" \
  "{downloadUrl}"
```

Or use the explicit URL:

```bash
curl -s -L -o "{output_dir}/{language}.{ext}" \
  -H "Authorization: Bearer $SUMMON_API_KEY" \
  "https://summontranslator.com/api/v1/jobs/{jobId}/tasks/{taskId}/download"
```

---

## check_job — Check translation status

Use when the user wants to check the status of a previously submitted job.

```bash
curl -s https://summontranslator.com/api/v1/jobs/{job_id} \
  -H "Authorization: Bearer $SUMMON_API_KEY"
```

---

## list_jobs — List recent translation jobs

```bash
curl -s "https://summontranslator.com/api/v1/jobs?limit=10" \
  -H "Authorization: Bearer $SUMMON_API_KEY"
```

---

## Supported file formats

| Extension | Format |
|---|---|
| .json | JSON key-value (nested supported) |
| .xliff / .xlf | XLIFF 1.2 bilingual files |
| .csv | CSV (id, value columns) |
| .md | Markdown (preserves code blocks) |
| .txt | Plain text |
| .strings | iOS/macOS Localizable.strings |
| .stringsdict | iOS/macOS plural rules |
| .xcstrings | Xcode String Catalog |
| .po | GNU gettext |
| .xml | Android string resources |
| .arb | Flutter ARB |
| .properties | Java resource bundles |

## Supported models

| Model ID | Provider | Quality | Cost |
|---|---|---|---|
| claude-sonnet-4-6 | anthropic | Highest | $$$ |
| claude-haiku-4-5-20251001 | anthropic | High | $ |
| gpt-4o | openai | Highest | $$$ |
| gpt-4o-mini | openai | Good | $ |
| gemini-2.0-flash | gemini | Good | $ |
| deepseek-chat | deepseek | Good | $ |

Recommended default: `claude-haiku-4-5-20251001` — fast and affordable.

## Common target language codes

`ja-JP` `zh-CN` `zh-TW` `ko-KR` `fr-FR` `de-DE` `es-ES` `pt-BR`
`it-IT` `nl-NL` `ar-SA` `th-TH` `vi-VN` `hi-IN` `sv-SE` `pl-PL`

## Pricing

- $0.007 per source word (platform fee)
- Plus AI model cost × 5 markup
- $5.00 minimum per job
- Billed monthly to card on file
- First 1,000 words free: use promo code `1TIME` by adding `-F "promoCode=1TIME"` to the job creation call

## Support

Email: support@summontranslator.com
API docs: https://summontranslator.com/llms.txt
