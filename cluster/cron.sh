#!/bin/bash
# Cron script to run cluster and risk analysis nightly

# Load environment variables
source ../.env

# Log file
LOG_FILE="./cluster_cron.log"

echo "$(date): Starting Cabal cluster and risk analysis" >> $LOG_FILE

# Run cluster analysis
echo "$(date): Running cluster analysis..." >> $LOG_FILE
node cluster.js >> $LOG_FILE 2>&1
if [ $? -ne 0 ]; then
  echo "$(date): ERROR: Cluster analysis failed" >> $LOG_FILE
  exit 1
fi

# Run risk scoring
echo "$(date): Running risk scoring..." >> $LOG_FILE
node risk.js >> $LOG_FILE 2>&1
if [ $? -ne 0 ]; then
  echo "$(date): ERROR: Risk scoring failed" >> $LOG_FILE
  exit 1
fi

# Send alert if configured
if [ ! -z "$ALERT_WEBHOOK" ]; then
  # Get high-risk clusters (risk score > 5)
  HIGH_RISK_CLUSTERS=$(psql -t -c "SELECT cluster_id, risk_score FROM cluster WHERE risk_score > 5 ORDER BY risk_score DESC LIMIT 5")
  
  if [ ! -z "$HIGH_RISK_CLUSTERS" ]; then
    echo "$(date): Sending alert for high-risk clusters..." >> $LOG_FILE
    
    # Format message for Discord webhook
    MESSAGE="High-risk clusters detected:\n$HIGH_RISK_CLUSTERS"
    
    # Send to webhook
    curl -H "Content-Type: application/json" \
      -d "{\"content\": \"$MESSAGE\"}" \
      $ALERT_WEBHOOK
  fi
fi

echo "$(date): Cabal cluster and risk analysis completed successfully" >> $LOG_FILE
