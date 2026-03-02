# Discord Prediction Markets — Product & Technical Spec

## The Pitch (30-second version)

Discord has 200M+ monthly active users in communities obsessed with stocks, crypto,
sports, esports, and politics. They're already making predictions in chat — every day.
We let them **put money behind those predictions**, natively inside Discord, and Discord
takes a cut of every trade. This isn't affiliate revenue that depends on users leaving
the platform — this is **transactional revenue that keeps users inside Discord longer**.

---

## 1. Why Discord? Why Now?

### The Behavior Already Exists
```
#stocks-chat (typical Discord server)

@trader_mike: NVDA is hitting $180 by Friday, calling it now
@bearish_ben:  No way, earnings will disappoint
@trader_mike: Bet?
@bearish_ben:  Bet.
```

This conversation happens thousands of times per day across Discord.
Right now, it's just talk. We turn talk into **trades**.

### Platform Fit
- Discord already has **rich embeds, buttons, modals, and bot infrastructure**
- Users are authenticated, verified, and have payment methods on file
- Server communities self-organize around prediction-heavy topics
- Discord's interaction model (buttons, dropdowns, modals) maps perfectly to trading UX

### Revenue Comparison: Affiliate vs. Prediction Markets

| Metric                  | Affiliate Model         | Prediction Markets           |
|-------------------------|-------------------------|------------------------------|
| Revenue per user action | $0.50–$2.00 (one-time) | $0.05–$0.50 per trade (recurring) |
| User leaves platform?   | Yes (redirect)          | No (native)                  |
| Engagement loop         | None                    | Strong (check positions)     |
| Server owner incentive  | Weak                    | Strong (rev share per trade) |
| DAU impact              | Negative (sends away)   | Positive (reasons to return) |
| LTV multiplier          | 1x                     | 10-50x (repeat trading)      |

---

## 2. Core Use Cases by Community Type

### A. Finance / Stocks Servers
> "Will TSLA close above $250 today?"
- Intraday price markets, earnings beat/miss, IPO day performance
- Feeds from market data → auto-generated events

### B. Crypto / DeFi Servers
> "Will BTC break $100K this week?"
- Price milestones, protocol launches, ETF approvals
- Familiar UX for an audience already comfortable with trading

### C. Sports / Esports Servers
> "Will T1 win Worlds 2026?"
- Match outcomes, player stats, tournament brackets
- Esports is Discord's home turf — massive competitive advantage

### D. Politics / News Servers
> "Will the infrastructure bill pass the Senate?"
- Election markets, policy outcomes, geopolitical events
- Already proven by Polymarket, PredictIt, Kalshi

### E. Creator / Community Servers
> "Will MrBeast hit 300M subscribers by June?"
- Creator milestones, video performance, community challenges
- Server owners CREATE the markets — deep engagement

---

## 3. UX Flow — Complete Walkthrough

### 3.1 Event Card in Channel

The entry point. A rich embed appears in any channel — posted by a bot,
triggered by a slash command, or auto-generated from a data feed.

