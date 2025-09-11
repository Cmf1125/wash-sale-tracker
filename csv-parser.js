/**
 * CSV Parser for Broker Data Import
 * Supports Charles Schwab, Robinhood, E*TRADE, TD Ameritrade, and other major brokers
 */

class BrokerCSVParser {
    constructor() {
        this.supportedBrokers = {
            'schwab': 'Charles Schwab',
            'robinhood': 'Robinhood',
            'etrade': 'E*TRADE',
            'td': 'TD Ameritrade',
            'fidelity': 'Fidelity',
            'vanguard': 'Vanguard',
            'ib': 'Interactive Brokers',
            'webull': 'Webull',
            'generic': 'Generic CSV'
        };
        console.log('📊 CSV Parser initialized');
    }

    /**
     * Parse CSV text and detect broker format
     */
    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) {
            throw new Error('CSV file must have at least a header and one data row');
        }

        const header = lines[0].toLowerCase();
        const brokerType = this.detectBrokerFormat(header);
        
        console.log(`🔍 Detected broker format: ${this.supportedBrokers[brokerType]}`);

        const transactions = [];
        
        for (let i = 1; i < lines.length; i++) {
            try {
                const transaction = this.parseLine(lines[i], brokerType, header);
                if (transaction) {
                    transactions.push(transaction);
                }
            } catch (error) {
                console.warn(`⚠️ Failed to parse line ${i + 1}: ${error.message}`);
            }
        }

        return {
            brokerType: this.supportedBrokers[brokerType],
            transactionCount: transactions.length,
            transactions: transactions
        };
    }

    /**
     * Detect broker format based on CSV headers
     */
    detectBrokerFormat(header) {
        console.log('🔍 Detecting broker format from header:', header);
        
        // Charles Schwab format
        if (header.includes('action') && header.includes('symbol') && header.includes('description')) {
            console.log('✅ Detected Charles Schwab format');
            return 'schwab';
        }
        
        // Robinhood format
        if (header.includes('instrument') && header.includes('side') && header.includes('fees')) {
            return 'robinhood';
        }
        
        // E*TRADE format
        if (header.includes('transaction type') && header.includes('security type')) {
            return 'etrade';
        }
        
        // TD Ameritrade format
        if (header.includes('transaction id') && header.includes('order id')) {
            return 'td';
        }
        
        // Fidelity format
        if (header.includes('run date') && header.includes('account') && header.includes('action')) {
            return 'fidelity';
        }
        
        // Interactive Brokers
        if (header.includes('tradeid') && header.includes('exectime')) {
            return 'ib';
        }
        
        // Generic format - try to map common column names
        return 'generic';
    }

    /**
     * Parse individual line based on broker format
     */
    parseLine(line, brokerType, header) {
        const values = this.parseCSVLine(line);
        const headers = this.parseCSVLine(header);
        
        switch (brokerType) {
            case 'schwab':
                return this.parseSchwabLine(values, headers);
            case 'robinhood':
                return this.parseRobinhoodLine(values, headers);
            case 'etrade':
                return this.parseEtradeLine(values, headers);
            case 'td':
                return this.parseTDLine(values, headers);
            case 'fidelity':
                return this.parseFidelityLine(values, headers);
            case 'ib':
                return this.parseIBLine(values, headers);
            default:
                return this.parseGenericLine(values, headers);
        }
    }

    /**
     * Parse CSV line handling quotes and commas
     */
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    }

    /**
     * Parse Charles Schwab format
     * Typical columns: Date,Action,Symbol,Description,Quantity,Price,Fees & Comm,Amount
     */
    parseSchwabLine(values, headers) {
        const data = this.createDataMap(values, headers);
        console.log('📊 Parsing Schwab line data:', data);
        
        const action = data.action?.toLowerCase();
        if (!action || (!action.includes('buy') && !action.includes('sell') && 
                        !action.includes('bought') && !action.includes('sold') &&
                        !action.includes('purchase') && !action.includes('sale'))) {
            console.warn(`⚠️ Skipping Schwab transaction with action: "${data.action}"`);
            return null; // Skip non-trading transactions
        }
        
        const symbol = data.symbol?.replace(/['"]/g, '').trim();
        if (!symbol || symbol.length > 10) {
            console.warn(`⚠️ Skipping Schwab transaction - invalid symbol: "${data.symbol}"`);
            return null; // Invalid symbol
        }

        const quantity = Math.abs(parseFloat(data.quantity || 0));
        const price = Math.abs(parseFloat(data.price || 0));
        
        if (quantity <= 0) {
            console.warn(`⚠️ Skipping Schwab transaction - invalid quantity: "${data.quantity}"`);
            return null;
        }
        
        if (price <= 0) {
            console.warn(`⚠️ Skipping Schwab transaction - invalid price: "${data.price}"`);
            return null;
        }

        const transaction = {
            type: (action.includes('buy') || action.includes('bought') || action.includes('purchase')) ? 'buy' : 'sell',
            symbol: symbol.toUpperCase(),
            quantity: quantity,
            price: price,
            date: this.parseDate(data.date),
            fees: Math.abs(parseFloat(data['fees & comm'] || data.fees || 0)),
            source: 'Charles Schwab CSV Import'
        };
        
        console.log('✅ Successfully parsed Schwab transaction:', transaction);
        return transaction;
    }

    /**
     * Parse Robinhood format
     */
    parseRobinhoodLine(values, headers) {
        const data = this.createDataMap(values, headers);
        
        const side = data.side?.toLowerCase();
        if (!side || (side !== 'buy' && side !== 'sell')) {
            return null;
        }

        return {
            type: side,
            symbol: data.instrument?.toUpperCase() || data.symbol?.toUpperCase(),
            quantity: Math.abs(parseFloat(data.quantity || 0)),
            price: Math.abs(parseFloat(data.price || 0)),
            date: this.parseDate(data.date || data['executed at']),
            fees: Math.abs(parseFloat(data.fees || 0)),
            source: 'Robinhood CSV Import'
        };
    }

    /**
     * Parse E*TRADE format
     */
    parseEtradeLine(values, headers) {
        const data = this.createDataMap(values, headers);
        
        const transactionType = data['transaction type']?.toLowerCase();
        if (!transactionType || (!transactionType.includes('bought') && !transactionType.includes('sold'))) {
            return null;
        }

        return {
            type: transactionType.includes('bought') ? 'buy' : 'sell',
            symbol: data.symbol?.toUpperCase(),
            quantity: Math.abs(parseFloat(data.quantity || 0)),
            price: Math.abs(parseFloat(data.price || 0)),
            date: this.parseDate(data['trade date'] || data.date),
            fees: Math.abs(parseFloat(data.commission || data.fees || 0)),
            source: 'E*TRADE CSV Import'
        };
    }

    /**
     * Parse TD Ameritrade format
     */
    parseTDLine(values, headers) {
        const data = this.createDataMap(values, headers);
        
        const type = data.type?.toLowerCase() || data.action?.toLowerCase();
        if (!type || (!type.includes('buy') && !type.includes('sell'))) {
            return null;
        }

        return {
            type: type.includes('buy') ? 'buy' : 'sell',
            symbol: data.symbol?.toUpperCase(),
            quantity: Math.abs(parseFloat(data.quantity || 0)),
            price: Math.abs(parseFloat(data.price || 0)),
            date: this.parseDate(data.date || data['execute date']),
            fees: Math.abs(parseFloat(data.fees || data.commission || 0)),
            source: 'TD Ameritrade CSV Import'
        };
    }

    /**
     * Parse Fidelity format
     */
    parseFidelityLine(values, headers) {
        const data = this.createDataMap(values, headers);
        
        const action = data.action?.toLowerCase();
        if (!action || (!action.includes('buy') && !action.includes('sell'))) {
            return null;
        }

        return {
            type: action.includes('buy') ? 'buy' : 'sell',
            symbol: data.symbol?.toUpperCase(),
            quantity: Math.abs(parseFloat(data.quantity || 0)),
            price: Math.abs(parseFloat(data.price || 0)),
            date: this.parseDate(data.date || data['trade date']),
            fees: Math.abs(parseFloat(data.fees || data.commission || 0)),
            source: 'Fidelity CSV Import'
        };
    }

    /**
     * Parse Interactive Brokers format
     */
    parseIBLine(values, headers) {
        const data = this.createDataMap(values, headers);
        
        // IB uses different terminology
        const buySell = data.buysell?.toUpperCase();
        if (!buySell || (buySell !== 'BUY' && buySell !== 'SELL')) {
            return null;
        }

        return {
            type: buySell.toLowerCase(),
            symbol: data.symbol?.toUpperCase(),
            quantity: Math.abs(parseFloat(data.quantity || 0)),
            price: Math.abs(parseFloat(data.price || 0)),
            date: this.parseDate(data.datetime || data.date),
            fees: Math.abs(parseFloat(data.comm || data.fees || 0)),
            source: 'Interactive Brokers CSV Import'
        };
    }

    /**
     * Parse generic CSV format - attempt to map common column names
     */
    parseGenericLine(values, headers) {
        const data = this.createDataMap(values, headers);
        
        // Try to find action/type column
        let action = null;
        const actionKeys = ['action', 'type', 'side', 'transaction type', 'buy/sell'];
        
        for (const key of actionKeys) {
            if (data[key]) {
                action = data[key].toLowerCase();
                break;
            }
        }
        
        if (!action || (!action.includes('buy') && !action.includes('sell') && action !== 'b' && action !== 's')) {
            return null;
        }

        // Map action to buy/sell
        let type = 'buy';
        if (action.includes('sell') || action === 's') {
            type = 'sell';
        }

        // Find symbol
        const symbol = data.symbol || data.ticker || data.instrument || data.security;
        if (!symbol) return null;

        // Find quantity
        const quantity = parseFloat(data.quantity || data.shares || data.qty || 0);
        if (quantity <= 0) return null;

        // Find price
        const price = parseFloat(data.price || data['price per share'] || data.cost || 0);
        if (price <= 0) return null;

        // Find date
        const dateStr = data.date || data['trade date'] || data['execution date'] || data.datetime;
        if (!dateStr) return null;

        return {
            type: type,
            symbol: symbol.toUpperCase(),
            quantity: Math.abs(quantity),
            price: Math.abs(price),
            date: this.parseDate(dateStr),
            fees: Math.abs(parseFloat(data.fees || data.commission || data.comm || 0)),
            source: 'Generic CSV Import'
        };
    }

    /**
     * Create a map of column names to values
     */
    createDataMap(values, headers) {
        const data = {};
        for (let i = 0; i < headers.length && i < values.length; i++) {
            const key = headers[i].toLowerCase().trim();
            const value = values[i]?.replace(/['"]/g, '').trim();
            data[key] = value;
        }
        return data;
    }

    /**
     * Parse various date formats
     */
    parseDate(dateStr) {
        if (!dateStr) return new Date();
        
        // Remove extra quotes and whitespace
        const cleaned = dateStr.replace(/['"]/g, '').trim();
        
        // Try parsing as-is first
        let date = new Date(cleaned);
        if (!isNaN(date.getTime())) {
            return date;
        }
        
        // Try MM/DD/YYYY format
        const mmddyyyy = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (mmddyyyy) {
            return new Date(mmddyyyy[3], mmddyyyy[1] - 1, mmddyyyy[2]);
        }
        
        // Try YYYY-MM-DD format
        const yyyymmdd = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (yyyymmdd) {
            return new Date(yyyymmdd[1], yyyymmdd[2] - 1, yyyymmdd[3]);
        }
        
        // Default to today if we can't parse
        console.warn(`⚠️ Could not parse date: ${dateStr}, using today's date`);
        return new Date();
    }

    /**
     * Validate parsed transaction
     */
    validateTransaction(transaction) {
        const errors = [];
        
        if (!transaction.symbol || transaction.symbol.length > 10) {
            errors.push('Invalid or missing symbol');
        }
        
        if (!transaction.quantity || transaction.quantity <= 0) {
            errors.push('Invalid or missing quantity');
        }
        
        if (!transaction.price || transaction.price <= 0) {
            errors.push('Invalid or missing price');
        }
        
        if (!transaction.date || isNaN(transaction.date.getTime())) {
            errors.push('Invalid or missing date');
        }
        
        if (!['buy', 'sell'].includes(transaction.type)) {
            errors.push('Invalid transaction type (must be buy or sell)');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
}

// Create global instance
window.brokerCSVParser = new BrokerCSVParser();

console.log('✅ Broker CSV Parser loaded');