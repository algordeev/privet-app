# Privet thermal printer — protocol, connection and printed cards

The native iOS app prints learning cards on a cheap 57 mm Bluetooth LE thermal "cat" printer: a **word of the day** card, a **practice strip** for a lesson, **alphabet strips** to practise writing Cyrillic, a **write-from-memory** strip and a **progress receipt**. It is the third Bluetooth device next to the desk robot (`Privet-ESP32`) and the keychain Mini (`Privet-Mini`), and it can be connected at the same time as either. There is no firmware to install: the app speaks the printer's own protocol. Website behavior is unchanged; printing exists only in the native app on a real iPhone.

Tested on an **SC03h** printer (advertised as `SC03h-438F`).

[![Privet Printer pocket thermal printer concept body with its cat face and Privet wordmark](../public/images/printer-concept.webp)](../public/images/printer-concept.webp)

*Privet concept body for an SC03h-type printer, rendered from the app's 3D model. The app works with the printer as it is; the Privet body is a concept.* The same protocol is used by GB01, GB02, GB03, GT01, MX05, MX06, MX08, MX10, MX11 and YT01 printers; only the SC03h has been tried.

## Using it

1. Disconnect the printer from any other app or phone first. The printer takes **one connection at a time**: while another app or phone holds it, it cannot be found or will not connect, and the app says so.
2. **Settings → Printer → Connect**, then tap the printer in the list. The "printer found" card opens and plays its wake-up while it connects.
3. Print buttons appear only while the printer is connected:
   - a print icon on each revealed word in a lesson's vocabulary step (a word card for that word);
   - **Print a practice strip** on the end-of-lesson summary, and **Print a review strip** on the review summary;
   - **Print a practice strip** on each page of the Cyrillic quick start (an alphabet strip for that page);
   - **Print a write-from-memory strip** on the Cyrillic quick start's finish screen;
   - a print icon on each letter card of the Cyrillic quick start and of the Cyrillic guide in lessons and reviews (a letter strip for that letter);
   - **Print today's progress receipt** on Profile;
   - **Print word of the day** and **Print a test page** on Settings → Printer.
4. Each opens a sheet with a preview of exactly what will print (the 1-bit image), and Print. While printing it shows rows sent / total and **Cancel printing**.

**Darkness:** every print uses the normal darkness, energy 12000 (`DEFAULT_ENERGY`), which suits the SC03h. Lighter (about 8000) and darker (about 20000) values also work but aren't offered in the app.

## Automatic reconnect

Works like the robot's ([companion-ble.md, *Automatic reconnect*](companion-ble.md#automatic-reconnect)).

- **Remembered printer:** each successful connection saves the printer's iOS device ID and name (`privet-demo-v1-printer-device`), separately from the remembered companion, so the robot's discovery never offers the printer and the reverse.
- **Looking for it:** while the app is in the foreground and that printer is not connected, it runs quiet scans on every screen and connects as soon as it sees it (`discover({target})`, state `quiet`, then `auto: true`). A look lasts 5 s; a new one starts within 4 s for 2 minutes after the printer was lost or the app came back to the foreground, then every 20 s.
- **Quiet:** no card, no scanning status and no errors (except a permission denial). Settings shows "*name* will reconnect by itself when it's nearby" while it waits. Connect or Print during a quiet look turns it into the visible scan, keeping what it found.
- **Off:** Disconnect turns automatic reconnection off (`privet-demo-v1-printer-auto-off`), across app restarts, until the next connection by hand.
- **Background:** with nothing printing, going to the background disconnects the printer, which frees it for other apps; it reconnects by itself on return. A **running print is held instead**: sending stops at the next packet with the connection kept ("Paused while Privet is in the background…"), and the print carries on from the next row when the app is back, within 30 s (`PRINTER_TIMEOUTS.hold`). Away longer than that, it ends cleanly (lattice end sent) and frees the printer ("Printing stopped: Privet was in the background for too long."). The length of the absence is measured by the wall clock, since iOS freezes the web view's timers. Being only covered for a moment (Control Center, a banner, a system prompt: the app is *inactive* but still visible) does not interrupt a print at all. The flow-control stall limit waits while held. Not yet verified on a real printer: whether the SC03h keeps its print session while data stops, and whether the paper shows a seam where it paused.
- While automatic reconnection is on, Privet takes the printer whenever it is switched on and the app is open, so other apps cannot. Disconnect in Privet first to use the printer from another app.

