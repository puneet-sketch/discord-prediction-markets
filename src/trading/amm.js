/**
 * Automated Market Maker using Logarithmic Market Scoring Rule (LMSR).
 *
 * The AMM provides liquidity for every market so there's always a price
 * to trade against, even with zero organic order flow. As volume grows,
 * organic traders provide their own liquidity.
 *
 * LMSR cost function:
 *   C(q) = b * ln(e^(q_yes/b) + e^(q_no/b))
 *
 * Price of YES = e^(q_yes/b) / (e^(q_yes/b) + e^(q_no/b))
 * Price of NO  = 1 - Price of YES
 *
 * b = liquidity parameter (higher = more liquid, less price impact)
 */

class AMM {
  constructor(yesShares = 0, noShares = 0, liquidityParam = 100) {
    this.yesShares = Number(yesShares);
    this.noShares = Number(noShares);
    this.b = Number(liquidityParam);
  }

  /**
   * Current cost function value.
   */
  costFunction(yesQ, noQ) {
    const expYes = Math.exp(yesQ / this.b);
    const expNo = Math.exp(noQ / this.b);
    return this.b * Math.log(expYes + expNo);
  }

  /**
   * Get current YES price in cents (0–100).
   */
  yesPrice() {
    const expYes = Math.exp(this.yesShares / this.b);
    const expNo = Math.exp(this.noShares / this.b);
    return Math.round((expYes / (expYes + expNo)) * 100);
  }

  /**
   * Get current NO price in cents (0–100).
   */
  noPrice() {
    return 100 - this.yesPrice();
  }

  /**
   * Calculate the cost (in cents) to buy `quantity` shares of `side`.
   * Returns { cost, avgPrice, newYesPrice, newNoPrice }
   */
  quoteBuy(side, quantity) {
    const currentCost = this.costFunction(this.yesShares, this.noShares);

    let newYes = this.yesShares;
    let newNo = this.noShares;

    if (side === 'YES') {
      newYes += quantity;
    } else {
      newNo += quantity;
    }

    const newCost = this.costFunction(newYes, newNo);
    const costCents = Math.round((newCost - currentCost) * 100);
    const avgPrice = Math.round(costCents / quantity);

    // Calculate new prices after the trade
    const expYes = Math.exp(newYes / this.b);
    const expNo = Math.exp(newNo / this.b);
    const newYesPrice = Math.round((expYes / (expYes + expNo)) * 100);

    return {
      costCents,
      avgPrice,
      newYesPrice,
      newNoPrice: 100 - newYesPrice,
    };
  }

  /**
   * Calculate the payout (in cents) for selling `quantity` shares of `side`.
   */
  quoteSell(side, quantity) {
    const currentCost = this.costFunction(this.yesShares, this.noShares);

    let newYes = this.yesShares;
    let newNo = this.noShares;

    if (side === 'YES') {
      newYes -= quantity;
    } else {
      newNo -= quantity;
    }

    if (newYes < 0 || newNo < 0) {
      return null; // Can't sell more than exists
    }

    const newCost = this.costFunction(newYes, newNo);
    const payoutCents = Math.round((currentCost - newCost) * 100);
    const avgPrice = Math.round(payoutCents / quantity);

    const expYes = Math.exp(newYes / this.b);
    const expNo = Math.exp(newNo / this.b);
    const newYesPrice = Math.round((expYes / (expYes + expNo)) * 100);

    return {
      payoutCents,
      avgPrice,
      newYesPrice,
      newNoPrice: 100 - newYesPrice,
    };
  }

  /**
   * Execute a buy. Mutates the AMM state. Returns cost in cents.
   */
  executeBuy(side, quantity) {
    const quote = this.quoteBuy(side, quantity);
    if (side === 'YES') {
      this.yesShares += quantity;
    } else {
      this.noShares += quantity;
    }
    return quote;
  }

  /**
   * Execute a sell. Mutates the AMM state. Returns payout in cents.
   */
  executeSell(side, quantity) {
    const quote = this.quoteSell(side, quantity);
    if (!quote) return null;
    if (side === 'YES') {
      this.yesShares -= quantity;
    } else {
      this.noShares -= quantity;
    }
    return quote;
  }

  /**
   * Get the current state for persistence.
   */
  getState() {
    return {
      yesShares: this.yesShares,
      noShares: this.noShares,
      liquidityParam: this.b,
      yesPrice: this.yesPrice(),
      noPrice: this.noPrice(),
    };
  }
}

module.exports = { AMM };