```
┌─────────────────────────────────────────────────────────┐
│  📊 PREDICTION MARKET                    ⚡ LIVE        │
│─────────────────────────────────────────────────────────│
│                                                         │
│  Will NVDA close above $180 today?                      │
│                                                         │
│  ┌─────────────────────────────────────────────┐        │
│  │  $175 ──── $178.42 ─────────────── $185     │        │
│  │            ▲ current     target ──▶ $180     │        │
│  │  ░░░░░░░░░░░░░░░░████████████████           │        │
│  └─────────────────────────────────────────────┘        │
│                                                         │
│  ┌──────────────────┐   ┌──────────────────────┐        │
│  │  🟢 YES    62¢   │   │  🔴 NO      38¢      │        │
│  │  +3¢ ↑           │   │  -3¢ ↓               │        │
│  └──────────────────┘   └──────────────────────┘        │
│                                                         │
│  💰 Volume: $12,450    👥 342 traders                    │
│  ⏰ Closes: Today 4:00 PM ET                            │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌───────────────────┐       │
│  │ 📈 Chart │ │ 💬 12    │ │ 📋 My Position    │       │
│  └──────────┘ └──────────┘ └───────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- Price shown in cents (0–100¢) = probability (0–100%) — intuitive
- YES/NO buttons are large, colored, immediately tappable
- Price movement indicators (+3¢ ↑) create urgency
- Volume + trader count = social proof
- Mini price bar shows where current price sits relative to target

---

### 3.2 User Taps "YES" → Trade Bottom Sheet Opens

This is a **Discord modal** (or for richer UX, a pop-out panel like
the new Activities feature). The bottom sheet pattern works on both
desktop and mobile.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ── Trade: NVDA above $180 today ──                     │
│                                                         │
│  You're buying:  🟢 YES                                 │
│                                                         │
│  ┌─────────────────────────────────────────────┐        │
│  │  Price per share          62¢                │        │
│  │  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  │        │
│  │                                              │        │
│  │  Amount                                      │        │
│  │  ┌──────────────────────────────────────┐    │        │
│  │  │  $10.00                            ▼ │    │        │
│  │  └──────────────────────────────────────┘    │        │
│  │  ┌─────┐ ┌─────┐ ┌──────┐ ┌──────────┐     │        │
│  │  │ $5  │ │ $10 │ │ $25  │ │ $50      │     │        │
│  │  └─────┘ └─────┘ └──────┘ └──────────┘     │        │
│  │                                              │        │
│  │  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  │        │
│  │                                              │        │
│  │  Shares you get         16.1 shares          │        │
│  │  Potential payout       $16.10               │        │
│  │  Potential profit       $6.10 (+61%)         │        │
│  │                                              │        │
│  │  ⚙️ Max slippage: 2¢  (price can move to    │        │
│  │     64¢ max before order is rejected)        │        │
│  │                                              │        │
│  └─────────────────────────────────────────────┘        │
│                                                         │
│  ┌─────────────────────────────────────────────┐        │
│  │         🟢 PLACE ORDER — Buy YES at 62¢      │        │
│  │             Potential profit: $6.10           │        │
│  └─────────────────────────────────────────────┘        │
│                                                         │
│  🔒 Protected by 2¢ slippage limit                      │
│  ℹ️  Shares pay $1.00 each if YES wins                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- Quick-select dollar amounts (reduce friction, fits mobile)
- Profit shown prominently in dollars AND percentage
- Slippage control is visible but not overwhelming (default 2¢)
- "Shares pay $1.00 each if YES wins" — the one line that makes the model click
- Green CTA with profit amount — drives action

---

### 3.3 Auth Gate (only if not logged in)

If the user hasn't authenticated with the prediction market platform,
we intercept BEFORE the order is placed.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ── Connect Your Account ──                             │
│                                                         │
│  To trade on prediction markets, connect or create      │
│  your account. This is a one-time setup.                │
│                                                         │
│  ┌─────────────────────────────────────────────┐        │
│  │  🔗 Continue with Discord                    │        │
│  │     (Uses your Discord identity — fastest)   │        │
│  └─────────────────────────────────────────────┘        │
│                                                         │
│  ┌─────────────────────────────────────────────┐        │
│  │  📧 Sign in with Email                       │        │
│  └─────────────────────────────────────────────┘        │
│                                                         │
│  ┌─────────────────────────────────────────────┐        │
│  │  🏦 Connect Existing Account                 │        │
│  │     (Kalshi, Polymarket, etc.)               │        │
│  └─────────────────────────────────────────────┘        │
│                                                         │
│  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈        │
│                                                         │
│  Your pending order will be held for 5 minutes:         │
│  🟢 YES NVDA>$180 │ 16.1 shares @ 62¢ │ $10.00        │
│                                                         │
│  ⏱️ 4:52 remaining                                      │
│                                                         │
│  🔒 KYC verification may be required for withdrawals    │
│  📜 Licensed & regulated · Funds held in trust          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- "Continue with Discord" is the hero option (OAuth2 — one click)
- Pending order is HELD with a countdown — user doesn't lose context
- Price at time of intent is locked for the hold period
- Trust signals at the bottom (regulated, funds in trust)
- KYC is mentioned but not blocking — allow trading up to a threshold first

---

### 3.4 Order Confirmation

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│               ✅ Order Placed!                           │
│                                                         │
│  ┌─────────────────────────────────────────────┐        │
│  │                                              │        │
│  │  NVDA above $180 today                       │        │
│  │                                              │        │
│  │  Side:           🟢 YES                      │        │
│  │  Shares:         16.1                        │        │
│  │  Avg price:      62¢                         │        │
│  │  Total cost:     $10.00                      │        │
│  │  Potential win:  $16.10 (+$6.10)             │        │
│  │                                              │        │
│  │  Status:  ● Filled                           │        │
│  │  Fill price: 62¢ (within your 2¢ limit)      │        │
│  │                                              │        │
│  └─────────────────────────────────────────────┘        │
│                                                         │
│  ┌────────────────┐  ┌────────────────────────┐         │
│  │ 📊 View Chart  │  │ 📢 Share in Chat       │         │
│  └────────────────┘  └────────────────────────┘         │
│                                                         │
│  ┌─────────────────────────────────────────────┐        │
│  │ 💼 View Portfolio (3 active positions)       │        │
│  └─────────────────────────────────────────────┘        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**"Share in Chat" posts this embed:**

```
┌─────────────────────────────────────────────────────────┐
│  @trader_mike just bought YES on:                       │
│  "Will NVDA close above $180 today?" at 62¢             │
│                                                         │
│  ┌──────────────────┐   ┌──────────────────────┐        │
│  │  🟢 YES    63¢   │   │  🔴 NO      37¢      │        │
│  └──────────────────┘   └──────────────────────┘        │
│                                                         │
│  💰 Volume: $12,460    👥 343 traders                    │
└─────────────────────────────────────────────────────────┘
```

This is the **viral loop** — every trade becomes a new event card in chat.

---

### 3.5 Portfolio View (Persistent Panel / Slash Command)

```
/predictions portfolio

