#!/bin/bash

# Batch Token Analysis Script
# This script analyzes tokens from your Railway database and stores results locally

echo "🚀 Starting Batch Token Analysis"
echo "=================================="

# Configuration
BATCH_SIZE=${1:-10}
MAX_TOKENS=${2:-50}
START_OFFSET=${3:-0}
DELAY_BETWEEN_REQUESTS=2
DELAY_BETWEEN_BATCHES=10

# Railway database connection
RAILWAY_HOST="trolley.proxy.rlwy.net"
RAILWAY_PORT="30487"
RAILWAY_DB="railway"
RAILWAY_USER="postgres"
RAILWAY_PASS="jnZORZUDtetoUczuKrlvKVNYzrIfLFpc"

# API endpoint
API_URL="http://localhost:4000"

echo "📊 Configuration:"
echo "  Batch size: $BATCH_SIZE"
echo "  Max tokens: $MAX_TOKENS"
echo "  Start offset: $START_OFFSET"
echo "  API URL: $API_URL"
echo ""

# Function to get tokens from Railway database
get_tokens() {
    local limit=$1
    local offset=$2
    
    PGPASSWORD=$RAILWAY_PASS psql -h $RAILWAY_HOST -U $RAILWAY_USER -p $RAILWAY_PORT -d $RAILWAY_DB -t -c "
        SELECT policy_id || '|' || COALESCE(asset_name, '') || '|' || COALESCE(ticker, '') || '|' || COALESCE(name, '') 
        FROM tokens 
        ORDER BY volume_24h DESC NULLS LAST
        LIMIT $limit OFFSET $offset;
    " 2>/dev/null | sed 's/^ *//' | grep -v '^$'
}

# Function to analyze a single token
analyze_token() {
    local policy_id=$1
    local asset_name=$2
    local ticker=$3
    local name=$4
    
    local display_name="${name:-${ticker:-Unknown}}"
    echo "  🔍 Analyzing: $display_name ($policy_id)"
    
    # Build URL
    local url="$API_URL/analyze/$policy_id"
    if [ -n "$asset_name" ]; then
        url="$url?assetName=$asset_name&format=beautiful"
    else
        url="$url?format=beautiful"
    fi
    
    # Make request
    local response=$(curl -s "$url" 2>/dev/null)
    local exit_code=$?
    
    if [ $exit_code -eq 0 ] && echo "$response" | jq -e '.summary' >/dev/null 2>&1; then
        local risk_score=$(echo "$response" | jq -r '.summary.riskScore // "N/A"')
        local risk_level=$(echo "$response" | jq -r '.summary.riskLevel // "unknown"')
        local top_holder=$(echo "$response" | jq -r '.summary.topHolderPercentage // "N/A"')
        local verdict=$(echo "$response" | jq -r '.summary.verdict // "UNKNOWN"')
        
        case $verdict in
            "SAFE") echo "    ✅ $display_name: Risk $risk_score/10 ($risk_level) - Top holder $top_holder% - $verdict" ;;
            "CAUTION") echo "    ⚠️  $display_name: Risk $risk_score/10 ($risk_level) - Top holder $top_holder% - $verdict" ;;
            "AVOID") echo "    🚨 $display_name: Risk $risk_score/10 ($risk_level) - Top holder $top_holder% - $verdict" ;;
            *) echo "    ❓ $display_name: Risk $risk_score/10 ($risk_level) - Top holder $top_holder% - $verdict" ;;
        esac
        return 0
    else
        echo "    ❌ $display_name: Analysis failed"
        return 1
    fi
}

# Main processing loop
processed=0
successful=0
errors=0
offset=$START_OFFSET

echo "🔄 Starting analysis..."
echo ""

while [ $processed -lt $MAX_TOKENS ]; do
    remaining=$((MAX_TOKENS - processed))
    current_batch_size=$((remaining < BATCH_SIZE ? remaining : BATCH_SIZE))
    
    echo "📦 Processing batch $((offset / BATCH_SIZE + 1)) (up to $current_batch_size tokens)"
    
    # Get tokens for this batch
    tokens=$(get_tokens $current_batch_size $offset)
    
    if [ -z "$tokens" ]; then
        echo "No more tokens to process"
        break
    fi
    
    # Process each token in the batch
    while IFS='|' read -r policy_id asset_name ticker name; do
        if [ -n "$policy_id" ]; then
            if analyze_token "$policy_id" "$asset_name" "$ticker" "$name"; then
                ((successful++))
            else
                ((errors++))
            fi
            
            ((processed++))
            
            # Rate limiting
            if [ $processed -lt $MAX_TOKENS ]; then
                sleep $DELAY_BETWEEN_REQUESTS
            fi
        fi
    done <<< "$tokens"
    
    offset=$((offset + current_batch_size))
    
    # Progress update
    echo ""
    echo "📊 Progress: $processed/$MAX_TOKENS tokens processed ($successful successful, $errors errors)"
    
    # Pause between batches
    if [ $processed -lt $MAX_TOKENS ] && [ -n "$(get_tokens 1 $offset)" ]; then
        echo "⏸️  Pausing $DELAY_BETWEEN_BATCHES seconds between batches..."
        echo ""
        sleep $DELAY_BETWEEN_BATCHES
    fi
done

echo ""
echo "🎉 Batch analysis complete!"
echo "📈 Final Results:"
echo "  ✅ Successful: $successful"
echo "  ❌ Errors: $errors"
echo "  📊 Total processed: $processed"

# Show summary if API is working
echo ""
echo "📊 Attempting to retrieve summary statistics..."
summary=$(curl -s "$API_URL/stats" 2>/dev/null)
if echo "$summary" | jq -e '.total_tokens' >/dev/null 2>&1; then
    total=$(echo "$summary" | jq -r '.total_tokens')
    echo "  Total tokens in database: $total"
    
    echo "$summary" | jq -r '.by_risk_level[]? | "  \(.risk_level): \(.count) tokens (avg risk: \(.avg_risk_score | tonumber | . * 10 | round / 10))"'
else
    echo "  Could not retrieve summary statistics"
fi

echo ""
echo "✨ Analysis complete! Use the following endpoints to query results:"
echo "  Safe tokens: curl '$API_URL/safe-tokens'"
echo "  Risky tokens: curl '$API_URL/risky-tokens'"
echo "  Statistics: curl '$API_URL/stats'"
