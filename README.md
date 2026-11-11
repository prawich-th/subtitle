# Subtitle System

Live Thai / English subtitles for a stage production. One Mac runs the program;
every screen (projector, TVs, audience phones) just opens a web page on it.

Everything runs **locally on the Mac**. Once it has been set up, no internet is needed.

---

## Start it (2 steps)

1. Open this folder in Finder.
2. Double-click **`start.command`**.

A Terminal window opens, and after a few seconds the **Operator** page opens in
your browser. That's it.

- **Keep the Terminal window open** for as long as you need subtitles. Closing it stops everything.
- The **first time** takes about a minute and needs internet (it downloads what it needs). After that it works offline.
- The Mac will not go to sleep while the program is running.

### "Apple could not verify start.command is free of malware"

macOS shows this the first time, because the folder was downloaded from the
internet. You only need to allow it **once** per Mac:

1. Press **Done** on the warning (not "Move to Trash").
2. Open **System Settings → Privacy & Security** and scroll down to **Security**.
3. Next to *"start.command" was blocked…* press **Open Anyway**, then confirm
   with the Mac's password or Touch ID.
4. Double-click `start.command` again and choose **Open**.

If the **Open Anyway** button is not there, do this instead: open the
**Terminal** app, type `xattr -dr com.apple.quarantine ` (with a space at the
end), drag the subtitle folder from Finder into the Terminal window, and press
Return. Then double-click `start.command` again.

To stop: close the Terminal window (or press `Control + C` in it).

---

## The three pages

The Terminal window lists these addresses every time it starts.

| Page | Address on this Mac | What it is for |
| --- | --- | --- |
| **Operator** | `http://localhost:8001/controller` | Press Next / Previous during the show |
| **Editor** | `http://localhost:8001/editor` | Add and change subtitles |
| **Display** | `http://localhost:8001/display` | What the audience sees – put this on the projector, full screen |

**Other devices** (a second laptop, TVs, audience phones) must be on the **same
Wi-Fi / network** as the Mac. They use the address shown in the Terminal window,
for example `http://192.168.1.20:8001/display`. On the Operator page,
**Audience link & PIN** shows this address and a QR code for it.

Only the display is open to everyone. To operate or edit from another device you
need the **PIN** (shown in the Terminal window and under **Audience link & PIN**).
On the Mac itself no PIN is needed.

---

## Adding and editing subtitles

Open the **Editor** (`Edit subtitles` on the Operator page).

**A new show**

1. Type a name and press **+ New show**.
2. Press **Paste / import from spreadsheet**.
3. In Google Sheets or Excel, select your rows, copy, and paste into the box.
   (Or choose a `.csv` file.)
4. Check the column labels above the preview, then press **Import**.

The columns are: **Act, Scene, Character, Thai, English, Lyric?, Remark**. If your
sheet has those headings they are recognised automatically; if not, pick the
right label for each column in the preview. An empty Act / Scene means "same as
the line above", just like in the spreadsheet.

**Changing things**

- Click any box and type. It is saved automatically – the top right says **All changes saved ✓**.
- Buttons at the end of each line: add a line below / above, duplicate, move up / down, delete.
- **↶ Undo** takes back the last change. **Search lines…** finds a line quickly.
- **Download as CSV** gives you a file that opens in Excel / Google Sheets.
- A line whose Character is **QR** shows a QR code so the audience can follow on their phones (**+ QR code slide** adds one).
- **Remark** is a note for the operator only; the audience never sees it.

**Editing during a show** is fine. If the show is on the displays, the editor says
so in an orange bar; a change appears on every screen as soon as you click out of
the box. The displays stay on the same line even if you add or delete lines above it.
The **▶** button on a line sends the displays straight to that line.

**Safety net:** older versions of every show are kept automatically in
`data/backups/`. Deleted shows are moved there too, not destroyed.

---

## Running a show

1. Double-click `start.command`.
2. On the Operator page, choose the show under **Show on the displays**.
3. Open the Display page on the projector Mac / TVs and make it full screen.
4. Press **Next** (or `Space`, `→`, `↓`, or a presentation clicker) for each line.
   **Previous** is `←` / `↑`.

Other operator buttons:

- **Jump to Line** – type a line number (the INDEX on each card).
- **Jump to Act/Scene** – pick a scene from a list.
- **Start Jump to Click** – then click any line in the list to go straight to it.
- **Restart from first line** – back to the top.

If the Mac or the program restarts mid-show, it comes back **on the same show and
the same line**. Displays reconnect by themselves.

Add `?debug=true` to the display address to see line numbers on screen during rehearsal.

---

## If something goes wrong

| Problem | What to do |
| --- | --- |
| A display is stuck or blank | Reload the page on that device. Check it is on the same Wi-Fi as the Mac. |
| Operator page says "Connection lost" | The Terminal window was closed or the Mac lost its network. Double-click `start.command` again. |
| Phones can't open the address | They are on a different Wi-Fi (or a "guest" network that blocks devices from seeing each other). Use the same network as the Mac. If macOS asks to "allow incoming connections", choose **Allow**. |
| The address / QR code is wrong | The Mac has several network connections. Operator → **Audience link & PIN** → type the right one under **Audience address**. |
| "Port 8001 is already in use" | It is already running in another window. Use that one, or close it first. |
| I broke the subtitles | Press **↶ Undo**, or take an older copy from `data/backups/<show>/` and import that file in the editor. |
| First start fails | It needs internet the first time. Connect and double-click `start.command` again. |

---

## Moving to another Mac

Copy the whole folder, including **`data/`** – that folder holds every show, the
backups, the PIN, and where the show currently is. Then double-click
`start.command` on the new Mac (it needs internet once).

---

## For developers

One small [Bun](https://bun.sh) server, no database.

```
start.command     double-click launcher (installs Bun, builds, starts, opens browser)
server/main.ts    Express + socket.io: API, live state, serves the built pages
server/store.ts   reads/writes the JSON files in data/
server/seed/      the original production script, loaded as "Example show" on first run
shared/lines.ts   Line/Show types, spreadsheet import (CSV/TSV/JSON) and CSV export
web/src/          React pages: display, controller (operator), editor, verify (PIN)
data/             created at runtime, git-ignored: shows/, backups/, state.json, settings.json
```

```bash
bun install
```

```bash
bun run dev        # server on :8001 + Vite with live reload on :5173
```

```bash
bun run start      # build the pages and run the server (what start.command does)
```

```bash
bun test           # import/export tests
```

```bash
bun run typecheck
```

Settings via environment variables: `PORT` (default `8001`) and
`SUBTITLE_DATA_DIR` (default `./data`).

How it fits together: the server holds the live state (which show, which line).
Operator buttons call `POST /api/control/next | previous | jump | load`; the
server broadcasts `subIndex` (line changed) and `live` (show or its text changed)
over socket.io, and every page follows. Displays read `GET /api/live`. Requests
from the Mac itself are trusted; anything else needs the `X-Operator-Pin` header
for everything except the display endpoints.

A display page can still follow a server at another address with
`/display?service=http://that-server:8001`.
