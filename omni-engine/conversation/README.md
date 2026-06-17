# Conversation Capture

> You can't remember every detail of a call. This does. Record or type what
> happened, and the robot summarizes the important parts and files them into the
> contact's memory — so tomorrow's board is smarter.

```
notes / audio  ─▶  (transcribe)  ─▶  summarize  ─▶  relationship memory (append-only)
                    Whisper           Claude / heuristic    contacts/**.md + next follow-up
```

## Log a call

```bash
# typed / pasted notes
node src/logCall.js --contact "Squeezed Homes LLC" --type builder \
  --text "3 specs sitting 70+ days, short on lots, hesitant on price. Follow up next week."

# from a notes file
node src/logCall.js --contact "Jane Heir" --type landowner --file notes.txt

# from an audio recording (needs OPENAI_API_KEY for transcription)
node src/logCall.js --contact "Squeezed Homes LLC" --audio call.webm --save-transcript

# force the offline summarizer (no API key)
node src/logCall.js --contact "..." --text "..." --heuristic
```

It writes an **append-only** dated conversation block to the contact's memory
file, sets `currentPain` and the next follow-up date, and (with
`--save-transcript`) drops the raw transcript in a git-ignored `transcripts/`
sidecar.

## Recording

Open **`src/recorder.html`** in any browser (works on a phone): Start → Stop →
Download. Nothing is uploaded — the audio file stays on your device. Then run
`logCall.js --audio <file>`.

## Two summarizers

| | Engine | Needs | Quality |
|--|--------|-------|---------|
| Default when key present | **Claude** (`claude-opus-4-8`) | `ANTHROPIC_API_KEY` | Best — structured extraction |
| Always-available fallback | **Heuristic** (rule-based, offline) | nothing | Good — captures summary, pain, objections, next action, follow-up date |

Audio transcription uses **Whisper** (`OPENAI_API_KEY`) because Claude doesn't do
speech-to-text; the transcript is then summarized by Claude. Set the model with
`OMNI_MODEL` (defaults to `claude-opus-4-8`).

## Extracted fields

`summary`, `painLearned`, `opportunity`, `objections`, `personal`,
`followUpPromised`, `nextAction`, `nextFollowUpDate`.

Stored summaries pass the **trust-first language** scrubber (banned/hype terms are
rewritten) so the memory files stay compliant; the raw transcript sidecar keeps
your verbatim words.

```bash
npm test    # 26 passing (offline heuristic + memory write + append-only)
```
