/**
 * Standalone debug functions for portfolio analysis
 * Paste this directly into the browser console
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

// Make functions available globally
window.debugPortfolio = debugPortfolio;
window.fixPortfolio = fixPortfolio;

console.log('✅ Debug functions loaded. You can now use:');
console.log('   debugPortfolio() - to diagnose issues');
console.log('   fixPortfolio() - to fix discrepancies');