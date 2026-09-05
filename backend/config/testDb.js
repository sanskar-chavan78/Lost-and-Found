const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('dns');

// Fallback to Google and Cloudflare DNS resolvers
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
  // Ignore fallback errors
}

dotenv.config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!uri) {
  console.error('ERROR: MONGODB_URI or MONGO_URI is missing in environment variables.');
  process.exit(1);
}

// Attempt Mongoose connection
mongoose.connect(uri)
  .then(() => {
    console.log('PASS: Successfully connected to MongoDB Atlas.');
    process.exit(0);
  })
  .catch((err) => {
    console.error(`ERROR: Failed to connect to MongoDB Atlas. Reason: ${err.message}`);
    process.exit(2);
  });
