declare class MetalTorque {
  constructor(apiKey: string, options?: { baseUrl?: string; wallet?: string });
  
  query(queryText: string, options?: {
    txHash?: string;
    wallet?: string;
    amount?: number;
  }): Promise<{
    success: boolean;
    intent: string;
    services: string[];
    result: {
      search_results?: any;
      analysis?: any;
      blockchain_data?: any;
    };
    cost: {
      service_costs: Record<string, number>;
      mt_charged: number;
      mt_profit: number;
    };
  }>;

  search(queryText: string, options?: any): Promise<any>;
  analyze(queryText: string, options?: any): Promise<any>;
  blockchain(queryText: string, options?: any): Promise<any>;
  detectIntent(queryText: string): Promise<{ intent: string; services: string[] }>;
  health(): Promise<{ status: string }>;
  stats(): Promise<any>;
}

export = MetalTorque;
