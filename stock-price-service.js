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

        // Rate limiting
        await this.respectRateLimit();

        try {
            // Try multiple APIs in order of preference
            const apis = [
                () => this.fetchFromYahooFinance(normalizedSymbol),
                () => this.fetchFromAlphaVantageDemo(normalizedSymbol),
                () => this.fetchFromFinnhubDemo(normalizedSymbol)
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
            console.error(`❌ Failed to get price for ${normalizedSymbol}:`, error);
            return this.getFallbackPrice(normalizedSymbol);
        }
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