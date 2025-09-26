/**
 * Similar Stocks Engine - Find correlated alternatives to avoid wash sales
 * Implements sector-based, market cap, and correlation analysis
 */

class SimilarStocksEngine {
    constructor() {
        this.sectorMappings = this.initializeSectorMappings();
        this.stockDatabase = this.initializeStockDatabase();
        this.correlationCache = new Map();
        console.log('🔍 Similar Stocks Engine initialized');
    }

    /**
     * Initialize comprehensive sector and industry mappings
     */
    initializeSectorMappings() {
        return {
            // Technology
            'AAPL': { sector: 'Technology', industry: 'Consumer Electronics', marketCap: 'large' },
            'MSFT': { sector: 'Technology', industry: 'Software', marketCap: 'large' },
            'GOOGL': { sector: 'Technology', industry: 'Internet', marketCap: 'large' },
            'GOOG': { sector: 'Technology', industry: 'Internet', marketCap: 'large' },
            'META': { sector: 'Technology', industry: 'Social Media', marketCap: 'large' },
            'TSLA': { sector: 'Technology', industry: 'Electric Vehicles', marketCap: 'large' },
            'NVDA': { sector: 'Technology', industry: 'Semiconductors', marketCap: 'large' },
            'AMD': { sector: 'Technology', industry: 'Semiconductors', marketCap: 'large' },
            'INTC': { sector: 'Technology', industry: 'Semiconductors', marketCap: 'large' },
            'ORCL': { sector: 'Technology', industry: 'Software', marketCap: 'large' },
            'CRM': { sector: 'Technology', industry: 'Software', marketCap: 'large' },
            'ADBE': { sector: 'Technology', industry: 'Software', marketCap: 'large' },
            
            // Financial Services
            'JPM': { sector: 'Financial', industry: 'Banking', marketCap: 'large' },
            'BAC': { sector: 'Financial', industry: 'Banking', marketCap: 'large' },
            'WFC': { sector: 'Financial', industry: 'Banking', marketCap: 'large' },
            'GS': { sector: 'Financial', industry: 'Investment Banking', marketCap: 'large' },
            'MS': { sector: 'Financial', industry: 'Investment Banking', marketCap: 'large' },
            'V': { sector: 'Financial', industry: 'Payment Processing', marketCap: 'large' },
            'MA': { sector: 'Financial', industry: 'Payment Processing', marketCap: 'large' },
            'BRK.B': { sector: 'Financial', industry: 'Insurance', marketCap: 'large' },
            
            // Healthcare
            'JNJ': { sector: 'Healthcare', industry: 'Pharmaceuticals', marketCap: 'large' },
            'PFE': { sector: 'Healthcare', industry: 'Pharmaceuticals', marketCap: 'large' },
            'ABBV': { sector: 'Healthcare', industry: 'Pharmaceuticals', marketCap: 'large' },
            'MRK': { sector: 'Healthcare', industry: 'Pharmaceuticals', marketCap: 'large' },
            'LLY': { sector: 'Healthcare', industry: 'Pharmaceuticals', marketCap: 'large' },
            'UNH': { sector: 'Healthcare', industry: 'Health Insurance', marketCap: 'large' },
            
            // Consumer Goods
            'PG': { sector: 'Consumer Goods', industry: 'Personal Care', marketCap: 'large' },
            'KO': { sector: 'Consumer Goods', industry: 'Beverages', marketCap: 'large' },
            'PEP': { sector: 'Consumer Goods', industry: 'Beverages', marketCap: 'large' },
            'WMT': { sector: 'Consumer Goods', industry: 'Retail', marketCap: 'large' },
            'COST': { sector: 'Consumer Goods', industry: 'Retail', marketCap: 'large' },
            'HD': { sector: 'Consumer Goods', industry: 'Home Improvement', marketCap: 'large' },
            'MCD': { sector: 'Consumer Goods', industry: 'Restaurants', marketCap: 'large' },
            'SBUX': { sector: 'Consumer Goods', industry: 'Restaurants', marketCap: 'large' },
            
            // Energy
            'XOM': { sector: 'Energy', industry: 'Oil & Gas', marketCap: 'large' },
            'CVX': { sector: 'Energy', industry: 'Oil & Gas', marketCap: 'large' },
            'COP': { sector: 'Energy', industry: 'Oil & Gas', marketCap: 'large' },
            
            // Industrial
            'BA': { sector: 'Industrial', industry: 'Aerospace', marketCap: 'large' },
            'CAT': { sector: 'Industrial', industry: 'Heavy Machinery', marketCap: 'large' },
            'GE': { sector: 'Industrial', industry: 'Conglomerate', marketCap: 'large' },
            
            // ETFs for sector exposure
            'QQQ': { sector: 'ETF', industry: 'Technology ETF', marketCap: 'large' },
            'SPY': { sector: 'ETF', industry: 'S&P 500 ETF', marketCap: 'large' },
            'VTI': { sector: 'ETF', industry: 'Total Market ETF', marketCap: 'large' },
            'XLK': { sector: 'ETF', industry: 'Technology ETF', marketCap: 'large' },
            'XLF': { sector: 'ETF', industry: 'Financial ETF', marketCap: 'large' },
            'XLV': { sector: 'ETF', industry: 'Healthcare ETF', marketCap: 'large' },
            'XLE': { sector: 'ETF', industry: 'Energy ETF', marketCap: 'large' },
        };
    }

