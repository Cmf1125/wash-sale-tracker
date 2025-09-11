/**
 * WashSale Engine - Core wash sale detection and prevention logic
 * Implements IRS wash sale rules for stock transactions
 */

class WashSaleEngine {
    constructor() {
        this.transactions = this.loadTransactions();
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
     * Save transactions to localStorage
     */
    saveTransactions() {
        try {
            localStorage.setItem('washsafe_transactions', JSON.stringify(this.transactions));
            localStorage.setItem('washsafe_last_updated', new Date().toISOString());
        } catch (error) {
            console.error('Error saving transactions:', error);
        }
    }

    /**
     * Add a new transaction and check for wash sales
     */
    addTransaction(transaction) {
        // Add unique ID and timestamp
        transaction.id = Date.now() + Math.random();
        transaction.createdAt = new Date().toISOString();
        
        // Normalize the transaction
        transaction.symbol = transaction.symbol.toUpperCase();
        transaction.date = new Date(transaction.date);
        transaction.quantity = parseInt(transaction.quantity);
        transaction.price = parseFloat(transaction.price);
        transaction.total = transaction.quantity * transaction.price;

        // Check for wash sale BEFORE adding
        const washSaleResult = this.checkWashSale(transaction);
        
        // Add the transaction
        this.transactions.push(transaction);
        this.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Save to storage
        this.saveTransactions();
        
        return {
            transaction,
            washSaleViolation: washSaleResult
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
                message: `Warning: Don't buy ${symbol} again until ${new Date(sellDate.getTime() + (31 * 24 * 60 * 60 * 1000)).toLocaleDateString()} to avoid wash sale rule.`
            };
        }

        return null;
    }

    /**
     * Calculate average cost basis for a symbol up to a certain date
     */
    calculateAverageCost(symbol, upToDate) {
        const symbolTransactions = this.transactions
            .filter(t => t.symbol === symbol && new Date(t.date) <= upToDate)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        let totalShares = 0;
        let totalCost = 0;

        symbolTransactions.forEach(transaction => {
            if (transaction.type === 'buy') {
                totalShares += transaction.quantity;
                totalCost += transaction.total;
            } else if (transaction.type === 'sell') {
                const sellRatio = transaction.quantity / totalShares;
                totalCost -= (totalCost * sellRatio);
                totalShares -= transaction.quantity;
            }
        });

        return {
            averageCost: totalShares > 0 ? totalCost / totalShares : 0,
            totalShares: totalShares,
            totalCost: totalCost
        };
    }

    /**
     * Get current portfolio positions
     */
    getPortfolio() {
        const positions = {};
        
        this.transactions.forEach(transaction => {
            const symbol = transaction.symbol;
            
            if (!positions[symbol]) {
                positions[symbol] = {
                    symbol: symbol,
                    shares: 0,
                    totalCost: 0,
                    transactions: [],
                    averageCost: 0
                };
            }

            positions[symbol].transactions.push(transaction);

            if (transaction.type === 'buy') {
                positions[symbol].shares += transaction.quantity;
                positions[symbol].totalCost += transaction.total;
            } else if (transaction.type === 'sell') {
                positions[symbol].shares -= transaction.quantity;
                // Reduce cost proportionally
                const sellRatio = transaction.quantity / (positions[symbol].shares + transaction.quantity);
                positions[symbol].totalCost -= (positions[symbol].totalCost * sellRatio / (1 - sellRatio));
            }
        });

        // Calculate average cost and remove zero positions
        Object.keys(positions).forEach(symbol => {
            if (positions[symbol].shares <= 0) {
                delete positions[symbol];
            } else {
                positions[symbol].averageCost = positions[symbol].totalCost / positions[symbol].shares;
            }
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

        // This is simplified - in reality you'd need to track wash sales more carefully
        yearTransactions.forEach(transaction => {
            if (transaction.type === 'sell') {
                const cost = this.calculateAverageCost(transaction.symbol, transaction.date);
                const pnl = (transaction.price - cost.averageCost) * transaction.quantity;
                
                if (pnl < 0) {
                    totalLosses += Math.abs(pnl);
                } else {
                    totalGains += pnl;
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
     * Clear all data
     */
    clearAllData() {
        if (confirm('Are you sure you want to delete all transaction data? This cannot be undone.')) {
            this.transactions = [];
            this.washSaleViolations = [];
            localStorage.removeItem('washsafe_transactions');
            localStorage.removeItem('washsafe_last_updated');
            return true;
        }
        return false;
    }
}

// Create global instance
window.washSaleEngine = new WashSaleEngine();

console.log('✅ WashSale Engine loaded');