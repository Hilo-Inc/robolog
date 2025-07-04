🚀Usage

docker compose pull   # fetch ollama & fluent‑bit
ollama pull gemma:3n  # optional: pre‑pull model locally
docker compose up -d  # spin up full stack

Within ~1 minute the analyzer will start posting critical summaries to your Discord channel.

🛠️Tuning

Adjust FILTER in analyze.js (regex) or extend logic for severity levels.

Change POLL_MS for faster or slower cadence.

Modify fluent-bit.conf outputs (Elastic, Loki, etc.) for full observability.

Enjoy hands‑free LLM‑powered ops monitoring!  🎉

Great! Here are a few quick ways to confirm that **`analyze.js`** is really talking to Gemma through Ollama:

| What to check                         | How to do it                                                                                                                                                                                       | What you should see                                                                                      |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **1. Watch the analyzer’s stdout**    | `bash docker compose logs -f analyzer `                                                                                                                                                            | A line every 60 s similar to:<br>`Analyzer pulled X log lines…` or, on errors, stack traces.             |
| **2. See Ollama’s request log**       | `bash docker compose logs -f ollama `                                                                                                                                                              | Entries like:<br>`/api/generate 200 … model=gemma:3n` whenever the analyzer calls `/api/generate`.       |
| **3. Tail Discord** (if webhook set)  | Open the Discord channel you supplied.                                                                                                                                                             | Messages that start with **“⚠️ Gemma summary:”**—they’re posted only after a successful Ollama response. |
| **4. Force a test event**             | `bash docker compose exec app bash -c 'echo \"ERROR test message\" >&2' `<br>(writes to the app’s stdout → Fluent Bit → analyzer).                                                                 | Within the next minute the analyzer should pick up the line, call Gemma, and post a summary.             |
| **5. Inspect analyzer’s last prompt** | `bash docker compose exec analyzer tail -n 20 /tmp/last_prompt.txt `<br>(Add `fs.writeFileSync('/tmp/last_prompt.txt', prompt)` at the end of **summarize()** if you want to capture each prompt.) | You’ll see the full text that was just sent to Gemma along with the disk/memory report.                  |

### One-liner to watch both containers side-by-side

```bash
docker compose logs -f --tail=20 analyzer ollama
```

*(Ctrl-C to stop following)*

### If nothing shows up

1. **Is the log filter too strict?**
   Change the regex in `analyze.js` to something broader (e.g. `/./`) and rebuild:

   ```bash
   docker compose build analyzer
   docker compose up -d
   ```

2. **Confirm environment variables**

   ```bash
   docker compose exec analyzer printenv | grep OLLAMA_URL
   ```

   Should output `http://ollama:11434`.

3. **Manual curl from inside analyzer**

   ```bash
   docker compose exec analyzer sh
   /usr/src/app # apk add --no-cache curl      # (tiny if needed)
   /usr/src/app # curl -s http://ollama:11434/api/generate \
       -H 'Content-Type: application/json' \
       -d '{"model":"gemma:3n","prompt":"Hello","stream":false}'
   ```

   You should get a JSON response with `response: "Hello …"`.

Once you see traffic in **both** the analyzer and Ollama logs—or summaries arriving in Discord—you’ve confirmed the pipeline is working end-to-end. 🚀

Here are three quick “smoke tests” you can run right now. Each one writes a line that matches the analyzer’s filter (`ERROR | CRIT | WARN`), so you’ll see:

* the line appear in **Fluent Bit’s** `/logs/all.log`
* a minute later the **analyzer** calls Gemma through Ollama
* (optionally) the summary lands in your Discord webhook

---

## 1 · Fire an error from the Node app

```powershell
# open a shell in the app container
docker compose exec app bash

# inside the container – write an ERROR to stdout
echo "ERROR test – something went wrong at $(date)" >&2

exit
```

*Why it works:*
`echo … >&2` writes to **stderr** → captured by Docker → Fluent Bit tails the container JSON log → saved to `/logs/all.log` (shared volume) → analyzer picks it up.

---

## 2 · Write directly into Nginx’s error log

```powershell
docker compose exec app bash -c \
  'echo "2025/07/04 19:30:00 [crit] 123#123: *1 critical failure test" >> /var/log/nginx/error.log'
```

Nginx writes under `/var/log`, which is the same path you mounted into the `logs:` volume, so this line is also tailed by Fluent Bit.

---

## 3 · Synthetic log via `logger`

If the Debian/Ubuntu image has `logger` (it usually does):

```powershell
docker compose exec app logger -p user.err "ERROR synthetic syslog test"
```

That lands in `/var/log/syslog`, again under the shared volume.

---

### Watch it happen

```bash
# in a second terminal
docker compose logs -f analyzer ollama fluent-bit
```

Typical sequence:

1. **fluent-bit** shows a “docker.\*” line for the new log entry.
2. \~0-60 s later **analyzer** prints

   ```
   Picked up 1 ERROR lines (123B)… summarising
   ```
3. **ollama** logs a `/api/generate 200 … model=gemma:3n` hit.
4. **analyzer** prints “posted to Discord” (if a webhook is set) or the summary text.

If you don’t want to wait a whole minute, temporarily drop `const POLL_MS = 60_000;` in `analyzer.js` to, say, `10_000`, rebuild the image (`docker compose build analyzer`), and restart.

---

#### Troubleshooting tips

| Symptom                                        | Check                                                                                   |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| No line appears in `/logs/all.log`             | Make sure the path you wrote to is inside `/var/log` **or** the container’s stdout/err. |
| `/logs/all.log` updates but analyzer is silent | Does the line contain `ERROR`, `CRIT`, or `WARN`? Adjust the `FILTER` regex if needed.  |
| Analyzer logs an exception talking to Ollama   | Confirm Gemma is pulled: `docker compose exec ollama ollama pull gemma:3n`              |
| Discord stays quiet                            | Verify `DISCORD_WEBHOOK_URL` is set in `.env` and that the webhook URL is valid.        |

Run any one of the commands above, tail the logs, and you’ll immediately verify the full “log → Fluent Bit → analyzer → Ollama → Discord” pipeline. 🚀
