# Platecoin

**Pass the plate, pass it on.** A Solana community coin shaped like a plate, with a live market board beside it.

[![Live site](https://img.shields.io/badge/live%20site-PlateCoin.fun-E92C26?style=flat-square)](https://platecoin.fun)
![Chain](https://img.shields.io/badge/chain-Solana-FEEAB2?style=flat-square&labelColor=E92C26)

| | |
|---|---|
| Chain | Solana mainnet |
| Contract address | `CA_PLACEHOLDER` (not stated yet) |
| Site | https://platecoin.fun |
| X | https://x.com/platecoinpf |

## Overview

This repository is the static site for Platecoin. It is plain HTML, CSS and ES modules with no framework and no runtime dependencies. A small Node script copies `src/` into `dist/`, pre-renders the slots that depend on the register, and runs a gate suite on two builds: one with the contract address absent and one with it stated.

## Features

- **Contract address slot** at the very top of the page: full address, large type, click-to-copy with feedback. Inert until the address is stated.
- **Live market board**: ten Solana tokens from DexScreener with logo, symbol, name, price, 24h change, volume and liquidity. Skeleton loaders fade into real rows, numbers count up and flash when they change, and a ticker band reads the same data.
- **Own-token row pinned first**: once the address is stated, DexScreener and pump.fun are queried in parallel and the coin takes row one. Until then a placeholder row carries the brand logo.
- **Resilient polling**: exponential backoff, last good data kept when a refresh fails, 60 second refresh, paused while the tab is hidden and fetched again the moment it is visible.
- **Motion**: spring-physics reveals, hero parallax from pointer and scroll, spotlight hover, scroll progress bar, and a full `prefers-reduced-motion` fallback.
- **Register pattern**: every external fact is one record (`stated`, `absent` or `unconfirmed`). Inert records carry no value and no URL, and render without an `href`.

## Links

- Website: https://platecoin.fun
- X: https://x.com/platecoinpf
- Whitepaper: [docs/whitepaper.md](docs/whitepaper.md)

## Develop

```bash
npm run build         # builds dist/ (CA absent) and .proof/stated (CA stated), runs every gate
npm run gates         # mutation harness over the register
npm run serve         # serves dist/ on http://localhost:4173
```

To state the contract address, edit the `ca` record in `src/js/register.js`:

```js
ca: { state: 'stated', value: '<address>' },
```

## License

MIT. See [LICENSE](LICENSE).
