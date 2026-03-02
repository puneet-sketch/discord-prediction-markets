require('dotenv').config();

module.exports = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
  },
  db: {
    url: process.env.DATABASE_URL,
  },
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    env: process.env.NODE_ENV || 'development',
  },
  trading: {
    defaultSlippageCents: parseInt(process.env.DEFAULT_SLIPPAGE_CENTS, 10) || 2,
    orderTtlSeconds: parseInt(process.env.ORDER_TTL_SECONDS, 10) || 10,
    feeRate: parseFloat(process.env.FEE_RATE) || 0.02,
    platformFeeShare: parseFloat(process.env.PLATFORM_FEE_SHARE) || 0.50,
    serverOwnerFeeShare: parseFloat(process.env.SERVER_OWNER_FEE_SHARE) || 0.30,
    creatorFeeShare: parseFloat(process.env.CREATOR_FEE_SHARE) || 0.20,
  },
  amm: {
    initialLiquidity: parseInt(process.env.AMM_INITIAL_LIQUIDITY, 10) || 1000,
    subsidy: parseInt(process.env.AMM_SUBSIDY, 10) || 100,
  },
};
