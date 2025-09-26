/**
 * WashSale Engine - Core wash sale detection and prevention logic
 * Implements IRS wash sale rules for stock transactions
 */

class WashSaleEngine {
    constructor() {
        this.transactions = this.loadTransactions();
        this.shareLots = this.loadShareLots();
        this.stockSplits = this.loadStockSplits();
        this.washSaleViolations = [];
        console.log('🎯 WashSale Engine initialized');
    }

    /**
     * Load transactions from localStorage
     */
    loadTransactions() {
        try {
            const saved = localStorage.getItem('washsafe_transactions');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Error loading transactions:', error);
            return [];
        }
    }


    /**
     * Load share lots from localStorage
     */
    loadShareLots() {
        try {
            const saved = localStorage.getItem('washsafe_share_lots');
            const lots = saved ? JSON.parse(saved) : [];
            
            // If no share lots exist but we have transactions, rebuild them
            if (lots.length === 0 && this.transactions && this.transactions.length > 0) {
                console.log('🔄 Rebuilding share lots from existing transactions...');
                return this.rebuildShareLotsFromTransactions();
            }
            
            return lots;
        } catch (error) {
            console.error('Error loading share lots:', error);
            return [];
        }
    }

    /**
     * Rebuild share lots from existing transactions (for migration)
     */
    rebuildShareLotsFromTransactions() {
        const lots = [];
        const sortedTransactions = [...this.transactions].sort((a, b) => {
            const dateDiff = new Date(a.date) - new Date(b.date);
            if (dateDiff !== 0) return dateDiff;
            
            // For same-day transactions, prioritize buy before sell to avoid "no lots available"
            if (a.type !== b.type) {
                return a.type === 'buy' ? -1 : 1;
            }
            
            // If same type and date, sort by numeric ID if possible, otherwise string comparison
            const aId = isNaN(a.id) ? a.id : Number(a.id);
            const bId = isNaN(b.id) ? b.id : Number(b.id);
            
            if (typeof aId === 'number' && typeof bId === 'number') {
                return aId - bId;
            } else {
                return aId.toString().localeCompare(bId.toString());
            }
        });
        
        console.log(`🔄 Rebuilding from ${sortedTransactions.length} transactions...`);
        
        sortedTransactions.forEach(transaction => {
            if (transaction.type === 'buy') {
                // Create new lot for purchase
                const lot = this.createShareLot(transaction);
                lots.push(lot);
                console.log(`   → Created lot from buy: ${lot.symbol} ${lot.originalQuantity}@${lot.costPerShare}`);
                
            } else if (transaction.type === 'sell') {
                // Allocate sale against existing lots using FIFO
                const symbol = transaction.symbol;
                const availableLots = lots
                    .filter(lot => lot.symbol === symbol && lot.remainingQuantity > 0)
                    .sort((a, b) => new Date(a.purchaseDate) - new Date(b.purchaseDate));
                
                // Apply split adjustments to sell quantity to match lot quantities
                const adjustments = this.calculateSplitAdjustments(transaction.symbol, new Date(transaction.date));
                let remainingToSell = transaction.quantity * adjustments.totalRatio;
                
                console.log(`   → Processing sell: ${transaction.quantity} → ${remainingToSell} shares (split ratio: ${adjustments.totalRatio})`);
                
                for (const lot of availableLots) {
                    if (remainingToSell <= 0) break;
                    
                    const sharesFromThisLot = Math.min(remainingToSell, lot.remainingQuantity);
                    lot.remainingQuantity -= sharesFromThisLot;
                    remainingToSell -= sharesFromThisLot;
                    
                    console.log(`   → Allocated ${sharesFromThisLot} shares from lot ${lot.id} for sell`);
                }
                
                if (remainingToSell > 0) {
                    console.warn(`   → Warning: ${remainingToSell} shares could not be allocated for sell transaction`);
                }
            }
        });
        
        // Remove empty lots to keep data clean
        const activeLots = lots.filter(lot => lot.remainingQuantity > 0);
        const removedLots = lots.length - activeLots.length;
        
        this.shareLots = activeLots;
        this.saveTransactions(); // This will save the rebuilt lots
        console.log(`✅ Rebuilt ${activeLots.length} share lots (removed ${removedLots} empty lots)`);
        
        return lots;
    }

    /**
     * Load stock splits from localStorage
     */
    loadStockSplits() {
        try {
            const saved = localStorage.getItem('washsafe_stock_splits');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Error loading stock splits:', error);
            return [];
        }
    }

    /**
     * Save transactions, share lots, and stock splits to localStorage
     */
    saveTransactions() {
        try {
            localStorage.setItem('washsafe_transactions', JSON.stringify(this.transactions));
            localStorage.setItem('washsafe_share_lots', JSON.stringify(this.shareLots));
            localStorage.setItem('washsafe_stock_splits', JSON.stringify(this.stockSplits));
            localStorage.setItem('washsafe_last_updated', new Date().toISOString());
        } catch (error) {
            console.error('Error saving transactions:', error);
        }
    }

    /**
     * Add a new transaction and check for wash sales using FIFO
     * @param {Object} transaction - The transaction to add
     * @param {Object} options - Options for adding the transaction
     * @param {boolean} options.forceImport - If true, add transaction even if FIFO validation fails (for CSV imports)
     */
    addTransaction(transaction, options = {}) {
        // Add unique ID and timestamp
        transaction.id = Date.now() + Math.random();
        transaction.createdAt = new Date().toISOString();
        
        // Normalize the transaction
        transaction.symbol = transaction.symbol.toUpperCase();
        transaction.date = new Date(transaction.date);
        transaction.quantity = parseInt(transaction.quantity);
        transaction.price = parseFloat(transaction.price);
        transaction.total = transaction.quantity * transaction.price;

        let washSaleResult = null;
        let fifoResult = null;

        if (transaction.type === 'buy') {
            // Create a new share lot
            const newLot = this.createShareLot(transaction);
            this.shareLots.push(newLot);
            console.log(`📊 Created new share lot: ${newLot.id} - ${newLot.originalQuantity} shares @ $${newLot.costPerShare}`);
            
        } else if (transaction.type === 'sell') {
            // Process the sale using FIFO with allowPartial option during force imports
            // Skip wash sale detection during CSV imports since we're importing historical data
            const processingOptions = options.forceImport 
                ? { allowPartial: true, skipWashSaleCheck: true } 
                : {};
            fifoResult = this.processFifoSale(transaction, processingOptions);
            
            if (!fifoResult.success) {
                if (options.forceImport) {
                    console.warn(`⚠️ FORCE IMPORT: Recording sell transaction despite FIFO failure: ${fifoResult.error}`);
                    // We'll add the transaction anyway, but mark it as problematic
                    washSaleResult = {
                        type: 'insufficient_shares',
                        message: `${fifoResult.error} (Transaction recorded anyway due to force import)`,
                        forcedImport: true
                    };
                } else {
                    return {
                        transaction: null,
                        washSaleViolation: {
                            type: 'insufficient_shares',
                            message: fifoResult.error
                        },
                        fifoResult: fifoResult
                    };
                }
            } else {
                // Update share lots after successful sale (even if partial)
                if (fifoResult.lotSales && fifoResult.lotSales.length > 0) {
                    this.updateShareLotsAfterSale(fifoResult.lotSales);
                }
                
                // Check if any wash sales occurred
                const washSales = fifoResult.lotSales ? fifoResult.lotSales.filter(sale => sale.isWashSale) : [];
                if (washSales.length > 0) {
                    washSaleResult = {
                        type: 'wash_sale_violation',
                        loss: fifoResult.totalWashSaleLoss,
                        lotSales: washSales,
                        message: `Wash sale detected! $${fifoResult.totalWashSaleLoss.toFixed(2)} loss disallowed across ${washSales.length} lot(s).`
                    };
                }
                
                // Note if this was a partial processing
                if (fifoResult.partialProcessing) {
                    if (washSaleResult) {
                        washSaleResult.message += ` (Partial processing: ${fifoResult.shortfall} shares could not be allocated)`;
                    } else {
                        washSaleResult = {
                            type: 'partial_processing',
                            message: `Sale processed partially: ${fifoResult.shortfall} shares could not be allocated to existing lots`,
                            shortfall: fifoResult.shortfall
                        };
                    }
                }
            }
        }
        
        // Add the transaction
        this.transactions.push(transaction);
        this.transactions.sort((a, b) => {
            const dateDiff = new Date(a.date) - new Date(b.date);
            if (dateDiff !== 0) return dateDiff;
            // If dates are equal, sort by transaction ID to ensure consistent ordering
            return a.id.toString().localeCompare(b.id.toString());
        });
        
        // Save to storage
        this.saveTransactions();
        
        return {
            transaction,
            washSaleViolation: washSaleResult,
            fifoResult: fifoResult
        };
    }

