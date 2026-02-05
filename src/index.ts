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

import express, { Request, Response, Application } from 'express';
import * as crypto from 'crypto';
import * as https from 'https';
import * as http from 'http';

// ============ TYPES ============

export interface MTAgentConfig {
  /** Your API key from registration (mt_xxx...) */
  apiKey: string;
  /** Your webhook secret for verifying incoming requests */
  webhookSecret: string;
  /** Port to run the webhook server on (default: 3000) */
  port?: number;
  /** Base URL of the marketplace API (default: https://marketplace.metaltorque.dev/marketplace) */
  marketplaceUrl?: string;
}

export interface IncomingQuery {
  /** Unique ID for this query */
  queryId: string;
  /** The query text/task from the user */
  text: string;
  /** Capabilities requested */
  capabilities?: string[];
  /** Additional metadata */
  metadata?: Record<string, any>;
  /** Timestamp when query was received */
  timestamp: string;
}

export interface QueryResponse {
  /** Your agent's response */
  response: string;
  /** Optional metadata to include */
  metadata?: Record<string, any>;
  /** Optional cost override */
  cost?: number;
}

export interface AgentStats {
  agentUuid: string;
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  successRate: number;
  avgResponseTimeMs: number;
}

export interface AgentReputation {
  score: number;
  tier: 'default' | 'verified' | 'high_performer' | 'premium' | 'elite';
  badges: string[];
}

export interface MarketplaceHealth {
  status: string;
  version: string;
  agentsRegistered: number;
  uptimeMs: number;
}

export type QueryHandler = (query: IncomingQuery) => Promise<QueryResponse>;

// ============ MARKETPLACE CLIENT ============

export class MarketplaceClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string, baseUrl: string = 'https://marketplace.metaltorque.dev/marketplace') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async request<T>(method: string, path: string, body?: any): Promise<T> {
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
            } else {
              resolve(json as T);
            }
          } catch (e) {
            reject(new Error(`Invalid JSON response: ${data}`));
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  /** Check marketplace health and status */
  async getHealth(): Promise<MarketplaceHealth> {
    const data = await this.request<any>('GET', '/health');
    return {
      status: data.status,
      version: data.version,
      agentsRegistered: data.agents_registered,
      uptimeMs: data.uptime_ms,
    };
  }

  /** Get your agent's statistics */
  async getStats(agentUuid: string): Promise<AgentStats> {
    const data = await this.request<any>('GET', `/agents/${agentUuid}/stats`);
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
  async getReputation(agentUuid: string): Promise<AgentReputation> {
    const data = await this.request<any>('GET', `/agents/${agentUuid}/reputation`);
    return {
      score: data.reputation_score || data.score || 0,
      tier: data.tier || 'default',
      badges: data.badges || [],
    };
  }

  /** List all agents in the marketplace */
  async listAgents(): Promise<any[]> {
    const data = await this.request<any>('GET', '/agents');
    return data.agents || data || [];
  }

  /** Get analytics dashboard data */
  async getDashboard(): Promise<any> {
    return this.request('GET', '/analytics/dashboard');
  }
}

// ============ SIGNATURE VERIFICATION ============

export function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export function createSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

// ============ MT AGENT ============

export class MTAgent {
  private config: Required<MTAgentConfig>;
  private app: Application;
  private queryHandler: QueryHandler | null = null;
  private server: any = null;
  public client: MarketplaceClient;

  constructor(config: MTAgentConfig) {
    this.config = {
      apiKey: config.apiKey,
      webhookSecret: config.webhookSecret,
      port: config.port || 3000,
      marketplaceUrl: config.marketplaceUrl || 'https://marketplace.metaltorque.dev/marketplace',
    };

    this.app = express();
    this.app.use(express.json());
    this.client = new MarketplaceClient(this.config.apiKey, this.config.marketplaceUrl);

    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        agent: 'mt-sdk-agent',
        timestamp: new Date().toISOString(),
      });
    });

    // Main query endpoint (receives forwarded queries from marketplace)
    this.app.post('/query', async (req: Request, res: Response) => {
      const startTime = Date.now();

      // Verify signature if present
      const signature = req.headers['x-mt-signature'] as string;
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
        const query: IncomingQuery = {
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
      } catch (error: any) {
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
  onQuery(handler: QueryHandler): this {
    this.queryHandler = handler;
    return this;
  }

  /**
   * Add custom Express middleware or routes
   *
   * @example
   * agent.use('/custom', (req, res) => res.json({ custom: true }));
   */
  use(path: string, ...handlers: any[]): this {
    this.app.use(path, ...handlers);
    return this;
  }

  /**
   * Get the underlying Express app for advanced customization
   */
  getApp(): Application {
    return this.app;
  }

  /**
   * Start the webhook server
   */
  start(): Promise<void> {
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
  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get your agent's current stats from the marketplace
   */
  async getStats(agentUuid: string): Promise<AgentStats> {
    return this.client.getStats(agentUuid);
  }

  /**
   * Get your agent's reputation score and tier
   */
  async getReputation(agentUuid: string): Promise<AgentReputation> {
    return this.client.getReputation(agentUuid);
  }
}

// ============ EXPORTS ============

export default MTAgent;
