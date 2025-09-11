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
                () => this.fetchFromGoogleFinance(normalizedSymbol),
                () => this.fetchFromYahooFinanceSimple(normalizedSymbol),
                () => this.fetchFromYahooFinanceV2(normalizedSymbol)
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
     * Fetch from Google Finance (reliable and free)
     */
    async fetchFromGoogleFinance(symbol) {
        // Google Finance search API - no key required
        const url = `https://www.google.com/finance/quote/${symbol}:NASDAQ`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        });
        
        if (!response.ok) throw new Error(`Google Finance error: ${response.status}`);
        
        const html = await response.text();
        
        // Extract price from HTML - Google shows it in a specific div
        const priceMatch = html.match(/data-last-price="([^"]+)"/);
        const currencyMatch = html.match(/data-currency-code="([^"]+)"/);
        
        if (!priceMatch) throw new Error('Could not find price in Google Finance response');
        
        return {
            price: parseFloat(priceMatch[1]),
            source: 'Google Finance',
            timestamp: new Date(),
            currency: currencyMatch ? currencyMatch[1] : 'USD'
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