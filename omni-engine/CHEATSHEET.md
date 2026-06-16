# 🪪 Omni-Engine Cheat Sheet (keep this next to the computer)

## Every morning — one button
- **Mac:** double-click **`run.command`**
- **Windows:** double-click **`run.bat`**
- It runs everything and opens **today's board**.

Then open: **`daily/travis-follow-up-board.md`** → start at the top.
- 📞 First Call → who to call first + exact opening line
- ✅ Must Contact Today
- 🛑 Deals to Kill (skip these)
- 🤝 New Matches (land + builder + money)

## After a call — tell the robot (so it remembers)
Type what you remember, OR record it.

**Type/paste notes:**
```
node conversation/src/logCall.js --contact "Squeezed Homes LLC" --type builder --text "He has 3 specs sitting, short on lots, follow up next week"
```

**Record it (phone or computer):**
1. Open **`conversation/src/recorder.html`** in a browser → Start → Stop → Download.
2. Then:
```
node conversation/src/logCall.js --contact "Squeezed Homes LLC" --type builder --audio omni-call.webm --save-transcript
```

`--type` is one of: `builder` · `landowner` · `investor` · `engineer` · `title` · `banker`

The robot writes the summary, the pain, and the next follow-up into that person's
memory file — and surfaces them again on the right day.

## When a deal is real — make the paperwork
```
echo '{ "seller":{"name":"Jane Heir"}, "assignee":{"name":"Squeezed Homes LLC"}, "property":{"address":"123 Vine St","parcelId":"INFILL1"}, "netToSeller":60000, "finderFee":10000, "play":"Margin Squeeze" }' | node contracts/src/cli.js --out ./deals
```

## One-time setup (to use real KC data)
Find each county's real field names (run on your computer or via Claude in Chrome):
```
node tools/discover-fields.js --url "https://gis.mijackson.org/countygis/rest/services/ParcelViewer/Parcels/MapServer/0/query"
```
Paste the suggested field names into your config. (Base service URLs are in `config/county-sources.json`.)

## Smarter summaries (optional)
Set these once and the robot uses Claude (better) instead of the basic summarizer:
- `ANTHROPIC_API_KEY` → Claude summarizes your notes
- `OPENAI_API_KEY` → transcribes your audio recordings
Without them, everything still works with the built-in offline summarizer.
