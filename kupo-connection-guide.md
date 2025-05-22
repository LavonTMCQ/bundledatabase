# Connecting to Kupo Cardano Indexer

## Overview
This guide explains how to connect to a Kupo instance to retrieve Cardano blockchain data.

## What is Kupo?
Kupo is a lightweight, scalable Cardano chain indexer that allows you to query transaction history, UTXOs, and other blockchain data for specific addresses.

## Connection Details
- **Endpoint URL**: `http://51.89.7.13:1442`
- **API Method**: HTTP GET
- **Port**: 1442

## Basic Usage

### Query Address Transaction History
To retrieve the transaction history for a Cardano address:

```bash
curl "http://51.89.7.13:1442/matches/{cardano_address}"
```

Replace `{cardano_address}` with a valid Cardano address (bech32 format starting with "addr1").

### Example
```bash
curl "http://51.89.7.13:1442/matches/addr1q82j3cnhky8u0w4wa0ntsgeypraf24jxz5qr6wgwcy97u7t8pvpwk4ker5z2lmfsjlvx0y2tex68ahdwql9xkm9urxks9n2nl8"
```

## Response Format
The response is a JSON array containing transaction details for the queried address:
- `transaction_id`: The transaction hash
- `output_index`: Index of the output in the transaction
- `address`: Cardano address
- `value`: Contains both ADA coins and native assets
- `created_at`: When the UTXO was created
- `spent_at`: If/when the UTXO was spent

## Error Handling
If you receive an error about an invalid pattern, make sure you're using a proper Cardano address format.

## Further Resources
For more information on Kupo and its API:
- [Kupo Documentation](https://cardanosolutions.github.io/kupo)
- You can explore additional endpoints and parameters in the documentation

## Note
This is a direct connection to a specific Kupo instance. For production applications, consider running your own Kupo instance or using a reliable service provider. 