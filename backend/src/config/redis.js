const redis  = require('redis');
const logger = require('../utils/logger');

let client;
let pubClient;
let subClient;

const connectRedis = async () => {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';

  client    = redis.createClient({ url });
  pubClient = client.duplicate();
  subClient = client.duplicate();

  client.on('error', (e) => logger.error('Redis error:', e));

  await Promise.all([client.connect(), pubClient.connect(), subClient.connect()]);
  return client;
};

const getRedis    = () => client;
const getPub      = () => pubClient;
const getSub      = () => subClient;

// Shorthand helpers
const cache = {
  get:    (key)        => client.get(key),
  set:    (key, val, ttl=300) => client.setEx(key, ttl, JSON.stringify(val)),
  del:    (key)        => client.del(key),
  exists: (key)        => client.exists(key),
  // Cache-aside pattern
  getOrSet: async (key, fn, ttl=300) => {
    const cached = await client.get(key);
    if (cached) return JSON.parse(cached);
    const fresh = await fn();
    await client.setEx(key, ttl, JSON.stringify(fresh));
    return fresh;
  },
};

module.exports = { connectRedis, getRedis, getPub, getSub, cache };
