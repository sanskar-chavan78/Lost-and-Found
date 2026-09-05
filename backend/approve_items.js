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

const approveAllItems = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const result = await Item.updateMany({ status: 'pending' }, { status: 'approved' });
    console.log(`Updated ${result.modifiedCount} items to approved status.`);

    process.exit(0);
  } catch (error) {
    console.error('Error approving items:', error);
    process.exit(1);
  }
};

approveAllItems();