    /**
     * Core wash sale detection logic
     * IRS Rule: If you sell at a loss and buy substantially identical stock 
     * within 30 days before or after, it's a wash sale
     */
    checkWashSale(newTransaction) {
        if (newTransaction.type !== 'sell') {
            return null; // Only sells can trigger wash sales
        }

        const symbol = newTransaction.symbol;
        const sellDate = new Date(newTransaction.date);
        const thirtyDaysBefore = new Date(sellDate.getTime() - (30 * 24 * 60 * 60 * 1000));
        const thirtyDaysAfter = new Date(sellDate.getTime() + (30 * 24 * 60 * 60 * 1000));

        // Find all transactions for this symbol
        const symbolTransactions = this.transactions.filter(t => t.symbol === symbol);
        
        // Calculate if this would be a loss
        const { averageCost, totalShares } = this.calculateAverageCost(symbol, sellDate);
        
        if (totalShares < newTransaction.quantity) {
            return {
                type: 'insufficient_shares',
                message: `Cannot sell ${newTransaction.quantity} shares. Only ${totalShares} shares available.`
            };
        }

        const sellPrice = newTransaction.price;
        const loss = (averageCost - sellPrice) * newTransaction.quantity;

        if (loss <= 0) {
            return null; // No loss, no wash sale
        }

        // Look for purchases within 30 days before or after
        const conflictingPurchases = this.transactions.filter(t => {
            if (t.symbol !== symbol || t.type !== 'buy') return false;
            
            const transactionDate = new Date(t.date);
            return transactionDate >= thirtyDaysBefore && transactionDate <= thirtyDaysAfter;
        });

        // Check future purchases (this is tricky since we don't know future trades)
        // For now, we'll warn about the 30-day window
        if (conflictingPurchases.length > 0) {
            return {
                type: 'wash_sale_violation',
                loss: loss,
                conflictingTransactions: conflictingPurchases,
                washSaleWindow: {
                    start: thirtyDaysBefore,
                    end: thirtyDaysAfter
                },
                message: `Wash sale detected! You purchased ${symbol} within 30 days of this sale. Loss of $${loss.toFixed(2)} will be disallowed.`
            };
        }

        // Check if we're in a danger zone (recent purchases)
        const recentPurchases = this.transactions.filter(t => {
            if (t.symbol !== symbol || t.type !== 'buy') return false;
            const transactionDate = new Date(t.date);
            return transactionDate >= thirtyDaysBefore && transactionDate < sellDate;
        });

        if (recentPurchases.length > 0) {
            return {
                type: 'wash_sale_warning',
                loss: loss,
                recentPurchases: recentPurchases,
                safeDate: new Date(sellDate.getTime() + (31 * 24 * 60 * 60 * 1000)),
                message: `Warning: If you buy ${symbol} before ${new Date(sellDate.getTime() + (31 * 24 * 60 * 60 * 1000)).toLocaleDateString()}, this $${loss.toFixed(2)} tax loss will be disallowed if you sell at a loss.`
            };
        }

        return null;
    }

    /**
     * Calculate average cost basis for a symbol up to a certain date
     * @param {string} symbol - Stock symbol
     * @param {Date|string} upToDate - Calculate up to this date
     * @param {string} excludeTransactionId - Optional transaction ID to exclude from calculation
     */
    calculateAverageCost(symbol, upToDate, excludeTransactionId = null) {
        const symbolTransactions = this.transactions
            .filter(t => t.symbol === symbol && new Date(t.date) <= upToDate && t.id !== excludeTransactionId)
            .sort((a, b) => {
                const dateDiff = new Date(a.date) - new Date(b.date);
                if (dateDiff !== 0) return dateDiff;
                return a.id.toString().localeCompare(b.id.toString());
            });

        let totalShares = 0;
        let totalCost = 0;

        symbolTransactions.forEach(transaction => {
            if (transaction.type === 'buy') {
                totalShares += transaction.quantity;
                totalCost += transaction.total;
            } else if (transaction.type === 'sell') {
                if (totalShares > 0) {
                    const sellRatio = transaction.quantity / totalShares;
                    totalCost -= (totalCost * sellRatio);
                    totalShares -= transaction.quantity;
                }
            }
        });

        return {
            averageCost: totalShares > 0 ? totalCost / totalShares : 0,
            totalShares: totalShares,
            totalCost: totalCost
        };
    }

    /**
     * FIFO Share Lot Management
     */
    
    /**
     * Create a new share lot from a buy transaction
     */
    createShareLot(buyTransaction) {
        // Apply split adjustments when creating lots
        const adjustments = this.calculateSplitAdjustments(buyTransaction.symbol, new Date(buyTransaction.date));
        
        const adjustedQuantity = buyTransaction.quantity * adjustments.totalRatio;
        const adjustedPrice = buyTransaction.price / adjustments.totalRatio;
        
        console.log(`   Creating lot for ${buyTransaction.symbol}: ${buyTransaction.quantity} → ${adjustedQuantity} shares, $${buyTransaction.price} → $${adjustedPrice.toFixed(4)} (split ratio: ${adjustments.totalRatio})`);
        
        return {
            id: `lot_${buyTransaction.id}_${Date.now()}`,
            symbol: buyTransaction.symbol,
            purchaseDate: new Date(buyTransaction.date),
            originalQuantity: adjustedQuantity,
            remainingQuantity: adjustedQuantity,
            costPerShare: adjustedPrice,
            purchaseTransactionId: buyTransaction.id,
            originalTransactionQuantity: buyTransaction.quantity,
            originalTransactionPrice: buyTransaction.price,
            splitAdjustmentRatio: adjustments.totalRatio,
            appliedSplits: adjustments.appliedSplits.map(s => s.id)
        };
    }

