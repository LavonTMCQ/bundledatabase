import { gql } from 'mercurius';

// Define GraphQL schema
export const schema = gql`
  # Token type
  type Token {
    policyId: String!
    assetName: String
    decimals: Int
    marketCapAda: Float
    holderCount: Int
    maxRiskScore: Float
    firstSeen: String
  }

  # Wallet type
  type Wallet {
    stakeCred: String!
    flags: JSON
    clusterId: Int
    holdings: [TokenHolding]
    edges: [WalletEdge]
  }

  # Token holding type
  type TokenHolding {
    policyId: String!
    balance: String
    lastSeen: String
  }

  # Wallet edge type
  type WalletEdge {
    dst: String!
    relation: String!
    weight: Float
  }

  # Cluster type
  type Cluster {
    clusterId: Int!
    riskScore: Float
    tags: [String]
    members: [Wallet]
    history: [RiskHistory]
  }

  # Risk history type
  type RiskHistory {
    score: Float
    timestamp: String
  }

  # JSON scalar type
  scalar JSON

  # Query type
  type Query {
    # Get all tokens
    tokens: [Token]
    
    # Get token by policy ID
    token(policyId: String!): Token
    
    # Get wallet graph for a token
    tokenGraph(policyId: String!): [Wallet]
    
    # Get cluster by ID
    cluster(clusterId: Int!): Cluster
    
    # Get clusters with risk score above threshold
    highRiskClusters(threshold: Float = 5): [Cluster]
    
    # Get wallet by stake credential
    wallet(stakeCred: String!): Wallet
    
    # Search wallets by flags
    searchWallets(flags: JSON): [Wallet]
  }
`;

