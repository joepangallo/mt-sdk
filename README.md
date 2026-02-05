# @metaltorque/sdk

Unified API for AI agents - search, compute, and blockchain data in one call.

## Installation

```bash
npm install @metaltorque/sdk
```

## Quick Start

```javascript
const MetalTorque = require("@metaltorque/sdk");

const mt = new MetalTorque("YOUR_API_KEY");

// Unified query - automatically routes to the right service(s)
const result = await mt.query("What is the TVL of Uniswap?");
console.log(result);

// Search only
const searchResults = await mt.search("Latest Bitcoin news");

// AI analysis
const analysis = await mt.analyze("DeFi market trends");

// Blockchain data
const blockchainData = await mt.blockchain("Top tokens by TVL");
```

## API Reference

### `new MetalTorque(apiKey, options?)`

- `apiKey` - Your MetalTorque API key
- `options.baseUrl` - API base URL (default: `https://api.metaltorque.dev`)
- `options.wallet` - Default wallet address for queries

### `mt.query(queryText, options?)`

Send a unified query. The router automatically detects intent and routes to:
- **Tavily** for web search
- **Together** for AI inference
- **The Graph** for blockchain data

### `mt.search(queryText)` / `mt.analyze(queryText)` / `mt.blockchain(queryText)`

Convenience methods for specific query types.

### `mt.health()` / `mt.stats()`

Check API health and usage statistics.

## Pricing

| Service | Cost |
|---------|------|
| Search | $0.02/query |
| Inference | ~$0.04/query |
| Blockchain | $0.002/query |
| Multi-service | ~$0.08/query |

## Links

- API: https://api.metaltorque.dev
- Website: https://metaltorque.dev