    /**
     * Get available share lots for a symbol, ordered by FIFO (oldest first)
     */
    getAvailableShareLots(symbol) {
        return this.shareLots
            .filter(lot => lot.symbol === symbol && lot.remainingQuantity > 0)
            .sort((a, b) => new Date(a.purchaseDate) - new Date(b.purchaseDate));
    }

    /**
     * Process a sale using FIFO share lot allocation
     * Returns detailed information about which lots were used and their P&L
     * @param {Object} sellTransaction - The sell transaction to process
     * @param {Object} options - Options for processing
     * @param {boolean} options.allowPartial - If true, allow partial processing even without sufficient shares
     * @param {Array} options.existingTransactions - List of transactions to check for wash sales (for CSV imports)
     */
    processFifoSale(sellTransaction, options = {}) {
        const symbol = sellTransaction.symbol;
        const sellDate = new Date(sellTransaction.date);
        
        // Apply split adjustments to sell transaction to match lot quantities
        const adjustments = this.calculateSplitAdjustments(symbol, sellDate);
        const sellQuantity = sellTransaction.quantity * adjustments.totalRatio;
        const sellPrice = sellTransaction.price / adjustments.totalRatio;
        
        console.log(`🔍 FIFO Sale Processing: ${symbol} - ${sellTransaction.quantity} → ${sellQuantity} shares @ $${sellTransaction.price} → $${sellPrice.toFixed(4)} (split ratio: ${adjustments.totalRatio})`);
        
        // Get available lots for this symbol (FIFO order)
        const availableLots = this.getAvailableShareLots(symbol);
        
        if (availableLots.length === 0) {
            if (options.allowPartial) {
                console.warn(`⚠️ No shares available for ${symbol} sale, allowing partial processing`);
                return {
                    success: true,
                    error: null,
                    lotSales: [],
                    totalPnL: 0,
                    totalWashSaleLoss: 0,
                    partialProcessing: true,
                    shortfall: sellQuantity
                };
            } else {
                return {
                    success: false,
                    error: 'No shares available to sell',
                    lotSales: []
                };
            }
        }
        
        // Calculate total available shares
        const totalAvailable = availableLots.reduce((sum, lot) => sum + lot.remainingQuantity, 0);
        
        if (totalAvailable < sellQuantity) {
            if (options.allowPartial) {
                console.warn(`⚠️ Insufficient shares for ${symbol} sale: ${totalAvailable} available, ${sellQuantity} requested. Processing partial sale.`);
                // Continue with partial processing using available lots
            } else {
                return {
                    success: false,
                    error: `Insufficient shares: ${totalAvailable} available, ${sellQuantity} requested`,
                    lotSales: []
                };
            }
        }
        
        // Allocate sale across lots using FIFO
        const lotSales = [];
        let remainingToSell = sellQuantity;
        
        for (const lot of availableLots) {
            if (remainingToSell <= 0) break;
            
            const sharesFromThisLot = Math.min(remainingToSell, lot.remainingQuantity);
            const costBasis = lot.costPerShare * sharesFromThisLot;
            const saleProceeds = sellPrice * sharesFromThisLot;
            const pnl = saleProceeds - costBasis;
            
            // Check if this lot sale creates a wash sale (skip during force imports of historical data)
            let washSaleInfo = { isWashSale: false, details: null };
            if (!options.skipWashSaleCheck) {
                const washSaleOptions = options.existingTransactions 
                    ? { existingTransactions: options.existingTransactions }
                    : { asOfDate: sellDate };
                washSaleInfo = this.checkLotWashSale(lot, sharesFromThisLot, sellDate, pnl, washSaleOptions);
            } else {
                console.log(`   → 🚫 Skipping wash sale check for ${symbol} (CSV import mode)`);
            }
            
            const lotSale = {
                lotId: lot.id,
                purchaseDate: lot.purchaseDate,
                sharesFromLot: sharesFromThisLot,
                costPerShare: lot.costPerShare,
                sellPrice: sellPrice,
                costBasis: costBasis,
                saleProceeds: saleProceeds,
                pnl: pnl,
                isWashSale: washSaleInfo.isWashSale,
                washSaleDetails: washSaleInfo.details
            };
            
            lotSales.push(lotSale);
            remainingToSell -= sharesFromThisLot;
            
            console.log(`   → Used ${sharesFromThisLot} shares from lot ${lot.id} (${lot.purchaseDate.toDateString()})`);
            console.log(`   → P&L: $${pnl.toFixed(2)} ${pnl >= 0 ? '(GAIN)' : '(LOSS)'} ${washSaleInfo.isWashSale ? '⚠️ WASH SALE' : ''}`);
        }
        
        const result = {
            success: true,
            error: null,
            lotSales: lotSales,
            totalPnL: lotSales.reduce((sum, sale) => sum + sale.pnl, 0),
            totalWashSaleLoss: lotSales.reduce((sum, sale) => 
                sum + (sale.isWashSale && sale.pnl < 0 ? Math.abs(sale.pnl) : 0), 0)
        };
        
        // Add partial processing info if there's a shortfall
        if (remainingToSell > 0 && options.allowPartial) {
            result.partialProcessing = true;
            result.shortfall = remainingToSell;
            console.warn(`⚠️ Partial sale processing: ${remainingToSell} shares could not be allocated`);
        }
        
        return result;
    }

    /**
     * Check if selling shares from a specific lot creates a wash sale
     * @param {Object} lot - The lot being sold from
     * @param {number} sharesSold - Number of shares being sold from this lot
     * @param {Date} sellDate - Date of the sale
     * @param {number} pnl - P&L for this lot sale
     * @param {Object} options - Options for wash sale checking
     * @param {Date} options.asOfDate - Only consider transactions up to this date (for historical analysis)
     */
    checkLotWashSale(lot, sharesSold, sellDate, pnl, options = {}) {
        // Only losses can be wash sales
        if (pnl >= 0) {
            return { isWashSale: false, details: null };
        }
        
        const symbol = lot.symbol;
        const thirtyDaysBefore = new Date(sellDate.getTime() - (30 * 24 * 60 * 60 * 1000));
        const thirtyDaysAfter = new Date(sellDate.getTime() + (30 * 24 * 60 * 60 * 1000));
        
        // For historical analysis or CSV imports, only look at transactions that existed up to a certain date
        // This prevents looking into the "future" during CSV imports
        let transactionsToCheck = this.transactions;
        if (options.existingTransactions) {
            transactionsToCheck = options.existingTransactions;
        } else if (options.asOfDate) {
            transactionsToCheck = this.transactions.filter(t => new Date(t.date) <= options.asOfDate);
        }
        
        // Look for purchases within the wash sale window
        const conflictingPurchases = transactionsToCheck.filter(t => {
            if (t.symbol !== symbol || t.type !== 'buy') return false;
            
            const transactionDate = new Date(t.date);
            return transactionDate >= thirtyDaysBefore && transactionDate <= thirtyDaysAfter;
        });
        
        if (conflictingPurchases.length > 0) {
            return {
                isWashSale: true,
                details: {
                    disallowedLoss: Math.abs(pnl),
                    conflictingPurchases: conflictingPurchases
                }
            };
        }
        
        return { isWashSale: false, details: null };
    }