// Define resolvers
export const resolvers = {
  Query: {
    // Get all tokens
    tokens: async (_: any, __: any, { pg }: { pg: any }) => {
      const { rows } = await pg.query(`
        SELECT 
          t.policy_id as "policyId", 
          t.asset_name as "assetName", 
          t.decimals,
          t.market_cap_ada as "marketCapAda",
          COUNT(DISTINCT th.stake_cred) as "holderCount",
          MAX(c.risk_score) as "maxRiskScore",
          t.first_seen as "firstSeen"
        FROM token t
        LEFT JOIN token_holding th ON th.policy_id = t.policy_id
        LEFT JOIN cluster_member cm ON cm.stake_cred = th.stake_cred
        LEFT JOIN cluster c ON c.cluster_id = cm.cluster_id
        GROUP BY t.policy_id, t.asset_name, t.decimals, t.market_cap_ada, t.first_seen
        ORDER BY t.first_seen DESC
      `);
      
      return rows;
    },
    
    // Get token by policy ID
    token: async (_: any, { policyId }: { policyId: string }, { pg }: { pg: any }) => {
      const { rows } = await pg.query(`
        SELECT 
          t.policy_id as "policyId", 
          t.asset_name as "assetName", 
          t.decimals,
          t.market_cap_ada as "marketCapAda",
          COUNT(DISTINCT th.stake_cred) as "holderCount",
          MAX(c.risk_score) as "maxRiskScore",
          t.first_seen as "firstSeen"
        FROM token t
        LEFT JOIN token_holding th ON th.policy_id = t.policy_id
        LEFT JOIN cluster_member cm ON cm.stake_cred = th.stake_cred
        LEFT JOIN cluster c ON c.cluster_id = cm.cluster_id
        WHERE t.policy_id = $1
        GROUP BY t.policy_id, t.asset_name, t.decimals, t.market_cap_ada, t.first_seen
      `, [policyId]);
      
      return rows[0];
    },
    
    // Get wallet graph for a token
    tokenGraph: async (_: any, { policyId }: { policyId: string }, { pg }: { pg: any }) => {
      const { rows } = await pg.query(`
        SELECT 
          w.stake_cred as "stakeCred", 
          w.flags,
          cm.cluster_id as "clusterId",
          json_agg(
            json_build_object(
              'dst', e.dst, 
              'relation', e.relation, 
              'weight', e.weight
            )
          ) as edges
        FROM wallet w
        JOIN token_holding th ON th.stake_cred = w.stake_cred
        LEFT JOIN cluster_member cm ON cm.stake_cred = w.stake_cred
        LEFT JOIN wallet_edge e ON e.src = w.stake_cred
        WHERE th.policy_id = $1
        GROUP BY w.stake_cred, w.flags, cm.cluster_id
      `, [policyId]);
      
      return rows;
    },
    
    // Get cluster by ID
    cluster: async (_: any, { clusterId }: { clusterId: number }, { pg }: { pg: any }) => {
      // Get cluster details
      const { rows: clusterDetails } = await pg.query(`
        SELECT 
          c.cluster_id as "clusterId", 
          c.risk_score as "riskScore", 
          c.tags
        FROM cluster c
        WHERE c.cluster_id = $1
      `, [clusterId]);
      
      if (clusterDetails.length === 0) {
        return null;
      }
      
      // Get risk history
      const { rows: history } = await pg.query(`
        SELECT 
          score, 
          ts as timestamp
        FROM cluster_score_history
        WHERE cluster_id = $1
        ORDER BY ts DESC
        LIMIT 30
      `, [clusterId]);
      
      return {
        ...clusterDetails[0],
        history
      };
    },
    
    // Get clusters with risk score above threshold
    highRiskClusters: async (_: any, { threshold }: { threshold: number }, { pg }: { pg: any }) => {
      const { rows } = await pg.query(`
        SELECT 
          c.cluster_id as "clusterId", 
          c.risk_score as "riskScore", 
          c.tags
        FROM cluster c
        WHERE c.risk_score > $1
        ORDER BY c.risk_score DESC
      `, [threshold]);
      
      return rows;
    },
    
    // Get wallet by stake credential
    wallet: async (_: any, { stakeCred }: { stakeCred: string }, { pg }: { pg: any }) => {
      const { rows } = await pg.query(`
        SELECT 
          w.stake_cred as "stakeCred", 
          w.flags,
          cm.cluster_id as "clusterId"
        FROM wallet w
        LEFT JOIN cluster_member cm ON cm.stake_cred = w.stake_cred
        WHERE w.stake_cred = $1
      `, [stakeCred]);
      
      if (rows.length === 0) {
        return null;
      }
      
      return rows[0];
    },
    
    // Search wallets by flags
    searchWallets: async (_: any, { flags }: { flags: any }, { pg }: { pg: any }) => {
      // Convert flags object to JSON string for query
      const flagsJson = JSON.stringify(flags);
      
      const { rows } = await pg.query(`
        SELECT 
          w.stake_cred as "stakeCred", 
          w.flags,
          cm.cluster_id as "clusterId"
        FROM wallet w
        LEFT JOIN cluster_member cm ON cm.stake_cred = w.stake_cred
        WHERE w.flags @> $1::jsonb
      `, [flagsJson]);
      
      return rows;
    }
  },
  
  // Resolver for Wallet type to get holdings
  Wallet: {
    holdings: async (parent: any, _: any, { pg }: { pg: any }) => {
      const { rows } = await pg.query(`
        SELECT 
          th.policy_id as "policyId",
          th.balance,
          th.last_seen as "lastSeen"
        FROM token_holding th
        WHERE th.stake_cred = $1
      `, [parent.stakeCred]);
      
      return rows;
    }
  },
  
  // Resolver for Cluster type to get members
  Cluster: {
    members: async (parent: any, _: any, { pg }: { pg: any }) => {
      const { rows } = await pg.query(`
        SELECT 
          w.stake_cred as "stakeCred", 
          w.flags,
          cm.cluster_id as "clusterId"
        FROM cluster_member cm
        JOIN wallet w ON w.stake_cred = cm.stake_cred
        WHERE cm.cluster_id = $1
      `, [parent.clusterId]);
      
      return rows;
    }
  }
};
