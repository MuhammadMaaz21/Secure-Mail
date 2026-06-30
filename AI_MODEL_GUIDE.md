# AI Threat Detection — How It Works

This document explains the **Artificial Intelligence** used in the UOL Secure
Email System to detect spam, phishing and scam emails. It is written so that
anyone reading it understands **which models are used, how they are integrated,
and how the detection works** — no prior AI knowledge required.

---

## 1. What problem does the AI solve?

Earlier, the system decided whether an email was spam/phishing by checking for
**hardcoded keywords** (e.g. the word "lottery" or "verify your account"). This
is weak — it misses anything not on the list and is easily fooled.

This has been replaced with **real, pre-trained AI models** that understand the
**meaning** of the email text and decide whether it is harmful. No keyword lists
are used to make the decision anymore.

Key facts:

| Property | Value |
|---|---|
| Type | Pre-trained transformer (neural network) text classifiers |
| Runs | **Locally**, inside the Node.js backend — no cloud, no API key |
| Privacy | Email text **never leaves the server** — nothing is sent to the internet |
| Library | [`@xenova/transformers`](https://www.npmjs.com/package/@xenova/transformers) (transformers.js) running ONNX models |
| Training | **None by us** — we use existing public models from Hugging Face |
| Offline | Works fully offline after the models are present on disk |

---

## 2. Which models are used?

Two small, specialised models are downloaded from Hugging Face and run together:

### Model 1 — Phishing / scam detector (main safety model)
- **ID:** `onnx-community/bert-finetuned-phishing-ONNX`
- **Type:** BERT fine-tuned for phishing detection
- **Output labels:** `benign` / `phishing`
- **Trained on:** phishing & legitimate emails, URLs and messages
- **Role:** the main "is this dangerous?" decision. It reliably flags phishing,
  scams and malicious content.

### Model 2 — Spam detector (label refinement)
- **ID:** `onnx-community/tanaos-spam-detection-v1-ONNX`
- **Type:** transformer fine-tuned for spam detection
- **Output labels:** `not_spam` / `spam`
- **Role:** helps decide whether a harmful email should be labelled **spam**
  (junk/promotional) vs **phishing** (dangerous).

Both models are stored on disk inside **`backend/.models/`** so they only ever
download once. (In this client package they are **already included**, so the app
works offline out of the box.)

---

## 3. How the detection works (step by step)

```
   Email is sent
        │
        ▼
 ┌─────────────────────────────────────────────┐
 │  analyzeEmailAI(subject, body)               │   backend/src/utils/aiClassifier.js
 │  combines subject + body into one text       │
 └─────────────────────────────────────────────┘
        │                         │
        ▼                         ▼
 Model 1 (phishing)        Model 2 (spam)
 → phishingProb (0–1)      → spamProb (0–1)
        │                         │
        └────────────┬────────────┘
                     ▼
        Decision logic (phishing has priority):
          • phishingProb ≥ 0.50  → classification = "phishing"
          • else spamProb ≥ 0.50 → classification = "spam"
          • else max ≥ 0.35      → threat = "suspicious"
          • else                 → "safe" (inbox, or "important")
                     │
                     ▼
        Result stored on the email:
          { threatLevel, confidence, details, spamProbability, classification }
                     │
                     ▼
        The email controller routes it:
          phishing / spam  → recipient's SPAM folder + warning badge
          safe             → recipient's INBOX
```

**Why phishing has priority:** under-warning a real phishing email (treating it
as harmless) is far more dangerous than over-warning ordinary junk mail, so if
the phishing model is confident, that decision wins.

---

## 4. Where the code lives

| File | Purpose |
|---|---|
| `backend/src/utils/aiClassifier.js` | **The AI engine.** Loads both models, runs them, combines the scores. |
| `backend/src/utils/aiAnalysis.js` | **Fallback** simple analyzer, used only if the AI models fail to load. |
| `backend/src/controllers/emailController.js` | Calls `analyzeEmailAI()` when an email is sent and routes it to the right folder. |
| `backend/.models/` | The downloaded AI model files (cached, used offline). |
| `backend/scripts/downloadAiModels.js` | `npm run setup:ai` — pre-downloads the models. |
| `backend/scripts/testAiClassifier.js` | `npm run test:ai` — quick test that the AI is working. |

---

## 5. How to verify the AI is working

From inside the **`backend`** folder run:

```bash
npm run test:ai
```

Expected output (verdicts for known phishing/spam/safe samples):

```
✅ [expected: harmful got: harmful] phishing/phishing  conf:100%  src:ai-model
✅ [expected: harmful got: harmful] phishing/phishing  conf:100%  src:ai-model
...
✅ [expected: safe    got: safe   ] inbox/safe         conf:100%  src:ai-model

Score: 7/7 correct.
Detection engine: REAL AI MODEL ✅
```

- `src:ai-model`  → the real AI is running. ✅
- `src:heuristic-fallback` → the AI models did not load (see below).

---

## 6. If the models need to be (re)downloaded

The models are already included in `backend/.models/`. If that folder is ever
missing or you want to re-download, run from the **`backend`** folder:

```bash
npm run setup:ai
```

This downloads both models once (~450 MB total) and caches them. Internet is
required only for this one-time download.

> If you are on a network with a security proxy and the download fails with a
> certificate error, run it once as:
> `NODE_TLS_REJECT_UNAUTHORIZED=0 npm run setup:ai`

---

## 7. Fallback behaviour (the app never breaks)

If the AI models cannot be loaded for any reason, the system automatically falls
back to the older simple analyzer (`aiAnalysis.js`) so that **sending email keeps
working**. You can tell which engine was used from the `source` field
(`ai-model` vs `heuristic-fallback`) shown by `npm run test:ai`.