## Printer found card

`PrinterFoundCard` is the robot's "companion found" card for the printer, with a 3D model of it (`printerFigure` in `src/robotScene.ts`, shown through `Robot3D`; a printer icon without WebGL). The model is a Privet concept body for the SC03h shape (the same picture as at the top of this page): an upright rounded body, glossy white at the front and mint behind, meeting flush round the sides; two mint cat ears and vent holes on top; the paper slot across the front; its printed cat face (static, since there is no screen) and a "Privet." wordmark below the slot. On connect it hops, the LED on top lights and a paper strip printed "Privet" feeds out of the slot and droops over the front.

- **Home:** once Bluetooth was granted before (a companion or a printer connected once, `privet-demo-v1-ble-used`), home quietly looks for printers (`discover({offer: true})`) and offers the first one found. The remembered printer is skipped only while automatic reconnection is on, since it connects by itself (`offeredPrinter` in `src/foundCards.ts`); after Disconnect it is offered like any other. *Not now* or Disconnect ends the offers for the app session.
- **Settings → Printer:** the card opens when you tap a printer in the list.
- **One card at a time:** the companion card and the printer card never open together (`src/foundCards.ts`); the second waits until the first closes.

## Shared Bluetooth state

The printer has its own driver and transport (`src/printerDriver.ts`, `src/printerTransport.ts`), separate from the companion's, but the BLE plugin keeps some state process-wide. `src/bleShared.ts` owns it, created on first use in `src/bleNative.ts`:

- `BleClient.disableQueue()` and `initialize()` run once and are shared.
- iOS runs **one scan at a time** (a second `requestLEScan` stops the first) and `BleClient` keeps one scan listener. Each driver takes a **lease** on one shared native scan instead. The scan is unfiltered while any lease needs that (the printer, which does not reliably advertise its service), otherwise filtered by the leases' services. Each result goes only to the leases that accept it: the companion lease takes the Privet service UUID or a `Privet-` name, the printer lease takes printer names. Releasing a lease narrows or stops the scan; it never ends another driver's.
- `BleClient` keeps one Bluetooth-enabled listener; it is fanned out to any number of watchers.
- Each driver's `cleanup()` releases only its own lease, watch, notifications and device. It no longer calls the global `stopLEScan()` or `stopEnabledNotifications()`, so robot cleanup cannot kill a printer scan or job, and the reverse.

Bluetooth permission is still asked only after an explicit Connect or Print. `NSBluetoothAlwaysUsageDescription` in `ios/App/App/Info.plist` mentions the printer.

## Protocol (as tested)

| Item | Value |
| --- | --- |
| Name match | Unfiltered scan; the name, case-insensitively, starts with `SC03`, `GB0`, `GT01`, `MX0`, `MX1` or `YT01` (`PRINTER_NAME_PREFIXES`). `MXW01` uses a different protocol and is excluded. |
| Service | `0000ae30-0000-1000-8000-00805f9b34fb` |
| Write | `0000ae01-0000-1000-8000-00805f9b34fb`, **write without response** |
| Notify | `0000ae02-0000-1000-8000-00805f9b34fb`, status and flow control |

**Framing:** `51 78 | cmd | 00 | len_lo len_hi | data… | crc8(data) | FF`. CRC-8 with polynomial 0x07, init 0x00, no reflection and no final XOR, over the data bytes only. Test vectors: `A4 [33]` → `51 78 a4 00 01 00 33 99 ff`; lattice start → `… a1 ff`.

| cmd | Name | Data |
| --- | --- | --- |
| A3 | Get device state | `00` |
| A4 | Quality | `33` |
| BD | Speed | `20` (32) |
| AF | Energy (darkness) | uint16 LE (12000 = `E0 2E`) |
| BE | Apply energy | `01` |
| A9 | Update device | `00` |
| A6 | Lattice start | `AA 55 17 38 44 5F 5F 5F 44 38 2C` |
| A2 | Bitmap row | 48 bytes = one 384-px row |
| A1 | Feed paper | uint16 LE line count (80 after a print) |
| A6 | Lattice end | `AA 55 17 00 00 00 00 00 00 00 17` |

