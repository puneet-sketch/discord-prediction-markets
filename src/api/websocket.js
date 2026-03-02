const { WebSocketServer } = require('ws');
const engine = require('../trading/engine');

/**
 * WebSocket server for real-time price feeds.
 *
 * Clients subscribe to markets and receive price updates
 * as trades happen. This keeps the Discord embeds and any
 * web clients in sync with minimal latency.
 *
 * Protocol:
 *   Client → Server:
 *     { "type": "subscribe", "marketIds": [1, 2, 3] }
 *     { "type": "unsubscribe", "marketIds": [1] }
 *
 *   Server → Client:
 *     { "type": "price", "marketId": 1, "yesPrice": 62, "noPrice": 38, "ts": ... }
 *     { "type": "trade", "marketId": 1, "side": "YES", "quantity": 5.2, "price": 63, "ts": ... }
 */
class PriceFeedServer {
  constructor() {
    this.wss = null;
    // Map<marketId, Set<ws>>
    this.subscriptions = new Map();
  }

  attach(httpServer) {
    this.wss = new WebSocketServer({ server: httpServer, path: '/ws/prices' });

    this.wss.on('connection', (ws) => {
      ws._subscribedMarkets = new Set();

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw);
          this.handleMessage(ws, msg);
        } catch {
          // Ignore malformed messages
        }
      });

      ws.on('close', () => {
        // Clean up subscriptions
        for (const marketId of ws._subscribedMarkets) {
          const subs = this.subscriptions.get(marketId);
          if (subs) {
            subs.delete(ws);
            if (subs.size === 0) this.subscriptions.delete(marketId);
          }
        }
      });

      // Send hello
      ws.send(JSON.stringify({ type: 'connected', ts: Date.now() }));
    });

    // Listen to trading engine events
    engine.on('priceUpdate', (data) => {
      this.broadcast(data.marketId, {
        type: 'price',
        marketId: data.marketId,
        yesPrice: data.yesPrice,
        noPrice: data.noPrice,
        ts: Date.now(),
      });
    });

    engine.on('trade', ({ trade, market }) => {
      this.broadcast(trade.market_id, {
        type: 'trade',
        marketId: trade.market_id,
        side: trade.side,
        quantity: Number(trade.quantity),
        price: trade.price_cents,
        ts: Date.now(),
      });
    });

    console.log('WebSocket price feed attached at /ws/prices');
  }

  handleMessage(ws, msg) {
    switch (msg.type) {
      case 'subscribe': {
        const ids = Array.isArray(msg.marketIds) ? msg.marketIds : [];
        for (const id of ids) {
          if (!this.subscriptions.has(id)) {
            this.subscriptions.set(id, new Set());
          }
          this.subscriptions.get(id).add(ws);
          ws._subscribedMarkets.add(id);
        }
        ws.send(JSON.stringify({
          type: 'subscribed',
          marketIds: ids,
          ts: Date.now(),
        }));
        break;
      }
      case 'unsubscribe': {
        const ids = Array.isArray(msg.marketIds) ? msg.marketIds : [];
        for (const id of ids) {
          const subs = this.subscriptions.get(id);
          if (subs) {
            subs.delete(ws);
            if (subs.size === 0) this.subscriptions.delete(id);
          }
          ws._subscribedMarkets.delete(id);
        }
        break;
      }
    }
  }

  broadcast(marketId, data) {
    const subs = this.subscriptions.get(marketId);
    if (!subs || subs.size === 0) return;

    const payload = JSON.stringify(data);
    for (const ws of subs) {
      if (ws.readyState === 1) { // OPEN
        ws.send(payload);
      }
    }
  }
}

module.exports = new PriceFeedServer();