    /**
     * Initialize stock correlation database
     */
    initializeStockDatabase() {
        return {
            // High correlation pairs (based on historical data)
            correlations: {
                'AAPL': ['MSFT', 'GOOGL', 'QQQ', 'XLK'],
                'MSFT': ['AAPL', 'GOOGL', 'ORCL', 'CRM'],
                'GOOGL': ['MSFT', 'META', 'AAPL', 'QQQ'],
                'META': ['GOOGL', 'SNAP', 'TWTR', 'QQQ'],
                'TSLA': ['NIO', 'RIVN', 'LCID', 'F'],
                'NVDA': ['AMD', 'INTC', 'AVGO', 'XLK'],
                'AMD': ['NVDA', 'INTC', 'MU', 'XLK'],
                'JPM': ['BAC', 'WFC', 'C', 'XLF'],
                'V': ['MA', 'PYPL', 'SQ', 'XLF'],
                'JNJ': ['PFE', 'MRK', 'ABBV', 'XLV'],
            }
        };
    }

    /**
     * Find similar stocks for wash sale avoidance
     * @param {string} symbol - Original stock symbol
     * @param {number} maxSuggestions - Maximum number of suggestions
     * @returns {Array} Array of similar stock suggestions
     */
    async findSimilarStocks(symbol, maxSuggestions = 5) {
        console.log(`🔍 Finding similar stocks for ${symbol}`);
        
        const originalStock = this.sectorMappings[symbol];
        if (!originalStock) {
            console.warn(`❌ Stock ${symbol} not found in database`);
            return [];
        }

        const suggestions = [];

        // 1. Direct correlations from database
        const directCorrelations = this.stockDatabase.correlations[symbol] || [];
        directCorrelations.forEach(correlatedSymbol => {
            if (this.sectorMappings[correlatedSymbol]) {
                suggestions.push({
                    symbol: correlatedSymbol,
                    reason: 'High Historical Correlation',
                    confidence: 0.9,
                    type: 'correlation',
                    ...this.sectorMappings[correlatedSymbol]
                });
            }
        });

        // 2. Same sector alternatives
        Object.entries(this.sectorMappings).forEach(([otherSymbol, data]) => {
            if (otherSymbol !== symbol && 
                data.sector === originalStock.sector &&
                !suggestions.find(s => s.symbol === otherSymbol)) {
                
                let confidence = 0.7;
                let reason = `Same Sector: ${data.sector}`;
                
                // Higher confidence for same industry
                if (data.industry === originalStock.industry) {
                    confidence = 0.8;
                    reason = `Same Industry: ${data.industry}`;
                }

                suggestions.push({
                    symbol: otherSymbol,
                    reason,
                    confidence,
                    type: 'sector',
                    ...data
                });
            }
        });

        // 3. ETF alternatives for broad exposure
        const sectorETFs = this.getSectorETFs(originalStock.sector);
        sectorETFs.forEach(etfSymbol => {
            if (!suggestions.find(s => s.symbol === etfSymbol)) {
                suggestions.push({
                    symbol: etfSymbol,
                    reason: `${originalStock.sector} Sector ETF`,
                    confidence: 0.6,
                    type: 'etf',
                    ...this.sectorMappings[etfSymbol]
                });
            }
        });

        // Sort by confidence and return top suggestions
        return suggestions
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, maxSuggestions)
            .map(suggestion => ({
                ...suggestion,
                riskScore: this.calculateRiskScore(symbol, suggestion.symbol),
                washSafeScore: this.calculateWashSafeScore(originalStock, suggestion)
            }));
    }

    /**
     * Get sector-specific ETFs
     */
    getSectorETFs(sector) {
        const etfMapping = {
            'Technology': ['XLK', 'QQQ', 'VGT', 'FTEC'],
            'Financial': ['XLF', 'VFH', 'FREL'],
            'Healthcare': ['XLV', 'VHT', 'FHLC'],
            'Energy': ['XLE', 'VDE', 'FENY'],
            'Consumer Goods': ['XLY', 'XLP', 'VCR', 'VDC'],
            'Industrial': ['XLI', 'VIS', 'FIDU']
        };
        
        return etfMapping[sector] || ['SPY', 'VTI']; // Default to broad market
    }

    /**
     * Calculate risk score for similarity
     */
    calculateRiskScore(originalSymbol, similarSymbol) {
        // Lower risk score = better alternative
        const original = this.sectorMappings[originalSymbol];
        const similar = this.sectorMappings[similarSymbol];
        
        if (!original || !similar) return 0.5;
        
        let riskScore = 0;
        
        // Same sector increases risk slightly (more correlation)
        if (original.sector === similar.sector) riskScore += 0.2;
        
        // Same industry increases risk more
        if (original.industry === similar.industry) riskScore += 0.3;
        
        // ETFs generally lower risk
        if (similar.sector === 'ETF') riskScore -= 0.2;
        
        return Math.max(0, Math.min(1, riskScore));
    }

    /**
     * Calculate wash sale safety score
     */
    calculateWashSafeScore(originalStock, suggestion) {
        let score = 1.0; // Perfect score = 1.0
        
        // Reduce score for same industry
        if (originalStock.industry === suggestion.industry) score -= 0.3;
        
        // Reduce score for same sector
        if (originalStock.sector === suggestion.sector) score -= 0.2;
        
        // ETFs are generally safer
        if (suggestion.sector === 'ETF') score += 0.1;
        
        // High correlation reduces safety
        if (suggestion.type === 'correlation') score -= 0.2;
        
        return Math.max(0, Math.min(1, score));
    }

    /**
     * Get wash sale prevention suggestions when selling at a loss
     */
    async getWashSalePreventionSuggestions(symbol, sellQuantity, expectedLoss) {
        const similarStocks = await this.findSimilarStocks(symbol);
        
        return {
            originalStock: {
                symbol,
                quantity: sellQuantity,
                expectedLoss,
                sector: this.sectorMappings[symbol]?.sector,
                industry: this.sectorMappings[symbol]?.industry
            },
            alternatives: similarStocks.map(stock => ({
                ...stock,
                recommendedAction: this.getRecommendedAction(stock, sellQuantity),
                taxImplication: this.calculateTaxImplication(expectedLoss, stock.washSafeScore)
            })),
            strategy: this.generateTaxStrategy(symbol, sellQuantity, expectedLoss, similarStocks)
        };
    }

    /**
     * Generate recommended action for each alternative
     */
    getRecommendedAction(stock, originalQuantity) {
        if (stock.type === 'etf') {
            return `Buy ${Math.floor(originalQuantity * 0.8)} shares of ${stock.symbol} for sector exposure`;
        } else if (stock.washSafeScore > 0.7) {
            return `Buy ${originalQuantity} shares of ${stock.symbol} as direct substitute`;
        } else {
            return `Consider ${stock.symbol} but monitor correlation closely`;
        }
    }

    /**
     * Calculate tax implications
     */
    calculateTaxImplication(expectedLoss, washSafeScore) {
        const taxBenefit = expectedLoss * 0.24; // Assuming 24% tax bracket
        const riskAdjustedBenefit = taxBenefit * washSafeScore;
        
        return {
            potentialTaxSavings: taxBenefit,
            riskAdjustedSavings: riskAdjustedBenefit,
            confidence: washSafeScore
        };
    }

    /**
     * Generate comprehensive tax optimization strategy
     */
    generateTaxStrategy(symbol, quantity, expectedLoss, alternatives) {
        const bestAlternative = alternatives[0];
        
        return {
            recommendation: bestAlternative ? 
                `Sell ${symbol} and immediately buy ${bestAlternative.symbol}` :
                `Sell ${symbol} and wait 31 days before repurchasing`,
            reasoning: bestAlternative ?
                `${bestAlternative.symbol} provides similar ${bestAlternative.sector} exposure with ${Math.round(bestAlternative.washSafeScore * 100)}% wash sale safety` :
                'No suitable alternatives found - recommend waiting period',
            timeline: 'Execute trade same day to maintain market exposure',
            riskLevel: bestAlternative ? 
                bestAlternative.riskScore < 0.3 ? 'Low' : 'Medium' : 'High'
        };
    }
}

// Initialize and export
const similarStocksEngine = new SimilarStocksEngine();