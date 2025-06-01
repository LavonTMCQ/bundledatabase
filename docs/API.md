# API Documentation - MISTER Risk Analysis Platform

## 🔗 API Endpoints

### Risk Analysis API (Port 4000)

#### Health Check
```http
GET /health
```
**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-12-29T...",
  "service": "MISTER Risk Analysis API"
}
```

#### Token Analysis
```http
GET /analyze/{policyId}?ticker={ticker}
```
**Parameters:**
- `policyId` (required): 56-character hex policy ID
- `ticker` (optional): Token ticker for enhanced analysis

**Response:**
```json
{
  "success": true,
  "data": {
    "policyId": "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f",
    "ticker": "SNEK",
    "riskScore": 3,
    "verdict": "SAFE",
    "analysis": {
      "holderConcentration": 15.2,
      "topHolders": [...],
      "socialLinks": {...},
      "marketData": {...}
    }
  }
}
```

### Token Database API (Port 3456)

#### Find Token by Ticker
```http
GET /api/token/find?ticker={ticker}
```
**Response:**
```json
{
  "success": true,
  "token": {
    "policyId": "279c909f...",
    "unit": "279c909f...534e454b",
    "ticker": "SNEK",
    "name": "SNEK",
    "price": 0.004,
    "socialLinks": {...}
  }
}
```

#### Search Tokens
```http
GET /api/token/search?q={query}&limit={limit}
```

#### Get All Tokens
```http
GET /api/tokens?page={page}&limit={limit}&orderBy={orderBy}
```

#### Database Statistics
```http
GET /api/stats
```

## 🔧 Integration Examples

### Discord Bot Integration
```javascript
// Find token by ticker
const response = await axios.get(`http://localhost:3456/api/token/find?ticker=${ticker}`);
if (response.data.success) {
  const token = response.data.token;
  // Analyze with risk API
  const analysis = await axios.get(`http://localhost:4000/analyze/${token.policyId}?ticker=${ticker}`);
}
```

### TapTools Integration
```javascript
// Get top volume tokens
const tokens = await tapTools.getTopVolumeTokens('1h', 50);

// Get token social links
const links = await tapTools.getTokenLinks(unit);

// Get holder data
const holders = await tapTools.getTopTokenHolders(unit, 1, 100);
```

## 📊 Rate Limiting

- **TapTools API**: 1-2 second delays between requests
- **Blockfrost API**: Built-in rate limiting
- **Internal APIs**: No rate limiting (local)

## 🔐 Authentication

- **Discord Bot**: Uses bot token in headers
- **TapTools**: API key in request headers
- **Blockfrost**: Project ID in headers
- **Internal APIs**: No authentication required

## 🚨 Error Handling

All APIs return consistent error format:
```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE"
}
```

## 📈 Response Times

- **Token Lookup**: <100ms
- **Risk Analysis**: 1-3 seconds
- **Database Operations**: <50ms
- **External API Calls**: 500ms-2s