┌─────────────────────────────────────────────────────────┐
│  💼 Your Prediction Portfolio                            │
│─────────────────────────────────────────────────────────│
│                                                         │
│  Balance: $142.50       P&L Today: +$8.30 (+6.2%)      │
│                                                         │
│  ── Active Positions ───────────────────────────────    │
│                                                         │
│  🟢 NVDA > $180 today              16.1 shares @ 62¢   │
│     Current: 68¢  │  P&L: +$0.97 (+9.7%)  │  ⏰ 3h     │
│     ├─ 🟩🟩🟩🟩🟩🟩🟩🟩░░ │  [Cash Out $10.95]        │
│                                                         │
│  🔴 BTC < $95K this week            5.0 shares @ 41¢   │
│     Current: 38¢  │  P&L: -$0.15 (-7.3%)  │  ⏰ 4d     │
│     ├─ 🟥🟥🟥🟥░░░░░░ │  [Cash Out $1.90]             │
│                                                         │
│  🟢 T1 wins Worlds 2026            25.0 shares @ 33¢   │
│     Current: 40¢  │  P&L: +$1.75 (+21%)   │  ⏰ 48d    │
│     ├─ 🟩🟩🟩🟩🟩🟩🟩░░░ │  [Cash Out $10.00]         │
│                                                         │
│  ── Resolved Today ─────────────────────────────────    │
│                                                         │
│  ✅ AAPL earnings beat  │ WON  │ +$4.20                  │
│  ❌ ETH > $4K today     │ LOST │ -$3.00                  │
│                                                         │
│  ┌────────────────┐  ┌──────────┐  ┌───────────┐       │
│  │ 📊 History     │  │ 💳 Fund  │  │ 💸 Cash Out│       │
│  └────────────────┘  └──────────┘  └───────────┘       │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Handling Latency & Price Movements

This is the most critical technical section. Prediction markets have
thin liquidity compared to stock markets. A 200ms delay can mean the
price moved 5¢. Here's the complete strategy:

### 4.1 The Problem

```
Timeline of a typical order without protection:

T+0ms     User sees price: 62¢
T+50ms    User clicks "Place Order"
T+100ms   Request hits Discord gateway
T+150ms   Gateway forwards to prediction market API
T+200ms   API receives order
T+250ms   Orderbook match attempted
          ❌ Price is now 67¢ — order fails or fills at bad price
          😡 User is confused and angry
```

### 4.2 The Solution: Multi-Layer Price Protection

#### Layer 1: Optimistic Price Lock (Client-Side)

When user opens the trade sheet, we establish a **WebSocket connection**
to the market's price feed. The displayed price updates in real-time.

```
┌─────────────────────────────────────────────┐
│  Price per share     62¢   ● LIVE           │
│                      ▲ updates every 100ms  │
└─────────────────────────────────────────────┘
```

