// Vercel serverless function for stock prices
// GET /api/stock-price?symbol=AAPL

export default async function handler(req, res) {
    // Enable CORS for your domain
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { symbol } = req.query;
    
    if (!symbol) {
        return res.status(400).json({ error: 'Symbol parameter required' });
    }

    // Simple rate limiting: max 10 requests per minute per IP
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    // Note: In production, you'd want to use a proper rate limiting solution
    // For now, we'll rely on Alpha Vantage's rate limits
    
    try {
        // Get Alpha Vantage API key from environment variable
        const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
        
        if (!API_KEY) {
            console.error('ALPHA_VANTAGE_API_KEY environment variable not set');
            return res.status(500).json({ error: 'API configuration error' });
        }

        // Try different Alpha Vantage endpoints for reliability
        const endpoints = [
            // Global Quote (most reliable, but slower)
            `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`,
            // Intraday (faster, but may fail for some stocks)
            `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=1min&apikey=${API_KEY}&outputsize=compact`
        ];

        for (const url of endpoints) {
            try {
                console.log(`Fetching ${symbol} from Alpha Vantage...`);
                
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                
                // Handle different response formats
                let price = null;
                let source = 'Alpha Vantage';

                // Try Global Quote format
                if (data['Global Quote'] && data['Global Quote']['05. price']) {
                    price = parseFloat(data['Global Quote']['05. price']);
                }
                // Try Intraday format
                else if (data['Time Series (1min)']) {
                    const timeSeries = data['Time Series (1min)'];
                    const timestamps = Object.keys(timeSeries);
                    if (timestamps.length > 0) {
                        price = parseFloat(timeSeries[timestamps[0]]['4. close']);
                    }
                }

                if (price && price > 0) {
                    return res.status(200).json({
                        symbol: symbol.toUpperCase(),
                        price: price,
                        source: source,
                        timestamp: new Date().toISOString(),
                        currency: 'USD'
                    });
                }

                // If we got a response but no price, check for errors
                if (data['Error Message']) {
                    throw new Error(data['Error Message']);
                }
                if (data['Note']) {
                    throw new Error('API rate limit exceeded');
                }

            } catch (error) {
                console.warn(`Endpoint failed for ${symbol}:`, error.message);
                continue; // Try next endpoint
            }
        }

        // If all Alpha Vantage endpoints fail, return an error
        return res.status(503).json({
            error: 'Unable to fetch stock price',
            symbol: symbol.toUpperCase(),
            message: 'All data sources temporarily unavailable'
        });

    } catch (error) {
        console.error(`Error fetching price for ${symbol}:`, error);
        return res.status(500).json({
            error: 'Internal server error',
            symbol: symbol.toUpperCase()
        });
    }
}