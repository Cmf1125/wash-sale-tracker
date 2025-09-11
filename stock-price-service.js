/**
 * Stock Price Service - Real-time stock price fetching with multiple API sources
 * Provides fallback between different APIs for reliable price data
 */

class StockPriceService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
        this.rateLimits = {
            lastRequest: 0,
            minInterval: 1000 // 1 second between requests
        };
        
        console.log('📈 Stock Price Service initialized');
    }

    /**
     * Get current stock price with caching and fallback APIs
     */
    async getStockPrice(symbol) {
        const normalizedSymbol = symbol.toUpperCase();
        
        // Check cache first
        const cached = this.getCachedPrice(normalizedSymbol);
        if (cached) {
            console.log(`📊 Cache hit for ${normalizedSymbol}: $${cached.price}`);
            return cached;
        }

        console.log(`🔍 Fetching fresh price for ${normalizedSymbol}...`);

        // Rate limiting
        await this.respectRateLimit();

        try {
            // Try multiple APIs in order of preference
            const apis = [
                () => this.fetchFromVercelAPI(normalizedSymbol)
            ];

            for (const apiCall of apis) {
                try {
                    const price = await apiCall();
                    if (price && price.price > 0) {
                        this.setCachedPrice(normalizedSymbol, price);
                        console.log(`✅ Got ${normalizedSymbol} price: $${price.price} from ${price.source}`);
                        return price;
                    }
                } catch (error) {
                    console.warn(`⚠️ API failed for ${normalizedSymbol}:`, error.message);
                    continue; // Try next API
                }
            }

            throw new Error('All price APIs failed');
            
        } catch (error) {
            console.error(`❌ Failed to get price for ${normalizedSymbol}:`, error.message || error);
            console.log(`🔄 Using fallback price for ${normalizedSymbol}`);
            return this.getFallbackPrice(normalizedSymbol);
        }
    }

    /**
     * Fetch from our Vercel API endpoint
     */
    async fetchFromVercelAPI(symbol) {
        // Use relative URL so it works both locally and on Vercel
        const url = `/api/stock-price?symbol=${symbol}`;
        
        console.log(`🔍 Fetching ${symbol} from Vercel API...`);
        
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Vercel API error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`✅ Got ${symbol} price from Vercel API:`, data);
        
        if (!data.price || data.price <= 0) {
            throw new Error('Invalid price data from Vercel API');
        }
        
        return {
            price: parseFloat(data.price),
            source: data.source || 'Vercel API',
            timestamp: new Date(data.timestamp || Date.now()),
            currency: data.currency || 'USD'
        };
    }

    /**
     * Fetch from Twelve Data (simple free API)
     */
    async fetchFromTwelveData(symbol) {
        // Twelve Data has 5 requests per minute free
        const url = `https://api.twelvedata.com/price?symbol=${symbol}&apikey=demo`;
        
        console.log(`🔍 Fetching ${symbol} from Twelve Data...`);
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Twelve Data error: ${response.status}`);
        
        const data = await response.json();
        console.log('Twelve Data response:', data);
        
        if (data.status === 'error' || !data.price) {
            throw new Error(data.message || 'No price from Twelve Data');
        }
        
        return {
            price: parseFloat(data.price),
            source: 'Twelve Data',
            timestamp: new Date(),
            currency: 'USD'
        };
    }

    /**
     * Fetch from a simple market data API
     */
    async fetchFromMarketData(symbol) {
        // Using a simple REST API
        const url = `https://api.marketdata.app/v1/stocks/quotes/${symbol}/?token=demo`;
        
        console.log(`🔍 Fetching ${symbol} from Market Data...`);
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Market Data error: ${response.status}`);
        
        const data = await response.json();
        console.log('Market Data response:', data);
        
        if (!data || !data.last || data.last.length === 0) {
            throw new Error('No price from Market Data');
        }
        
        return {
            price: parseFloat(data.last[0]),
            source: 'Market Data',
            timestamp: new Date(),
            currency: 'USD'
        };
    }

    /**
     * Fetch from a CORS-friendly proxy service
     */
    async fetchFromCORSProxy(symbol) {
        // Using a public CORS proxy to access Yahoo Finance
        const proxyUrl = 'https://api.allorigins.win/raw?url=';
        const targetUrl = encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
        const url = proxyUrl + targetUrl;
        
        console.log(`🔍 Fetching ${symbol} via CORS proxy...`);
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`CORS Proxy error: ${response.status}`);
        
        const data = await response.json();
        const result = data?.chart?.result?.[0];
        
        if (!result) throw new Error('Invalid proxy response');
        
        const price = result.meta?.regularMarketPrice || result.meta?.previousClose;
        if (!price) throw new Error('No price data from proxy');
        
        return {
            price: parseFloat(price),
            source: 'Yahoo via CORS Proxy',
            timestamp: new Date(),
            currency: result.meta?.currency || 'USD',
            marketState: result.meta?.marketState || 'UNKNOWN'
        };
    }

    /**
     * Fetch from a simple free API (no CORS issues)
     */
    async fetchFromFreeAPI(symbol) {
        // Using a truly free API that supports CORS
        const url = `https://api.fxempire.com/v1/en/stocks/chart/candles?Identifier=${symbol}.XNAS&IdentifierType=Symbol&AdjustmentMethod=All&IncludeExtended=False&period=1&Precision=Minutes&Count=1`;
        
        console.log(`🔍 Fetching ${symbol} from FXEmpire...`);
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`FXEmpire API error: ${response.status}`);
        
        const data = await response.json();
        
        if (!data || !data.candles || data.candles.length === 0) {
            throw new Error('No data from FXEmpire');
        }
        
        const candle = data.candles[0];
        return {
            price: parseFloat(candle.close),
            source: 'FXEmpire',
            timestamp: new Date(),
            currency: 'USD',
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            volume: candle.volume
        };
    }

    /**
     * Fetch from Yahoo Finance (simple endpoint)
     */
    async fetchFromYahooFinanceSimple(symbol) {
        // Try a different Yahoo endpoint that's more reliable
        const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}&fields=regularMarketPrice,currency`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        });
        
        if (!response.ok) throw new Error(`Yahoo Finance Simple error: ${response.status}`);
        
        const data = await response.json();
        const quote = data?.quoteResponse?.result?.[0];
        
        if (!quote || !quote.regularMarketPrice) {
            throw new Error('No price data from Yahoo Finance Simple');
        }
        
        return {
            price: parseFloat(quote.regularMarketPrice),
            source: 'Yahoo Finance Simple',
            timestamp: new Date(),
            currency: quote.currency || 'USD'
        };
    }

    /**
     * Fetch from Yahoo Finance (unofficial but free)
     */
    async fetchFromYahooFinance(symbol) {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Yahoo Finance API error: ${response.status}`);
        
        const data = await response.json();
        const result = data?.chart?.result?.[0];
        
        if (!result) throw new Error('Invalid Yahoo Finance response');
        
        const price = result.meta?.regularMarketPrice || result.meta?.previousClose;
        if (!price) throw new Error('No price data from Yahoo Finance');
        
        return {
            price: parseFloat(price),
            source: 'Yahoo Finance',
            timestamp: new Date(),
            currency: result.meta?.currency || 'USD',
            marketState: result.meta?.marketState || 'UNKNOWN'
        };
    }

    /**
     * Fetch from Yahoo Finance V2 (more reliable endpoint)
     */
    async fetchFromYahooFinanceV2(symbol) {
        // Try the summary endpoint which is more reliable
        const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        });
        
        if (!response.ok) throw new Error(`Yahoo Finance V2 API error: ${response.status}`);
        
        const data = await response.json();
        const priceData = data?.quoteSummary?.result?.[0]?.price;
        
        if (!priceData) throw new Error('Invalid Yahoo Finance V2 response');
        
        const price = priceData.regularMarketPrice?.raw || priceData.postMarketPrice?.raw;
        if (!price) throw new Error('No price data from Yahoo Finance V2');
        
        return {
            price: parseFloat(price),
            source: 'Yahoo Finance V2',
            timestamp: new Date(),
            currency: priceData.currency || 'USD',
            marketState: priceData.marketState || 'UNKNOWN'
        };
    }

    /**
     * Fetch from Polygon.io (free tier)
     */
    async fetchFromPolygonFree(symbol) {
        // Polygon has a generous free tier
        const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apikey=DEMO_KEY`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Polygon API error: ${response.status}`);
        
        const data = await response.json();
        
        if (!data.results || data.results.length === 0) {
            throw new Error('No data from Polygon API');
        }
        
        const result = data.results[0];
        return {
            price: parseFloat(result.c), // Close price
            source: 'Polygon.io',
            timestamp: new Date(),
            currency: 'USD',
            volume: result.v,
            high: result.h,
            low: result.l
        };
    }

    /**
     * Fetch from Financial Modeling Prep (free tier)
     */
    async fetchFromFinancialModelingPrep(symbol) {
        // FMP has a generous free tier - 250 requests per day
        const url = `https://financialmodelingprep.com/api/v3/quote-short/${symbol}?apikey=demo`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`FMP API error: ${response.status}`);
        
        const data = await response.json();
        
        if (!data || data.length === 0 || !data[0].price) {
            throw new Error('No price data from Financial Modeling Prep');
        }
        
        return {
            price: parseFloat(data[0].price),
            source: 'Financial Modeling Prep',
            timestamp: new Date(),
            currency: 'USD',
            volume: data[0].volume
        };
    }

    /**
     * Fetch from Alpha Vantage (free tier with real key)
     */
    async fetchFromAlphaVantageFree(symbol) {
        // Using a real free Alpha Vantage key (you'll need to get one at alphavantage.co/support/#api-key)
        // For now, using demo but with different endpoint
        const apiKey = 'demo';
        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=1min&apikey=${apiKey}&outputsize=compact`;
        
        console.log(`🔍 Fetching ${symbol} from Alpha Vantage...`);
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Alpha Vantage API error: ${response.status}`);
        
        const data = await response.json();
        
        if (data['Error Message'] || data['Note']) {
            throw new Error('Alpha Vantage rate limit or error');
        }
        
        const timeSeries = data['Time Series (1min)'];
        if (!timeSeries) throw new Error('No time series data from Alpha Vantage');
        
        // Get the most recent price
        const timestamps = Object.keys(timeSeries);
        if (timestamps.length === 0) throw new Error('No price data available');
        
        const latestData = timeSeries[timestamps[0]];
        return {
            price: parseFloat(latestData['4. close']),
            source: 'Alpha Vantage',
            timestamp: new Date(),
            currency: 'USD',
            high: parseFloat(latestData['2. high']),
            low: parseFloat(latestData['3. low']),
            volume: parseInt(latestData['5. volume'])
        };
    }

    /**
     * Fetch from Alpha Vantage (demo/free tier)
     */
    async fetchFromAlphaVantageDemo(symbol) {
        // Using demo API key - limited to 25 requests per day
        const apiKey = 'demo';
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Alpha Vantage API error: ${response.status}`);
        
        const data = await response.json();
        const quote = data['Global Quote'];
        
        if (!quote || !quote['05. price']) {
            throw new Error('Invalid Alpha Vantage response or rate limit exceeded');
        }
        
        return {
            price: parseFloat(quote['05. price']),
            source: 'Alpha Vantage',
            timestamp: new Date(),
            currency: 'USD',
            change: parseFloat(quote['09. change']),
            changePercent: quote['10. change percent']
        };
    }

    /**
     * Fetch from Finnhub (demo)
     */
    async fetchFromFinnhubDemo(symbol) {
        // Using free tier - 60 API calls/minute
        const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=sandbox_c4n3fgaad3i9qbp5hd00`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Finnhub API error: ${response.status}`);
        
        const data = await response.json();
        
        if (!data.c || data.c <= 0) {
            throw new Error('Invalid Finnhub response or symbol not found');
        }
        
        return {
            price: parseFloat(data.c), // Current price
            source: 'Finnhub',
            timestamp: new Date(),
            currency: 'USD',
            previousClose: parseFloat(data.pc),
            change: parseFloat(data.d),
            changePercent: parseFloat(data.dp)
        };
    }

    /**
     * Get cached price if still valid
     */
    getCachedPrice(symbol) {
        const cached = this.cache.get(symbol);
        if (cached && (Date.now() - cached.timestamp.getTime()) < this.cacheTimeout) {
            return cached;
        }
        return null;
    }

    /**
     * Cache price data
     */
    setCachedPrice(symbol, priceData) {
        this.cache.set(symbol, priceData);
        
        // Clean old cache entries periodically
        if (this.cache.size > 100) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
    }

    /**
     * Rate limiting to avoid API abuse
     */
    async respectRateLimit() {
        const timeSinceLastRequest = Date.now() - this.rateLimits.lastRequest;
        if (timeSinceLastRequest < this.rateLimits.minInterval) {
            const delay = this.rateLimits.minInterval - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        this.rateLimits.lastRequest = Date.now();
    }

    /**
     * Fallback when all APIs fail - return a reasonable estimate
     */
    getFallbackPrice(symbol) {
        console.warn(`🔄 Using fallback pricing for ${symbol}`);
        
        // Try to get from localStorage if we have historical data
        const historicalPrice = localStorage.getItem(`last_price_${symbol}`);
        if (historicalPrice) {
            const price = parseFloat(historicalPrice);
            return {
                price: price,
                source: 'Cached (offline)',
                timestamp: new Date(),
                currency: 'USD',
                isStale: true
            };
        }
        
        // Last resort - return null to indicate failure
        return null;
    }

    /**
     * Get multiple stock prices in parallel (batch)
     */
    async getBatchPrices(symbols) {
        const uniqueSymbols = [...new Set(symbols.map(s => s.toUpperCase()))];
        const promises = uniqueSymbols.map(symbol => 
            this.getStockPrice(symbol).catch(error => {
                console.error(`Failed to get price for ${symbol}:`, error);
                return null;
            })
        );
        
        const results = await Promise.all(promises);
        const priceMap = {};
        
        uniqueSymbols.forEach((symbol, index) => {
            if (results[index]) {
                priceMap[symbol] = results[index];
                // Cache successful prices to localStorage
                localStorage.setItem(`last_price_${symbol}`, results[index].price.toString());
            }
        });
        
        return priceMap;
    }

    /**
     * Clear all cached prices
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️ Price cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            symbols: Array.from(this.cache.keys()),
            oldestEntry: this.cache.size > 0 ? Math.min(...Array.from(this.cache.values()).map(v => v.timestamp.getTime())) : null
        };
    }
}

// Create global instance
window.stockPriceService = new StockPriceService();

console.log('✅ Stock Price Service loaded');