When the user clicks "Place Order":
1. Capture the **exact price at click time** (not the price when sheet opened)
2. Send this as the `limit_price` in the order

#### Layer 2: Slippage Tolerance (User-Configurable)

Every order includes a **max slippage** parameter:

```
Order payload:
{
  "market_id":    "nvda-above-180-2026-03-02",
  "side":         "YES",
  "limit_price":  62,           // cents — price user saw
  "slippage":     2,            // cents — max acceptable deviation
  "max_price":    64,           // = limit_price + slippage
  "quantity":     16.1,         // shares
  "cost":         1000,         // cents ($10.00)
  "type":         "LIMIT_WITH_SLIPPAGE",
  "ttl_seconds":  10            // order expires in 10s
}
```

**Matching engine behavior:**
- If best available price is 62¢ or better → fill at best price
- If best available price is 63¢ → fill at 63¢ (within tolerance)
- If best available price is 65¢ → **REJECT** (exceeds slippage)
- If order isn't filled in 10s → **EXPIRE** (TTL protection)

#### Layer 3: Smart Slippage Defaults

Don't make users think about slippage. Set intelligent defaults:

```
Market Liquidity Tier    Default Slippage    Rationale
─────────────────────    ────────────────    ──────────────────
High (>$50K volume)      1¢                  Tight spread, stable
Medium ($5K–$50K)        2¢                  Some movement expected
Low (<$5K volume)        3¢                  Thin book, wider fills
Very Low (<$500)         5¢ + warning        "Low liquidity" badge

Shown to user:
┌─────────────────────────────────────────────┐
│  ⚙️ Price protection: ±2¢                   │
│  Your order fills between 60¢ – 64¢         │
│  or is automatically cancelled              │
│  [Adjust]                                   │
└─────────────────────────────────────────────┘
```

#### Layer 4: Partial Fill Handling

```
Scenario: User wants 16.1 shares. Only 10 available at ≤64¢.

Option A — Fill-or-Kill (default for small orders <$25):
  → Cancel entire order, show: "Market moved. Retry at 67¢?"

Option B — Partial Fill (default for larger orders ≥$25):
  → Fill 10 shares at 62¢, return remaining $3.78
  → Show: "Partially filled: 10/16.1 shares at 62¢.
           Remaining $3.78 returned to balance."

The user selects preference in settings. Default is Fill-or-Kill
because partial fills confuse new users.
```

#### Layer 5: Order Retry UX (When Price Moves Beyond Slippage)

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ⚠️  Price moved beyond your limit                      │
│                                                         │
│  You tried to buy at 62¢ (max 64¢)                     │
│  Current price: 67¢                                     │
│                                                         │
│  ┌─────────────────────────────────────────────┐        │
│  │ 🔄 Retry at 67¢                              │        │
│  │    New potential profit: $4.95 (+49.5%)      │        │
│  └─────────────────────────────────────────────┘        │
│                                                         │
│  ┌─────────────────────────────────────────────┐        │
│  │ 🔔 Set Price Alert (notify me at 62¢)        │        │
│  └─────────────────────────────────────────────┘        │
│                                                         │
│  ┌─────────────────────────────────────────────┐        │
│  │ ✕ Cancel                                     │        │
│  └─────────────────────────────────────────────┘        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key:** The retry button recalculates profit at the new price instantly.
The price alert option prevents rage-buying at a bad price.

#### Layer 6: Architecture for Speed

```
┌──────────────┐     WebSocket      ┌──────────────────┐
│              │◄───────────────────►│                  │
│   Discord    │     (price feed)    │  Prediction Mkt  │
│   Client     │                     │  Price Engine    │
│              │─────── REST ───────►│                  │
│              │   (order submit)    │  Order Matching  │
└──────────────┘                     └──────────────────┘
       │                                      │
       │              ┌───────────┐           │
       └──────────────│ Edge CDN  │───────────┘
                      │ (regional │
                      │  caching) │
                      └───────────┘

Latency budget:
  Client → Discord Gateway:     ~20ms (WebSocket already open)
  Discord Gateway → Edge:       ~10ms (regional routing)
  Edge → Matching Engine:       ~5ms  (colocated)
  Matching Engine execution:    ~2ms  (in-memory orderbook)
  Response back:                ~15ms
  ─────────────────────────────────────
  Total round-trip:             ~52ms  ✅ (fast enough)

Compare:
  Robinhood average:            ~200-400ms
  Polymarket:                   ~500-2000ms (blockchain)
```

