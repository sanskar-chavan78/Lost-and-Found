const User = require('../models/User');

const seedAdmin = async () => {
  try {
    const adminEmail = 'admin@gmail.com';
    const adminExists = await User.findOne({ email: adminEmail });

    if (!adminExists) {
      await User.create({
        name: 'Admin',
        email: adminEmail,
        password: 'Admin@123',
        role: 'admin',
        phone: '1234567890',
      });
      console.log('Default admin account created: admin@gmail.com / Admin@123');
    } else {
      // Update password and role if it already exists, to ensure it matches user's request
      adminExists.password = 'Admin@123';
      adminExists.role = 'admin';
      await adminExists.save();
      console.log('Default admin account updated: admin@gmail.com / Admin@123');
    }
  } catch (error) {
    console.error('Error seeding admin:', error.message);
  }
};

module.exports = seedAdmin;
