/**
 * WashSafe Application - Main UI Controller
 * Handles user interactions and updates the interface
 */

class WashSafeApp {
    constructor() {
        this.currentTab = 'trade';
        this.historyFilters = {
            year: '',
            type: '',
            symbol: ''
        };
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
            this.updateYearlySummary();
            this.updateHistoryTable();
            this.setupHistoryFilterListeners(); // Set up filter listeners when tab is shown
        } else if (tabName === 'alerts') {
            this.updateTaxAlerts();
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
                            <div class="flex gap-2">
                                <button onclick="sellPosition('${position.symbol}')" class="text-blue-600 hover:text-blue-800 text-sm">
                                    Quick Sell
                                </button>
                                <button onclick="adjustStockSplit('${position.symbol}')" class="text-purple-600 hover:text-purple-800 text-sm">
                                    Stock Split
                                </button>
                            </div>
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
                            <div class="flex gap-2">
                                <button onclick="sellPosition('${position.symbol}')" class="text-blue-600 hover:text-blue-800 text-sm">
                                    Quick Sell
                                </button>
                                <button onclick="adjustStockSplit('${position.symbol}')" class="text-purple-600 hover:text-purple-800 text-sm">
                                    Stock Split
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    /**
     * Set up filter event listeners (called when history tab is shown)
     */
    setupHistoryFilterListeners() {
        const filterYear = document.getElementById('filter-year');
        const filterType = document.getElementById('filter-type');
        const filterSymbol = document.getElementById('filter-symbol');
        const clearFilters = document.getElementById('clear-filters');

        // Remove existing listeners to avoid duplicates
        if (filterYear) {
            filterYear.removeEventListener('change', this.updateHistoryFilters);
            filterYear.addEventListener('change', () => this.updateHistoryFilters());
        }
        if (filterType) {
            filterType.removeEventListener('change', this.updateHistoryFilters);
            filterType.addEventListener('change', () => this.updateHistoryFilters());
        }
        if (filterSymbol) {
            filterSymbol.removeEventListener('input', this.updateHistoryFilters);
            filterSymbol.addEventListener('input', () => this.updateHistoryFilters());
        }
        if (clearFilters) {
            clearFilters.removeEventListener('click', this.clearHistoryFilters);
            clearFilters.addEventListener('click', () => this.clearHistoryFilters());
        }
    }

    /**
     * Update history filter state and refresh the table
     */
    updateHistoryFilters() {
        const filterYear = document.getElementById('filter-year');
        const filterType = document.getElementById('filter-type');
        const filterSymbol = document.getElementById('filter-symbol');

        this.historyFilters = {
            year: filterYear ? filterYear.value : '',
            type: filterType ? filterType.value : '',
            symbol: filterSymbol ? filterSymbol.value.toUpperCase().trim() : ''
        };

        console.log(`🔍 FILTER UPDATE: New filters:`, this.historyFilters);
        this.updateHistoryTable();
    }

    /**
     * Clear all history filters
     */
    clearHistoryFilters() {
        const filterYear = document.getElementById('filter-year');
        const filterType = document.getElementById('filter-type');
        const filterSymbol = document.getElementById('filter-symbol');

        if (filterYear) filterYear.value = '';
        if (filterType) filterType.value = '';
        if (filterSymbol) filterSymbol.value = '';

        this.historyFilters = {
            year: '',
            type: '',
            symbol: ''
        };

        this.updateHistoryTable();
    }

    /**
     * Populate year filter dropdown with available years
     */
    populateYearFilter() {
        const filterYear = document.getElementById('filter-year');
        if (!filterYear) return;

        // Save current selection
        const currentSelection = filterYear.value;

        // Get unique years from transactions
        const years = [...new Set(window.washSaleEngine.transactions.map(t => 
            new Date(t.date).getFullYear()
        ))].sort((a, b) => b - a); // Most recent first

        // Clear existing options (keep "All Years")
        filterYear.innerHTML = '<option value="">All Years</option>';
        
        // Add year options
        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            filterYear.appendChild(option);
        });