**Why this is fast enough:** Prediction markets don't need microsecond
HFT latency. Price moves in cents, not fractions. A 52ms round-trip
means the price is unlikely to move more than 1¢ during the order.

#### Layer 7: Stale Price Detection

If the client hasn't received a price update in >2 seconds:

```
┌─────────────────────────────────────────────┐
│  Price per share     62¢   ⚠️ DELAYED       │
│  Last update: 3s ago                        │
│  [Trading paused — reconnecting...]         │
└─────────────────────────────────────────────┘
```

Never let a user submit an order on a stale price. This prevents
the most common source of bad fills.

---

## 5. Server Owner Experience (The Revenue Story)

This is what makes Discord say yes. Server owners become **distribution partners**.

### 5.1 Server Dashboard

```
/predictions admin

┌─────────────────────────────────────────────────────────┐
│  📊 Prediction Markets — Server Dashboard               │
│  Server: Wall Street Degens (45,000 members)            │
│─────────────────────────────────────────────────────────│
│                                                         │
│  This Month's Revenue                                   │
│  ┌─────────────────────────────────────────────┐        │
│  │                                              │        │
│  │  Your Share (30%):         $2,847.00         │        │
│  │  Total Trading Volume:     $284,700          │        │
│  │  Active Traders:           1,204             │        │
│  │  Markets Created:          47                │        │
│  │                                              │        │
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░ 67% of month│        │
│  │  Projected:                $4,250            │        │
│  │                                              │        │
│  └─────────────────────────────────────────────┘        │
│                                                         │
│  Top Markets This Week                                  │
│  1. NVDA earnings beat?     $18,200 vol   580 traders   │
│  2. BTC > $100K?            $14,800 vol   430 traders   │
│  3. Fed rate cut March?     $9,100 vol    290 traders   │
│                                                         │
│  ┌──────────────┐ ┌───────────────┐ ┌───────────────┐  │
│  │ + New Market │ │ Auto-Markets  │ │ Payout Setup  │  │
│  └──────────────┘ └───────────────┘ └───────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Revenue Split Model

```
On every trade, a 2% fee is charged on the payout amount:

Example: User buys 16.1 YES shares at 62¢ = $10.00

  If YES wins → payout is $16.10
  Fee: 2% × $16.10 = $0.32

  Split:
  ├── Discord Platform:     $0.16 (50%)
  ├── Server Owner:         $0.10 (30%)
  └── Market Creator*:      $0.06 (20%)

  * If the server auto-generated the market, server gets 50%

For a server with $284K monthly volume:
  Total fees:           ~$5,690
  Server owner gets:    ~$2,847/month
  Discord gets:         ~$2,847/month   (at 50% if auto-generated)
```

### 5.3 Why Server Owners Will Love This

```
Current Discord monetization for server owners:
  - Server subscriptions:    Hard to sell, low conversion
  - Sponsored posts:         Annoys members, low CPM
  - Affiliate links:         Pennies, sends users away

With prediction markets:
  - Passive income:          Markets auto-generate, trades happen
  - Member engagement:       +40% DAU (users check positions)
  - Content creation:        Markets ARE the content
  - Competitive moat:        "Our server has the best markets"
```

---

## 6. Slash Commands & Bot Integration

### User Commands

```
/predict browse                     → Browse active markets
/predict search [query]             → Search markets
/predict create [question] [date]   → Create a new market
/predict portfolio                  → View your positions
/predict leaderboard                → Server trading leaderboard
/predict alerts                     → Manage price alerts
/predict history                    → Trade history
/predict cashout [market]           → Sell a position early
```

### Admin Commands

```
/predict admin dashboard            → Revenue & analytics
/predict admin create [question]    → Create market (pinned)
/predict admin automarket [feed]    → Configure auto-markets
/predict admin moderate             → Flag/resolve markets
/predict admin settings             → Fee split, limits, channels
```

### Auto-Market Feeds

Server admins can enable automatic market generation:

```
/predict admin automarket

