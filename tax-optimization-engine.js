/**
 * Tax Optimization Engine - Direct indexing-like tax loss harvesting
 * Provides intelligent tax optimization strategies for portfolio management
 */

class TaxOptimizationEngine {
    constructor(washSaleEngine) {
        this.washSaleEngine = washSaleEngine;
        this.taxRates = this.initializeTaxRates();
        this.optimizationRules = this.initializeOptimizationRules();
        console.log('📊 Tax Optimization Engine initialized');
    }

    /**
     * Initialize tax rate assumptions
     */
    initializeTaxRates() {
        return {
            shortTermCapitalGains: {
                brackets: [
                    { min: 0, max: 44625, rate: 0.12 },
                    { min: 44626, max: 95375, rate: 0.22 },
                    { min: 95376, max: 182050, rate: 0.24 },
                    { min: 182051, max: 231250, rate: 0.32 },
                    { min: 231251, max: 578125, rate: 0.35 },
                    { min: 578126, max: Infinity, rate: 0.37 }
                ]
            },
            longTermCapitalGains: {
                brackets: [
                    { min: 0, max: 44625, rate: 0.0 },
                    { min: 44626, max: 492300, rate: 0.15 },
                    { min: 492301, max: Infinity, rate: 0.20 }
                ]
            },
            netInvestmentIncomeTax: 0.038 // 3.8% NIIT for high earners
        };
    }

    /**
     * Initialize optimization rules and thresholds
     */
    initializeOptimizationRules() {
        return {
            minLossThreshold: 100, // Minimum loss to consider harvesting
            maxHarvestingFrequency: 4, // Max times per year per position
            washSaleBuffer: 31, // Days to avoid wash sale
            rebalanceThreshold: 0.05, // 5% drift before rebalancing
            taxLossCarryforward: true,
            prioritizeShortTermLosses: true
        };
    }

    /**
     * Analyze portfolio for tax optimization opportunities
     * @param {Array} positions - Current portfolio positions
     * @param {number} annualIncome - Annual income for tax bracket calculation
     * @returns {Object} Comprehensive tax optimization analysis
     */
    async analyzePortfolioOptimization(positions, annualIncome = 100000) {
        console.log('🔍 Analyzing portfolio for tax optimization...');

        const analysis = {
            summary: this.generateOptimizationSummary(positions),
            opportunities: await this.identifyHarvestingOpportunities(positions),
            washSaleRisks: this.analyzeWashSaleRisks(positions),
            rebalancingNeeds: this.analyzeRebalancingNeeds(positions),
            taxProjections: this.calculateTaxProjections(positions, annualIncome),
            recommendations: []
        };

        // Generate specific recommendations
        analysis.recommendations = await this.generateOptimizationRecommendations(analysis);

        return analysis;
    }

    /**
     * Generate portfolio optimization summary
     */
    generateOptimizationSummary(positions) {
        const totalValue = positions.reduce((sum, pos) => sum + pos.currentValue, 0);
        const totalGainLoss = positions.reduce((sum, pos) => sum + pos.unrealizedGainLoss, 0);
        const lossPositions = positions.filter(pos => pos.unrealizedGainLoss < 0);
        const gainPositions = positions.filter(pos => pos.unrealizedGainLoss > 0);

        return {
            totalPortfolioValue: totalValue,
            totalUnrealizedGainLoss: totalGainLoss,
            totalUnrealizedLosses: lossPositions.reduce((sum, pos) => sum + Math.abs(pos.unrealizedGainLoss), 0),
            totalUnrealizedGains: gainPositions.reduce((sum, pos) => sum + pos.unrealizedGainLoss, 0),
            harvestablePositions: lossPositions.length,
            riskPositions: this.countRiskPositions(positions)
        };
    }

    /**
     * Identify tax loss harvesting opportunities
     */
    async identifyHarvestingOpportunities(positions) {
        const opportunities = [];

        for (const position of positions) {
            if (position.unrealizedGainLoss < -this.optimizationRules.minLossThreshold) {
                const opportunity = await this.analyzeHarvestingOpportunity(position);
                if (opportunity.recommended) {
                    opportunities.push(opportunity);
                }
            }
        }

        // Sort by potential tax benefit
        return opportunities.sort((a, b) => b.potentialTaxBenefit - a.potentialTaxBenefit);
    }

