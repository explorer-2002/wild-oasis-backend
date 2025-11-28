import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();
// Create client but don't connect yet

const client = createClient({
    username: 'default',
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        tls: false,
        defaultTTL: 3600
    }
});

// Event listeners
client.on('error', err => {
    console.error('❌ Redis Client Error:', err);
    console.log(process.env.REDIS_HOST);
console.log(process.env.REDIS_PORT);
});

client.on('connect', () => {
    console.log('✅ Redis connected successfully');
});

client.on('ready', () => {
    console.log('✅ Redis ready');
});

// Initialize and test connection
async function initRedis() {
    try {
        await client.connect();
        
        // Test connection
        await client.set('foo', 'bar');
        const result = await client.get('foo');
        console.log('✅ Redis test result:', result);
        
    } catch (err) {
        console.error('❌ Failed to connect to Redis:', err.message);
        throw err;
    }
}

// Auto-initialize (call connect immediately)
await initRedis();

// Export the connected client
export { client };