┌─────────────────────────────────────────────────────────┐
│  🤖 Auto-Market Feeds                                   │
│                                                         │
│  ☑️  US Stock Earnings     (markets before each report)  │
│  ☑️  Crypto Price Targets  (daily BTC/ETH milestones)   │
│  ☐  NFL Game Outcomes     (weekly matchup markets)      │
│  ☐  Esports Tournaments   (per-match markets)           │
│  ☑️  Fed & Macro Events    (rate decisions, CPI, jobs)   │
│  ☐  Custom RSS Feed       (create markets from any feed)│
│                                                         │
│  Post to channel: #prediction-markets                   │
│  Auto-close markets: 30 min before event                │
│                                                         │
│  [Save Configuration]                                   │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Leaderboard & Social Features (Retention Engine)

### Server Leaderboard

```
/predict leaderboard

┌─────────────────────────────────────────────────────────┐
│  🏆 Prediction Leaderboard — Wall Street Degens         │
│  March 2026                                             │
│─────────────────────────────────────────────────────────│
│                                                         │
│  #   Trader           P&L       Win Rate   Trades      │
│  ─────────────────────────────────────────────────      │
│  🥇  @prophit_pete    +$342     71%        48          │
│  🥈  @market_maven    +$287     68%        62          │
│  🥉  @lucky_lucy      +$198     74%        29          │
│  4.  @bull_run_bob     +$156     59%        81          │
│  5.  @crystal_ball     +$134     65%        37          │
│  ...                                                    │
│  47. @you ★            +$8.30    60%        5           │
│                                                         │
│  Badges earned this month:                              │
│  🎯 Sharpshooter (5 wins in a row)                     │
│  🐋 Whale Trade (single trade > $100)                   │
│  📈 Early Bird (traded within 1 min of market open)     │
│                                                         │
│  ┌──────────────┐ ┌────────────────────┐                │
│  │ All Time     │ │ Share Leaderboard  │                │
│  └──────────────┘ └────────────────────┘                │
└─────────────────────────────────────────────────────────┘
```

### Social Trading Actions

```
When you trade, you can optionally share:

┌─────────────────────────────────────────────────────────┐
│  @trader_mike bought 🟢 YES on                          │
│  "Will NVDA close above $180 today?" at 62¢             │
│                                                         │
│  "Earnings call crushed it, this is easy money" 💬      │
│                                                         │
│  ┌──────────────────┐   ┌──────────────────────┐        │
│  │  🟢 YES    63¢   │   │  🔴 NO      37¢      │        │
│  └──────────────────┘   └──────────────────────┘        │
│                                                         │
│  👍 12  👎 3  │  💬 "Bold call" — @bearish_ben           │
└─────────────────────────────────────────────────────────┘
```

Each shared trade is itself a tradeable event card — **virality baked into the product**.

---

## 8. Technical Architecture

### 8.1 System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       DISCORD LAYER                         │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ Bot API  │  │ Interactions │  │ Activities/Embedded   │  │
│  │ (embeds) │  │ (buttons,    │  │ App (rich trade UI)   │  │
│  │          │  │  modals)     │  │                       │  │
│  └────┬─────┘  └──────┬───────┘  └───────────┬───────────┘  │
│       │               │                      │              │
└───────┼───────────────┼──────────────────────┼──────────────┘
        │               │                      │
        ▼               ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    INTEGRATION LAYER                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              API Gateway (rate limiting,              │   │
│  │              auth, request routing)                   │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                    │
│  ┌──────────┐  ┌───────┴──────┐  ┌────────────────────┐    │
│  │ Auth     │  │ Market       │  │ Price Feed          │    │
│  │ Service  │  │ Service      │  │ Service (WebSocket) │    │
│  │ (OAuth2, │  │ (CRUD,       │  │                     │    │
│  │  KYC)    │  │  resolution) │  │                     │    │
│  └──────────┘  └──────────────┘  └────────────────────┘    │
│                                                              │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    TRADING ENGINE                             │
│  ┌──────────────┐  ┌─────────────┐  ┌───────────────────┐  │
│  │ Order        │  │ Matching    │  │ Settlement        │  │
│  │ Validation   │  │ Engine      │  │ Engine            │  │
│  │ (slippage,   │  │ (in-memory  │  │ (payout on        │  │
│  │  limits,     │  │  orderbook, │  │  resolution,      │  │
│  │  balance)    │  │  FIFO)      │  │  fund transfers)  │  │
│  └──────────────┘  └─────────────┘  └───────────────────┘  │
│                                                              │
│  ┌──────────────┐  ┌─────────────┐  ┌───────────────────┐  │
│  │ Risk         │  │ Position    │  │ Market Data       │  │
│  │ Engine       │  │ Tracker     │  │ Feed (prices,     │  │
│  │ (exposure    │  │ (P&L,       │  │  volume, depth)   │  │
│  │  limits)     │  │  portfolio) │  │                   │  │
│  └──────────────┘  └─────────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATA / INFRA LAYER                         │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │ PostgreSQL │  │ Redis       │  │ Event Stream         │ │
│  │ (markets,  │  │ (sessions,  │  │ (Kafka — trade       │ │
│  │  orders,   │  │  cache,     │  │  events, audit log,  │ │
│  │  users)    │  │  rate limit)│  │  analytics)          │ │
│  └────────────┘  └─────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Order Lifecycle (State Machine)