        // Restore previous selection
        if (currentSelection) {
            filterYear.value = currentSelection;
            console.log(`🔍 DROPDOWN: Restored selection to ${currentSelection}`);
        }
    }

    /**
     * Update transaction history table
     */
    updateHistoryTable() {
        console.log(`🔍 TABLE UPDATE: Updating history table with filters:`, this.historyFilters);
        
        // Only populate year filter if it's empty (first time)
        const filterYear = document.getElementById('filter-year');
        if (filterYear && filterYear.children.length <= 1) {
            this.populateYearFilter();
        }
        
        // Apply filters
        let transactions = window.washSaleEngine.transactions
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Apply year filter
        if (this.historyFilters.year) {
            const filterYear = parseInt(this.historyFilters.year);
            console.log(`🔍 YEAR FILTER: Filtering to year ${filterYear} (was ${this.historyFilters.year})`);
            transactions = transactions.filter(t => 
                new Date(t.date).getFullYear() === filterYear
            );
            console.log(`🔍 YEAR FILTER: ${transactions.length} transactions match year filter`);
        }
        
        // Apply type filter
        if (this.historyFilters.type) {
            transactions = transactions.filter(t => 
                t.type === this.historyFilters.type
            );
        }
        
        // Apply symbol filter
        if (this.historyFilters.symbol) {
            transactions = transactions.filter(t => 
                t.symbol.includes(this.historyFilters.symbol)
            );
        }
        
        console.log(`🔍 TABLE UPDATE: Final filtered transactions: ${transactions.length}`);
        
        const tableBody = document.getElementById('history-table');
        
        if (transactions.length === 0) {
            const hasActiveFilters = this.historyFilters.year || this.historyFilters.type || this.historyFilters.symbol;
            const emptyMessage = hasActiveFilters 
                ? 'No transactions match the current filters. Try clearing filters or adjusting your criteria.'
                : 'No transactions yet. Start trading to see your history.';
                
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="px-6 py-8 text-center text-gray-500">
                        ${emptyMessage}
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = transactions.map(transaction => {
            const typeClass = transaction.type === 'buy' ? 'text-green-600' : 'text-red-600';
            const typeIcon = transaction.type === 'buy' ? '↗' : '↘';
            
            // Create detailed calculation column
            let calculationDetails = '<span class="text-xs text-gray-500">-</span>';
            let washSaleDisplay = '<span class="text-xs text-gray-500">-</span>';
            
            if (transaction.type === 'sell') {
                // Show detailed FIFO calculation for sells
                const lotsAtSaleTime = window.washSaleEngine.getShareLotsAtDate(transaction.symbol, new Date(transaction.date));
                
                if (lotsAtSaleTime.length > 0) {
                    // Simulate FIFO allocation
                    let remainingToSell = transaction.quantity;
                    let totalPnL = 0;
                    let totalWashSaleLoss = 0;
                    let hasWashSale = false;
                    let calculationBreakdown = [];
                    
                    for (const lot of lotsAtSaleTime) {
                        if (remainingToSell <= 0) break;
                        
                        const sharesFromThisLot = Math.min(remainingToSell, lot.remainingQuantity);
                        const costBasis = lot.costPerShare * sharesFromThisLot;
                        const saleProceeds = transaction.price * sharesFromThisLot;
                        const lotPnL = saleProceeds - costBasis;
                        
                        totalPnL += lotPnL;
                        
                        // Check wash sale for this lot (only consider transactions up to this date)
                        const washSaleInfo = window.washSaleEngine.checkLotWashSale(lot, sharesFromThisLot, new Date(transaction.date), lotPnL, { asOfDate: new Date(transaction.date) });
                        if (washSaleInfo.isWashSale && lotPnL < 0) {
                            hasWashSale = true;
                            totalWashSaleLoss += Math.abs(lotPnL);
                        }
                        
                        calculationBreakdown.push({
                            shares: sharesFromThisLot,
                            costPerShare: lot.costPerShare,
                            costBasis: costBasis,
                            pnl: lotPnL,
                            isWashSale: washSaleInfo.isWashSale && lotPnL < 0,
                            purchaseDate: lot.purchaseDate
                        });
                        
                        remainingToSell -= sharesFromThisLot;
                    }
                    
                    // Create detailed breakdown display
                    const breakdownText = calculationBreakdown.map(breakdown => 
                        `${breakdown.shares}@$${breakdown.costPerShare.toFixed(2)} = $${breakdown.pnl >= 0 ? '+' : ''}${breakdown.pnl.toFixed(2)}${breakdown.isWashSale ? ' ⚠️' : ''}`
                    ).join('<br>');
                    
                    calculationDetails = `
                        <div class="text-xs">
                            <div class="font-semibold">${breakdownText}</div>
                            <div class="mt-1 ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}">
                                Total: $${totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
                            </div>
                        </div>
                    `;
                    
                    // Create wash sale display
                    if (hasWashSale) {
                        washSaleDisplay = `
                            <span class="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                                ⚠️ Wash Sale<br>
                                <span class="text-xs text-red-600">-$${totalWashSaleLoss.toFixed(2)}</span>
                            </span>
                        `;
                    } else if (totalPnL < 0) {
                        washSaleDisplay = `
                            <span class="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                                ✅ Safe Loss<br>
                                <span class="text-xs text-green-600">-$${Math.abs(totalPnL).toFixed(2)}</span>
                            </span>
                        `;
                    } else if (totalPnL > 0) {
                        washSaleDisplay = `
                            <span class="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                                📈 Gain<br>
                                <span class="text-xs text-blue-600">+$${totalPnL.toFixed(2)}</span>
                            </span>
                        `;
                    }
                } else {
                    calculationDetails = '<span class="text-xs text-red-500">No lots available</span>';
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
                        ${calculationDetails}
                    </td>
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
     * Update yearly summary in Transaction History tab
     */
    updateYearlySummary() {
        const container = document.getElementById('yearly-summary-container');
        const allTransactions = window.washSaleEngine.transactions;
        
        if (allTransactions.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 py-4">
                    <p>No transactions to summarize yet.</p>
                </div>
            `;
            return;
        }

        // Group transactions by year
        const transactionsByYear = {};
        allTransactions.forEach(transaction => {
            const year = new Date(transaction.date).getFullYear();
            if (!transactionsByYear[year]) {
                transactionsByYear[year] = [];
            }
            transactionsByYear[year].push(transaction);
        });

        // Calculate summary for each year
        const yearSummaries = Object.keys(transactionsByYear)
            .sort((a, b) => b - a) // Most recent year first
            .map(year => {
                const yearTransactions = transactionsByYear[year];
                console.log(`📊 Processing ${year}: ${yearTransactions.length} transactions`);
                
                let totalGains = 0;
                let totalLosses = 0;
                let washSaleViolations = 0;
                let disallowedLosses = 0;

                // Process only sell transactions and calculate their P&L
                const sellTransactions = yearTransactions.filter(t => t.type === 'sell');
                console.log(`📊 Year ${year}: Found ${sellTransactions.length} sell transactions out of ${yearTransactions.length} total`);
                
                sellTransactions.forEach(transaction => {
                    console.log(`🔍 FIFO Yearly Summary: ${transaction.symbol} on ${new Date(transaction.date).toLocaleDateString()}`);
                    
                    // Get the FIFO analysis for this transaction
                    const lotsAtSaleTime = window.washSaleEngine.getShareLotsAtDate(transaction.symbol, new Date(transaction.date));
                    
                    if (lotsAtSaleTime.length === 0) {
                        console.log(`   → Warning: No lots available for sale`);
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
                        
                        transactionTotalPnL += lotPnL;
                        
                        console.log(`   → Lot ${lot.id}: ${sharesFromThisLot} shares @ $${lot.costPerShare.toFixed(2)} → P&L: $${lotPnL.toFixed(2)}`);
                        
                        if (lotPnL < 0) {
                            // Check if this lot creates a wash sale (only consider transactions up to this date)
                            const washSaleInfo = window.washSaleEngine.checkLotWashSale(lot, sharesFromThisLot, new Date(transaction.date), lotPnL, { asOfDate: new Date(transaction.date) });
                            if (washSaleInfo.isWashSale) {
                                hasWashSales = true;
                                transactionWashSaleLoss += Math.abs(lotPnL);
                                console.log(`   → ⚠️ Wash sale on this lot: $${Math.abs(lotPnL).toFixed(2)}`);
                            }
                        }
                        
                        remainingToSell -= sharesFromThisLot;
                    }
                    
                    console.log(`   → Transaction Total P&L: $${transactionTotalPnL.toFixed(2)}`);
                    
                    if (transactionTotalPnL >= 0) {
                        // Net gain for this transaction
                        totalGains += transactionTotalPnL;
                        console.log(`   → ✅ Added $${transactionTotalPnL.toFixed(2)} to gains`);
                    } else {
                        // Net loss for this transaction
                        if (hasWashSales) {
                            washSaleViolations++;
                            disallowedLosses += transactionWashSaleLoss;
                            // Only the non-wash-sale portion counts as deductible loss
                            const deductibleLoss = Math.abs(transactionTotalPnL) - transactionWashSaleLoss;
                            if (deductibleLoss > 0) {
                                totalLosses += deductibleLoss;
                            }
                            console.log(`   → ⚠️ Partial wash sale: $${transactionWashSaleLoss.toFixed(2)} disallowed, $${deductibleLoss.toFixed(2)} deductible`);
                        } else {
                            totalLosses += Math.abs(transactionTotalPnL);
                            console.log(`   → ❌ Valid tax loss: $${Math.abs(transactionTotalPnL).toFixed(2)}`);
                        }
                    }
                    
                    console.log(`   → Running totals: Gains $${totalGains.toFixed(2)}, Losses $${totalLosses.toFixed(2)}, Wash Sales ${washSaleViolations}, Disallowed $${disallowedLosses.toFixed(2)}`);
                });

                return {
                    year,
                    totalTransactions: yearTransactions.length,
                    totalGains,
                    totalLosses,
                    washSaleViolations,
                    disallowedLosses,
                    netGainLoss: totalGains - totalLosses
                };
            });

        // Render yearly summaries
        container.innerHTML = yearSummaries.map(summary => `
            <div class="border border-gray-200 rounded-lg p-4 mb-4">
                <h3 class="text-lg font-semibold mb-3">${summary.year}</h3>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div class="text-center">
                        <div class="text-2xl font-bold text-gray-900">${summary.totalTransactions}</div>
                        <div class="text-xs text-gray-500">Transactions</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-green-600">$${summary.totalGains.toFixed(0)}</div>
                        <div class="text-xs text-gray-500">Gains</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-red-600">$${summary.totalLosses.toFixed(0)}</div>
                        <div class="text-xs text-gray-500">Losses</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-orange-600">${summary.washSaleViolations}</div>
                        <div class="text-xs text-gray-500">Wash Sales</div>
                        ${summary.disallowedLosses > 0 ? `<div class="text-xs text-orange-600">-$${summary.disallowedLosses.toFixed(0)} disallowed</div>` : ''}
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold ${summary.netGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}">
                            ${summary.netGainLoss >= 0 ? '+' : ''}$${summary.netGainLoss.toFixed(0)}
                        </div>
                        <div class="text-xs text-gray-500">Net P&L</div>
                    </div>
                </div>
            </div>
        `).join('');
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

function adjustStockSplit(symbol) {
    const portfolio = window.washSaleEngine.getPortfolio();
    const position = portfolio[symbol];
    
    if (!position) {
        alert('Position not found');
        return;
    }

    // Show current position info
    const message = `Stock Split Adjustment for ${symbol}\n\nCurrent Position: ${position.shares} shares @ $${position.averageCost.toFixed(2)} avg cost\n\nFORWARD SPLITS (more shares, lower price):\n- 10:1 split → enter "10"\n- 3:1 split → enter "3"\n- 2:1 split → enter "2"\n\nREVERSE SPLITS (fewer shares, higher price):\n- 1:10 reverse → enter "0.1"\n- 1:5 reverse → enter "0.2"\n- 1:3 reverse → enter "0.333"\n\nWhat is the split ratio?`;
    
    const splitRatio = prompt(message);
    if (!splitRatio || isNaN(splitRatio) || splitRatio <= 0) {
        return;
    }

    const splitDate = prompt(`What date did the split occur? (YYYY-MM-DD format)\n\nExample: 2024-06-07 for June 7th, 2024`);
    if (!splitDate) return;

    const parsedDate = new Date(splitDate);
    if (isNaN(parsedDate.getTime())) {
        alert('Invalid date format. Please use YYYY-MM-DD format.');
        return;
    }

    // Determine split type and show preview
    const ratio = parseFloat(splitRatio);
    const splitType = ratio >= 1 ? 'Forward Split' : 'Reverse Split';
    const shareMultiplier = ratio;
    const priceMultiplier = 1 / ratio;
    
    const previewShares = Math.round(position.shares * shareMultiplier);
    const previewPrice = position.averageCost * priceMultiplier;
    
    const confirmMessage = `Confirm Stock Split Adjustment:\n\n${symbol} - ${splitType}\nRatio: ${ratio >= 1 ? `${splitRatio}:1` : `1:${Math.round(1/ratio)}`}\nSplit Date: ${parsedDate.toDateString()}\n\nPREVIEW OF CHANGES:\nCurrent: ${position.shares} shares @ $${position.averageCost.toFixed(2)}\nAfter:   ${previewShares} shares @ $${previewPrice.toFixed(2)}\n\nThis will adjust all transactions and lots purchased before this date.\n\nIMPORTANT: This cannot be undone. Export your data first!\n\nProceed with adjustment?`;
    
    if (!confirm(confirmMessage)) {
        return;
    }

    try {
        const result = window.washSaleEngine.applyStockSplit(symbol, parsedDate, parseFloat(splitRatio));
        
        if (result.success) {
            const successSplitType = ratio >= 1 ? 'Forward Split' : 'Reverse Split';
            const successRatio = ratio >= 1 ? `${splitRatio}:1` : `1:${Math.round(1/ratio)}`;
            
            alert(`✅ ${successSplitType} Applied Successfully!\n\n${symbol} - ${successRatio} split on ${parsedDate.toDateString()}\n\nAdjusted:\n- ${result.lotsAffected} share lots\n- ${result.transactionsAffected} transactions\n\nPlease review your transaction history to verify the adjustments.`);
            
            // Refresh the UI
            window.app.updateUI();
            updateSaveStatus('✓ Stock Split Applied');
        } else {
            alert('❌ Stock split adjustment failed. Please try again.');
        }
    } catch (error) {
        console.error('Stock split error:', error);
        alert('❌ Error applying stock split. Please check the console for details.');
    }
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
                    let duplicateCount = 0;
                    let invalidCount = 0;
                    let fifoRejectedCount = 0;
                    let engineErrorCount = 0;
                    
                    console.log(`\n🔍 DETAILED CSV IMPORT ANALYSIS`);
                    console.log(`📊 Total parsed from CSV: ${result.transactions.length} transactions`);
                    console.log(`📊 Current engine has: ${window.washSaleEngine.transactions.length} existing transactions`);
                    console.log(`📊 Current share lots: ${window.washSaleEngine.shareLots.length} lots`);
                    
                    // Show a sample of parsed transactions
                    console.log(`\n📋 Sample of parsed transactions:`);
                    result.transactions.slice(0, 5).forEach((t, i) => {
                        console.log(`   ${i+1}. ${new Date(t.date).toDateString()} - ${t.type} ${t.quantity} ${t.symbol} @ $${t.price}`);
                    });
                    if (result.transactions.length > 5) {
                        console.log(`   ... and ${result.transactions.length - 5} more`);
                    }
                    
                    // Sort transactions chronologically to ensure proper FIFO processing
                    // (purchases must be processed before sales that depend on them)
                    const sortedTransactions = [...result.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
                    console.log(`\n🔄 Sorted ${sortedTransactions.length} transactions chronologically for FIFO processing`);
                    console.log(`📅 Date range: ${new Date(sortedTransactions[0]?.date).toDateString()} to ${new Date(sortedTransactions[sortedTransactions.length-1]?.date).toDateString()}`);
                    
                    sortedTransactions.forEach((transaction, index) => {
                        console.log(`\n📊 Transaction ${index + 1}/${sortedTransactions.length} (${new Date(transaction.date).toDateString()}):`, transaction);
                        
                        const validation = window.brokerCSVParser.validateTransaction(transaction);
                        console.log(`   → Validation result:`, validation);
                        
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
                                console.log(`   → ✅ Adding transaction: ${transaction.type} ${transaction.quantity} ${transaction.symbol} @ $${transaction.price} on ${new Date(transaction.date).toDateString()}`);
                                
                                try {
                                    // Use force import mode for CSV imports to ensure all valid transactions are recorded
                                    const addResult = window.washSaleEngine.addTransaction(transaction, { forceImport: true });
                                    
                                    if (addResult && addResult.transaction) {
                                        importedCount++;
                                        console.log(`   → ✅ Successfully imported to engine`);
                                        
                                        if (addResult.washSaleViolation) {
                                            if (addResult.washSaleViolation.forcedImport) {
                                                console.log(`   → ⚠️ Forced import despite FIFO issue: ${addResult.washSaleViolation.message}`);
                                                fifoRejectedCount++;
                                            } else {
                                                console.log(`   → ⚠️ Wash sale detected: ${addResult.washSaleViolation.message}`);
                                            }
                                        }
                                    } else {
                                        console.error(`   → ❌ Engine failed to import transaction:`, addResult);
                                        engineErrorCount++;
                                        skippedCount++;
                                    }
                                } catch (error) {
                                    console.error(`   → ❌ Exception during import:`, error);
                                    engineErrorCount++;
                                    skippedCount++;
                                }
                            } else {
                                console.log(`   → ⚠️ Skipping duplicate transaction`);
                                duplicateCount++;
                                skippedCount++;
                            }
                        } else {
                            console.warn(`   → ❌ Skipping invalid transaction:`, validation.errors);
                            invalidCount++;
                            skippedCount++;
                        }
                    });
                    
                    window.app.updateUI();
                    updateSaveStatus('✅ CSV Imported');
                    
                    let resultMessage = `✅ CSV Import Complete!\n\n`;
                    resultMessage += `📊 Total found in CSV: ${result.transactions.length}\n`;
                    resultMessage += `✅ Imported: ${importedCount} transactions\n`;
                    if (duplicateCount > 0) {
                        resultMessage += `⚠️ Duplicates: ${duplicateCount} (already existed)\n`;
                    }
                    if (invalidCount > 0) {
                        resultMessage += `❌ Invalid: ${invalidCount} (validation failed)\n`;
                    }
                    if (fifoRejectedCount > 0) {
                        resultMessage += `❌ FIFO Rejected: ${fifoRejectedCount} (insufficient shares)\n`;
                    }
                    if (engineErrorCount > 0) {
                        resultMessage += `❌ Engine Errors: ${engineErrorCount} (processing failed)\n`;
                    }
                    resultMessage += `\n🔍 Check console log for detailed import analysis.`;
                    resultMessage += `\n📈 Review Portfolio and History tabs to verify your data.`;
                    
                    console.log(`\n📈 DETAILED IMPORT SUMMARY:`);
                    console.log(`   📊 Total in CSV: ${result.transactions.length}`);
                    console.log(`   ✅ Successfully imported: ${importedCount}`);
                    console.log(`   ⚠️ Duplicates (skipped): ${duplicateCount}`);
                    console.log(`   ❌ Invalid (validation failed): ${invalidCount}`);
                    console.log(`   ❌ FIFO rejected (insufficient shares): ${fifoRejectedCount}`);
                    console.log(`   ❌ Engine errors: ${engineErrorCount}`);
                    console.log(`   📊 Total skipped: ${skippedCount}`);
                    console.log(`   🔍 Success rate: ${((importedCount / result.transactions.length) * 100).toFixed(1)}%`);
                    
                    // Show current state after import
                    console.log(`\n📊 ENGINE STATE AFTER IMPORT:`);
                    console.log(`   Total transactions: ${window.washSaleEngine.transactions.length}`);
                    console.log(`   Total share lots: ${window.washSaleEngine.shareLots.length}`);
                    
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
            const { averageCost } = window.washSaleEngine.calculateAverageCost(transaction.symbol, transaction.date, transaction.id);
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