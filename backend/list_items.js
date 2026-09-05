const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Item = require('./models/Item');
const dns = require('dns');

// Fallback to Google and Cloudflare public DNS resolvers for MongoDB Atlas host resolution
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (err) {
  console.warn('Could not set custom DNS fallback servers:', err.message);
}

dotenv.config();

const listItems = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const items = await Item.find({});
    console.log(`Found ${items.length} items:`);
    items.forEach(it => {
      console.log(`- ${it.name} (${it.type}) [Status: ${it.status}]`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error listing items:', error);
    process.exit(1);
  }
};

listItems();
