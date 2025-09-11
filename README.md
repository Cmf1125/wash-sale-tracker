# WashSafe - Wash Sale Prevention for Traders

**Stop losing money to wash sale violations!** WashSafe is a proactive trading tool that alerts you BEFORE you trigger IRS wash sale rules, helping you preserve your tax losses and optimize your trading strategy.

## 🚨 The Problem

Current trading platforms (Robinhood, E*TRADE, TD Ameritrade, etc.) only show wash sale violations **after** you've already triggered them. This means:

- ❌ Lost tax deductions you can't recover
- ❌ Unexpected tax surprises at year-end  
- ❌ Compliance headaches and record-keeping nightmares
- ❌ Missed opportunities for tax loss harvesting

## ✅ The Solution

WashSafe gives you **real-time wash sale alerts** before you place trades, so you can:

- ✅ Preserve valuable tax loss deductions
- ✅ Plan your trades strategically around wash sale rules
- ✅ Get "safe-to-buy" dates for each position
- ✅ Track your tax impact throughout the year
- ✅ Export clean records for your accountant

## 🎯 Key Features

### Real-Time Wash Sale Detection
- **Before-trade alerts**: Know if a trade will trigger wash sale rules before you execute
- **30-day violation tracking**: Monitors purchases 30 days before and after sales
- **Visual warnings**: Clear red alerts for violations, green for safe trades

### Smart Portfolio Management
- **Current positions**: View all holdings with average cost basis
- **Safe-to-sell dates**: Know exactly when you can trade without wash sale risk
- **P&L tracking**: Real-time profit/loss on all positions

### Tax Optimization Tools
- **Loss harvesting alerts**: Year-end reminders to capture tax losses
- **Wash sale impact calculator**: See exactly how much a violation will cost you
- **Export functionality**: Clean data for tax preparation

### Complete Transaction History
- **All trades logged**: Every buy/sell with wash sale flagging
- **Searchable history**: Find specific trades and patterns
- **Tax reporting ready**: Organized data for Schedule D

## 🚀 How It Works

### 1. Enter Your Trade
```
Symbol: AAPL
Type: Sell
Shares: 100
Price: $150.00
Date: Today
```

### 2. Get Instant Analysis
```
🚨 WASH SALE DETECTED!
You purchased AAPL on Oct 15th (within 30 days).
Loss of $500 will be disallowed for tax purposes.
```

### 3. Make Informed Decisions
- **Proceed anyway** (sometimes worth it)
- **Wait until safe date** (preserve tax loss)
- **Sell different shares** (FIFO vs. specific identification)

## 📊 Use Cases

### Day Traders
- Track wash sales across hundreds of trades
- Maintain tax loss deductions on frequent trades
- Plan re-entry strategies around 30-day windows

### Swing Traders  
- Optimize tax loss harvesting at year-end
- Plan position exits around wash sale rules
- Maintain detailed records for complex strategies

### Buy-and-Hold Investors
- Strategic rebalancing without tax penalties
- Optimize tax loss harvesting opportunities
- Clean record-keeping for tax preparation

## 🔧 Technical Features

- **Pure JavaScript**: No server required, runs entirely in your browser
- **Local Storage**: Your data stays private on your device
- **Export/Import**: Backup and restore your trading history
- **Mobile Responsive**: Works on phone, tablet, and desktop
- **No API Keys**: Manual entry keeps your broker data secure

## 📱 Getting Started

1. **Open `index.html`** in any modern web browser
2. **Add your first trade** using the "New Trade" tab
3. **Watch the real-time analysis** as you type
4. **Review your portfolio** and safe-to-sell dates
5. **Export your data** for tax preparation

## 🧮 Wash Sale Rules (IRS)

The IRS wash sale rule (Section 1091) states:

> If you sell stock at a loss and buy substantially identical stock within 30 days before or after the sale, the loss is disallowed for tax purposes.

**Key Points:**
- **30-day window**: 30 days before AND after the sale date (61 days total)
- **Substantially identical**: Same stock, options on same stock, similar securities
- **Loss disallowed**: Can't claim the tax deduction
- **Basis adjustment**: Lost amount gets added to cost basis of new shares

**Example:**
```
Oct 1:  Buy 100 AAPL at $200 = $20,000
Oct 15: Sell 100 AAPL at $150 = $15,000 (Loss: $5,000)
Oct 20: Buy 100 AAPL at $160 = $16,000

Result: $5,000 loss is disallowed, new cost basis = $21,000
```

## 📈 Roadmap

### Phase 1 (Current)
- [x] Core wash sale detection
- [x] Real-time trade alerts  
- [x] Portfolio tracking
- [x] Transaction history
- [x] Data export

### Phase 2 (Planned)
- [ ] Broker API integration (Alpaca, TD Ameritrade)
- [ ] Options wash sale detection
- [ ] Advanced tax strategies (FIFO, LIFO, Specific ID)
- [ ] Multi-account consolidation
- [ ] Professional tax reports

### Phase 3 (Future)
- [ ] Mobile app (iOS/Android)
- [ ] Real-time stock price integration
- [ ] Tax loss harvesting automation
- [ ] CPA collaboration features
- [ ] Enterprise/team accounts

## 🤝 Contributing

This is an open-source project! Contributions welcome:

1. **Bug reports**: Found an issue? Open an issue
2. **Feature requests**: Have ideas? We'd love to hear them
3. **Code contributions**: Pull requests welcome
4. **Documentation**: Help improve these docs

## ⚠️ Legal Disclaimer

WashSafe is a tool to help track and analyze wash sale rules. It is not:
- Tax advice (consult a CPA)
- Financial advice (consult a financial advisor)  
- Legal advice (consult an attorney)
- A substitute for professional tax preparation

Always verify wash sale calculations with a qualified tax professional.

## 📄 License

MIT License - Use freely for personal and commercial projects.

---

**Built by traders, for traders.** 📈

Stop losing money to wash sale violations. Start using WashSafe today!