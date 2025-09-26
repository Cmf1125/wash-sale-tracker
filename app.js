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
            symbol: '',
            account: ''
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
        } else if (tabName === 'optimization') {
            this.updateTaxOptimizationTab();
        } else if (tabName === 'alternatives') {
            this.setupAlternativesTab();
        } else if (tabName === 'help') {
            // Help tab is static HTML, no updates needed
        }
    }

    /**
     * Update portfolio table
     */
    async updatePortfolioTable() {
        const portfolio = window.washSaleEngine.getPortfolio();
        const stockSplits = window.washSaleEngine.getStockSplits();
        const tableBody = document.getElementById('portfolio-table');
        
        // Update applied splits section
        this.updateAppliedSplitsDisplay(stockSplits);
        
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
     * Update the applied splits display
     */
    updateAppliedSplitsDisplay(stockSplits) {
        const splitsList = document.getElementById('applied-splits-list');
        const noSplitsMessage = document.getElementById('no-splits-message');
        
        if (!splitsList) return;
        
        if (stockSplits.length === 0) {
            if (noSplitsMessage) {
                noSplitsMessage.style.display = 'block';
            }
            splitsList.innerHTML = `
                <div class="text-center text-gray-500 py-4" id="no-splits-message">
                    No stock splits applied yet. Add one above to adjust historical prices.
                </div>
            `;
            return;
        }
        
        if (noSplitsMessage) {
            noSplitsMessage.style.display = 'none';
        }
        
        splitsList.innerHTML = stockSplits.map(split => {
            const splitDate = new Date(split.splitDate).toLocaleDateString();
            const appliedDate = new Date(split.appliedAt).toLocaleDateString();
            const isForward = split.ratio >= 1;
            const displayRatio = isForward ? `${split.ratio}:1` : `1:${Math.round(1/split.ratio)}`;
            const splitType = isForward ? 'Forward' : 'Reverse';
            
            console.log(`🔍 DISPLAY: Rendering split ID: "${split.id}" for ${split.symbol}`);
            
            return `
                <div class="flex items-center justify-between bg-gray-50 rounded p-3 mb-2 border border-gray-200">
                    <div class="flex items-center">
                        <span class="font-medium text-gray-900">${split.symbol}</span>
                        <span class="mx-2 text-blue-600">${displayRatio} ${splitType} Split</span>
                        <span class="text-sm text-gray-600">on ${splitDate}</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="text-right">
                            <div class="text-sm text-gray-700">
                                Applied: ${appliedDate}
                            </div>
                            <div class="text-xs text-gray-600">
                                Affects pre-${splitDate} transactions
                            </div>
                        </div>
                        <button onclick="removeStockSplit('${split.id}')" class="text-red-600 hover:text-red-800 text-sm">
                            Remove
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Set up filter event listeners (called when history tab is shown)
     */
    setupHistoryFilterListeners() {
        const filterYear = document.getElementById('filter-year');
        const filterType = document.getElementById('filter-type');
        const filterAccount = document.getElementById('filter-account');
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
        if (filterAccount) {
            filterAccount.removeEventListener('change', this.updateHistoryFilters);
            filterAccount.addEventListener('change', () => this.updateHistoryFilters());
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
        const filterAccount = document.getElementById('filter-account');
        const filterSymbol = document.getElementById('filter-symbol');

        this.historyFilters = {
            year: filterYear ? filterYear.value : '',
            type: filterType ? filterType.value : '',
            account: filterAccount ? filterAccount.value : '',
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
        const filterAccount = document.getElementById('filter-account');
        const filterSymbol = document.getElementById('filter-symbol');

        if (filterYear) filterYear.value = '';
        if (filterType) filterType.value = '';
        if (filterAccount) filterAccount.value = '';
        if (filterSymbol) filterSymbol.value = '';

        this.historyFilters = {
            year: '',
            type: '',
            account: '',
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
     * Populate account filter dropdown with available accounts
     */
    populateAccountFilter() {
        const filterAccount = document.getElementById('filter-account');
        if (!filterAccount) return;

        // Save current selection
        const currentSelection = filterAccount.value;

        // Get unique accounts from transactions
        const accounts = [...new Set(window.washSaleEngine.transactions
            .map(t => t.account)
            .filter(account => account && account !== 'Unknown')
        )].sort();

        // Clear existing options (keep "All Accounts")
        filterAccount.innerHTML = '<option value="">All Accounts</option>';
        
        // Add account options
        accounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account;
            option.textContent = account;
            filterAccount.appendChild(option);
        });

        // Restore previous selection
        if (currentSelection) {
            filterAccount.value = currentSelection;
        }
    }

    /**
     * Update transaction history table
     */
    updateHistoryTable() {
        console.log(`🔍 TABLE UPDATE: Updating history table with filters:`, this.historyFilters);
        
        // Only populate filters if they're empty (first time)
        const filterYear = document.getElementById('filter-year');
        const filterAccount = document.getElementById('filter-account');
        
        if (filterYear && filterYear.children.length <= 1) {
            this.populateYearFilter();
        }
        if (filterAccount && filterAccount.children.length <= 1) {
            this.populateAccountFilter();
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
        
        // Apply account filter
        if (this.historyFilters.account) {
            transactions = transactions.filter(t => 
                t.account === this.historyFilters.account
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
            const hasActiveFilters = this.historyFilters.year || this.historyFilters.type || this.historyFilters.account || this.historyFilters.symbol;
            const emptyMessage = hasActiveFilters 
                ? 'No transactions match the current filters. Try clearing filters or adjusting your criteria.'
                : 'No transactions yet. Start trading to see your history.';
                
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="px-6 py-8 text-center text-gray-500">
                        ${emptyMessage}
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = transactions.map(transaction => {
            const typeClass = transaction.type === 'buy' ? 'text-green-600' : 'text-red-600';
            const typeIcon = transaction.type === 'buy' ? '↗' : '↘';
            
            // Get adjusted display for split-affected transactions
            const adjustedDisplay = window.washSaleEngine.getAdjustedTransactionDisplay(transaction);
            
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
            
            // Format display based on split adjustments
            const displayPrice = adjustedDisplay.isAdjusted 
                ? `$${adjustedDisplay.price.toFixed(2)} <span class="text-xs text-blue-600">*adj</span>`
                : `$${transaction.price.toFixed(2)}`;
            
            const displayQuantity = adjustedDisplay.isAdjusted 
                ? `${adjustedDisplay.quantity} <span class="text-xs text-blue-600">*adj</span>`
                : `${transaction.quantity}`;
            
            const displayTotal = adjustedDisplay.isAdjusted 
                ? `$${(adjustedDisplay.price * adjustedDisplay.quantity).toFixed(2)} <span class="text-xs text-blue-600">*adj</span>`
                : `$${transaction.total.toFixed(2)}`;
            
            return `
                <tr>
                    <td class="px-6 py-4">${new Date(transaction.date).toLocaleDateString()}</td>
                    <td class="px-6 py-4 ${typeClass}">${typeIcon} ${transaction.type.toUpperCase()}</td>
                    <td class="px-6 py-4 font-medium">${transaction.symbol}</td>
                    <td class="px-6 py-4 text-xs text-gray-600">${transaction.account || 'Unknown'}</td>
                    <td class="px-6 py-4">${displayQuantity}</td>
                    <td class="px-6 py-4">${displayPrice}</td>
                    <td class="px-6 py-4">${displayTotal}</td>
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

    /**
     * Update Tax Optimization Tab
     */
    async updateTaxOptimizationTab() {
        const portfolio = window.washSaleEngine.getPortfolio();
        const portfolioPositions = Object.values(portfolio);
        
        if (portfolioPositions.length === 0) {
            document.getElementById('optimization-portfolio-value').textContent = '$0';
            document.getElementById('optimization-harvestable-losses').textContent = '$0';
            document.getElementById('optimization-tax-savings').textContent = '$0';
            document.getElementById('optimization-opportunities').textContent = '0';
            return;
        }

        // Get current prices and calculate position values
        const symbols = Object.keys(portfolio);
        try {
            const prices = await window.stockPriceService.getBatchPrices(symbols);
            
            let totalValue = 0;
            let totalHarvestableLosses = 0;
            let opportunities = 0;
            
            // Convert portfolio to format expected by tax engine
            const positions = portfolioPositions.map(position => {
                const priceData = prices[position.symbol];
                const currentPrice = (priceData && priceData.price > 0) ? priceData.price : position.averageCost;
                const currentValue = position.shares * currentPrice;
                const unrealizedGainLoss = (currentPrice - position.averageCost) * position.shares;
                
                totalValue += currentValue;
                
                if (unrealizedGainLoss < -100) { // Only count significant losses
                    totalHarvestableLosses += Math.abs(unrealizedGainLoss);
                    opportunities++;
                }
                
                return {
                    symbol: position.symbol,
                    shares: position.shares,
                    averageCost: position.averageCost,
                    currentPrice: currentPrice,
                    currentValue: currentValue,
                    unrealizedGainLoss: unrealizedGainLoss,
                    purchaseDate: position.purchaseDate || new Date() // fallback
                };
            });
            
            // Update dashboard metrics
            document.getElementById('optimization-portfolio-value').textContent = `$${totalValue.toFixed(0)}`;
            document.getElementById('optimization-harvestable-losses').textContent = `$${totalHarvestableLosses.toFixed(0)}`;
            document.getElementById('optimization-tax-savings').textContent = `$${(totalHarvestableLosses * 0.24).toFixed(0)}`;
            document.getElementById('optimization-opportunities').textContent = opportunities.toString();
            
        } catch (error) {
            console.error('Failed to update tax optimization tab:', error);
        }
    }

    /**
     * Setup Stock Alternatives Tab
     */
    setupAlternativesTab() {
        const form = document.getElementById('alternatives-form');
        if (form && !form.hasEventListener) {
            form.addEventListener('submit', this.handleAlternativesFormSubmit.bind(this));
            form.hasEventListener = true;
        }
    }

    /**
     * Handle alternatives form submission
     */
    async handleAlternativesFormSubmit(e) {
        e.preventDefault();
        
        const symbol = document.getElementById('alternatives-symbol').value.toUpperCase().trim();
        const quantity = parseInt(document.getElementById('alternatives-quantity').value);
        const expectedLoss = parseFloat(document.getElementById('alternatives-loss').value) || 0;
        
        if (!symbol) {
            alert('Please enter a stock symbol');
            return;
        }
        
        if (!quantity || quantity <= 0) {
            alert('Please enter a valid quantity');
            return;
        }
        
        try {
            // Show loading state
            document.getElementById('alternatives-results').classList.remove('hidden');
            document.getElementById('alternatives-list').innerHTML = `
                <div class="text-center py-8">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p class="text-gray-600">Finding alternatives for ${symbol}...</p>
                </div>
            `;
            
            // Get similar stocks
            const suggestions = await window.similarStocksEngine.getWashSalePreventionSuggestions(
                symbol, 
                quantity, 
                expectedLoss
            );
            
            this.displayAlternativeResults(suggestions);
            
        } catch (error) {
            console.error('Error finding alternatives:', error);
            document.getElementById('alternatives-list').innerHTML = `
                <div class="text-center py-8 text-red-600">
                    <p>Error finding alternatives. Please try again.</p>
                </div>
            `;
        }
    }

    /**
     * Display alternative stock recommendations
     */
    displayAlternativeResults(suggestions) {
        const { originalStock, alternatives, strategy } = suggestions;
        
        if (!alternatives || alternatives.length === 0) {
            document.getElementById('alternatives-list').innerHTML = `
                <div class="text-center py-8 text-gray-600">
                    <div class="text-4xl mb-4">🔍</div>
                    <p>No suitable alternatives found for ${originalStock.symbol}</p>
                    <p class="text-sm mt-2">Consider waiting 31 days before repurchasing to avoid wash sale rules.</p>
                </div>
            `;
            return;
        }
        
        const resultsHtml = `
            <div class="mb-6 p-4 bg-blue-50 rounded-lg">
                <h4 class="font-semibold text-blue-900 mb-2">Original Position</h4>
                <p class="text-blue-800">
                    ${originalStock.symbol} - ${originalStock.quantity} shares
                    ${originalStock.expectedLoss > 0 ? ` (Expected Loss: $${originalStock.expectedLoss.toFixed(2)})` : ''}
                </p>
                <p class="text-sm text-blue-700 mt-1">
                    Sector: ${originalStock.sector} | Industry: ${originalStock.industry}
                </p>
            </div>
            
            <div class="mb-6">
                <h4 class="font-semibold mb-3">🎯 Recommended Strategy</h4>
                <div class="bg-green-50 p-4 rounded-lg border border-green-200">
                    <p class="font-medium text-green-900">${strategy.recommendation}</p>
                    <p class="text-green-800 text-sm mt-2">${strategy.reasoning}</p>
                    <div class="flex items-center justify-between mt-3">
                        <span class="text-xs text-green-700">Timeline: ${strategy.timeline}</span>
                        <span class="px-2 py-1 text-xs rounded ${
                            strategy.riskLevel === 'Low' ? 'bg-green-100 text-green-800' :
                            strategy.riskLevel === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                        }">
                            ${strategy.riskLevel} Risk
                        </span>
                    </div>
                </div>
            </div>
            
            <div class="space-y-4">
                <h4 class="font-semibold">🔍 Alternative Options</h4>
                ${alternatives.map((alt, index) => `
                    <div class="border border-gray-200 rounded-lg p-4 ${index === 0 ? 'border-blue-300 bg-blue-50' : ''}">
                        <div class="flex items-start justify-between mb-3">
                            <div>
                                <div class="flex items-center">
                                    <span class="font-semibold text-lg mr-2">${alt.symbol}</span>
                                    ${index === 0 ? '<span class="px-2 py-1 text-xs bg-blue-600 text-white rounded">RECOMMENDED</span>' : ''}
                                </div>
                                <p class="text-sm text-gray-600">${alt.sector} - ${alt.industry}</p>
                            </div>
                            <div class="text-right">
                                <div class="text-lg font-semibold ${alt.confidence > 0.8 ? 'text-green-600' : alt.confidence > 0.6 ? 'text-yellow-600' : 'text-red-600'}">
                                    ${Math.round(alt.confidence * 100)}%
                                </div>
                                <div class="text-xs text-gray-500">Confidence</div>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4 mb-3">
                            <div>
                                <div class="text-xs text-gray-500">Wash Sale Safety</div>
                                <div class="flex items-center">
                                    <div class="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                                        <div class="bg-green-500 h-2 rounded-full" style="width: ${alt.washSafeScore * 100}%"></div>
                                    </div>
                                    <span class="text-xs">${Math.round(alt.washSafeScore * 100)}%</span>
                                </div>
                            </div>
                            <div>
                                <div class="text-xs text-gray-500">Risk Score</div>
                                <div class="flex items-center">
                                    <div class="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                                        <div class="bg-red-500 h-2 rounded-full" style="width: ${alt.riskScore * 100}%"></div>
                                    </div>
                                    <span class="text-xs">${Math.round(alt.riskScore * 100)}%</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="border-t pt-3">
                            <p class="text-sm text-gray-700 mb-2"><strong>Reason:</strong> ${alt.reason}</p>
                            <p class="text-sm text-blue-700"><strong>Action:</strong> ${alt.recommendedAction}</p>
                            ${alt.taxImplication ? `
                                <div class="mt-2 text-xs text-gray-600">
                                    <span class="font-medium">Tax Impact:</span> 
                                    $${alt.taxImplication.potentialTaxSavings.toFixed(2)} potential savings 
                                    (${Math.round(alt.taxImplication.confidence * 100)}% confidence)
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        document.getElementById('alternatives-list').innerHTML = resultsHtml;
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
    // Switch to portfolio tab and show the split form with the symbol pre-filled
    window.app.showTab('portfolio');
    document.getElementById('split-symbol').value = symbol;
    toggleSplitForm(true);
}

function exportData() {
    window.washSaleEngine.exportTransactions();
}

function exportCSV() {
    console.log('📊 Generating CSV export with FIFO P&L calculations...');
    
    const transactions = window.washSaleEngine.transactions
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Create CSV headers
    const headers = [
        'Date',
        'Type',
        'Symbol',
        'Shares',
        'Price',
        'Total Value',
        'FIFO Cost Basis',
        'FIFO P&L',
        'Wash Sale',
        'Notes'
    ];
    
    // Process each transaction
    const csvRows = transactions.map(transaction => {
        let costBasis = '';
        let pnl = '';
        let washSale = '';
        let notes = '';
        
        if (transaction.type === 'sell') {
            // Calculate FIFO P&L for this sell transaction
            const lotsAtSaleTime = window.washSaleEngine.getShareLotsAtDate(transaction.symbol, new Date(transaction.date));
            
            if (lotsAtSaleTime.length > 0) {
                let remainingToSell = transaction.quantity;
                let totalCostBasis = 0;
                let totalPnL = 0;
                let hasWashSale = false;
                let lotDetails = [];
                
                for (const lot of lotsAtSaleTime) {
                    if (remainingToSell <= 0) break;
                    
                    const sharesFromThisLot = Math.min(remainingToSell, lot.remainingQuantity);
                    const lotCostBasis = lot.costPerShare * sharesFromThisLot;
                    const saleProceeds = transaction.price * sharesFromThisLot;
                    const lotPnL = saleProceeds - lotCostBasis;
                    
                    totalCostBasis += lotCostBasis;
                    totalPnL += lotPnL;
                    
                    // Check wash sale
                    if (lotPnL < 0) {
                        const washSaleInfo = window.washSaleEngine.checkLotWashSale(lot, sharesFromThisLot, new Date(transaction.date), lotPnL, { asOfDate: new Date(transaction.date) });
                        if (washSaleInfo.isWashSale) {
                            hasWashSale = true;
                        }
                    }
                    
                    lotDetails.push(`${sharesFromThisLot}@$${lot.costPerShare.toFixed(2)}`);
                    remainingToSell -= sharesFromThisLot;
                }
                
                costBasis = `$${totalCostBasis.toFixed(2)}`;
                pnl = `$${totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}`;
                washSale = hasWashSale ? 'YES' : 'NO';
                notes = `FIFO: ${lotDetails.join(' + ')}`;
            } else {
                notes = 'No lots available for FIFO calculation';
            }
        } else {
            notes = 'Purchase - creates new lot';
        }
        
        return [
            new Date(transaction.date).toLocaleDateString(),
            transaction.type.toUpperCase(),
            transaction.symbol,
            transaction.quantity,
            `$${transaction.price.toFixed(2)}`,
            `$${transaction.total.toFixed(2)}`,
            costBasis,
            pnl,
            washSale,
            notes
        ];
    });
    
    // Convert to CSV string
    const csvContent = [headers, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');
    
    // Download the file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `washsafe-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('✅ CSV export complete!');
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
                    console.log(`🔧 Duplicate detection: DISABLED for CSV imports (all valid transactions will be imported)`);
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
                    
                    // Analyze accounts in this CSV
                    const accountsInCSV = [...new Set(sortedTransactions.map(t => t.account).filter(a => a))];
                    console.log(`🏦 Accounts detected in CSV: ${accountsInCSV.length > 0 ? accountsInCSV.join(', ') : 'None detected'}`);
                    
                    // Check for potential cross-account issues
                    const symbolGroups = {};
                    sortedTransactions.forEach(t => {
                        if (!symbolGroups[t.symbol]) symbolGroups[t.symbol] = [];
                        symbolGroups[t.symbol].push(t);
                    });
                    
                    Object.keys(symbolGroups).forEach(symbol => {
                        const transactions = symbolGroups[symbol];
                        const accounts = [...new Set(transactions.map(t => t.account))];
                        if (accounts.length > 1) {
                            console.log(`🔍 Multi-account activity for ${symbol}: ${accounts.join(', ')}`);
                        }
                    });
                    
                    sortedTransactions.forEach((transaction, index) => {
                        console.log(`\n📊 Transaction ${index + 1}/${sortedTransactions.length} (${new Date(transaction.date).toDateString()}):`, {
                            symbol: transaction.symbol,
                            type: transaction.type,
                            quantity: transaction.quantity,
                            price: transaction.price,
                            date: new Date(transaction.date),
                            source: transaction.source,
                            account: transaction.account
                        });
                        
                        const validation = window.brokerCSVParser.validateTransaction(transaction);
                        console.log(`   → Validation result:`, validation);
                        
                        if (validation.isValid) {
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
                    console.log(`   🏦 Accounts processed: ${accountsInCSV.length > 0 ? accountsInCSV.join(', ') : 'None detected'}`);
                    
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

/**
 * Stock Split Functions
 */
function toggleSplitForm(show = null) {
    const formSection = document.getElementById('split-form-section');
    const addBtn = document.getElementById('add-split-btn');
    
    if (show === null) {
        // Toggle visibility
        formSection.classList.toggle('hidden');
    } else if (show) {
        formSection.classList.remove('hidden');
    } else {
        formSection.classList.add('hidden');
    }
    
    // Update button text
    if (formSection.classList.contains('hidden')) {
        addBtn.textContent = '+ Add Split';
    } else {
        addBtn.textContent = 'Hide Form';
        // Focus on symbol input when form is shown
        document.getElementById('split-symbol').focus();
    }
}

function handleSplitFormSubmit(e) {
    e.preventDefault();
    
    const symbol = document.getElementById('split-symbol').value.trim().toUpperCase();
    const splitDate = document.getElementById('split-date').value;
    const ratioInput = document.getElementById('split-ratio').value.trim();
    
    if (!symbol) {
        alert('Please enter a stock symbol');
        return;
    }
    
    if (!splitDate) {
        alert('Please select a split date');
        return;
    }
    
    if (!ratioInput) {
        alert('Please enter a split ratio (e.g., 2:1 or 1:15)');
        return;
    }
    
    const parsedDate = new Date(splitDate);
    if (isNaN(parsedDate.getTime())) {
        alert('Invalid date format');
        return;
    }
    
    // Parse the ratio from formats like "2:1", "4:1", "1:15", etc.
    let ratio;
    if (ratioInput.includes(':')) {
        const parts = ratioInput.split(':').map(p => parseFloat(p.trim()));
        if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1]) || parts[0] <= 0 || parts[1] <= 0) {
            alert('Invalid ratio format. Use format like "2:1" for 2-for-1 split or "1:15" for 1-for-15 reverse split');
            return;
        }
        ratio = parts[0] / parts[1]; // Convert to decimal (e.g., 2:1 = 2.0, 1:15 = 0.0667)
    } else {
        // Try to parse as decimal
        ratio = parseFloat(ratioInput);
        if (isNaN(ratio) || ratio <= 0) {
            alert('Invalid ratio. Enter as ratio (2:1) or decimal (2.0)');
            return;
        }
    }
    
    // Confirm the split
    const isForward = ratio >= 1;
    const displayRatio = isForward ? `${ratio}:1` : `1:${Math.round(1/ratio)}`;
    const splitType = isForward ? 'Forward' : 'Reverse';
    
    const message = `Add ${splitType} Split?\n\n${symbol} - ${displayRatio} split on ${parsedDate.toDateString()}\n\nThis will adjust the display of all transactions that occurred BEFORE this date.\nPost-split transactions will show actual traded prices.\n\nContinue?`;
    
    if (!confirm(message)) {
        return;
    }
    
    console.log(`📊 Calling engine addStockSplit: ${symbol}, ${parsedDate}, ${ratio}`);
    const success = window.washSaleEngine.addStockSplit(symbol, parsedDate, ratio);
    console.log(`📊 Add split result: ${success}`);
    
    if (success) {
        alert(`✅ Stock split added successfully!\n\n${symbol} - ${displayRatio} ${splitType} Split\nDate: ${parsedDate.toDateString()}\n\nPre-split transactions will now show adjusted prices.`);
        
        // Reset form
        document.getElementById('split-form').reset();
        toggleSplitForm(false);
        
        // Update UI
        console.log(`📊 Updating UI after split addition`);
        window.app.updateUI();
        updateSaveStatus('✓ Stock Split Added');
    } else {
        alert('❌ Failed to add stock split. It may already exist for this date.');
        console.error(`📊 Failed to add split: ${symbol}, ${parsedDate}, ${ratio}`);
    }
}

function removeStockSplit(splitId) {
    console.log(`🗑️ Attempting to remove stock split: ${splitId}`);
    
    if (!confirm('Remove this stock split?\n\nThis will restore original transaction prices for the affected period.')) {
        console.log(`🗑️ User cancelled split removal`);
        return;
    }
    
    console.log(`🗑️ Calling engine removeStockSplit...`);
    const success = window.washSaleEngine.removeStockSplit(splitId);
    console.log(`🗑️ Remove result: ${success}`);
    
    if (success) {
        alert('✅ Stock split removed successfully!');
        console.log(`🗑️ Updating UI after split removal`);
        window.app.updateUI();
        updateSaveStatus('✓ Stock Split Removed');
    } else {
        alert('❌ Failed to remove stock split.');
        console.error(`🗑️ Failed to remove split ID: ${splitId}`);
    }
}

function clearAllSplits() {
    console.log(`🗑️ Attempting to clear all stock splits`);
    const success = window.washSaleEngine.clearAllStockSplits();
    
    if (success) {
        alert('✅ All stock splits cleared successfully!');
        console.log(`🗑️ Updating UI after clearing all splits`);
        window.app.updateUI();
        updateSaveStatus('✓ All Splits Cleared');
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new WashSafeApp();
    
    // Set up split form event listener
    const splitForm = document.getElementById('split-form');
    if (splitForm) {
        splitForm.addEventListener('submit', handleSplitFormSubmit);
    }
});

/**
 * Global function for tax optimization analysis
 */
async function runTaxOptimizationAnalysis() {
    const portfolio = window.washSaleEngine.getPortfolio();
    const portfolioPositions = Object.values(portfolio);
    
    if (portfolioPositions.length === 0) {
        alert('No portfolio positions found. Add some trades to see optimization recommendations.');
        return;
    }
    
    try {
        // Show loading state
        document.getElementById('optimization-recommendations').innerHTML = `
            <div class="text-center py-8">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p class="text-gray-600">Analyzing your portfolio...</p>
            </div>
        `;
        
        // Get current prices for portfolio analysis
        const symbols = Object.keys(portfolio);
        const prices = await window.stockPriceService.getBatchPrices(symbols);
        
        // Convert portfolio to format expected by tax engine
        const positions = portfolioPositions.map(position => {
            const priceData = prices[position.symbol];
            const currentPrice = (priceData && priceData.price > 0) ? priceData.price : position.averageCost;
            const currentValue = position.shares * currentPrice;
            const unrealizedGainLoss = (currentPrice - position.averageCost) * position.shares;
            
            return {
                symbol: position.symbol,
                shares: position.shares,
                averageCost: position.averageCost,
                currentPrice: currentPrice,
                currentValue: currentValue,
                unrealizedGainLoss: unrealizedGainLoss,
                purchaseDate: position.purchaseDate || new Date()
            };
        });
        
        // Run tax optimization analysis
        const analysis = await window.taxOptimizationEngine.analyzePortfolioOptimization(positions);
        
        // Update recommendations section
        displayTaxOptimizationResults(analysis);
        
        // Update loss harvesting table
        updateLossHarvestingTable(analysis.opportunities);
        
    } catch (error) {
        console.error('Error running tax optimization analysis:', error);
        document.getElementById('optimization-recommendations').innerHTML = `
            <div class="text-center py-8 text-red-600">
                <p>Error running analysis. Please try again.</p>
            </div>
        `;
    }
}

/**
 * Display tax optimization analysis results
 */
function displayTaxOptimizationResults(analysis) {
    const { summary, recommendations, taxProjections } = analysis;
    
    let recommendationsHtml = '';
    
    if (recommendations.length === 0) {
        recommendationsHtml = `
            <div class="text-center py-8 text-gray-600">
                <div class="text-4xl mb-4">✅</div>
                <p>No immediate optimization opportunities found.</p>
                <p class="text-sm mt-2">Your portfolio appears to be well-positioned from a tax perspective.</p>
            </div>
        `;
    } else {
        recommendationsHtml = `
            <div class="space-y-4">
                ${recommendations.map(rec => `
                    <div class="border rounded-lg p-4 ${
                        rec.priority === 'HIGH' ? 'border-red-300 bg-red-50' :
                        rec.priority === 'MEDIUM' ? 'border-yellow-300 bg-yellow-50' :
                        'border-blue-300 bg-blue-50'
                    }">
                        <div class="flex items-start justify-between mb-2">
                            <div>
                                <h5 class="font-semibold ${
                                    rec.priority === 'HIGH' ? 'text-red-900' :
                                    rec.priority === 'MEDIUM' ? 'text-yellow-900' :
                                    'text-blue-900'
                                }">${rec.action}</h5>
                                <p class="text-sm text-gray-600 mt-1">${rec.category}</p>
                            </div>
                            <span class="px-2 py-1 text-xs rounded ${
                                rec.priority === 'HIGH' ? 'bg-red-200 text-red-800' :
                                rec.priority === 'MEDIUM' ? 'bg-yellow-200 text-yellow-800' :
                                'bg-blue-200 text-blue-800'
                            }">
                                ${rec.priority}
                            </span>
                        </div>
                        <p class="text-sm mb-2"><strong>Benefit:</strong> ${rec.benefit}</p>
                        ${rec.deadline ? `<p class="text-xs text-gray-600"><strong>Deadline:</strong> ${rec.deadline}</p>` : ''}
                        ${rec.strategy && rec.strategy.steps ? `
                            <div class="mt-3 text-sm">
                                <strong>Steps:</strong>
                                <ol class="list-decimal list-inside ml-4 mt-1">
                                    ${rec.strategy.steps.map(step => `<li>${step}</li>`).join('')}
                                </ol>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
            
            ${taxProjections ? `
                <div class="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h5 class="font-semibold mb-3">📊 Tax Impact Summary</h5>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div class="text-gray-600">Current Tax Liability</div>
                            <div class="font-semibold">$${taxProjections.currentTaxLiability.toFixed(2)}</div>
                        </div>
                        <div>
                            <div class="text-gray-600">Optimized Tax Liability</div>
                            <div class="font-semibold text-green-600">$${taxProjections.optimizedTaxLiability.toFixed(2)}</div>
                        </div>
                        <div>
                            <div class="text-gray-600">Potential Tax Savings</div>
                            <div class="font-semibold text-green-600">$${taxProjections.potentialTaxSavings.toFixed(2)}</div>
                        </div>
                        <div>
                            <div class="text-gray-600">Loss Carryforward</div>
                            <div class="font-semibold">$${taxProjections.carryforwardOpportunity.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
            ` : ''}
        `;
    }
    
    document.getElementById('optimization-recommendations').innerHTML = recommendationsHtml;
}

/**
 * Update loss harvesting opportunities table
 */
function updateLossHarvestingTable(opportunities) {
    const tableBody = document.getElementById('harvesting-opportunities-table');
    
    if (opportunities.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                    No loss harvesting opportunities identified.
                </td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = opportunities.map(opp => `
        <tr>
            <td class="px-6 py-4 font-medium">${opp.symbol}</td>
            <td class="px-6 py-4 text-red-600">-$${opp.unrealizedLoss.toFixed(2)}</td>
            <td class="px-6 py-4 text-green-600">$${opp.potentialTaxBenefit.toFixed(2)}</td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 text-xs rounded ${opp.isShortTerm ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}">
                    ${opp.isShortTerm ? 'Short-term' : 'Long-term'}
                </span>
                <div class="text-xs text-gray-500 mt-1">${opp.holdingPeriod} days</div>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm">${opp.strategy.action.replace(/_/g, ' ')}</div>
                <div class="text-xs text-gray-500 mt-1">${opp.strategy.timeline}</div>
            </td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 text-xs rounded ${
                    opp.urgency === 'HIGH' ? 'bg-red-100 text-red-800' :
                    opp.urgency === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                }">
                    ${opp.urgency}
                </span>
            </td>
        </tr>
    `).join('');
}

/**
 * Scan for potential stock splits in transaction history
 */
async function scanForStockSplits() {
    const scanButton = document.getElementById('scan-splits-btn');
    const resultsContainer = document.getElementById('split-scan-results');
    
    // Show loading state
    scanButton.disabled = true;
    scanButton.textContent = 'Scanning...';
    resultsContainer.innerHTML = `
        <div class="text-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p class="text-gray-600">Analyzing transaction history for potential stock splits...</p>
        </div>
    `;
    resultsContainer.classList.remove('hidden');
    
    try {
        // Run split detection
        const potentialSplits = window.washSaleEngine.detectPotentialSplits();
        
        // Reset button
        scanButton.disabled = false;
        scanButton.textContent = 'Scan for Stock Splits';
        
        if (potentialSplits.length === 0) {
            resultsContainer.innerHTML = `
                <div class="text-center py-8 text-green-600">
                    <div class="text-4xl mb-4">✅</div>
                    <p class="font-medium">No potential stock splits detected</p>
                    <p class="text-sm text-gray-600 mt-2">Your transaction history appears to have consistent pricing across all positions.</p>
                </div>
            `;
            return;
        }
        
        // Display potential splits
        displaySplitDetectionResults(potentialSplits);
        
    } catch (error) {
        console.error('Error scanning for splits:', error);
        scanButton.disabled = false;
        scanButton.textContent = 'Scan for Stock Splits';
        resultsContainer.innerHTML = `
            <div class="text-center py-8 text-red-600">
                <div class="text-4xl mb-4">❌</div>
                <p class="font-medium">Error scanning for splits</p>
                <p class="text-sm mt-2">Please try again or check your transaction data.</p>
            </div>
        `;
    }
}

/**
 * Display stock split detection results
 */
function displaySplitDetectionResults(potentialSplits) {
    const resultsContainer = document.getElementById('split-scan-results');
    
    const alertsHtml = potentialSplits.map((split, index) => `
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div class="flex items-start">
                <div class="flex-shrink-0">
                    <div class="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                        <span class="text-yellow-600 font-semibold text-sm">⚠️</span>
                    </div>
                </div>
                <div class="ml-3 flex-1">
                    <h4 class="text-yellow-800 font-medium">
                        Potential ${split.splitType === 'reverse' ? 'Reverse' : 'Regular'} Split: ${split.symbol}
                    </h4>
                    <div class="mt-2 text-yellow-700 text-sm">
                        <p><strong>Detection Date:</strong> ${new Date(split.detectedDate).toLocaleDateString()}</p>
                        <p><strong>Price Change:</strong> $${split.priceFrom.toFixed(2)} → $${split.priceTo.toFixed(2)} (${split.actualRatio.toFixed(1)}x ${split.splitType === 'reverse' ? 'increase' : 'drop'})</p>
                        <p><strong>Suggested Split Ratio:</strong> ${split.suggestedRatio}</p>
                        <p><strong>Confidence:</strong> 
                            <span class="px-2 py-1 rounded text-xs ${
                                split.confidence === 'HIGH' ? 'bg-red-100 text-red-800' :
                                split.confidence === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                            }">
                                ${split.confidence}
                            </span>
                        </p>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                        <button 
                            onclick="confirmSplit('${split.symbol}', '${split.detectedDate}', '${split.suggestedRatio}', ${index})"
                            class="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                        >
                            Add Split Record
                        </button>
                        <button 
                            onclick="dismissSplitAlert(${index})"
                            class="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400 transition-colors"
                        >
                            Dismiss
                        </button>
                        <button 
                            onclick="viewSplitDetails('${split.symbol}', '${split.detectedDate}')"
                            class="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded hover:bg-gray-200 transition-colors"
                        >
                            View Details
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    resultsContainer.innerHTML = `
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <h4 class="text-lg font-medium text-gray-900">
                    ${potentialSplits.length} Potential Split${potentialSplits.length !== 1 ? 's' : ''} Found
                </h4>
                <div class="flex items-center gap-2">
                    <span class="text-sm text-gray-500">
                        Review and confirm each detected split
                    </span>
                    <button 
                        onclick="dismissAllSplitAlerts()"
                        class="px-3 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200 transition-colors"
                    >
                        Dismiss All
                    </button>
                </div>
            </div>
            ${alertsHtml}
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div class="flex">
                    <div class="flex-shrink-0">
                        <span class="text-blue-600">ℹ️</span>
                    </div>
                    <div class="ml-3">
                        <h5 class="text-blue-800 font-medium text-sm">About Stock Split Detection</h5>
                        <p class="text-blue-700 text-sm mt-1">
                            This system detects significant price drops that may indicate stock splits. 
                            Please verify each suggestion against official records before confirming. 
                            Adding incorrect split data can affect your tax calculations.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Confirm and add a stock split record
 */
function confirmSplit(symbol, date, ratio, alertIndex) {
    const confirmed = confirm(
        `Add ${ratio} stock split for ${symbol} on ${new Date(date).toLocaleDateString()}?\n\n` +
        `This will update all future calculations for ${symbol}. Make sure this information is accurate.`
    );
    
    if (confirmed) {
        try {
            // Parse ratio (e.g., "2:1" -> [2, 1])
            const [numerator, denominator] = ratio.split(':').map(x => parseInt(x.trim()));
            
            // Add split to engine
            window.washSaleEngine.addStockSplit(symbol, date, numerator / denominator);
            
            // Show success message
            alert(`✅ Stock split added successfully!\n\n${symbol}: ${ratio} split on ${new Date(date).toLocaleDateString()}`);
            
            // Remove the alert from display
            dismissSplitAlert(alertIndex);
            
            // Refresh any displayed data
            if (typeof refreshAllData === 'function') {
                refreshAllData();
            }
            
        } catch (error) {
            console.error('Error adding stock split:', error);
            alert('❌ Error adding stock split. Please check the data and try again.');
        }
    }
}

/**
 * Dismiss a split detection alert
 */
function dismissSplitAlert(alertIndex) {
    const alertElements = document.querySelectorAll('#split-scan-results .bg-yellow-50');
    
    // Find the alert element to dismiss (handle cases where indexes might be off)
    let alertToRemove = alertElements[alertIndex];
    if (!alertToRemove && alertElements.length > 0) {
        // If the specific index doesn't exist, remove the last one
        alertToRemove = alertElements[alertElements.length - 1];
        console.log(`Alert ${alertIndex} not found, removing last alert instead`);
    }
    
    if (alertToRemove) {
        alertToRemove.style.transition = 'opacity 0.3s';
        alertToRemove.style.opacity = '0';
        setTimeout(() => {
            alertToRemove.remove();
            
            // Check if any alerts remain after removal
            const remainingAlerts = document.querySelectorAll('#split-scan-results .bg-yellow-50');
            if (remainingAlerts.length === 0) {
                document.getElementById('split-scan-results').innerHTML = `
                    <div class="text-center py-8 text-green-600">
                        <div class="text-4xl mb-4">✅</div>
                        <p class="font-medium">All split alerts reviewed</p>
                        <p class="text-sm text-gray-600 mt-2">Run another scan anytime to check for new potential splits.</p>
                    </div>
                `;
            }
        }, 300);
    } else {
        console.error(`No alert element found to dismiss (index: ${alertIndex})`);
    }
}

/**
 * Dismiss all split detection alerts
 */
function dismissAllSplitAlerts() {
    const confirmed = confirm('Dismiss all split detection alerts?\n\nThis will clear all current split suggestions.');
    
    if (!confirmed) return;
    
    document.getElementById('split-scan-results').innerHTML = `
        <div class="text-center py-8 text-green-600">
            <div class="text-4xl mb-4">✅</div>
            <p class="font-medium">All split alerts dismissed</p>
            <p class="text-sm text-gray-600 mt-2">Run another scan anytime to check for new potential splits.</p>
        </div>
    `;
}

/**
 * View detailed information about a potential split
 */
function viewSplitDetails(symbol, detectedDate) {
    const transactions = window.washSaleEngine.transactions
        .filter(t => t.symbol === symbol)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    if (transactions.length === 0) {
        alert('No transactions found for this symbol.');
        return;
    }
    
    const detailsHtml = transactions.map(t => 
        `${new Date(t.date).toLocaleDateString()}: ${t.type.toUpperCase()} ${t.quantity} shares @ $${t.price.toFixed(2)}`
    ).join('\n');
    
    alert(
        `Transaction Details for ${symbol}\n` +
        `Split detected around: ${new Date(detectedDate).toLocaleDateString()}\n\n` +
        detailsHtml
    );
}

/**
 * Debug portfolio calculation issues
 */
function debugPortfolio() {
    if (!window.washSaleEngine) {
        console.error('❌ Wash Sale Engine not initialized');
        return;
    }
    
    console.log('🔍 Running portfolio diagnostics...');
    const discrepancies = window.washSaleEngine.diagnosePortfolioDiscrepancies();
    
    if (discrepancies.length > 0) {
        console.log(`\n🔧 Found ${discrepancies.length} issues. Would you like to fix them?`);
        console.log('Run fixPortfolio() to attempt automatic fix.');
        return discrepancies;
    } else {
        console.log('✅ All portfolio calculations are correct.');
        return [];
    }
}

/**
 * Fix portfolio calculation issues
 */
function fixPortfolio() {
    if (!window.washSaleEngine) {
        console.error('❌ Wash Sale Engine not initialized');
        return;
    }
    
    console.log('🔧 Attempting to fix portfolio discrepancies...');
    const remainingIssues = window.washSaleEngine.fixPortfolioDiscrepancies();
    
    // Refresh the UI after fixing
    if (window.currentView && window.currentView.updateTransactionTable) {
        window.currentView.updateTransactionTable();
        window.currentView.updatePortfolioSummary();
    }
    
    return remainingIssues;
}

/**
 * Remove a specific stock split by date
 */
function removeStockSplit(symbol, splitDate) {
    if (!window.washSaleEngine) {
        console.error('❌ Wash Sale Engine not initialized');
        return;
    }
    
    symbol = symbol.toUpperCase();
    const targetDate = new Date(splitDate);
    
    const splits = window.washSaleEngine.getStockSplits(symbol);
    const splitToRemove = splits.find(s => {
        const sDate = new Date(s.splitDate);
        return Math.abs(sDate.getTime() - targetDate.getTime()) < 24 * 60 * 60 * 1000; // Within 24 hours
    });
    
    if (!splitToRemove) {
        console.log(`❌ No split found for ${symbol} on ${targetDate.toDateString()}`);
        return false;
    }
    
    const confirmed = confirm(
        `Remove stock split for ${symbol}?\n\n` +
        `Date: ${new Date(splitToRemove.splitDate).toDateString()}\n` +
        `Ratio: ${splitToRemove.ratio}:1\n\n` +
        `This will rebuild your share lots and update the portfolio.`
    );
    
    if (!confirmed) return false;
    
    console.log(`🗑️ Removing split: ${symbol} ${splitToRemove.ratio}:1 on ${new Date(splitToRemove.splitDate).toDateString()}`);
    
    // Remove from array
    const index = window.washSaleEngine.stockSplits.findIndex(s => s.id === splitToRemove.id);
    if (index > -1) {
        window.washSaleEngine.stockSplits.splice(index, 1);
        
        // Rebuild share lots to remove split effects
        console.log(`🔄 Rebuilding share lots to remove split effects...`);
        window.washSaleEngine.rebuildShareLotsFromTransactions();
        
        // Save and update UI
        window.washSaleEngine.saveTransactions();
        if (window.app) window.app.updateUI();
        
        console.log(`✅ Split removed and portfolio updated`);
        return true;
    }
    
    return false;
}

/**
 * Debug specific stock split issues
 */
function debugStock(symbol) {
    if (!window.washSaleEngine) {
        console.error('❌ Wash Sale Engine not initialized');
        return;
    }
    
    symbol = symbol.toUpperCase();
    console.log(`🔍 DEBUGGING ${symbol}:`);
    
    // Get all transactions for this symbol
    const transactions = window.washSaleEngine.transactions
        .filter(t => t.symbol === symbol)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    console.log(`\n📋 TRANSACTIONS (${transactions.length}):`);
    transactions.forEach(t => {
        console.log(`   ${new Date(t.date).toDateString()}: ${t.type.toUpperCase()} ${t.quantity} @ $${t.price.toFixed(2)}`);
    });
    
    // Get all splits for this symbol
    const splits = window.washSaleEngine.getStockSplits(symbol);
    console.log(`\n📊 SPLITS (${splits.length}):`);
    splits.forEach(s => {
        console.log(`   ${new Date(s.splitDate).toDateString()}: ${s.ratio}:1 (${s.ratio < 1 ? 'reverse' : 'regular'})`);
    });
    
    // Get current share lots
    const lots = window.washSaleEngine.shareLots.filter(lot => lot.symbol === symbol && lot.remainingQuantity > 0);
    console.log(`\n📦 CURRENT SHARE LOTS (${lots.length}):`);
    lots.forEach(lot => {
        console.log(`   Lot ${lot.id}: ${lot.remainingQuantity} shares @ $${lot.costPerShare.toFixed(4)} (purchased ${new Date(lot.purchaseDate).toDateString()})`);
        if (lot.appliedSplits) {
            console.log(`     Applied splits: ${lot.appliedSplits.join(', ')}`);
        }
    });
    
    // Calculate what position should be
    let expectedShares = 0;
    transactions.forEach(t => {
        if (t.type === 'buy') {
            expectedShares += t.quantity;
        } else {
            expectedShares -= t.quantity;
        }
    });
    
    // Apply splits to expected shares
    let adjustedExpectedShares = expectedShares;
    splits.forEach(split => {
        adjustedExpectedShares *= split.ratio;
    });
    
    const actualShares = lots.reduce((sum, lot) => sum + lot.remainingQuantity, 0);
    
    console.log(`\n🎯 EXPECTED POSITION:`);
    console.log(`   Raw calculation: ${expectedShares} shares`);
    console.log(`   After splits: ${adjustedExpectedShares.toFixed(6)} shares`);
    console.log(`   Actual portfolio: ${actualShares} shares`);
    console.log(`   Difference: ${Math.abs(adjustedExpectedShares - actualShares).toFixed(6)} shares`);
    
    if (Math.abs(adjustedExpectedShares - actualShares) > 0.001) {
        console.log(`❌ DISCREPANCY FOUND! Expected ${adjustedExpectedShares.toFixed(6)} but have ${actualShares}`);
        
        if (adjustedExpectedShares === 0 && actualShares > 0) {
            console.log(`💡 Suggestion: You should have zero shares. Check if split dates are correct or if there are missing sell transactions.`);
        }
    } else {
        console.log(`✅ Position is correct`);
    }
    
    return {
        transactions,
        splits,
        lots,
        expectedShares: adjustedExpectedShares,
        actualShares
    };
}

/**
 * List all stock splits
 */
function listAllSplits() {
    if (!window.washSaleEngine) {
        console.error('❌ Wash Sale Engine not initialized');
        return;
    }
    
    const allSplits = window.washSaleEngine.stockSplits;
    console.log(`📊 ALL STOCK SPLITS (${allSplits.length}):`);
    
    if (allSplits.length === 0) {
        console.log('   No splits found');
        return;
    }
    
    allSplits.forEach(split => {
        console.log(`   ${split.symbol}: ${split.ratio}:1 on ${new Date(split.splitDate).toDateString()} (ID: ${split.id})`);
    });
    
    return allSplits;
}

/**
 * Force rebuild share lots
 */
function forceRebuild() {
    if (!window.washSaleEngine) {
        console.error('❌ Wash Sale Engine not initialized');
        return;
    }
    
    console.log('🔄 Force rebuilding share lots...');
    window.washSaleEngine.rebuildShareLotsFromTransactions();
    window.washSaleEngine.saveTransactions();
    if (window.app) window.app.updateUI();
    console.log('✅ Rebuild complete');
}

// Make debug functions available globally
window.debugPortfolio = debugPortfolio;
window.fixPortfolio = fixPortfolio;
window.debugStock = debugStock;
window.removeStockSplit = removeStockSplit;
window.listAllSplits = listAllSplits;
window.forceRebuild = forceRebuild;

// Ensure all engines are initialized
function ensureEnginesInitialized() {
    // Initialize tax optimization engine if not ready
    if (window.washSaleEngine && !window.taxOptimizationEngine) {
        window.taxOptimizationEngine = new TaxOptimizationEngine(window.washSaleEngine);
        console.log('✅ Tax Optimization Engine initialized in app.js');
    }
    
    // Ensure similar stocks engine is available
    if (!window.similarStocksEngine) {
        window.similarStocksEngine = new SimilarStocksEngine();
        console.log('✅ Similar Stocks Engine initialized in app.js');
    }
}

// Initialize engines
ensureEnginesInitialized();

console.log('✅ WashSafe App loaded');