    /**
     * Analyze individual harvesting opportunity
     */
    async analyzeHarvestingOpportunity(position) {
        const loss = Math.abs(position.unrealizedGainLoss);
        const isShortTerm = this.isShortTermPosition(position);
        
        // Get similar stocks for replacement
        const similarStocks = await similarStocksEngine.findSimilarStocks(position.symbol, 3);
        
        // Calculate tax benefit
        const taxRate = isShortTerm ? 0.24 : 0.15; // Simplified for now
        const potentialTaxBenefit = loss * taxRate;

        // Check wash sale risk with current holdings
        const washSaleRisk = this.assessWashSaleRisk(position, similarStocks);

        return {
            symbol: position.symbol,
            currentValue: position.currentValue,
            unrealizedLoss: loss,
            potentialTaxBenefit,
            isShortTerm,
            holdingPeriod: this.calculateHoldingPeriod(position),
            similarStocks,
            washSaleRisk,
            recommended: washSaleRisk.level !== 'HIGH' && potentialTaxBenefit > 50,
            strategy: this.generateHarvestingStrategy(position, similarStocks, washSaleRisk),
            urgency: this.calculateUrgency(position, isShortTerm)
        };
    }

    /**
     * Generate harvesting strategy
     */
    generateHarvestingStrategy(position, similarStocks, washSaleRisk) {
        const bestAlternative = similarStocks[0];
        
        if (washSaleRisk.level === 'LOW' && bestAlternative) {
            return {
                action: 'IMMEDIATE_HARVEST_AND_REPLACE',
                steps: [
                    `Sell all ${position.shares} shares of ${position.symbol}`,
                    `Immediately buy ${position.shares} shares of ${bestAlternative.symbol}`,
                    `Monitor ${bestAlternative.symbol} performance vs ${position.symbol}`
                ],
                timeline: 'Execute within same trading day',
                expectedOutcome: `Realize $${Math.abs(position.unrealizedGainLoss).toFixed(2)} loss while maintaining sector exposure`
            };
        } else if (washSaleRisk.level === 'MEDIUM') {
            return {
                action: 'HARVEST_WITH_ETF_REPLACEMENT',
                steps: [
                    `Sell ${position.shares} shares of ${position.symbol}`,
                    `Buy sector ETF (${similarStocks.find(s => s.type === 'etf')?.symbol || 'SPY'}) for temporary exposure`,
                    `Wait 31 days, then consider repurchasing ${position.symbol} or similar stock`
                ],
                timeline: 'Execute sell immediately, wait 31 days for repurchase',
                expectedOutcome: `Realize loss with broad market exposure during waiting period`
            };
        } else {
            return {
                action: 'HARVEST_AND_WAIT',
                steps: [
                    `Sell ${position.shares} shares of ${position.symbol}`,
                    `Park proceeds in money market or short-term treasuries`,
                    `Wait 31 days before any repurchase to avoid wash sale`
                ],
                timeline: 'Execute sell immediately, wait 31 days minimum',
                expectedOutcome: `Clean tax loss realization with no market exposure during waiting period`
            };
        }
    }

