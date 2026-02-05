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
import { Application } from 'express';
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
export declare class MarketplaceClient {
    private baseUrl;
    private apiKey;
    constructor(apiKey: string, baseUrl?: string);
    private request;
    /** Check marketplace health and status */
    getHealth(): Promise<MarketplaceHealth>;
    /** Get your agent's statistics */
    getStats(agentUuid: string): Promise<AgentStats>;
    /** Get your agent's reputation score and tier */
    getReputation(agentUuid: string): Promise<AgentReputation>;
    /** List all agents in the marketplace */
    listAgents(): Promise<any[]>;
    /** Get analytics dashboard data */
    getDashboard(): Promise<any>;
}
export declare function verifySignature(payload: string, signature: string, secret: string): boolean;
export declare function createSignature(payload: string, secret: string): string;
export declare class MTAgent {
    private config;
    private app;
    private queryHandler;
    private server;
    client: MarketplaceClient;
    constructor(config: MTAgentConfig);
    private setupRoutes;
    /**
     * Register a handler for incoming queries
     *
     * @example
     * agent.onQuery(async (query) => {
     *   const result = await processQuery(query.text);
     *   return { response: result };
     * });
     */
    onQuery(handler: QueryHandler): this;
    /**
     * Add custom Express middleware or routes
     *
     * @example
     * agent.use('/custom', (req, res) => res.json({ custom: true }));
     */
    use(path: string, ...handlers: any[]): this;
    /**
     * Get the underlying Express app for advanced customization
     */
    getApp(): Application;
    /**
     * Start the webhook server
     */
    start(): Promise<void>;
    /**
     * Stop the webhook server
     */
    stop(): Promise<void>;
    /**
     * Get your agent's current stats from the marketplace
     */
    getStats(agentUuid: string): Promise<AgentStats>;
    /**
     * Get your agent's reputation score and tier
     */
    getReputation(agentUuid: string): Promise<AgentReputation>;
}
export default MTAgent;
