/**
 * WashSafe Application - Main UI Controller
 * Handles user interactions and updates the interface
 */

class WashSafeApp {
    constructor() {
        this.currentTab = 'trade';
        this.init();
    }

    init() {
        this.bindEventListeners();
        this.setDefaultDate();
        this.updateUI();
        console.log('🚀 WashSafe App initialized');
    }

    bindEventListeners() {
        // Form submission
        document.getElementById('trade-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleTradeSubmission();
        });

        // Real-time wash sale checking
        ['symbol', 'quantity', 'price', 'trade-date', 'trade-type'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', () => this.checkTradeRealTime());
                element.addEventListener('change', () => this.checkTradeRealTime());
            }
        });

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabId = e.target.onclick.toString().match(/showTab\('(\w+)'\)/)[1];
                this.showTab(tabId);
            });
        });
    }

    setDefaultDate() {
        const dateInput = document.getElementById('trade-date');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    }

    /**
     * Handle trade form submission
     */
    async handleTradeSubmission() {
        const formData = this.getFormData();
        
        if (!this.validateForm(formData)) {
            return;
        }

        try {
            // Add transaction and check for wash sales
            const result = window.washSaleEngine.addTransaction(formData);
            
            // Show success message
            this.showTradeResult(result);
            
            // Reset form
            this.resetForm();
            
            // Update all UI components
            this.updateUI();
            
            // Show save confirmation
            updateSaveStatus('✓ Trade Saved');
            
        } catch (error) {
            console.error('Error adding transaction:', error);
            alert('Error adding transaction. Please try again.');
        }
    }

    /**
     * Get form data
     */
    getFormData() {
        return {
            type: document.getElementById('trade-type').value,
            symbol: document.getElementById('symbol').value.toUpperCase().trim(),
            quantity: parseInt(document.getElementById('quantity').value),
            price: parseFloat(document.getElementById('price').value),
            date: document.getElementById('trade-date').value
        };
    }

    /**
     * Validate form data
     */
    validateForm(data) {
        if (!data.symbol) {
            alert('Please enter a stock symbol');
            return false;
        }

        if (!data.quantity || data.quantity <= 0) {
            alert('Please enter a valid quantity');
            return false;
        }

        if (!data.price || data.price <= 0) {
            alert('Please enter a valid price');
            return false;
        }

        if (!data.date) {
            alert('Please select a trade date');
            return false;
        }

        return true;
    }

    /**
     * Show trade result with wash sale information
     */
    showTradeResult(result) {
        const { transaction, washSaleViolation } = result;
        
        if (washSaleViolation) {
            if (washSaleViolation.type === 'wash_sale_violation') {
                alert(`⚠️ WASH SALE DETECTED!\n\n${washSaleViolation.message}\n\nThis trade has been recorded, but the $${washSaleViolation.loss.toFixed(2)} loss will be disallowed for tax purposes.`);
            } else if (washSaleViolation.type === 'wash_sale_warning') {
                alert(`🚨 WASH SALE WARNING!\n\n${washSaleViolation.message}\n\nAvoid buying ${transaction.symbol} until ${washSaleViolation.safeDate.toLocaleDateString()} to preserve your tax loss.`);
            } else if (washSaleViolation.type === 'insufficient_shares') {
                alert(`❌ INSUFFICIENT SHARES!\n\n${washSaleViolation.message}`);
                return;
            }
        } else {
            // Show success for safe trades
            const action = transaction.type === 'buy' ? 'Purchased' : 'Sold';
            alert(`✅ Trade Recorded!\n\n${action} ${transaction.quantity} shares of ${transaction.symbol} at $${transaction.price}\n\nNo wash sale violations detected.`);
        }
    }

    /**
     * Real-time wash sale checking as user types
     */
    checkTradeRealTime() {
        const formData = this.getFormData();
        
        // Clear previous alerts
        document.getElementById('wash-sale-alert').classList.add('hidden');
        document.getElementById('safe-trade-alert').classList.add('hidden');
        document.getElementById('no-analysis').classList.add('hidden');

        // Only check if we have enough data
        if (!formData.symbol || !formData.quantity || !formData.price || !formData.date) {
            document.getElementById('no-analysis').classList.remove('hidden');
            return;
        }

        // Only check wash sales for sell transactions
        if (formData.type !== 'sell') {
            document.getElementById('no-analysis').classList.remove('hidden');
            return;
        }

        // Check for wash sale
        const washSaleResult = window.washSaleEngine.checkWashSale(formData);
        
        if (washSaleResult && washSaleResult.type === 'wash_sale_violation') {
            document.getElementById('wash-sale-alert').classList.remove('hidden');
            document.getElementById('wash-sale-details').textContent = washSaleResult.message;
        } else if (washSaleResult && washSaleResult.type === 'wash_sale_warning') {
            document.getElementById('wash-sale-alert').classList.remove('hidden');
            document.getElementById('wash-sale-details').textContent = washSaleResult.message;
        } else if (washSaleResult === null) {
            // This means it's a sell but either no loss or no wash sale violation
            document.getElementById('safe-trade-alert').classList.remove('hidden');
        } else {
            document.getElementById('no-analysis').classList.remove('hidden');
        }
    }

    /**
     * Reset the form
     */
    resetForm() {
        document.getElementById('trade-form').reset();
        this.setDefaultDate();
        
        // Clear alerts
        document.getElementById('wash-sale-alert').classList.add('hidden');
        document.getElementById('safe-trade-alert').classList.add('hidden');
        document.getElementById('no-analysis').classList.remove('hidden');
    }

    /**
     * Show different tabs
     */
    showTab(tabName) {
        this.currentTab = tabName;

        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('border-blue-500', 'text-blue-600');
            btn.classList.add('border-transparent', 'text-gray-500');
        });

        document.getElementById(`tab-${tabName}`).classList.remove('border-transparent', 'text-gray-500');
        document.getElementById(`tab-${tabName}`).classList.add('border-blue-500', 'text-blue-600');

        // Show/hide tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });

        document.getElementById(`${tabName}-tab`).classList.remove('hidden');

        // Update content for the active tab
        if (tabName === 'portfolio') {
            this.updatePortfolioTable();
        } else if (tabName === 'history') {
            this.updateHistoryTable();
        } else if (tabName === 'alerts') {
            this.updateTaxAlerts();
        } else if (tabName === 'tax') {
            this.updateTaxSummary();
        } else if (tabName === 'help') {
            // Help tab is static HTML, no updates needed
        }
    }

    /**
     * Update portfolio table
     */
    async updatePortfolioTable() {
        const portfolio = window.washSaleEngine.getPortfolio();
        const tableBody = document.getElementById('portfolio-table');
        
        if (Object.keys(portfolio).length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="px-6 py-8 text-center text-gray-500">
                        No positions yet. Add some trades to see your portfolio.
                    </td>
                </tr>
            `;
            return;
        }

        // Show loading state
        tableBody.innerHTML = Object.values(portfolio).map(position => {
            const safeDate = window.washSaleEngine.getSafeToSellDate(position.symbol);
            const isSafeToSell = !safeDate || safeDate <= new Date();
            
            return `
                <tr>
                    <td class="px-6 py-4 font-medium text-gray-900">${position.symbol}</td>
                    <td class="px-6 py-4">${position.shares}</td>
                    <td class="px-6 py-4">$${position.averageCost.toFixed(2)}</td>
                    <td class="px-6 py-4">
                        <span class="text-gray-400 animate-pulse">Loading...</span>
                    </td>
                    <td class="px-6 py-4">
                        <span class="text-gray-400 animate-pulse">Loading...</span>
                    </td>
                    <td class="px-6 py-4">
                        <span class="px-2 py-1 text-xs rounded ${isSafeToSell ? 'safe-to-sell' : 'wash-sale-risk'}">
                            ${isSafeToSell ? 'Safe' : `Wait until ${safeDate.toLocaleDateString()}`}
                        </span>
                    </td>
                    <td class="px-6 py-4">
                        <button onclick="sellPosition('${position.symbol}')" class="text-blue-600 hover:text-blue-800 text-sm">
                            Quick Sell
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Fetch real prices for all symbols
        const symbols = Object.keys(portfolio);
        try {
            const prices = await window.stockPriceService.getBatchPrices(symbols);
            
            // Update table with real prices
            tableBody.innerHTML = Object.values(portfolio).map(position => {
                const priceData = prices[position.symbol];
                let currentPrice, pnl, pnlClass, priceDisplay, pnlDisplay;
                
                if (priceData && priceData.price > 0) {
                    currentPrice = priceData.price;
                    pnl = (currentPrice - position.averageCost) * position.shares;
                    pnlClass = pnl >= 0 ? 'gain' : 'loss';
                    
                    priceDisplay = `$${currentPrice.toFixed(2)}`;
                    if (priceData.isStale) {
                        priceDisplay += ` <span class="text-xs text-gray-500">(cached)</span>`;
                    }
                    
                    pnlDisplay = `<span class="${pnlClass}">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}</span>`;
                } else {
                    // Fallback to mock price if real price fails
                    currentPrice = position.averageCost * (0.95 + Math.random() * 0.1);
                    pnl = (currentPrice - position.averageCost) * position.shares;
                    pnlClass = pnl >= 0 ? 'gain' : 'loss';
                    
                    priceDisplay = `<span class="text-red-500">$${currentPrice.toFixed(2)} (est)</span>`;
                    pnlDisplay = `<span class="${pnlClass} text-red-500">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (est)</span>`;
                }

                const safeDate = window.washSaleEngine.getSafeToSellDate(position.symbol);
                
                // Safe to sell if:
                // 1. No recent purchases (no safeDate) OR
                // 2. Safe date has passed OR  
                // 3. Position is profitable (no wash sale risk for gains)
                const isPositionProfitable = priceData && priceData.price > position.averageCost;
                const isSafeToSell = !safeDate || safeDate <= new Date() || isPositionProfitable;
                
                return `
                    <tr>
                        <td class="px-6 py-4 font-medium text-gray-900">${position.symbol}</td>
                        <td class="px-6 py-4">${position.shares}</td>
                        <td class="px-6 py-4">$${position.averageCost.toFixed(2)}</td>
                        <td class="px-6 py-4">${priceDisplay}</td>
                        <td class="px-6 py-4">${pnlDisplay}</td>
                        <td class="px-6 py-4">
                            <span class="px-2 py-1 text-xs rounded ${isSafeToSell ? 'safe-to-sell' : 'wash-sale-risk'}">
                                ${isSafeToSell ? 'Safe' : `Wait until ${safeDate.toLocaleDateString()}`}
                            </span>
                        </td>
                        <td class="px-6 py-4">
                            <button onclick="sellPosition('${position.symbol}')" class="text-blue-600 hover:text-blue-800 text-sm">
                                Quick Sell
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
            
        } catch (error) {
            console.error('Failed to fetch stock prices:', error);
            
            // Fallback to mock prices with error indication
            tableBody.innerHTML = Object.values(portfolio).map(position => {
                const currentPrice = position.averageCost * (0.95 + Math.random() * 0.1);
                const pnl = (currentPrice - position.averageCost) * position.shares;
                const pnlClass = pnl >= 0 ? 'gain' : 'loss';
                const safeDate = window.washSaleEngine.getSafeToSellDate(position.symbol);
                
                // Safe to sell if:
                // 1. No recent purchases (no safeDate) OR
                // 2. Safe date has passed OR  
                // 3. Position is profitable (no wash sale risk for gains)
                const isPositionProfitable = pnl >= 0; // Use mock P&L if no real price
                const isSafeToSell = !safeDate || safeDate <= new Date() || isPositionProfitable;
                
                return `
                    <tr>
                        <td class="px-6 py-4 font-medium text-gray-900">${position.symbol}</td>
                        <td class="px-6 py-4">${position.shares}</td>
                        <td class="px-6 py-4">$${position.averageCost.toFixed(2)}</td>
                        <td class="px-6 py-4">
                            <span class="text-red-500">$${currentPrice.toFixed(2)} (offline)</span>
                        </td>
                        <td class="px-6 py-4">
                            <span class="${pnlClass} text-red-500">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (offline)</span>
                        </td>
                        <td class="px-6 py-4">
                            <span class="px-2 py-1 text-xs rounded ${isSafeToSell ? 'safe-to-sell' : 'wash-sale-risk'}">
                                ${isSafeToSell ? 'Safe' : `Wait until ${safeDate.toLocaleDateString()}`}
                            </span>
                        </td>
                        <td class="px-6 py-4">
                            <button onclick="sellPosition('${position.symbol}')" class="text-blue-600 hover:text-blue-800 text-sm">
                                Quick Sell
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    /**
     * Update transaction history table
     */
    updateHistoryTable() {
        const transactions = window.washSaleEngine.transactions
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        const tableBody = document.getElementById('history-table');
        
        if (transactions.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="px-6 py-8 text-center text-gray-500">
                        No transactions yet. Start trading to see your history.
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = transactions.map(transaction => {
            const typeClass = transaction.type === 'buy' ? 'text-green-600' : 'text-red-600';
            const typeIcon = transaction.type === 'buy' ? '↗' : '↘';
            
            // Check for wash sale status
            const washSaleStatus = window.washSaleEngine.getTransactionWashSaleStatus(transaction);
            let washSaleDisplay = '<span class="text-xs text-gray-500">-</span>';
            
            if (washSaleStatus && washSaleStatus.type === 'wash_sale_violation') {
                washSaleDisplay = `
                    <span class="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                        ⚠️ Wash Sale<br>
                        <span class="text-xs text-red-600">-$${washSaleStatus.loss.toFixed(2)}</span>
                    </span>
                `;
            } else if (transaction.type === 'sell') {
                // For sells with no wash sale, show if it was a loss or gain
                const { averageCost } = window.washSaleEngine.calculateAverageCost(transaction.symbol, transaction.date);
                const pnl = (transaction.price - averageCost) * transaction.quantity;
                
                if (pnl < 0) {
                    washSaleDisplay = `
                        <span class="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                            ✅ Safe Loss<br>
                            <span class="text-xs text-green-600">-$${Math.abs(pnl).toFixed(2)}</span>
                        </span>
                    `;
                }
            }
            
            return `
                <tr>
                    <td class="px-6 py-4">${new Date(transaction.date).toLocaleDateString()}</td>
                    <td class="px-6 py-4 ${typeClass}">${typeIcon} ${transaction.type.toUpperCase()}</td>
                    <td class="px-6 py-4 font-medium">${transaction.symbol}</td>
                    <td class="px-6 py-4">${transaction.quantity}</td>
                    <td class="px-6 py-4">$${transaction.price.toFixed(2)}</td>
                    <td class="px-6 py-4">$${transaction.total.toFixed(2)}</td>
                    <td class="px-6 py-4">
                        ${washSaleDisplay}
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Update tax alerts
     */
    async updateTaxAlerts() {
        const portfolio = window.washSaleEngine.getPortfolio();
        const alertsContainer = document.getElementById('tax-alerts');
        const alerts = [];

        // Get current prices for all positions to check for unrealized losses
        const symbols = Object.keys(portfolio);
        if (symbols.length > 0) {
            try {
                const prices = await window.stockPriceService.getBatchPrices(symbols);
                
                // Check for positions with wash sale risks (only for loss positions)
                Object.values(portfolio).forEach(position => {
                    const safeDate = window.washSaleEngine.getSafeToSellDate(position.symbol);
                    
                    // Only show wash sale warning if:
                    // 1. There's a recent purchase (safeDate exists and is in future)  
                    // 2. The position would be sold at a loss (current price < average cost)
                    if (safeDate && safeDate > new Date()) {
                        const priceData = prices[position.symbol];
                        const currentPrice = priceData?.price;
                        
                        // Check if selling now would be at a loss
                        if (currentPrice && currentPrice < position.averageCost) {
                            const unrealizedLoss = (position.averageCost - currentPrice) * position.shares;
                            alerts.push({
                                type: 'wash-sale-risk',
                                symbol: position.symbol,
                                message: `Recent purchase: Avoid selling ${position.symbol} at a loss until ${safeDate.toLocaleDateString()} to preserve $${unrealizedLoss.toFixed(2)} tax loss.`,
                                priority: 'high'
                            });
                        }
                    }
                });
            } catch (error) {
                console.warn('Failed to fetch prices for tax alerts:', error);
                // Skip wash sale alerts if we can't get current prices
            }
        }

        // Add year-end tax loss harvesting alerts
        const now = new Date();
        if (now.getMonth() >= 10) { // November or December
            alerts.push({
                type: 'tax-planning',
                message: 'Year-end is approaching. Consider tax loss harvesting opportunities.',
                priority: 'medium'
            });
        }

        if (alerts.length === 0) {
            alertsContainer.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <div class="text-6xl mb-4">🎯</div>
                    <p>No tax alerts at this time. You're all clear!</p>
                </div>
            `;
            return;
        }

        alertsContainer.innerHTML = alerts.map(alert => {
            const colorClass = alert.priority === 'high' ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50';
            const iconColor = alert.priority === 'high' ? 'text-red-500' : 'text-yellow-500';
            
            return `
                <div class="border ${colorClass} rounded-lg p-4 mb-4">
                    <div class="flex items-start">
                        <div class="${iconColor} text-xl mr-3">⚠️</div>
                        <div>
                            <p class="text-gray-800">${alert.message}</p>
                            ${alert.symbol ? `<span class="text-xs text-gray-500 mt-1 block">Symbol: ${alert.symbol}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Update main UI components
     */
    updateUI() {
        this.updateStats();
        if (this.currentTab === 'portfolio') this.updatePortfolioTable();
        if (this.currentTab === 'history') this.updateHistoryTable();
        if (this.currentTab === 'alerts') this.updateTaxAlerts();
    }

    /**
     * Update statistics in header and sidebar
     */
    async updateStats() {
        const stats = window.washSaleEngine.getYTDStats();
        const portfolio = window.washSaleEngine.getPortfolio();
        
        // Calculate total portfolio value with real prices
        let totalValue = 0;
        const symbols = Object.keys(portfolio);
        
        if (symbols.length > 0) {
            try {
                const prices = await window.stockPriceService.getBatchPrices(symbols);
                
                Object.values(portfolio).forEach(position => {
                    const priceData = prices[position.symbol];
                    const currentPrice = (priceData && priceData.price > 0) 
                        ? priceData.price 
                        : position.averageCost * (0.95 + Math.random() * 0.1); // Fallback
                    
                    totalValue += position.shares * currentPrice;
                });
            } catch (error) {
                console.error('Failed to fetch prices for stats:', error);
                // Fallback to mock prices
                Object.values(portfolio).forEach(position => {
                    const mockCurrentPrice = position.averageCost * (0.95 + Math.random() * 0.1);
                    totalValue += position.shares * mockCurrentPrice;
                });
            }
        }

        document.getElementById('total-portfolio-value').textContent = `$${totalValue.toFixed(2)}`;
        document.getElementById('ytd-losses').textContent = `$${stats.totalLosses.toFixed(0)}`;
        document.getElementById('wash-sale-count').textContent = stats.washSaleCount;
    }

    /**
     * Update tax summary tab with comprehensive tax information
     */
    async updateTaxSummary() {
        const currentYear = new Date().getFullYear();
        const yearTransactions = window.washSaleEngine.transactions.filter(t => 
            new Date(t.date).getFullYear() === currentYear
        );

        let totalRealizedGains = 0;
        let totalRealizedLosses = 0;
        let totalDisallowedLosses = 0;
        const washSaleViolations = [];

        // Calculate tax impact for each transaction
        yearTransactions.forEach(transaction => {
            if (transaction.type === 'sell') {
                const { averageCost } = window.washSaleEngine.calculateAverageCost(transaction.symbol, transaction.date);
                const pnl = (transaction.price - averageCost) * transaction.quantity;
                
                if (pnl > 0) {
                    totalRealizedGains += pnl;
                } else {
                    // Check if this is a wash sale
                    const washSaleStatus = window.washSaleEngine.getTransactionWashSaleStatus(transaction);
                    if (washSaleStatus && washSaleStatus.type === 'wash_sale_violation') {
                        totalDisallowedLosses += Math.abs(pnl);
                        washSaleViolations.push({
                            transaction,
                            washSaleStatus,
                            pnl
                        });
                    } else {
                        totalRealizedLosses += Math.abs(pnl);
                    }
                }
            }
        });

        const netTaxImpact = totalRealizedGains - totalRealizedLosses;

        // Update summary cards
        document.getElementById('total-realized-gains').textContent = `$${totalRealizedGains.toFixed(2)}`;
        document.getElementById('total-realized-losses').textContent = `$${totalRealizedLosses.toFixed(2)}`;
        document.getElementById('total-disallowed-losses').textContent = `$${totalDisallowedLosses.toFixed(2)}`;
        document.getElementById('net-tax-impact').textContent = `${netTaxImpact >= 0 ? '+' : ''}$${netTaxImpact.toFixed(2)}`;

        // Update wash sale violations table
        this.updateWashSaleTable(washSaleViolations);

        // Update tax harvesting opportunities
        await this.updateTaxHarvestingOpportunities();
    }

    /**
     * Update wash sale violations table
     */
    updateWashSaleTable(washSaleViolations) {
        const tableBody = document.getElementById('wash-sale-table');
        
        if (washSaleViolations.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-8 text-center text-gray-500">
                        No wash sale violations this year. Great job! 🎉
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = washSaleViolations.map(violation => {
            const transaction = violation.transaction;
            const loss = Math.abs(violation.pnl);
            
            return `
                <tr>
                    <td class="px-6 py-4">${new Date(transaction.date).toLocaleDateString()}</td>
                    <td class="px-6 py-4 font-medium">${transaction.symbol}</td>
                    <td class="px-6 py-4">${transaction.quantity}</td>
                    <td class="px-6 py-4 text-red-600">$${loss.toFixed(2)}</td>
                    <td class="px-6 py-4">
                        <span class="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                            Disallowed
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Update tax loss harvesting opportunities
     */
    async updateTaxHarvestingOpportunities() {
        const portfolio = window.washSaleEngine.getPortfolio();
        const opportunitiesContainer = document.getElementById('tax-harvesting-opportunities');
        
        if (Object.keys(portfolio).length === 0) {
            opportunitiesContainer.innerHTML = `
                <div class="text-center text-gray-500 py-4">
                    <p>No positions to analyze for tax loss harvesting.</p>
                </div>
            `;
            return;
        }

        try {
            const symbols = Object.keys(portfolio);
            const prices = await window.stockPriceService.getBatchPrices(symbols);
            const opportunities = [];

            Object.values(portfolio).forEach(position => {
                const priceData = prices[position.symbol];
                const currentPrice = priceData?.price;
                
                if (currentPrice && currentPrice < position.averageCost) {
                    const unrealizedLoss = (position.averageCost - currentPrice) * position.shares;
                    const safeDate = window.washSaleEngine.getSafeToSellDate(position.symbol);
                    const isSafeToSell = !safeDate || safeDate <= new Date();
                    
                    opportunities.push({
                        symbol: position.symbol,
                        shares: position.shares,
                        currentPrice: currentPrice,
                        costBasis: position.averageCost,
                        unrealizedLoss: unrealizedLoss,
                        isSafeToSell: isSafeToSell,
                        safeDate: safeDate
                    });
                }
            });

            if (opportunities.length === 0) {
                opportunitiesContainer.innerHTML = `
                    <div class="text-center text-gray-500 py-4">
                        <p>No tax loss harvesting opportunities found. All positions are profitable! 📈</p>
                    </div>
                `;
                return;
            }

            // Sort by largest loss first
            opportunities.sort((a, b) => b.unrealizedLoss - a.unrealizedLoss);

            opportunitiesContainer.innerHTML = `
                <div class="space-y-3">
                    ${opportunities.map(opp => `
                        <div class="border border-gray-200 rounded-lg p-4">
                            <div class="flex justify-between items-start">
                                <div>
                                    <h4 class="font-medium text-gray-900">${opp.symbol}</h4>
                                    <p class="text-sm text-gray-600">
                                        ${opp.shares} shares • Cost: $${opp.costBasis.toFixed(2)} • Current: $${opp.currentPrice.toFixed(2)}
                                    </p>
                                </div>
                                <div class="text-right">
                                    <div class="text-lg font-medium text-red-600">-$${opp.unrealizedLoss.toFixed(2)}</div>
                                    <div class="text-xs ${opp.isSafeToSell ? 'text-green-600' : 'text-orange-600'}">
                                        ${opp.isSafeToSell ? '✅ Safe to sell' : `⏳ Wait until ${opp.safeDate.toLocaleDateString()}`}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

        } catch (error) {
            console.error('Failed to load tax harvesting opportunities:', error);
            opportunitiesContainer.innerHTML = `
                <div class="text-center text-gray-500 py-4">
                    <p>Unable to load current prices for tax loss analysis.</p>
                </div>
            `;
        }
    }
}

/**
 * Global functions for button callbacks
 */
function showTab(tabName) {
    window.app.showTab(tabName);
}

function sellPosition(symbol) {
    const portfolio = window.washSaleEngine.getPortfolio();
    const position = portfolio[symbol];
    
    if (!position) {
        alert('Position not found');
        return;
    }

    const shares = prompt(`How many shares of ${symbol} do you want to sell? (Available: ${position.shares})`);
    if (!shares || isNaN(shares) || shares <= 0) return;

    const price = prompt(`At what price per share?`);
    if (!price || isNaN(price) || price <= 0) return;

    // Switch to trade tab and pre-fill the form
    window.app.showTab('trade');
    document.getElementById('trade-type').value = 'sell';
    document.getElementById('symbol').value = symbol;
    document.getElementById('quantity').value = shares;
    document.getElementById('price').value = price;
    
    // Trigger real-time check
    window.app.checkTradeRealTime();
}

function exportData() {
    window.washSaleEngine.exportTransactions();
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (confirm(`Import ${data.transactions?.length || 0} transactions? This will replace your current data.`)) {
                    window.washSaleEngine.transactions = data.transactions || [];
                    window.washSaleEngine.saveTransactions();
                    window.app.updateUI();
                    updateSaveStatus('✓ Data Imported');
                    alert('✅ Data imported successfully!');
                }
            } catch (error) {
                alert('❌ Error importing data. Please check the file format.');
                console.error('Import error:', error);
            }
        };
        reader.readAsText(file);
    };
    
    input.click();
}

function importCSV() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        updateSaveStatus('📊 Parsing CSV...');
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const csvText = e.target.result;
                const result = window.brokerCSVParser.parseCSV(csvText);
                
                if (result.transactions.length === 0) {
                    alert('❌ No valid transactions found in CSV file.\n\nSupported formats:\n• Charles Schwab\n• Robinhood\n• E*TRADE\n• TD Ameritrade\n• Fidelity\n• Interactive Brokers\n• Generic CSV');
                    updateSaveStatus('✓ Saved');
                    return;
                }
                
                const message = `Found ${result.transactions.length} transactions from ${result.brokerType}.\n\nThis will ADD to your existing data (not replace).\n\nContinue with import?`;
                
                if (confirm(message)) {
                    let importedCount = 0;
                    let skippedCount = 0;
                    
                    result.transactions.forEach(transaction => {
                        const validation = window.brokerCSVParser.validateTransaction(transaction);
                        if (validation.isValid) {
                            // Check for duplicates (same symbol, date, quantity, price)
                            const duplicate = window.washSaleEngine.transactions.find(t => 
                                t.symbol === transaction.symbol &&
                                t.type === transaction.type &&
                                t.quantity === transaction.quantity &&
                                Math.abs(t.price - transaction.price) < 0.01 &&
                                Math.abs(new Date(t.date) - transaction.date) < 24 * 60 * 60 * 1000 // Same day
                            );
                            
                            if (!duplicate) {
                                window.washSaleEngine.addTransaction(transaction);
                                importedCount++;
                            } else {
                                skippedCount++;
                            }
                        } else {
                            console.warn('⚠️ Skipping invalid transaction:', validation.errors);
                            skippedCount++;
                        }
                    });
                    
                    window.app.updateUI();
                    updateSaveStatus('✅ CSV Imported');
                    
                    let resultMessage = `✅ CSV Import Complete!\n\n`;
                    resultMessage += `📊 Imported: ${importedCount} transactions\n`;
                    if (skippedCount > 0) {
                        resultMessage += `⚠️ Skipped: ${skippedCount} (duplicates or invalid)\n`;
                    }
                    resultMessage += `\n🔍 Check Portfolio and History tabs to review your data.`;
                    
                    alert(resultMessage);
                } else {
                    updateSaveStatus('✓ Saved');
                }
                
            } catch (error) {
                console.error('CSV Import error:', error);
                alert(`❌ Error parsing CSV file: ${error.message}\n\nPlease check that your file is a valid CSV from a supported broker.`);
                updateSaveStatus('✓ Saved');
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

function clearAllData() {
    if (window.washSaleEngine.clearAllData()) {
        window.app.updateUI();
        updateSaveStatus('✓ Data Cleared');
        alert('✅ All data cleared successfully!');
    }
}

function updateSaveStatus(message) {
    const statusElement = document.getElementById('save-status');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = 'text-xs text-green-600';
        
        // Flash effect for visual feedback
        setTimeout(() => {
            statusElement.style.opacity = '0.5';
            setTimeout(() => {
                statusElement.style.opacity = '1';
                statusElement.textContent = '✓ Saved';
            }, 200);
        }, 1000);
    }
}

function exportTaxSummary() {
    const currentYear = new Date().getFullYear();
    const yearTransactions = window.washSaleEngine.transactions.filter(t => 
        new Date(t.date).getFullYear() === currentYear
    );

    const taxSummary = {
        year: currentYear,
        exportDate: new Date().toISOString(),
        summary: {
            totalRealizedGains: parseFloat(document.getElementById('total-realized-gains').textContent.replace('$', '').replace(',', '')),
            totalRealizedLosses: parseFloat(document.getElementById('total-realized-losses').textContent.replace('$', '').replace(',', '')),
            totalDisallowedLosses: parseFloat(document.getElementById('total-disallowed-losses').textContent.replace('$', '').replace(',', '')),
            netTaxImpact: parseFloat(document.getElementById('net-tax-impact').textContent.replace('$', '').replace('+', '').replace(',', ''))
        },
        transactions: yearTransactions,
        washSaleViolations: yearTransactions.filter(t => {
            if (t.type !== 'sell') return false;
            const status = window.washSaleEngine.getTransactionWashSaleStatus(t);
            return status && status.type === 'wash_sale_violation';
        })
    };

    const blob = new Blob([JSON.stringify(taxSummary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `washsafe-tax-summary-${currentYear}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    updateSaveStatus('✓ Tax Summary Exported');
}

function exportForAccountant() {
    const currentYear = new Date().getFullYear();
    const yearTransactions = window.washSaleEngine.transactions.filter(t => 
        new Date(t.date).getFullYear() === currentYear
    );

    // Create CSV format suitable for accountants
    const csvHeaders = [
        'Date',
        'Type',
        'Symbol', 
        'Shares',
        'Price',
        'Total',
        'Realized P&L',
        'Wash Sale',
        'Disallowed Loss',
        'Notes'
    ];

    const csvRows = yearTransactions.map(transaction => {
        const date = new Date(transaction.date).toLocaleDateString();
        const type = transaction.type.toUpperCase();
        const symbol = transaction.symbol;
        const shares = transaction.quantity;
        const price = transaction.price.toFixed(2);
        const total = transaction.total.toFixed(2);
        
        let realizedPnL = '';
        let washSale = 'No';
        let disallowedLoss = '';
        let notes = '';

        if (transaction.type === 'sell') {
            const { averageCost } = window.washSaleEngine.calculateAverageCost(transaction.symbol, transaction.date);
            const pnl = (transaction.price - averageCost) * transaction.quantity;
            realizedPnL = pnl.toFixed(2);

            const washSaleStatus = window.washSaleEngine.getTransactionWashSaleStatus(transaction);
            if (washSaleStatus && washSaleStatus.type === 'wash_sale_violation') {
                washSale = 'Yes';
                disallowedLoss = Math.abs(pnl).toFixed(2);
                notes = 'Loss disallowed due to wash sale rule';
            }
        }

        return [
            date,
            type,
            symbol,
            shares,
            price,
            total,
            realizedPnL,
            washSale,
            disallowedLoss,
            notes
        ];
    });

    // Convert to CSV string
    const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `washsafe-tax-report-${currentYear}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    updateSaveStatus('✓ Tax Report Exported for Accountant');
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new WashSafeApp();
});

console.log('✅ WashSafe App loaded');