    /**
     * Analyze wash sale risks across portfolio
     */
    analyzeWashSaleRisks(positions) {
        const risks = [];
        
        // Check for potential wash sales within portfolio
        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                const risk = this.assessPositionWashSaleRisk(positions[i], positions[j]);
                if (risk.level !== 'NONE') {
                    risks.push(risk);
                }
            }
        }

        return {
            totalRisks: risks.length,
            highRisks: risks.filter(r => r.level === 'HIGH').length,
            mediumRisks: risks.filter(r => r.level === 'MEDIUM').length,
            details: risks
        };
    }

    /**
     * Assess wash sale risk between two positions
     */
    assessPositionWashSaleRisk(pos1, pos2) {
        // Check if stocks are substantially identical
        if (pos1.symbol === pos2.symbol) {
            return {
                level: 'HIGH',
                reason: 'Identical securities',
                positions: [pos1.symbol, pos2.symbol]
            };
        }

        // Check sector/industry similarity
        const stock1Info = similarStocksEngine.sectorMappings[pos1.symbol];
        const stock2Info = similarStocksEngine.sectorMappings[pos2.symbol];

        if (stock1Info && stock2Info) {
            if (stock1Info.industry === stock2Info.industry) {
                return {
                    level: 'MEDIUM',
                    reason: `Same industry: ${stock1Info.industry}`,
                    positions: [pos1.symbol, pos2.symbol]
                };
            } else if (stock1Info.sector === stock2Info.sector) {
                return {
                    level: 'LOW',
                    reason: `Same sector: ${stock1Info.sector}`,
                    positions: [pos1.symbol, pos2.symbol]
                };
            }
        }

        return {
            level: 'NONE',
            reason: 'No substantial identity risk',
            positions: [pos1.symbol, pos2.symbol]
        };
    }

    /**
     * Analyze portfolio rebalancing needs
     */
    analyzeRebalancingNeeds(positions) {
        const totalValue = positions.reduce((sum, pos) => sum + pos.currentValue, 0);
        
        // Calculate current allocations
        const allocations = positions.map(pos => ({
            ...pos,
            currentAllocation: pos.currentValue / totalValue,
            targetAllocation: pos.targetAllocation || (1 / positions.length), // Equal weight if no target
        }));

        // Find positions that need rebalancing
        const rebalanceNeeds = allocations.filter(pos => 
            Math.abs(pos.currentAllocation - pos.targetAllocation) > this.optimizationRules.rebalanceThreshold
        );

        return {
            needsRebalancing: rebalanceNeeds.length > 0,
            positions: rebalanceNeeds,
            totalDrift: rebalanceNeeds.reduce((sum, pos) => 
                sum + Math.abs(pos.currentAllocation - pos.targetAllocation), 0
            ),
            recommendations: this.generateRebalancingRecommendations(rebalanceNeeds)
        };
    }

    /**
     * Calculate tax projections
     */
    calculateTaxProjections(positions, annualIncome) {
        const realizedGains = this.washSaleEngine.getYearToDateRealizedGains();
        const potentialHarvestableLosses = positions
            .filter(pos => pos.unrealizedGainLoss < 0)
            .reduce((sum, pos) => sum + Math.abs(pos.unrealizedGainLoss), 0);

        const currentTaxLiability = this.calculateTaxLiability(realizedGains, annualIncome);
        const optimizedTaxLiability = this.calculateTaxLiability(
            realizedGains - potentialHarvestableLosses, 
            annualIncome
        );

        return {
            currentRealizedGains: realizedGains,
            potentialHarvestableLosses,
            currentTaxLiability,
            optimizedTaxLiability,
            potentialTaxSavings: currentTaxLiability - optimizedTaxLiability,
            carryforwardOpportunity: Math.max(0, potentialHarvestableLosses - realizedGains)
        };
    }

    /**
     * Generate comprehensive optimization recommendations
     */
    async generateOptimizationRecommendations(analysis) {
        const recommendations = [];

        // Priority 1: High-value loss harvesting opportunities
        const highValueOpportunities = analysis.opportunities.filter(opp => 
            opp.potentialTaxBenefit > 500 && opp.washSaleRisk.level !== 'HIGH'
        );

        highValueOpportunities.forEach(opp => {
            recommendations.push({
                priority: 'HIGH',
                category: 'Tax Loss Harvesting',
                action: `Harvest loss in ${opp.symbol}`,
                benefit: `$${opp.potentialTaxBenefit.toFixed(2)} tax savings`,
                strategy: opp.strategy,
                deadline: opp.urgency === 'HIGH' ? 'End of tax year' : 'Flexible timing'
            });
        });

        // Priority 2: Wash sale risk mitigation
        if (analysis.washSaleRisks.highRisks > 0) {
            recommendations.push({
                priority: 'HIGH',
                category: 'Risk Mitigation',
                action: 'Address wash sale risks',
                benefit: 'Avoid disallowed loss deductions',
                strategy: {
                    action: 'REVIEW_SIMILAR_HOLDINGS',
                    steps: ['Review similar positions', 'Consider consolidation or diversification']
                }
            });
        }

        // Priority 3: Portfolio rebalancing
        if (analysis.rebalancingNeeds.needsRebalancing) {
            recommendations.push({
                priority: 'MEDIUM',
                category: 'Portfolio Rebalancing',
                action: 'Rebalance portfolio allocations',
                benefit: 'Maintain target risk profile',
                strategy: analysis.rebalancingNeeds.recommendations
            });
        }

        return recommendations.sort((a, b) => {
            const priorityOrder = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    /**
     * Helper methods
     */
    isShortTermPosition(position) {
        const holdingPeriod = this.calculateHoldingPeriod(position);
        return holdingPeriod <= 365; // One year or less
    }

    calculateHoldingPeriod(position) {
        const purchaseDate = new Date(position.purchaseDate);
        const today = new Date();
        return Math.floor((today - purchaseDate) / (1000 * 60 * 60 * 24));
    }

    calculateUrgency(position, isShortTerm) {
        const holdingPeriod = this.calculateHoldingPeriod(position);
        const daysToYearEnd = this.getDaysToYearEnd();
        
        if (isShortTerm && daysToYearEnd < 30) return 'HIGH';
        if (holdingPeriod > 350 && holdingPeriod < 370) return 'HIGH'; // Near long-term threshold
        if (daysToYearEnd < 60) return 'MEDIUM';
        return 'LOW';
    }

    getDaysToYearEnd() {
        const today = new Date();
        const yearEnd = new Date(today.getFullYear(), 11, 31); // December 31
        return Math.floor((yearEnd - today) / (1000 * 60 * 60 * 24));
    }

    countRiskPositions(positions) {
        return positions.filter(pos => {
            // Check if position has recent purchases that could trigger wash sale
            const recentPurchases = this.washSaleEngine.transactions.filter(t => 
                t.symbol === pos.symbol && 
                t.type === 'buy' && 
                new Date(t.date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
            );
            return recentPurchases.length > 0;
        }).length;
    }

    assessWashSaleRisk(position, similarStocks) {
        // Simplified risk assessment
        const hasHighlyCorrelatedAlternatives = similarStocks.some(stock => 
            stock.confidence > 0.8 && stock.type === 'correlation'
        );

        if (hasHighlyCorrelatedAlternatives) {
            return { level: 'LOW', reason: 'Good alternatives available' };
        } else {
            return { level: 'MEDIUM', reason: 'Limited suitable alternatives' };
        }
    }

    calculateTaxLiability(gains, income) {
        // Simplified tax calculation
        const taxRate = income > 200000 ? 0.24 : 0.22;
        return Math.max(0, gains * taxRate);
    }

    generateRebalancingRecommendations(rebalanceNeeds) {
        return {
            action: 'PORTFOLIO_REBALANCING',
            steps: rebalanceNeeds.map(pos => 
                pos.currentAllocation > pos.targetAllocation ? 
                `Reduce ${pos.symbol} by ${((pos.currentAllocation - pos.targetAllocation) * 100).toFixed(1)}%` :
                `Increase ${pos.symbol} by ${((pos.targetAllocation - pos.currentAllocation) * 100).toFixed(1)}%`
            )
        };
    }
}

// Initialize after washSaleEngine is available
let taxOptimizationEngine;

// Initialize when DOM is ready or washSaleEngine is available
function initializeTaxOptimizationEngine() {
    if (window.washSaleEngine && !window.taxOptimizationEngine) {
        taxOptimizationEngine = new TaxOptimizationEngine(window.washSaleEngine);
        window.taxOptimizationEngine = taxOptimizationEngine;
        console.log('✅ Tax Optimization Engine initialized');
    }
}

// Try to initialize immediately
initializeTaxOptimizationEngine();

// Also try when DOM loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTaxOptimizationEngine);
} else {
    // DOM already loaded, try again in next tick
    setTimeout(initializeTaxOptimizationEngine, 100);
}