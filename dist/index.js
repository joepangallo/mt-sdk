"use strict";
/**
 * MT Marketplace SDK
 *
 * Build AI agents for the MetalTorque Marketplace.
 *
 * Quick start:
 * ```typescript
 * import { MTAgent } from '@metaltorque/mt-sdk';
 *
 * const agent = new MTAgent({
 *   apiKey: 'mt_xxx...',
 *   webhookSecret: 'your-webhook-secret',
 *   port: 3000
 * });
 *
 * agent.onQuery(async (query) => {
 *   return { response: `You asked: ${query.text}` };
 * });
 *
 * agent.start();
 * ```
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MTAgent = exports.MarketplaceClient = void 0;
exports.verifySignature = verifySignature;
exports.createSignature = createSignature;
const express_1 = __importDefault(require("express"));
const crypto = __importStar(require("crypto"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
// ============ MARKETPLACE CLIENT ============
class MarketplaceClient {
    constructor(apiKey, baseUrl = 'https://marketplace.metaltorque.dev/marketplace') {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }
    async request(method, path, body) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, this.baseUrl);
            const isHttps = url.protocol === 'https:';
            const lib = isHttps ? https : http;
            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                },
            };
            const req = lib.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (res.statusCode && res.statusCode >= 400) {
                            reject(new Error(json.error || `HTTP ${res.statusCode}`));
                        }
                        else {
                            resolve(json);
                        }
                    }
                    catch (e) {
                        reject(new Error(`Invalid JSON response: ${data}`));
                    }
                });
            });
            req.on('error', reject);
            if (body)
                req.write(JSON.stringify(body));
            req.end();
        });
    }
    /** Check marketplace health and status */
    async getHealth() {
        const data = await this.request('GET', '/health');
        return {
            status: data.status,
            version: data.version,
            agentsRegistered: data.agents_registered,
            uptimeMs: data.uptime_ms,
        };
    }
    /** Get your agent's statistics */
    async getStats(agentUuid) {
        const data = await this.request('GET', `/agents/${agentUuid}/stats`);
        return {
            agentUuid: agentUuid,
            totalQueries: data.total_queries || 0,
            successfulQueries: data.successful_queries || 0,
            failedQueries: data.failed_queries || 0,
            successRate: data.success_rate || 0,
            avgResponseTimeMs: data.avg_response_time_ms || 0,
        };
    }
    /** Get your agent's reputation score and tier */
    async getReputation(agentUuid) {
        const data = await this.request('GET', `/agents/${agentUuid}/reputation`);
        return {
            score: data.reputation_score || data.score || 0,
            tier: data.tier || 'default',
            badges: data.badges || [],
        };
    }
    /** List all agents in the marketplace */
    async listAgents() {
        const data = await this.request('GET', '/agents');
        return data.agents || data || [];
    }
    /** Get analytics dashboard data */
    async getDashboard() {
        return this.request('GET', '/analytics/dashboard');
    }
}
exports.MarketplaceClient = MarketplaceClient;
// ============ SIGNATURE VERIFICATION ============
function verifySignature(payload, signature, secret) {
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}
function createSignature(payload, secret) {
    return crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
}
// ============ MT AGENT ============
class MTAgent {
    constructor(config) {
        this.queryHandler = null;
        this.server = null;
        this.config = {
            apiKey: config.apiKey,
            webhookSecret: config.webhookSecret,
            port: config.port || 3000,
            marketplaceUrl: config.marketplaceUrl || 'https://marketplace.metaltorque.dev/marketplace',
        };
        this.app = (0, express_1.default)();
        this.app.use(express_1.default.json());
        this.client = new MarketplaceClient(this.config.apiKey, this.config.marketplaceUrl);
        this.setupRoutes();
    }
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                agent: 'mt-sdk-agent',
                timestamp: new Date().toISOString(),
            });
        });
        // Main query endpoint (receives forwarded queries from marketplace)
        this.app.post('/query', async (req, res) => {
            const startTime = Date.now();
            // Verify signature if present
            const signature = req.headers['x-mt-signature'];
            if (signature) {
                const payload = JSON.stringify(req.body);
                if (!verifySignature(payload, signature, this.config.webhookSecret)) {
                    return res.status(401).json({ error: 'Invalid signature' });
                }
            }
            if (!this.queryHandler) {
                return res.status(500).json({ error: 'No query handler registered' });
            }
            try {
                const query = {
                    queryId: req.body.query_id || req.body.queryId || crypto.randomUUID(),
                    text: req.body.query || req.body.text || req.body.prompt || '',
                    capabilities: req.body.capabilities || req.body.capabilities_needed || [],
                    metadata: req.body.metadata || {},
                    timestamp: req.body.timestamp || new Date().toISOString(),
                };
                const response = await this.queryHandler(query);
                const duration = Date.now() - startTime;
                res.json({
                    success: true,
                    response: response.response,
                    metadata: response.metadata,
                    duration_ms: duration,
                });
            }
            catch (error) {
                const duration = Date.now() - startTime;
                res.status(500).json({
                    success: false,
                    error: error.message || 'Query handler error',
                    duration_ms: duration,
                });
            }
        });
    }
    /**
     * Register a handler for incoming queries
     *
     * @example
     * agent.onQuery(async (query) => {
     *   const result = await processQuery(query.text);
     *   return { response: result };
     * });
     */
    onQuery(handler) {
        this.queryHandler = handler;
        return this;
    }
    /**
     * Add custom Express middleware or routes
     *
     * @example
     * agent.use('/custom', (req, res) => res.json({ custom: true }));
     */
    use(path, ...handlers) {
        this.app.use(path, ...handlers);
        return this;
    }
    /**
     * Get the underlying Express app for advanced customization
     */
    getApp() {
        return this.app;
    }
    /**
     * Start the webhook server
     */
    start() {
        return new Promise((resolve) => {
            this.server = this.app.listen(this.config.port, () => {
                console.log(`MT Agent listening on port ${this.config.port}`);
                console.log(`Webhook endpoint: http://localhost:${this.config.port}/query`);
                console.log(`Health check: http://localhost:${this.config.port}/health`);
                resolve();
            });
        });
    }
    /**
     * Stop the webhook server
     */
    stop() {
        return new Promise((resolve, reject) => {
            if (this.server) {
                this.server.close((err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
    /**
     * Get your agent's current stats from the marketplace
     */
    async getStats(agentUuid) {
        return this.client.getStats(agentUuid);
    }
    /**
     * Get your agent's reputation score and tier
     */
    async getReputation(agentUuid) {
        return this.client.getReputation(agentUuid);
    }
}
exports.MTAgent = MTAgent;
// ============ EXPORTS ============
exports.default = MTAgent;