    /**
     * Update share lots after a sale (reduce remaining quantities)
     */
    updateShareLotsAfterSale(lotSales) {
        lotSales.forEach(lotSale => {
            const lot = this.shareLots.find(l => l.id === lotSale.lotId);
            if (lot) {
                lot.remainingQuantity -= lotSale.sharesFromLot;
                console.log(`   → Updated lot ${lot.id}: ${lot.remainingQuantity} shares remaining`);
            }
        });
        
        // Remove empty lots to keep data clean
        const beforeCount = this.shareLots.length;
        this.shareLots = this.shareLots.filter(lot => lot.remainingQuantity > 0);
        const removedCount = beforeCount - this.shareLots.length;
        
        if (removedCount > 0) {
            console.log(`   → Cleaned up ${removedCount} empty lots`);
        }
    }

    /**
     * Calculate the cost basis of shares being sold in a specific transaction
     * This is different from calculateAverageCost as it calculates what the average cost
     * was BEFORE the sale, not after excluding it
     */
    calculateSaleCostBasis(sellTransaction) {
        const symbol = sellTransaction.symbol;
        const sellDate = new Date(sellTransaction.date);
        
        // Get all transactions for this symbol up to (but not including) the sell date
        const priorTransactions = this.transactions
            .filter(t => t.symbol === symbol && new Date(t.date) < sellDate)
            .sort((a, b) => {
                const dateDiff = new Date(a.date) - new Date(b.date);
                if (dateDiff !== 0) return dateDiff;
                return a.id.toString().localeCompare(b.id.toString());
            });
        
        let totalShares = 0;
        let totalCost = 0;

        // Build up the position chronologically
        priorTransactions.forEach(transaction => {
            if (transaction.type === 'buy') {
                totalShares += transaction.quantity;
                totalCost += transaction.total;
            } else if (transaction.type === 'sell') {
                if (totalShares > 0) {
                    const sellRatio = transaction.quantity / totalShares;
                    totalCost -= (totalCost * sellRatio);
                    totalShares -= transaction.quantity;
                }
            }
        });

        // The cost basis for the sale is the average cost of shares held just before the sale
        return {
            averageCost: totalShares > 0 ? totalCost / totalShares : 0,
            availableShares: totalShares,
            totalCost: totalCost
        };
    }

    /**
     * Get current portfolio positions using FIFO share lots
     */
    getPortfolio() {
        const positions = {};
        
        console.log(`📊 PORTFOLIO CALCULATION: Processing ${this.shareLots.length} share lots`);
        
        // Group lots by symbol
        this.shareLots.forEach(lot => {
            if (lot.remainingQuantity <= 0) return; // Skip fully sold lots
            
            const symbol = lot.symbol;
            
            console.log(`   → Lot ${lot.id}: ${symbol} ${lot.remainingQuantity} shares @ $${lot.costPerShare.toFixed(2)} (applied splits: ${lot.appliedSplits || 'none'})`);
            
            if (!positions[symbol]) {
                positions[symbol] = {
                    symbol: symbol,
                    shares: 0,
                    totalCost: 0,
                    averageCost: 0,
                    lots: []
                };
            }
            
            positions[symbol].shares += lot.remainingQuantity;
            positions[symbol].totalCost += lot.remainingQuantity * lot.costPerShare;
            positions[symbol].lots.push(lot);
        });

        // Calculate average cost for each position
        Object.keys(positions).forEach(symbol => {
            const position = positions[symbol];
            position.averageCost = position.totalCost / position.shares;
            
            console.log(`📊 FINAL POSITION: ${symbol} - ${position.shares} shares @ $${position.averageCost.toFixed(2)} avg cost`);
            
            // Sort lots by purchase date for display
            position.lots.sort((a, b) => new Date(a.purchaseDate) - new Date(b.purchaseDate));
        });

        return positions;
    }

    /**
     * Get safe-to-sell date for a position
     */
    getSafeToSellDate(symbol) {
        const lastPurchase = this.transactions
            .filter(t => t.symbol === symbol && t.type === 'buy')
            .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

        if (!lastPurchase) return null;

        const safeDate = new Date(lastPurchase.date);
        safeDate.setDate(safeDate.getDate() + 31);
        
        return safeDate;
    }

    /**
     * Calculate year-to-date statistics
     */
    getYTDStats() {
        const currentYear = new Date().getFullYear();
        const yearTransactions = this.transactions.filter(t => 
            new Date(t.date).getFullYear() === currentYear
        );

        let totalLosses = 0;
        let totalGains = 0;
        let washSaleCount = 0;

        // Process only sell transactions
        const sellTransactions = yearTransactions.filter(t => t.type === 'sell');
        
        console.log(`🔍 getYTDStats: Using NEW FIFO-based calculation for ${sellTransactions.length} sell transactions`);
        
        sellTransactions.forEach(transaction => {
            console.log(`\n🔍 YTD CALC: Processing ${transaction.symbol} sale on ${new Date(transaction.date).toDateString()}: ${transaction.quantity} shares @ $${transaction.price.toFixed(2)}`);
            
            // Use FIFO-based calculation for consistency with yearly summary
            const lotsAtSaleTime = this.getShareLotsAtDate(transaction.symbol, new Date(transaction.date));
            
            if (lotsAtSaleTime.length === 0) {
                console.warn(`No lots available for ${transaction.symbol} sale on ${new Date(transaction.date).toDateString()}`);
                return;
            }
            
            // Simulate FIFO allocation for this transaction
            let remainingToSell = transaction.quantity;
            let transactionTotalPnL = 0;
            let transactionWashSaleLoss = 0;
            let hasWashSales = false;
            
            for (const lot of lotsAtSaleTime) {
                if (remainingToSell <= 0) break;
                
                const sharesFromThisLot = Math.min(remainingToSell, lot.remainingQuantity);
                const costBasis = lot.costPerShare * sharesFromThisLot;
                const saleProceeds = transaction.price * sharesFromThisLot;
                const lotPnL = saleProceeds - costBasis;
                
                console.log(`     → Lot ${lot.id} (${lot.purchaseDate.toDateString()}): ${sharesFromThisLot} shares @ $${lot.costPerShare.toFixed(2)} → P&L: $${lotPnL.toFixed(2)}`);
                
                transactionTotalPnL += lotPnL;
                
                if (lotPnL < 0) {
                    // Check if this lot creates a wash sale (only consider transactions up to this date)
                    const washSaleInfo = this.checkLotWashSale(lot, sharesFromThisLot, new Date(transaction.date), lotPnL, { asOfDate: new Date(transaction.date) });
                    if (washSaleInfo.isWashSale) {
                        hasWashSales = true;
                        transactionWashSaleLoss += Math.abs(lotPnL);
                    }
                }
                
                remainingToSell -= sharesFromThisLot;
            }
            
            console.log(`     → Transaction Total P&L: $${transactionTotalPnL.toFixed(2)} (${transactionTotalPnL >= 0 ? 'GAIN' : 'LOSS'})`);
            
            if (transactionTotalPnL >= 0) {
                // Net gain for this transaction
                totalGains += transactionTotalPnL;
                console.log(`     → Added $${transactionTotalPnL.toFixed(2)} to gains. Running total: $${totalGains.toFixed(2)}`);
            } else {
                // Net loss for this transaction
                if (hasWashSales) {
                    washSaleCount++;
                    // Only the non-wash-sale portion counts as deductible loss
                    const deductibleLoss = Math.abs(transactionTotalPnL) - transactionWashSaleLoss;
                    if (deductibleLoss > 0) {
                        totalLosses += deductibleLoss;
                    }
                    console.log(`     → Wash sale: $${transactionWashSaleLoss.toFixed(2)} disallowed, $${deductibleLoss.toFixed(2)} deductible. Running loss total: $${totalLosses.toFixed(2)}`);
                } else {
                    totalLosses += Math.abs(transactionTotalPnL);
                    console.log(`     → Added $${Math.abs(transactionTotalPnL).toFixed(2)} to losses. Running total: $${totalLosses.toFixed(2)}`);
                }
            }
        });

        return {
            totalLosses,
            totalGains,
            washSaleCount,
            netPnL: totalGains - totalLosses
        };
    }

