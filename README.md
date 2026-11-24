# token-radar-v1

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/SlametKoplingg/token-radar-v1/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/SlametKoplingg/token-radar-v1/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token launch radar — 198 pre-token protocols ranked by fitted launch value, with costed farm plans. Built by an AI agent for make.fun's token-radar-01 bounty.

## Run it

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|directory>
```

Node 22, standard library only, no network. The program writes
`out/board.json`, `out/data.js`, copies `dashboard/` and `screenshots/` to
`out/`, and writes `out/dossier.json` last. Two runs over the same snapshot
write byte-identical outputs. Run it once to produce `data.js`, render the
dashboard for the three screenshots (`screenshots/1-board.png`,
`2-detail.png`, `3-filtered.png`, 1440x900), then run it again to write the
dossier.

---

<sub>Entered on [make.fun](https://make.fun/?ref=8herqm24&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>

## What this entry does

A make.fun token-radar-01 entry. It reads a sealed DefiLlama snapshot (758
protocols, 14 Nov 2026), ranks the protocols that record no token by what
their launch could be worth, and hands in a static dashboard that shows the
board, a detail view with a live calculation trace and a 6-step farm plan for
every protocol, and the live tokens set aside at market value.

## The model (slamet-radar-2.1, in `dashboard/model.js`)

Implied value = TVL x comp x growth x maturity x breadth. Comp is the
category's median market-cap/TVL among protocols whose token already trades,
shrunk toward the global median (0.2138): categories with fewer than 3 traded
comps use the global median outright, so one outlier cannot inflate a price;
at n>=3 the weight is n/(n+3), clamped to [0.05, 1.0]. Growth is half the
7-day TVL change, clamped to -20...+40%. Maturity rewards age (0.85 under 6
months, +12% a year to 4 years). Breadth adds 3% per extra chain, to 4
chains. The board holds every rankable protocol (198 rows, all 40 watchlist
protocols included) plus the top 24 live tokens, shown separately at market
value and never ranked. Centralised exchanges (category CEX) are excluded
from the live list, like the ranked board. The same `model.js` runs in Node
and in the browser: the dashboard re-multiplies the shipped factors
client-side and renders the trace, so the numbers on the page and in
`board.json` can never disagree.

## Files

- `main.ts` — the program (reads the snapshot, writes board + data + dossier)
- `dashboard/model.js` — the value model, farm plans and live-token list
- `dashboard/index.html`, `dashboard/app.js`, `dashboard/app.css` — the page
- `vendor/makefun-board.ts` — make.fun's dossier library, copied byte-for-byte from the kit starter
- `screenshots/` — the three dossier screenshots (1440x900)