```
                    ┌──────────┐
                    │ CREATED  │
                    └────┬─────┘
                         │ validate (balance, limits, slippage)
                         ▼
                    ┌──────────┐
              ┌─────│VALIDATED │─────┐
              │     └────┬─────┘     │
              │          │           │ validation failed
              │          │           ▼
              │          │     ┌──────────┐
              │          │     │ REJECTED │
              │          │     └──────────┘
              │          │ submit to matching engine
              │          ▼
              │    ┌───────────┐
              │    │ SUBMITTED │
              │    └─────┬─────┘
              │          │
              ▼          │ match attempt
        ┌──────────┐     │
        │ EXPIRED  │◄────┼──── TTL exceeded
        └──────────┘     │
                         ├───────────────┐
                         │               │
                         ▼               ▼
                   ┌──────────┐   ┌──────────────┐
                   │  FILLED  │   │ PARTIAL_FILL │
                   └────┬─────┘   └──────┬───────┘
                        │                │
                        │                │ remaining auto-cancelled
                        ▼                ▼
                   ┌───────────────────────┐
                   │       SETTLED        │
                   │ (position created,    │
                   │  balance updated)     │
                   └───────────────────────┘
```

### 8.3 Critical Path Optimization

```
What we optimize for: TIME FROM CLICK TO FILL

Step                          Target     How
──────────────────────────    ──────     ──────────────────────
1. Button click → request     <20ms     Discord Interaction (instant)
2. Auth check                 <5ms      JWT validation (no DB call)
3. Balance check              <5ms      Redis cached balance
4. Order validation           <3ms      In-memory rules
5. Network to matching eng    <10ms     Regional edge deployment
6. Orderbook match            <2ms      In-memory FIFO matching
7. Response to client         <15ms     Same path back
──────────────────────────    ──────
TOTAL                         <60ms     ✅
```

---

## 9. Regulatory & Compliance Framework

```
Requirement                  Solution
─────────────────────        ──────────────────────────────────
Licensed exchange            Partner with Kalshi (CFTC-regulated)
                             or operate under existing license

KYC/AML                      Tiered:
                             - Tier 0: Browse, no trading
                             - Tier 1: Discord OAuth → trade up to $100/week
                             - Tier 2: ID verification → trade up to $5K/week
                             - Tier 3: Full KYC → unlimited

Age verification             Discord age gate + exchange KYC
                             (21+ for real-money US markets)

Geo restrictions             Server-side geo-fence by jurisdiction
                             Some markets unavailable in certain states

Fund custody                 Exchange partner holds funds in trust
                             Discord never touches user funds

Responsible trading          Daily loss limits, cool-off periods,
                             self-exclusion option, no leverage
```

---

## 10. Rollout Strategy

### Phase 1: Closed Beta (Month 1–2)
- 10 hand-picked finance Discord servers (>10K members each)
- Pre-built stock & crypto markets only
- $50/week trading limit
- Gather UX feedback, measure engagement lift

### Phase 2: Open Beta (Month 3–4)
- Any server can enable prediction markets
- Add sports & esports markets
- Server owner dashboard + revenue sharing
- Raise limits to $500/week with KYC

### Phase 3: General Availability (Month 5–6)
- Auto-market feeds for major event categories
- Custom market creation by community members
- Full portfolio experience
- Leaderboards, badges, social features
- Mobile-optimized trade sheets

