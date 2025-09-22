/**
 * WashSale Engine - Core wash sale detection and prevention logic
 * Implements IRS wash sale rules for stock transactions
 */

class WashSaleEngine {
    constructor() {
        this.transactions = this.loadTransactions();
        this.shareLots = this.loadShareLots();
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
        const sortedTransactions = [...this.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
        
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
                
                let remainingToSell = transaction.quantity;
                
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
        
        this.shareLots = lots;
        this.saveTransactions(); // This will save the rebuilt lots
        console.log(`✅ Rebuilt ${lots.length} share lots`);
        
        return lots;
    }

    /**
     * Save transactions and share lots to localStorage
     */
    saveTransactions() {
        try {
            localStorage.setItem('washsafe_transactions', JSON.stringify(this.transactions));
            localStorage.setItem('washsafe_share_lots', JSON.stringify(this.shareLots));
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
        this.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        
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
            .sort((a, b) => new Date(a.date) - new Date(b.date));

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
        return {
            id: `lot_${buyTransaction.id}`,
            symbol: buyTransaction.symbol,
            purchaseDate: new Date(buyTransaction.date),
            originalQuantity: buyTransaction.quantity,
            remainingQuantity: buyTransaction.quantity,
            costPerShare: buyTransaction.price,
            purchaseTransactionId: buyTransaction.id
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
        const sellQuantity = sellTransaction.quantity;
        const sellPrice = sellTransaction.price;
        const sellDate = new Date(sellTransaction.date);
        
        console.log(`🔍 FIFO Sale Processing: ${symbol} - ${sellQuantity} shares @ $${sellPrice}`);
        
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
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        
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
        
        // Group lots by symbol
        this.shareLots.forEach(lot => {
            if (lot.remainingQuantity <= 0) return; // Skip fully sold lots
            
            const symbol = lot.symbol;
            
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
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        
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
     * Apply stock split adjustment to all lots and transactions for a symbol
     * @param {string} symbol - Stock symbol (e.g., 'NVDA')
     * @param {Date} splitDate - Date when the split occurred
     * @param {number} splitRatio - Split ratio (e.g., 10 for 10:1 split)
     */
    applyStockSplit(symbol, splitDate, splitRatio) {
        const splitType = splitRatio >= 1 ? 'forward' : 'reverse';
        const displayRatio = splitRatio >= 1 ? `${splitRatio}:1` : `1:${Math.round(1/splitRatio)}`;
        console.log(`🔄 Applying ${displayRatio} ${splitType} split for ${symbol} on ${splitDate.toDateString()}`);
        console.log(`🔍 Split date object:`, splitDate);
        console.log(`🔍 Split date type:`, typeof splitDate);
        console.log(`🔍 Split date timestamp:`, splitDate.getTime());
        
        let lotsAffected = 0;
        let transactionsAffected = 0;
        
        // Adjust share lots purchased before the split date
        this.shareLots.forEach(lot => {
            if (lot.symbol === symbol && new Date(lot.purchaseDate) < splitDate) {
                console.log(`   → Adjusting lot ${lot.id}: ${lot.originalQuantity}@$${lot.costPerShare.toFixed(2)} → ${lot.originalQuantity * splitRatio}@$${(lot.costPerShare / splitRatio).toFixed(2)}`);
                
                // Adjust quantities
                lot.originalQuantity *= splitRatio;
                lot.remainingQuantity *= splitRatio;
                
                // Adjust cost per share (divide by split ratio)
                lot.costPerShare /= splitRatio;
                
                lotsAffected++;
            }
        });
        
        // Adjust transactions that occurred before the split date
        this.transactions.forEach(transaction => {
            if (transaction.symbol === symbol) {
                const transactionDate = new Date(transaction.date);
                const isBeforeSplit = transactionDate < splitDate;
                console.log(`🔍 Checking transaction: ${transaction.symbol} on ${transactionDate.toDateString()} (${transactionDate.getTime()}) vs split ${splitDate.toDateString()} (${splitDate.getTime()}) → Before split: ${isBeforeSplit}`);
                
                if (isBeforeSplit) {
                    console.log(`   → Adjusting transaction ${transaction.id}: ${transaction.quantity}@$${transaction.price.toFixed(2)} → ${transaction.quantity * splitRatio}@$${(transaction.price / splitRatio).toFixed(2)}`);
                    
                    // Adjust quantities
                    transaction.quantity *= splitRatio;
                    
                    // Adjust price per share (divide by split ratio)
                    transaction.price /= splitRatio;
                    
                    // Recalculate total (should remain the same)
                    transaction.total = transaction.quantity * transaction.price;
                    
                    transactionsAffected++;
                }
            }
        });
        
        // Save the changes
        this.saveTransactions();
        
        console.log(`✅ Stock split applied: ${lotsAffected} lots and ${transactionsAffected} transactions adjusted`);
        
        return {
            success: true,
            lotsAffected,
            transactionsAffected,
            splitRatio,
            splitDate
        };
    }

    /**
     * Clear all data
     */
    clearAllData() {
        if (confirm('Are you sure you want to delete all transaction data? This cannot be undone.')) {
            this.transactions = [];
            this.shareLots = [];
            this.washSaleViolations = [];
            localStorage.removeItem('washsafe_transactions');
            localStorage.removeItem('washsafe_share_lots');
            localStorage.removeItem('washsafe_last_updated');
            return true;
        }
        return false;
    }
}

// Create global instance
window.washSaleEngine = new WashSaleEngine();

console.log('✅ WashSale Engine loaded');