**Print sequence:** A3, A4, BD, AF, BE, A9, A6 (start), one A2 per image row, A1 (80), A6 (end), A3 (`printJob` in `src/printerProtocol.ts`).

**Image rows:** 384 px wide, 1 bit per pixel. Pixel `x` goes into byte `x >> 3`, bit `x & 7` (LSB first = leftmost pixel); 1 burns.

## Sending and flow control

- **One write at a time**, 10 ms apart (`PRINTER_TIMEOUTS.pace`). On iOS, `writeWithoutResponse` resolves as soon as it is handed to CoreBluetooth and never checks whether the buffer has room, so pacing is what keeps writes from being dropped.
- **Two rows per write** (`ROWS_PER_WRITE`): consecutive A2 packets are joined into one write; every other packet goes on its own. The printer parses a byte stream, so the bytes are identical. Set it to 1 if a print shows missing lines or garbled stripes; try 3 for more speed. Writes larger than the link's maximum (MTU − 3) are split by the driver.
- **Never more than one link packet per write:** a write holds at most the rows that fit the link's largest write (`driver.maxWrite`, 3 rows at the usual 182 bytes), so no write is split into back-to-back pieces. iOS silently drops a write without response when its queue is full, and the Bluetooth plugin resolves every write at once without checking (`Device.swift` calls `writeValue(.withoutResponse)` and resolves), so bursts are what lose data. A test at 4 and 6 rows per write with 4 and 2 ms gaps (2026-11-23) made the printer stop partway.
- **The printer, not the sending, sets the pace:** measured on the SC03h (2026-11-23), sending 607 rows takes about 4 s with the normal pacing and the printer never asks us to wait, while the paper takes about 20 s (19.6 s measured once the printer's answer was timed); the printer prints about 32 rows (4 mm) a second and holds most of a print in its buffer. Sending faster (tried at about 1.7 and 2.2 times) only fills the buffer sooner, and the printer then made us wait 3.2 s, so the paper came out no faster. The sending pace stays at 2 rows per write with a 10 ms gap.
- **Finishing:** once everything is sent, the print stays on "printing" (`finishing`, "Finishing…" with an open-ended progress bar) until the printer answers the status request (A3) that closes every job; if it handles commands in order, that answer comes when the paper has stopped. With no answer, the print ends after `max(5 s, rows ÷ 20 per second)`. Not leaving the app matters only while sending: nothing is held while finishing. Checked on the SC03h (2026-11-23): the answer comes when the paper stops. Each print records the time to send (`sentMs`) and the time until the printer's answer (`finishedMs`), shown under "Last print" in Settings → Printer.
- **The printer's own speed setting does not help:** a test of the BD speed at 36, 32, 28 and 24 (2026-11-23) printed the same 290-row block in 9.2, 8.6, 8.3 and 8.5 s, within the variation between runs. The SC03h prints about 32 rows (4 mm) a second, and its time per row is about the same for blank and black rows, so a print's time follows its number of rows. The speed stays at 32. The only other levers would be shorter prints (less blank space) or darkness (energy), which lightens the print.
- **Paper progress and time left:** the printer doesn't report rows as it prints them, so the progress bar and "About N s left" come from its speed (`printEstimate`): rows per second learnt from each print it said it finished (`learnRate`, half the old value and half the new, kept under `privet-demo-v1-printer-rate`), starting from 32. The estimate is never ahead of what was sent and shows "Almost done…" until the printer's answer ends the print.
- **Flow control:** the printer notifies `51 78 AE 00 01 00 10 70 FF` when its buffer is full and `51 78 AE 00 01 00 00 00 FF` when it can take more (byte 6: `0x10` pause, `0x00` resume). A pause holds sending until resume; with no resume within 8 s the job ends with "The printer stopped responding".
- **Cancel, disconnect or a hold that ran out:** sending stops before the next packet and, if still connected, A6 (end) is sent so the printer does not wait for more rows. A dropped link stops sending with no further writes.
- **Progress:** rows sent / total are updated every 4 rows; the screen shows how far the paper is (see *Paper progress and time left*).
- **Busy printer:** a connection that fails or times out, or a scan that finds nothing, says "If another app or phone is connected to the printer, disconnect it there, then try again."

## The printed cards

Content (`src/printContent.ts`) is built only from the existing lessons, reviews and statistics; no new Russian is written for printing. Drawing (`src/printRender.ts`) uses an offscreen 384-px canvas on white, with text at 16 px or more because thermal paper blurs thin strokes. Text and line art use a hard threshold at 140/255; grey areas (the receipt's XP bars, the word to trace, the test page's gradient) are Floyd–Steinberg dithered (`ditherRegions`). Every card starts with the robot logo and "Privet".

- **Stress marks** are drawn by hand: the U+0301 accent is stripped from the text and stroked above its vowel (`fillStressed`). Real combining accents landed beside the vowel in Chromium; the drawn accent sits correctly in Chromium and in iOS Simulator Safari.
- **Word of the day:** a learned word (one with a review item), picked by the date and preferring weak or due words; the first lesson's words before anything is learned. It shows an inverted "СЛОВО ДНЯ · WORD OF THE DAY" banner, a line icon per lesson, the word with its stress, the transliteration, the meaning and, when the lesson has one, an example sentence that uses it (another line of the same lesson with its English), then a cut line. A vocabulary card's print icon prints the same card for that word. There is no grammar line (gender/plural is not in the lesson data yet) and no QR code.
- **Practice strip:** three fill-in-the-blank lines, each with three tick-box options. Blanks come from the lesson's multi-word lines; wrong options are other words of the lesson, then of the course, never a word of the same line, and names (such as Анна) are never blanked or offered. A lesson with too few lines also gets "____ (meaning)" items. Then **trace & write**: the lesson's typed-exercise word in dithered grey to write over (without stress marks), with a line to write it again. The answers are printed upside down below a cut line.
- **Review strip:** the practice strip for a finished review session, titled "Review · *date*". Its lines come from the lessons the reviewed words belong to and contain at least one of them. Words answered wrong come first: each gets a blank in a line, or a "____ (meaning)" item when no line uses it; then words answered correctly. The word to trace is the first one missed (else the first reviewed).
- **Alphabet strip:** one per Cyrillic quick start page, titled with the page's title. Pages 1–3: each of the page's letters with its sound, then one row on writing lines: the capital as a model and twice to trace, then the small letter the same way. The look-alike notes ("Looks like B, sounds like v.") are printed only on page 2, the look-alikes page. Page 4: the four reading words, each with its reading guide and meaning, a line to trace it and an empty line to copy it. Everything comes from the quick start (`QUICK_LETTERS`, `QUICK_TITLES`, `READING_WORDS` in `src/cyrillic.ts`) and the reading guides.
- **Letter strip:** any of the 33 letters, from its card in the Cyrillic quick start or guide ("Cyrillic · letter 8 of 33"): the letter large, its sound and note, rows for the capital and the small letter (a model, three to trace, one empty; five per row so Ж and Щ have room), an empty row, then the card's example word with its reading guide, to trace and copy. It prints the example the card shows: during an exercise the guide swaps out any example that would give the answer away (`referenceExample`), and when it leaves the example out the strip has no word.
- **Write from memory:** a section per quick start page, headed with its title. Pages 1–3: each letter's sound ("v", "short y", "soft sign") above an empty box to write the letter in, in rows of up to six, or of four when a section is longer so the labels fit. Page 4: each reading word's guide and meaning ("KO-fe · coffee") above an empty writing line. The order is shuffled within each section on every print, so it does not give the answers away; the preview and the print are the same order. The answers, one line per section in the printed order, are printed upside down below a cut line.
- **Writing lines and trace letters** (both alphabet strips): a dotted cap line, a dashed midline at the height of small letters and a solid baseline, drawn in whole pixels. Letters to trace are filled with a fixed pattern, one burnt dot in every 2×2, about as light as the practice strip's dithered trace word. A pattern is used instead of dithering so the lines the letters cross stay solid. Print style only for now; handwritten Cyrillic letters are planned as a later setting (they need a bundled font, since iOS has none).
- **Progress receipt:** like a shop receipt: the date and time, the streak in days with Mon–Sun boxes, then dotted-leader lines for new words (from lessons finished today), reviewed (today's review answers), accuracy (first-try results from today's lessons and reviews together) and XP today. Then today's words with 1–3 stars from their review box (0–1, 2–3, 4–5), an XP bar chart of the last 7 days (dithered bars, today solid), total XP and "Молодец! До завтра!". Minutes studied, robot nods and levels are not tracked, so they are not shown.
- **Test page:** text with stress marks, a dithered gradient, line weights and a 30 mm length check (rows lost on the way make the box shorter and put a step in its diagonal), for checking a new printer.

## Source

| Source | Responsibility |
| --- | --- |
| `src/printerProtocol.ts` | UUIDs, name matching, `crc8`, `packet()`, `packRows()` (threshold/dither, LSB first), `printJob()`, flow-control decoding |
| `src/printerTransport.ts` | Scan, connect, quiet discovery and offers, paced batched sending, flow control, cancel, background and the busy hint |
| `src/printerDriver.ts` | Plugin adapter: its own scan lease, disconnect listener, notifications and MTU-sized writes without response |
| `src/bleShared.ts`, `src/bleNative.ts` | The plugin's shared state: one initialization, the shared scan with leases, the Bluetooth-enabled fan-out |
| `src/usePrinter.ts` | App-wide printer hook: remembered printer, auto-reconnect loop, home offers, print-when-connected |
| `src/printContent.ts`, `src/printRender.ts` | Card content from lessons/reviews/stats and the Cyrillic quick start and guide; canvas drawing, hand-drawn stress marks, writing lines and packing |
| `src/PrinterScreen.tsx` | Settings → Printer, the print sheet with preview and progress, the settings button |
| `src/NativeCyrillic.tsx` | The quick start's **Print a practice strip** and **Print a write-from-memory strip** buttons and the letter print icons on quick start and guide cards (shown only while a printer is connected) |
| `src/PrinterFoundCard.tsx`, `src/foundCards.ts` | "Printer found" card, which printer to offer, one found card at a time |
| `src/robotScene.ts` (`printerFigure`), `src/Robot3D.tsx` | 3D printer model and its connect animation |
| `src/printerProtocol.test.ts`, `printerTransport.test.ts`, `bleShared.test.ts`, `printContent.test.ts`, `printRender.test.ts`, `foundCards.test.ts` | Unit tests with a fake driver and clock; no real printer or canvas |

## Verification

**Automated (`npm test`):** both CRC test vectors, packet framing, LSB-first bit order, 48-byte rows, threshold and dithering, the exact print order and energy encoding, name matching (MXW01 excluded); pacing, one write at a time, two rows per write with identical bytes, pause/resume and the stall limit, cancel and disconnect sending the lattice end, a background hold (nothing sent while held, then every packet once and in order; a visible interruption ignored; ending cleanly after 30 s, by the wall clock; the stall limit waiting; cancel and a dropped link while held), print statistics (including prints that stop early), tuned batches sending identical bytes, a write never larger than the link takes, waiting for the printer's closing answer (an early answer to the opening request not counting, an immediate answer not waited for, no answer ending after the slow-printer wait, cancel, background and a lost link while finishing), the printer speed byte, the paper estimate and learning the printer's speed, a dropped link stopping with no end packet, the busy hint, quiet discovery, home offers and auto-reconnect; the shared scan (robot cleanup never ending a printer scan, and the reverse; each lease receiving only its own devices) and the enabled-state fan-out; card content for all eight lessons; alphabet strips for the four quick start pages and letter strips for all 33 letters (including a swapped or omitted example); the write-from-memory strip (every quick start letter and word once, prompts matching answers, shuffled per print); stress-mark placement; which printer home offers. `npm run test:interactions` checks that the quick start's print button and the letter print icons in the quick start and the guide stay hidden while no printer is connected.

**On the real SC03h (reported by the project owner):** connecting, printing, the progress receipt, the print speed with two rows per write, automatic reconnect after the printer is switched off and on, the "printer found" card on home and in settings, and printing while the robot is connected at the same time.

**Still to check on hardware:** pausing and resuming a print when leaving the app (the seam on the paper),  the alphabet, letter and write-from-memory strips (how light the trace dots print); other printer models (GB01–GB03, GT01, MX05–MX11, YT01).