### Phase 4: Platform (Month 7+)
- API for third-party market makers
- Cross-server markets (global liquidity pools)
- Creator markets (YouTubers, streamers create markets)
- Prediction market "Activities" (Discord's embedded app format)

---

## 11. Key Metrics for the Pitch

### What to measure:

```
Engagement:
  - DAU lift in servers with markets enabled (target: +25%)
  - Average session length increase (target: +15 min)
  - Return rate (target: 70% of traders return within 48h)

Revenue:
  - Average revenue per trading user per month (target: $4–8)
  - Server owner monthly payout (target: $500+ for 10K+ servers)
  - Platform take rate (target: 1% of volume)

Growth:
  - Viral coefficient (trades shared → new traders, target: 0.3)
  - Server-to-server spread (target: 20% of eligible servers in Y1)
  - New Discord signups attributed to markets
```

---

## 12. Why This Beats the Affiliate Model

```
                    AFFILIATE              PREDICTION MARKETS
                    ─────────              ──────────────────
User experience     "Click this link"      "What do you think?"
                    (transactional)        (engaging)

Revenue trigger     One-time click         Every trade, forever

User retention      Sends users AWAY       Keeps users IN Discord

Server owner $      ~$100/mo (big server)  ~$2,000+/mo (big server)

Discord's cut       $0 (server keeps it)   50% of fees ($2,000+/mo
                                           per big server)

Network effects     None                   More traders = better
                                           prices = more traders

Content generated   None                   Every market + trade is
                                           content in the channel

Competitive moat    Any platform can do    Deep Discord integration
                    affiliate links        that's hard to replicate
```

---

## 13. One-Pager for the Business Head

**Discord Prediction Markets** transforms passive chat speculation into
active, monetized prediction trading — without users ever leaving Discord.

**The opportunity:** 200M+ MAU, millions already discussing predictions
daily. We capture trading intent that currently leaves the platform.

**Revenue model:** 2% fee on winning payouts, split between Discord (50%)
and server owners (30-50%). A 10K-member finance server generates ~$2,800/mo
for the owner and ~$2,800/mo for Discord.

**Engagement lift:** Prediction markets create a reason to come back every
day (check positions), engage with content (every trade is shareable), and
stay longer (portfolio management, leaderboards).

**Risk management:** Partner with a CFTC-regulated exchange (Kalshi).
Discord never touches funds. Tiered KYC. Daily loss limits. Self-exclusion.

**Competitive advantage:** No other messaging platform has prediction
markets. This can't be easily replicated by Slack, Telegram, or others
because it requires Discord's rich interaction model + bot ecosystem +
massive community infrastructure.

**Ask:** Engineering resources for a 3-month closed beta, partnership
discussions with one regulated exchange, and legal review for launch markets.

---

## Appendix A: Edge Cases & How We Handle Them

### A.1 What if a market resolves ambiguously?
→ Markets have pre-defined resolution sources (e.g., "per Yahoo Finance
closing price"). If ambiguous, designated resolvers (exchange + community
moderators) vote. Disputed markets can be voided (all funds returned).

### A.2 What if someone manipulates a low-liquidity market?
→ Position limits per user per market (max 10% of total volume).
→ Suspicious trading detection (rapid buy-sell, wash trading).
→ Minimum liquidity threshold before a market goes live.

### A.3 What about market-making? Who provides liquidity?
→ Initial liquidity seeded by automated market maker (AMM) using
logarithmic market scoring rule (LMSR) — same model as Polymarket.
→ As volume grows, organic order flow replaces AMM.
→ Server owners can stake liquidity for additional revenue.

### A.4 What if Discord goes down?
→ All orders and positions live on the exchange partner's infrastructure.
→ Users can access their portfolio via the exchange's website.
→ Discord is the interface layer, not the settlement layer.

### A.5 What about taxes?
→ Exchange partner issues 1099s for US users (same as any trading platform).
→ Trade history exportable as CSV for tax reporting.
→ Integration with tax software (e.g., CoinTracker) in Phase 3.

### A.6 What about underage users?
→ Age verification at account creation (exchange-level KYC).
→ Markets only visible in channels marked as 18+ (or 21+ for real-money).
→ Play-money mode available for all ages (no real funds, leaderboard only).
```
