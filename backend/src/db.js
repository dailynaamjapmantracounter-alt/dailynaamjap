import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let isMongoConnected = false;

// 1. Mongoose Schemas (MongoDB)
const userSchema = new mongoose.Schema(
  {
    google_id: { type: String, default: null, index: true },
    email: { type: String, required: true, unique: true },
    name: { type: String, default: 'Bhakta' },
    avatar_url: { type: String, default: '' },
    country: { type: String, default: 'India' },
    state: { type: String, default: 'Rajasthan' },
    gender: { type: String, default: 'Male' },
    total_japa: { type: Number, default: 0 },
    malas_completed: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const diarySchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    chant_name: { type: String, required: true },
    mala_count: { type: Number, default: 1 },
    total_chants: { type: Number, default: 108 },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export const UserModel = mongoose.models.User || mongoose.model('User', userSchema);
export const DiaryModel = mongoose.models.Diary || mongoose.model('Diary', diarySchema);

// 2. Offline / Local fallback (agar MONGO_URI abhi nahi dala toh bhi app chalti rahegi)
const localDbPath = path.join(__dirname, '../data/local_db.json');
const dataDir = path.dirname(localDbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(localDbPath)) {
  fs.writeFileSync(localDbPath, JSON.stringify({ users: [], diary_entries: [] }, null, 2));
}

function readLocalDb() {
  try {
    return JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
  } catch {
    return { users: [], diary_entries: [] };
  }
}

function writeLocalDb(data) {
  fs.writeFileSync(localDbPath, JSON.stringify(data, null, 2));
}

// 3. Database Initialization Function
export async function initDb() {
  const mongoUri = process.env.MONGO_URI;

  if (mongoUri && mongoUri.trim().length > 0 && !mongoUri.includes('username:password')) {
    try {
      await mongoose.connect(mongoUri);
      isMongoConnected = true;
      console.log('🍃 MongoDB Atlas Connected Successfully!');
      return;
    } catch (err) {
      console.error('❌ MongoDB Connection Error:', err.message);
      console.log('⚠️ Falling back to local offline storage.');
      isMongoConnected = false;
    }
  } else {
    console.log('ℹ️ MONGO_URI not provided or placeholder. Running on local JSON storage.');
    isMongoConnected = false;
  }
}

// 4. Unified Data Adapter (Mongo + Local Fallback)
export const db = {
  async findUserByGoogleOrEmail({ googleId, email }) {
    if (isMongoConnected) {
      const query = [];
      if (email) query.push({ email });
      if (googleId) query.push({ google_id: googleId });
      return await UserModel.findOne({ $or: query });
    } else {
      const local = readLocalDb();
      return (
        local.users.find(
          (u) => (googleId && u.google_id === googleId) || (email && u.email === email)
        ) || null
      );
    }
  },

  async findUserById(id) {
    if (isMongoConnected) {
      return await UserModel.findById(id);
    } else {
      const local = readLocalDb();
      return local.users.find((u) => String(u.id) === String(id)) || null;
    }
  },

  async createUser({ googleId, email, name, avatarUrl, country, state, gender }) {
    if (isMongoConnected) {
      const user = new UserModel({
        google_id: googleId || null,
        email,
        name: name || 'Bhakta',
        avatar_url: avatarUrl || '',
        country: country || 'India',
        state: state || 'Rajasthan',
        gender: gender || 'Male',
        total_japa: 0,
        malas_completed: 0,
      });
      await user.save();
      return user;
    } else {
      const local = readLocalDb();
      const newUser = {
        id: local.users.length > 0 ? Math.max(...local.users.map((u) => Number(u.id) || 1)) + 1 : 1,
        google_id: googleId || null,
        email,
        name: name || 'Bhakta',
        avatar_url: avatarUrl || '',
        country: country || 'India',
        state: state || 'Rajasthan',
        gender: gender || 'Male',
        total_japa: 0,
        malas_completed: 0,
        createdAt: new Date().toISOString(),
      };
      local.users.push(newUser);
      writeLocalDb(local);
      return newUser;
    }
  },

  async updateUser(id, updates) {
    if (isMongoConnected) {
      return await UserModel.findByIdAndUpdate(id, { $set: updates }, { new: true });
    } else {
      const local = readLocalDb();
      const idx = local.users.findIndex((u) => String(u.id) === String(id));
      if (idx !== -1) {
        local.users[idx] = { ...local.users[idx], ...updates, updatedAt: new Date().toISOString() };
        writeLocalDb(local);
        return local.users[idx];
      }
      return null;
    }
  },

  async addDiaryEntry({ userId, chantName, malaCount, totalChants, notes }) {
    if (isMongoConnected) {
      const entry = new DiaryModel({
        user_id: userId,
        chant_name: chantName,
        mala_count: malaCount,
        total_chants: totalChants,
        notes: notes || '',
      });
      await entry.save();
      return entry;
    } else {
      const local = readLocalDb();
      const newEntry = {
        id: local.diary_entries.length > 0 ? Math.max(...local.diary_entries.map((d) => Number(d.id) || 1)) + 1 : 1,
        user_id: userId,
        chant_name: chantName,
        mala_count: malaCount,
        total_chants: totalChants,
        notes: notes || '',
        createdAt: new Date().toISOString(),
      };
      local.diary_entries.push(newEntry);
      writeLocalDb(local);
      return newEntry;
    }
  },

  async getDiaryEntries(userId) {
    if (isMongoConnected) {
      return await DiaryModel.find({ user_id: userId }).sort({ createdAt: -1 });
    } else {
      const local = readLocalDb();
      return local.diary_entries
        .filter((d) => String(d.user_id) === String(userId))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  },

  async deleteAccount(userId) {
    if (isMongoConnected) {
      await DiaryModel.deleteMany({ user_id: userId });
      await UserModel.findByIdAndDelete(userId);
      return true;
    } else {
      const local = readLocalDb();
      local.users = local.users.filter((u) => String(u.id) !== String(userId));
      local.diary_entries = local.diary_entries.filter((d) => String(d.user_id) !== String(userId));
      writeLocalDb(local);
      return true;
    }
  },
};
