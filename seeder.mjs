// seeder.mjs
import mongoose from 'mongoose';
import dotenv   from 'dotenv';
import User     from './models/User.js';

dotenv.config();

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Wipe existing users
    await User.deleteMany({});
    console.log('🗑️  Cleared users collection');

    // Seed two accounts
    const users = [
      { username: 'admin1',    password: 'adminpass',    role: 'admin'    },
      { username: 'employee1', password: 'employeepass', role: 'employee' },
    ];

    for (const u of users) {
      const user = new User(u);
      await user.save();
      console.log(`🔑 Created ${u.role}: ${u.username} / ${u.password}`);
    }

    console.log('🎉 Seeding complete');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeder error:', err);
    process.exit(1);
  }
}

seed();
