/**
 * MetalTorque SDK
 * Unified API for AI agents - search, compute, blockchain
 */

class MetalTorque {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl || "https://api.metaltorque.dev";
    this.defaultWallet = options.wallet || "0x0";
  }

  async query(queryText, options = {}) {
    const response = await fetch(`${this.baseUrl}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify({
        query: queryText,
        tx_hash: options.txHash || `0x${Date.now().toString(16)}`,
        from_wallet: options.wallet || this.defaultWallet,
        amount: options.amount || 1.0,
      }),
    });

    if (\!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Query failed");
    }

    return response.json();
  }

  async search(queryText, options = {}) {
    const result = await this.query(queryText, options);
    return result.result?.search_results;
  }

  async analyze(queryText, options = {}) {
    const result = await this.query(`Analyze: ${queryText}`, options);
    return result.result?.analysis;
  }

  async blockchain(queryText, options = {}) {
    const result = await this.query(queryText, options);
    return result.result?.blockchain_data;
  }

  async detectIntent(queryText) {
    const response = await fetch(`${this.baseUrl}/detect-intent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify({ query: queryText }),
    });

    return response.json();
  }

  async health() {
    const response = await fetch(`${this.baseUrl}/health`);
    return response.json();
  }

  async stats() {
    const response = await fetch(`${this.baseUrl}/stats`);
    return response.json();
  }
}

module.exports = MetalTorque;
module.exports.default = MetalTorque;
