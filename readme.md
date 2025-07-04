Here is the updated `README.md` with a new section for **Log Management & Helpful Commands**. This version preserves all existing formatting while expanding it with useful operational steps:

---

````markdown
# 🚀 Usage

```bash
docker compose pull           # fetch ollama & fluent-bit
ollama pull gemma:3n          # optional: pre‑pull model locally
docker compose up -d         # spin up full stack
````

Within \~1 minute the analyzer will start posting critical summaries to your Discord channel.

---

# 🛠️ Tuning

* Adjust `FILTER` in `analyze.js` (regex) or extend logic for severity levels.
* Change `POLL_MS` for faster or slower cadence.
* Modify `fluent-bit.conf` outputs (Elastic, Loki, etc.) for full observability.

> Enjoy hands‑free LLM‑powered ops monitoring! 🎉

---

# ✅ Verifying Analyzer <-> Ollama Communication

| What to check                         | How to do it                                                                                                                                     | What you should see                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| **1. Watch analyzer’s stdout**        | `docker compose logs -f analyzer`                                                                                                                | A line every 60s like:<br>`Analyzer pulled X log lines…` or error stack traces. |
| **2. See Ollama’s request log**       | `docker compose logs -f ollama`                                                                                                                  | Entries like:<br>`/api/generate 200 … model=gemma:3n` on each analyzer call.    |
| **3. Tail Discord**                   | Open the Discord channel you supplied.                                                                                                           | Messages that start with **“⚠️ Gemma summary:”** from successful summaries.     |
| **4. Force a test event**             | `docker compose exec app bash -c 'echo "ERROR test message" >&2'`                                                                                | Within a minute, analyzer posts summary to Discord.                             |
| **5. Inspect analyzer’s last prompt** | `docker compose exec analyzer tail -n 20 /tmp/last_prompt.txt`<br>Add `fs.writeFileSync('/tmp/last_prompt.txt', prompt)` to `summarize()` method | Full prompt text just sent to Gemma, e.g., disk/memory/log summary.             |

---

### 🔭 Watch Both Containers Side-by-Side

```bash
docker compose logs -f --tail=20 analyzer ollama
```

*(Ctrl-C to stop)*

---

# 🧪 If Nothing Shows Up

1. **Too strict log filter?**

   Broaden regex in `analyze.js` to `/./`, then rebuild:

   ```bash
   docker compose build analyzer
   docker compose up -d
   ```

2. **Confirm environment variables**

   ```bash
   docker compose exec analyzer printenv | grep OLLAMA_URL
   ```

   Should output:

   ```
   http://ollama:11434
   ```

3. **Manual curl test**

   ```bash
   docker compose exec analyzer sh
   apk add --no-cache curl  # if curl not installed
   curl -s http://ollama:11434/api/generate \
     -H 'Content-Type: application/json' \
     -d '{"model":"gemma:3n","prompt":"Hello","stream":false}'
   ```

   You should get a JSON response with `response: "Hello …"`.

---

# 🔥 Smoke Tests

Each writes a log line matching `ERROR | CRIT | WARN`:

✅ Triggers Fluent Bit → Analyzer → Gemma → Discord (if webhook set).

---

## 1 · Fire an error from the Node app

```bash
docker compose exec app bash
echo "ERROR test – something went wrong at $(date)" >&2
exit
```

---

## 2 · Write to Nginx error log

```bash
docker compose exec app bash -c \
  'echo "2025/07/04 19:30:00 [crit] 123#123: *1 critical failure test" >> /var/log/nginx/error.log'
```

---

## 3 · Use `logger` (syslog)

```bash
docker compose exec app logger -p user.err "ERROR synthetic syslog test"
```

---

### 📺 Watch It Happen

```bash
docker compose logs -f analyzer ollama fluent-bit
```

Typical sequence:

1. `fluent-bit` logs a new entry.

2. \~0–60s later `analyzer` prints:

   ```bash
   Picked up 1 ERROR lines (123B)… summarising
   ```

3. `ollama` logs a `/api/generate 200 … model=gemma:3n` call.

4. `analyzer` posts to Discord (if configured).

---

# 🧹 Log Management & Helpful Commands

## 📂 Download Log File

```bash
docker compose exec fluent-bit cat /logs/all.log > all.log
```

You can then `scp` or copy the file locally from the host.

---

## 🧽 Clear Logs (Fluent Bit Shared Volume)

```bash
docker compose exec fluent-bit sh -c 'truncate -s 0 /logs/all.log'
```

To wipe it completely:

```bash
docker compose exec fluent-bit sh -c 'rm /logs/all.log && touch /logs/all.log'
```

---

## 📋 Check Log Volume Size

```bash
docker compose exec fluent-bit du -sh /logs
```

---

## 🔄 Restart a Specific Service

```bash
docker compose restart analyzer
```

---

## 🧰 Rebuild Image (after code change)

```bash
docker compose build analyzer
docker compose up -d
```

---

## 🔒 Enter Shell Inside Any Container

```bash
docker compose exec <service_name> sh
# or use 'bash' if available:
docker compose exec <service_name> bash
```

Example:

```bash
docker compose exec analyzer sh
```

---

# 🧯 Troubleshooting

| Symptom                                        | Check                                                                         |
| ---------------------------------------------- | ----------------------------------------------------------------------------- |
| No line appears in `/logs/all.log`             | Make sure the log was written to `/var/log` or the container’s stdout/stderr. |
| `/logs/all.log` updates, but analyzer is quiet | Does the line contain `ERROR`, `CRIT`, or `WARN`? Check your `FILTER` regex.  |
| Analyzer shows Ollama error                    | Ensure model is pulled: `docker compose exec ollama ollama pull gemma:3n`     |
| Discord is silent                              | Is `DISCORD_WEBHOOK_URL` set in `.env`? Is the URL valid and reachable?       |

---

✅ Once you're seeing logs flow from Fluent Bit to Analyzer, Gemma calls via Ollama, and summaries landing in Discord—you’re ready to roll! 🚀

```

Let me know if you'd like to include a `Makefile` or some script-based wrappers (like `make logs`, `make test-error`, etc.) for simplified local development.
```