    /**
     * Export data for tax purposes
     */
    exportTransactions() {
        const data = {
            transactions: this.transactions,
            portfolio: this.getPortfolio(),
            ytdStats: this.getYTDStats(),
            exportDate: new Date().toISOString(),
            version: '1.0'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `washsafe-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Check if a specific transaction was involved in a wash sale
     * This is for historical analysis of existing transactions
     * Uses FIFO-based analysis for accurate results
     */
    getTransactionWashSaleStatus(targetTransaction) {
        console.log(`🔍 Checking wash sale for ${targetTransaction.symbol} on ${new Date(targetTransaction.date).toLocaleDateString()}`);
        
        if (targetTransaction.type !== 'sell') {
            console.log(`   → Skipping: Not a sell transaction`);
            return null; // Only sells can trigger wash sales
        }

        // Try to get the FIFO sale data for this transaction
        // We'll simulate the sale to see what lots would have been used
        const symbol = targetTransaction.symbol;
        const sellDate = new Date(targetTransaction.date);
        
        // Get share lots as they would have been at the time of this sale
        const lotsAtSaleTime = this.getShareLotsAtDate(symbol, sellDate);
        
        if (lotsAtSaleTime.length === 0) {
            console.log(`   → No lots available at sale time`);
            return null;
        }
        
        // Simulate the FIFO allocation for this transaction
        let remainingToSell = targetTransaction.quantity;
        let totalWashSaleLoss = 0;
        let hasWashSale = false;
        
        for (const lot of lotsAtSaleTime) {
            if (remainingToSell <= 0) break;
            
            const sharesFromThisLot = Math.min(remainingToSell, lot.remainingQuantity);
            const costBasis = lot.costPerShare * sharesFromThisLot;
            const saleProceeds = targetTransaction.price * sharesFromThisLot;
            const pnl = saleProceeds - costBasis;
            
            if (pnl < 0) {
                // Check if this lot sale creates a wash sale (only consider transactions up to this date)
                const washSaleInfo = this.checkLotWashSale(lot, sharesFromThisLot, sellDate, pnl, { asOfDate: sellDate });
                if (washSaleInfo.isWashSale) {
                    hasWashSale = true;
                    totalWashSaleLoss += Math.abs(pnl);
                }
            }
            
            remainingToSell -= sharesFromThisLot;
        }
        
        if (hasWashSale) {
            console.log(`   → WASH SALE DETECTED! Loss of $${totalWashSaleLoss.toFixed(2)} disallowed`);
            return {
                type: 'wash_sale_violation',
                loss: totalWashSaleLoss
            };
        }
        
        console.log(`   → No wash sale detected`);
        return null;
    }

    /**
     * Get share lots as they would have been at a specific date
     * This helps analyze historical transactions
     */
    getShareLotsAtDate(symbol, targetDate) {
        // Rebuild lots up to the target date
        const lots = [];
        const transactionsUpToDate = this.transactions
            .filter(t => t.symbol === symbol && new Date(t.date) < targetDate)
            .sort((a, b) => {
                const dateDiff = new Date(a.date) - new Date(b.date);
                if (dateDiff !== 0) return dateDiff;
                return a.id.toString().localeCompare(b.id.toString());
            });
        
        transactionsUpToDate.forEach(transaction => {
            if (transaction.type === 'buy') {
                const lot = this.createShareLot(transaction);
                lots.push(lot);
            } else if (transaction.type === 'sell') {
                // Allocate sale against existing lots using FIFO
                const availableLots = lots
                    .filter(lot => lot.remainingQuantity > 0)
                    .sort((a, b) => new Date(a.purchaseDate) - new Date(b.purchaseDate));
                
                let remainingToSell = transaction.quantity;
                
                for (const lot of availableLots) {
                    if (remainingToSell <= 0) break;
                    
                    const sharesFromThisLot = Math.min(remainingToSell, lot.remainingQuantity);
                    lot.remainingQuantity -= sharesFromThisLot;
                    remainingToSell -= sharesFromThisLot;
                }
            }
        });
        
        return lots.filter(lot => lot.remainingQuantity > 0)
                  .sort((a, b) => new Date(a.purchaseDate) - new Date(b.purchaseDate));
    }


    /**
     * Add a stock split - only affects pre-split transactions
     * @param {string} symbol - Stock symbol
     * @param {Date|string} splitDate - Date of the split
     * @param {number} ratio - Split ratio (e.g., 10 for 10:1 split, 0.1 for 1:10 reverse split)
     */
    addStockSplit(symbol, splitDate, ratio) {
        const split = {
            id: 'split_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            symbol: symbol.toUpperCase(),
            splitDate: new Date(splitDate),
            ratio: ratio,
            appliedAt: new Date()
        };

        // Check if this split already exists
        const existingSplit = this.stockSplits.find(s => 
            s.symbol === split.symbol && 
            Math.abs(new Date(s.splitDate).getTime() - split.splitDate.getTime()) < 24 * 60 * 60 * 1000
        );

        if (existingSplit) {
            console.warn(`⚠️ Split already exists for ${symbol} on ${split.splitDate.toDateString()}`);
            return false;
        }

        this.stockSplits.push(split);
        
        // Immediately rebuild share lots to apply the new split
        console.log(`📊 Added stock split: ${symbol} ${ratio}:1 on ${split.splitDate.toDateString()}`);
        console.log(`🔄 Rebuilding share lots to apply new split...`);
        this.rebuildShareLotsFromTransactions();
        
        this.saveTransactions();
        console.log(`✅ Split applied and share lots updated`);
        return true;
    }

    /**
     * Get stock splits for a symbol
     */
    getStockSplits(symbol = null) {
        if (symbol) {
            return this.stockSplits
                .filter(s => s.symbol === symbol.toUpperCase())
                .sort((a, b) => new Date(a.splitDate) - new Date(b.splitDate));
        }
        return this.stockSplits.sort((a, b) => new Date(a.splitDate) - new Date(b.splitDate));
    }

    /**
     * Detect potential stock splits by analyzing price gaps in transaction history
     * @param {string} symbol - Optional symbol to check, or null to check all symbols
     * @returns {Array} Array of potential split alerts
     */
    detectPotentialSplits(symbol = null) {
        console.log('🔍 Scanning for potential stock splits...');
        const alerts = [];
        const transactionsToCheck = symbol ? 
            this.transactions.filter(t => t.symbol === symbol) : 
            this.transactions;
        
        // Group transactions by symbol
        const bySymbol = {};
        transactionsToCheck.forEach(t => {
            if (!bySymbol[t.symbol]) bySymbol[t.symbol] = [];
            bySymbol[t.symbol].push(t);
        });
        
        Object.entries(bySymbol).forEach(([sym, transactions]) => {
            if (transactions.length < 2) return; // Need at least 2 transactions to detect gaps
            
            const sorted = transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            for (let i = 1; i < sorted.length; i++) {
                const prev = sorted[i-1];
                const curr = sorted[i];
                const daysBetween = Math.abs(new Date(curr.date) - new Date(prev.date)) / (1000 * 60 * 60 * 24);
                
                // Only consider transactions within reasonable timeframe (up to 60 days apart)
                if (daysBetween > 60) continue;
                
                const priceRatio = prev.price / curr.price;
                const reverseRatio = curr.price / prev.price;
                
                let detectedSplit = null;
                
                // Check for regular stock splits (price drops)
                const regularSplitRatios = [2, 3, 4, 5, 7, 10, 20, 25, 50];
                for (const splitRatio of regularSplitRatios) {
                    if (Math.abs(priceRatio - splitRatio) < 0.4) {
                        const confidence = this.calculateSplitConfidence(priceRatio, splitRatio, daysBetween, 'regular');
                        if (confidence >= 60) { // Only high-confidence detections
                            detectedSplit = {
                                type: 'regular',
                                suggestedRatio: `${splitRatio}:1`,
                                actualRatio: priceRatio,
                                confidence: confidence
                            };
                            break;
                        }
                    }
                }
                
                // Check for reverse splits (price increases)
                if (!detectedSplit) {
                    const reverseSplitRatios = [2, 3, 4, 5, 7, 10, 15, 20, 25, 40, 50, 100];
                    for (const splitRatio of reverseSplitRatios) {
                        if (Math.abs(reverseRatio - splitRatio) < 0.4) {
                            const confidence = this.calculateSplitConfidence(reverseRatio, splitRatio, daysBetween, 'reverse');
                            if (confidence >= 60) { // Only high-confidence detections
                                detectedSplit = {
                                    type: 'reverse',
                                    suggestedRatio: `1:${splitRatio}`,
                                    actualRatio: reverseRatio,
                                    confidence: confidence
                                };
                                break;
                            }
                        }
                    }
                }
                
                if (detectedSplit) { // Enhanced split detection
                    // Check if we already have this split recorded
                    const existingSplit = this.stockSplits.find(s => 
                        s.symbol === sym && 
                        Math.abs(new Date(s.splitDate).getTime() - new Date(curr.date).getTime()) < 7 * 24 * 60 * 60 * 1000 // Within 7 days
                    );
                    
                    if (!existingSplit) {
                        alerts.push({
                            symbol: sym,
                            detectedDate: curr.date,
                            splitType: detectedSplit.type,
                            suggestedRatio: detectedSplit.suggestedRatio,
                            priceFrom: prev.price,
                            priceTo: curr.price,
                            actualRatio: detectedSplit.actualRatio,
                            daysBetween: Math.round(daysBetween),
                            confidence: detectedSplit.confidence,
                            previousTransaction: prev,
                            currentTransaction: curr
                        });
                        
                        console.log(`   🎯 Potential ${detectedSplit.suggestedRatio} ${detectedSplit.type} split detected for ${sym} around ${new Date(curr.date).toDateString()}`);
                        console.log(`      Price change: $${prev.price.toFixed(2)} → $${curr.price.toFixed(2)} (${detectedSplit.actualRatio.toFixed(1)}x) - ${detectedSplit.confidence}% confidence`);
                    }
                }
            }
        });
        
        // Sort by confidence (highest first)
        alerts.sort((a, b) => b.confidence - a.confidence);
        
        console.log(`✅ Split detection complete: Found ${alerts.length} potential splits`);
        return alerts;
    }

    /**
     * Diagnostic function to identify portfolio calculation issues
     */
    diagnosePortfolioDiscrepancies() {
        console.log('🔍 DIAGNOSING PORTFOLIO DISCREPANCIES...');
        
        const symbols = [...new Set(this.transactions.map(t => t.symbol))];
        const discrepancies = [];
        
        for (const symbol of symbols) {
            console.log(`\n📊 Analyzing ${symbol}:`);
            
            // Calculate position using transaction logic
            const symbolTransactions = this.transactions
                .filter(t => t.symbol === symbol)
                .sort((a, b) => {
                const dateDiff = new Date(a.date) - new Date(b.date);
                if (dateDiff !== 0) return dateDiff;
                return a.id.toString().localeCompare(b.id.toString());
            });
            
            let calculatedShares = 0;
            let unallocatedSells = 0;
            
            for (const transaction of symbolTransactions) {
                console.log(`   ${new Date(transaction.date).toDateString()}: ${transaction.type.toUpperCase()} ${transaction.quantity} @ $${transaction.price}`);
                
                if (transaction.type === 'buy') {
                    // Apply split adjustments for buy transactions
                    const adjustments = this.calculateSplitAdjustments(symbol, new Date(transaction.date));
                    const adjustedQuantity = transaction.quantity * adjustments.totalRatio;
                    calculatedShares += adjustedQuantity;
                    console.log(`     → Added ${adjustedQuantity} shares (split adjusted from ${transaction.quantity})`);
                } else if (transaction.type === 'sell') {
                    // Apply split adjustments for sell transactions
                    const adjustments = this.calculateSplitAdjustments(symbol, new Date(transaction.date));
                    const adjustedQuantity = transaction.quantity * adjustments.totalRatio;
                    
                    if (calculatedShares >= adjustedQuantity) {
                        calculatedShares -= adjustedQuantity;
                        console.log(`     → Sold ${adjustedQuantity} shares (split adjusted from ${transaction.quantity})`);
                    } else {
                        unallocatedSells += adjustedQuantity - calculatedShares;
                        calculatedShares = 0;
                        console.log(`     → ⚠️  Could only sell ${calculatedShares} of ${adjustedQuantity} requested shares`);
                    }
                }
            }
            
            // Get current portfolio position
            const portfolio = this.getPortfolio();
            const portfolioPosition = portfolio[symbol];
            const portfolioShares = portfolioPosition ? portfolioPosition.shares : 0;
            
            console.log(`   📊 Transaction-based calculation: ${calculatedShares} shares`);
            console.log(`   📊 Portfolio method shows: ${portfolioShares} shares`);
            
            if (Math.abs(calculatedShares - portfolioShares) > 0.001) {
                console.log(`   ❌ DISCREPANCY FOUND: ${Math.abs(calculatedShares - portfolioShares)} shares difference`);
                discrepancies.push({
                    symbol,
                    transactionBasedShares: calculatedShares,
                    portfolioShares,
                    difference: portfolioShares - calculatedShares,
                    unallocatedSells
                });
            } else {
                console.log(`   ✅ Portfolio calculation matches transaction analysis`);
            }
        }
        
        if (discrepancies.length > 0) {
            console.log(`\n❌ FOUND ${discrepancies.length} PORTFOLIO DISCREPANCIES:`);
            discrepancies.forEach(disc => {
                console.log(`   ${disc.symbol}: Portfolio shows ${disc.portfolioShares}, should be ${disc.transactionBasedShares} (diff: ${disc.difference})`);
            });
            return discrepancies;
        } else {
            console.log(`\n✅ All portfolio calculations are consistent`);
            return [];
        }
    }

    /**
     * Fix portfolio discrepancies by rebuilding share lots with proper validation
     */
    fixPortfolioDiscrepancies() {
        console.log('🔧 FIXING PORTFOLIO DISCREPANCIES...');
        
        // First, diagnose to understand the issues
        const discrepancies = this.diagnosePortfolioDiscrepancies();
        
        if (discrepancies.length === 0) {
            console.log('✅ No discrepancies found to fix');
            return;
        }
        
        console.log(`🔧 Rebuilding share lots to fix ${discrepancies.length} discrepancies...`);
        
        // Clear existing share lots
        this.shareLots = [];
        
        // Rebuild with enhanced validation
        const lots = [];
        const sortedTransactions = [...this.transactions].sort((a, b) => {
            const dateDiff = new Date(a.date) - new Date(b.date);
            if (dateDiff !== 0) return dateDiff;
            // If dates are equal, sort by transaction ID to ensure consistent ordering
            return a.id.toString().localeCompare(b.id.toString());
        });
        
        console.log(`🔄 Processing ${sortedTransactions.length} transactions in chronological order...`);
        
        sortedTransactions.forEach((transaction, index) => {
            console.log(`\n${index + 1}/${sortedTransactions.length}: ${new Date(transaction.date).toDateString()} - ${transaction.type.toUpperCase()} ${transaction.quantity} ${transaction.symbol} @ $${transaction.price}`);
            
            if (transaction.type === 'buy') {
                // Create new lot for purchase
                const lot = this.createShareLot(transaction);
                lots.push(lot);
                console.log(`   ✅ Created lot: ${lot.originalQuantity} shares @ $${lot.costPerShare.toFixed(4)}`);
                
            } else if (transaction.type === 'sell') {
                // Allocate sale against existing lots using FIFO
                const symbol = transaction.symbol;
                const availableLots = lots
                    .filter(lot => lot.symbol === symbol && lot.remainingQuantity > 0)
                    .sort((a, b) => new Date(a.purchaseDate) - new Date(b.purchaseDate));
                
                // Apply split adjustments to sell quantity to match lot quantities
                const adjustments = this.calculateSplitAdjustments(transaction.symbol, new Date(transaction.date));
                let remainingToSell = transaction.quantity * adjustments.totalRatio;
                
                console.log(`   🔍 Attempting to sell ${transaction.quantity} → ${remainingToSell} shares (split ratio: ${adjustments.totalRatio})`);
                
                // Calculate total available shares
                const totalAvailable = availableLots.reduce((sum, lot) => sum + lot.remainingQuantity, 0);
                console.log(`   📊 Available shares: ${totalAvailable}, Requested: ${remainingToSell}`);
                
                if (totalAvailable < remainingToSell) {
                    console.warn(`   ⚠️  INSUFFICIENT SHARES: Only ${totalAvailable} available for ${remainingToSell} requested`);
                    console.warn(`   → This sell transaction will result in a portfolio discrepancy`);
                    
                    // Log which lots are available
                    availableLots.forEach(lot => {
                        console.log(`     Available lot: ${lot.remainingQuantity} shares from ${lot.purchaseDate.toDateString()}`);
                    });
                }
                
                let allocatedShares = 0;
                for (const lot of availableLots) {
                    if (remainingToSell <= 0) break;
                    
                    const sharesFromThisLot = Math.min(remainingToSell, lot.remainingQuantity);
                    lot.remainingQuantity -= sharesFromThisLot;
                    remainingToSell -= sharesFromThisLot;
                    allocatedShares += sharesFromThisLot;
                    
                    console.log(`     → Allocated ${sharesFromThisLot} shares from lot ${lot.id} (${lot.remainingQuantity} remaining)`);
                }
                
                if (remainingToSell > 0) {
                    console.error(`   ❌ UNALLOCATED SELL: ${remainingToSell} shares could not be allocated`);
                    console.error(`   → This indicates a data inconsistency that needs to be resolved`);
                } else {
                    console.log(`   ✅ Successfully allocated ${allocatedShares} shares`);
                }
            }
        });
        
        // Update share lots
        this.shareLots = lots;
        
        // Save the corrected data
        this.saveTransactions();
        
        // Verify the fix
        console.log('\n🔍 Verifying fix...');
        const remainingDiscrepancies = this.diagnosePortfolioDiscrepancies();
        
        if (remainingDiscrepancies.length === 0) {
            console.log('✅ Portfolio discrepancies successfully fixed!');
        } else {
            console.log(`❌ ${remainingDiscrepancies.length} discrepancies still remain after fix attempt`);
        }
        
        return remainingDiscrepancies;
    }

    /**
     * Calculate confidence score for a detected split
     */
    calculateSplitConfidence(actualRatio, suggestedRatio, daysBetween, splitType = 'regular') {
        let confidence = 100;
        
        // Reduce confidence based on how far actual ratio is from suggested ratio
        const ratioError = Math.abs(actualRatio - suggestedRatio) / suggestedRatio;
        confidence -= ratioError * 60; // Up to 60% penalty for ratio mismatch
        
        // Reduce confidence if transactions are too far apart
        if (daysBetween > 30) {
            confidence -= (daysBetween - 30) * 1.5; // 1.5% penalty per day over 30 days
        }
        
        // Very close transactions might not be splits, just market volatility
        if (daysBetween < 1) {
            confidence -= 40; // Same day transactions are suspicious
        }
        
        // Common split ratios get bonus confidence
        const commonRegularRatios = [2, 3, 4, 5, 10, 20];
        const commonReverseRatios = [5, 10, 20, 25, 40, 50, 100];
        
        if (splitType === 'regular' && commonRegularRatios.includes(suggestedRatio)) {
            confidence += 15;
        } else if (splitType === 'reverse' && commonReverseRatios.includes(suggestedRatio)) {
            confidence += 10; // Reverse splits are less common, smaller bonus
        }
        
        // Price ratio must be significant enough to be a real split
        if (actualRatio < 1.8) {
            confidence -= 30; // Small price changes are probably not splits
        }
        
        // Very large ratios (>100) are suspicious unless it's a known penny stock scenario
        if (actualRatio > 100) {
            confidence -= 20;
        }
        
        return Math.max(10, Math.min(100, Math.round(confidence)));
    }

    /**
     * Get split-adjusted values for a transaction (for display and calculations)
     * This does NOT modify the original transaction data
     */
    getAdjustedTransactionDisplay(transaction) {
        const adjustments = this.calculateSplitAdjustments(transaction.symbol, new Date(transaction.date));
        
        return {
            price: transaction.price / adjustments.totalRatio,
            quantity: transaction.quantity * adjustments.totalRatio,
            isAdjusted: adjustments.appliedSplits.length > 0,
            splitInfo: adjustments.appliedSplits
        };
    }

    /**
     * Calculate cumulative split adjustments for a symbol up to a given date
     * Returns the total ratio to apply and which splits were considered
     */
    calculateSplitAdjustments(symbol, asOfDate) {
        const splits = this.stockSplits
            .filter(s => s.symbol === symbol && new Date(s.splitDate) > asOfDate)
            .sort((a, b) => new Date(a.splitDate) - new Date(b.splitDate));
        
        let totalRatio = 1;
        const appliedSplits = [];
        
        for (const split of splits) {
            totalRatio *= split.ratio;
            appliedSplits.push(split);
        }
        
        return {
            totalRatio,
            appliedSplits
        };
    }

    /**
     * Apply stock splits to actual share lots and transactions (affects P&L calculations)
     * This modifies the underlying data, not just display
     */
    applyStockSplitsToLots() {
        console.log('🔄 Applying stock splits to share lots and transactions...');
        
        // Apply splits to share lots
        console.log(`🔍 Checking ${this.shareLots.length} share lots for split applications...`);
        
        this.shareLots.forEach(lot => {
            console.log(`🔍 Lot ${lot.id}: ${lot.symbol}, purchased ${lot.purchaseDate}, remaining: ${lot.remainingQuantity}, cost: $${lot.costPerShare}`);
            
            const splits = this.getStockSplits(lot.symbol);
            const lotDate = new Date(lot.purchaseDate);
            
            console.log(`   → Found ${splits.length} splits for ${lot.symbol}`);
            
            for (const split of splits) {
                const splitDate = new Date(split.splitDate);
                const lotBeforeSplit = lotDate < splitDate;
                const alreadyApplied = lot.appliedSplits?.includes(split.id);
                
                console.log(`   → Split ${split.id} (${split.ratio}:1 on ${splitDate.toDateString()}): lotBeforeSplit=${lotBeforeSplit}, alreadyApplied=${alreadyApplied}`);
                
                // Only apply splits to lots that were created BEFORE the split date
                if (lotBeforeSplit && !alreadyApplied) {
                    console.log(`   → ✅ Applying ${split.ratio}:1 split to lot ${lot.id} (${lot.symbol})`);
                    console.log(`   → BEFORE: ${lot.remainingQuantity} shares @ $${lot.costPerShare.toFixed(2)}`);
                    
                    // Adjust lot quantities and prices
                    lot.originalQuantity *= split.ratio;
                    lot.remainingQuantity *= split.ratio;
                    lot.costPerShare /= split.ratio;
                    
                    console.log(`   → AFTER: ${lot.remainingQuantity} shares @ $${lot.costPerShare.toFixed(2)}`);
                    
                    // Track which splits have been applied to this lot
                    if (!lot.appliedSplits) lot.appliedSplits = [];
                    lot.appliedSplits.push(split.id);
                } else {
                    console.log(`   → ⏭️ Skipping split (not applicable or already applied)`);
                }
            }
        });
        
        // Apply splits to transactions (for accurate historical P&L)
        this.transactions.forEach(transaction => {
            const splits = this.getStockSplits(transaction.symbol);
            const transactionDate = new Date(transaction.date);
            
            for (const split of splits) {
                const splitDate = new Date(split.splitDate);
                
                // Only apply splits that occurred AFTER the transaction
                if (splitDate > transactionDate && !transaction.appliedSplits?.includes(split.id)) {
                    console.log(`   → Applying ${split.ratio}:1 split to transaction ${transaction.id} (${transaction.symbol})`);
                    
                    // Adjust transaction quantities and prices
                    transaction.quantity *= split.ratio;
                    transaction.price /= split.ratio;
                    transaction.total = transaction.quantity * transaction.price;
                    
                    // Track which splits have been applied to this transaction
                    if (!transaction.appliedSplits) transaction.appliedSplits = [];
                    transaction.appliedSplits.push(split.id);
                }
            }
        });
        
        this.saveTransactions();
        console.log('✅ Stock splits applied to lots and transactions');
    }

    /**
     * Remove a stock split and undo its effects
     */
    removeStockSplit(splitId) {
        console.log(`🗑️ ENGINE: Looking for split ID: ${splitId}`);
        console.log(`🗑️ ENGINE: Available splits:`, this.stockSplits.map(s => ({ id: s.id, symbol: s.symbol, ratio: s.ratio })));
        
        const index = this.stockSplits.findIndex(s => s.id == splitId || s.id === splitId);
        console.log(`🗑️ ENGINE: Found split at index: ${index}`);
        
        if (index >= 0) {
            const split = this.stockSplits[index];
            console.log(`🗑️ ENGINE: Removing split:`, split);
            
            // Undo the split effects on lots and transactions
            this.undoStockSplit(splitId, split.ratio);
            
            // Remove the split
            this.stockSplits.splice(index, 1);
            this.saveTransactions();
            console.log(`🗑️ ENGINE: Successfully removed stock split: ${split.symbol} ${split.ratio}:1 on ${new Date(split.splitDate).toDateString()}`);
            return true;
        }
        console.error(`🗑️ ENGINE: Split ID ${splitId} not found`);
        return false;
    }

    /**
     * Undo the effects of a stock split on lots and transactions
     */
    undoStockSplit(splitId, ratio) {
        console.log(`🔄 Undoing stock split effects for split ID: ${splitId}`);
        
        // Undo effects on share lots
        this.shareLots.forEach(lot => {
            if (lot.appliedSplits?.includes(splitId)) {
                console.log(`   → Undoing split effects on lot ${lot.id}`);
                
                // Reverse the split adjustments
                lot.originalQuantity /= ratio;
                lot.remainingQuantity /= ratio;
                lot.costPerShare *= ratio;
                
                // Remove split from applied splits
                lot.appliedSplits = lot.appliedSplits.filter(id => id !== splitId);
                if (lot.appliedSplits.length === 0) {
                    delete lot.appliedSplits;
                }
            }
        });
        
        // Undo effects on transactions
        this.transactions.forEach(transaction => {
            if (transaction.appliedSplits?.includes(splitId)) {
                console.log(`   → Undoing split effects on transaction ${transaction.id}`);
                
                // Reverse the split adjustments
                transaction.quantity /= ratio;
                transaction.price *= ratio;
                transaction.total = transaction.quantity * transaction.price;
                
                // Remove split from applied splits
                transaction.appliedSplits = transaction.appliedSplits.filter(id => id !== splitId);
                if (transaction.appliedSplits.length === 0) {
                    delete transaction.appliedSplits;
                }
            }
        });
        
        console.log('✅ Stock split effects undone');
    }

    /**
     * Clear all stock splits (for fixing old ID format issues)
     */
    clearAllStockSplits() {
        if (confirm('Clear all stock splits?\n\nThis will remove all splits and restore original transaction prices.\nThis action cannot be undone.')) {
            // Undo all split effects first
            this.stockSplits.forEach(split => {
                this.undoStockSplit(split.id, split.ratio);
            });
            
            this.stockSplits = [];
            this.saveTransactions();
            console.log('🗑️ All stock splits cleared');
            return true;
        }
        return false;
    }

    /**
     * Clear all data
     */
    clearAllData() {
        if (confirm('Are you sure you want to delete all transaction data? This cannot be undone.')) {
            this.transactions = [];
            this.shareLots = [];
            this.stockSplits = [];
            this.washSaleViolations = [];
            localStorage.removeItem('washsafe_transactions');
            localStorage.removeItem('washsafe_share_lots');
            localStorage.removeItem('washsafe_stock_splits');
            localStorage.removeItem('washsafe_last_updated');
            return true;
        }
        return false;
    }
}

// Create global instance
window.washSaleEngine = new WashSaleEngine();

console.log('✅ WashSale Engine loaded');