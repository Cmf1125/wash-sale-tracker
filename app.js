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

        // Check for wash sale
        const washSaleResult = window.washSaleEngine.checkWashSale(formData);
        
        if (washSaleResult && washSaleResult.type === 'wash_sale_violation') {
            document.getElementById('wash-sale-alert').classList.remove('hidden');
            document.getElementById('wash-sale-details').textContent = washSaleResult.message;
        } else if (washSaleResult && washSaleResult.type === 'wash_sale_warning') {
            document.getElementById('wash-sale-alert').classList.remove('hidden');
            document.getElementById('wash-sale-details').textContent = washSaleResult.message;
        } else {
            document.getElementById('safe-trade-alert').classList.remove('hidden');
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
        }
    }

    /**
     * Update portfolio table
     */
    updatePortfolioTable() {
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

        tableBody.innerHTML = Object.values(portfolio).map(position => {
            const currentPrice = position.averageCost * (0.95 + Math.random() * 0.1); // Mock current price
            const pnl = (currentPrice - position.averageCost) * position.shares;
            const pnlClass = pnl >= 0 ? 'gain' : 'loss';
            const safeDate = window.washSaleEngine.getSafeToSellDate(position.symbol);
            const isSafeToSell = !safeDate || safeDate <= new Date();
            
            return `
                <tr>
                    <td class="px-6 py-4 font-medium text-gray-900">${position.symbol}</td>
                    <td class="px-6 py-4">${position.shares}</td>
                    <td class="px-6 py-4">$${position.averageCost.toFixed(2)}</td>
                    <td class="px-6 py-4">$${currentPrice.toFixed(2)}</td>
                    <td class="px-6 py-4 ${pnlClass}">$${pnl.toFixed(2)}</td>
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
            
            return `
                <tr>
                    <td class="px-6 py-4">${new Date(transaction.date).toLocaleDateString()}</td>
                    <td class="px-6 py-4 ${typeClass}">${typeIcon} ${transaction.type.toUpperCase()}</td>
                    <td class="px-6 py-4 font-medium">${transaction.symbol}</td>
                    <td class="px-6 py-4">${transaction.quantity}</td>
                    <td class="px-6 py-4">$${transaction.price.toFixed(2)}</td>
                    <td class="px-6 py-4">$${transaction.total.toFixed(2)}</td>
                    <td class="px-6 py-4">
                        <span class="text-xs text-gray-500">-</span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Update tax alerts
     */
    updateTaxAlerts() {
        const portfolio = window.washSaleEngine.getPortfolio();
        const alertsContainer = document.getElementById('tax-alerts');
        const alerts = [];

        // Check for positions with wash sale risks
        Object.values(portfolio).forEach(position => {
            const safeDate = window.washSaleEngine.getSafeToSellDate(position.symbol);
            if (safeDate && safeDate > new Date()) {
                alerts.push({
                    type: 'wash-sale-risk',
                    symbol: position.symbol,
                    message: `Don't buy more ${position.symbol} until ${safeDate.toLocaleDateString()} to avoid wash sale rules.`,
                    priority: 'high'
                });
            }
        });

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
    updateStats() {
        const stats = window.washSaleEngine.getYTDStats();
        const portfolio = window.washSaleEngine.getPortfolio();
        
        // Calculate total portfolio value
        let totalValue = 0;
        Object.values(portfolio).forEach(position => {
            const mockCurrentPrice = position.averageCost * (0.95 + Math.random() * 0.1);
            totalValue += position.shares * mockCurrentPrice;
        });

        document.getElementById('total-portfolio-value').textContent = `$${totalValue.toFixed(2)}`;
        document.getElementById('ytd-losses').textContent = `$${stats.totalLosses.toFixed(0)}`;
        document.getElementById('wash-sale-count').textContent = stats.washSaleCount;
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

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new WashSafeApp();
});

console.log('✅ WashSafe App loaded');