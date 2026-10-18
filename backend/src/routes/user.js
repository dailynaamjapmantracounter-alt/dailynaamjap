import express from 'express';
import { db } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// 1. Get Current User Profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await db.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching profile' });
  }
});

// 2. Update User Profile Details
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, country, state, gender } = req.body;
    const updated = await db.updateUser(req.user.id, {
      ...(name && { name }),
      ...(country && { country }),
      ...(state && { state }),
      ...(gender && { gender }),
    });
    res.json({ success: true, user: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating profile' });
  }
});

// 3. Sync Japa & Mala Counts (Offline-to-Cloud sync)
router.post('/sync-japa', authenticateToken, async (req, res) => {
  try {
    const { totalJapa, malasCompleted } = req.body;
    const user = await db.findUserById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Save whichever is higher (prevents offline data loss)
    const newTotal = Math.max(Number(user.total_japa || 0), Number(totalJapa || 0));
    const newMalas = Math.max(Number(user.malas_completed || 0), Number(malasCompleted || 0));

    const updated = await db.updateUser(req.user.id, {
      total_japa: newTotal,
      malas_completed: newMalas,
    });

    res.json({ success: true, user: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error syncing japa' });
  }
});

// 4. Save Diary Entry
router.post('/diary', authenticateToken, async (req, res) => {
  try {
    const { chantName, malaCount, totalChants, notes } = req.body;
    if (!chantName) {
      return res.status(400).json({ success: false, message: 'Chant name is required' });
    }

    const entry = await db.addDiaryEntry({
      userId: req.user.id,
      chantName,
      malaCount: Number(malaCount || 1),
      totalChants: Number(totalChants || 108),
      notes: notes || '',
    });

    // Also increment user's total counts
    const user = await db.findUserById(req.user.id);
    if (user) {
      await db.updateUser(req.user.id, {
        total_japa: Number(user.total_japa || 0) + Number(totalChants || 108),
        malas_completed: Number(user.malas_completed || 0) + Number(malaCount || 1),
      });
    }

    res.json({ success: true, entry });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error saving diary entry' });
  }
});

// 5. Get Diary Entries
router.get('/diary', authenticateToken, async (req, res) => {
  try {
    const entries = await db.getDiaryEntries(req.user.id);
    res.json({ success: true, entries });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching diary entries' });
  }
});

// 6. Delete Account (Play Store & App Store Mandatory Compliance)
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    await db.deleteAccount(req.user.id);
    res.json({ success: true, message: 'Account and associated data deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting account' });
  }
});

export default router;
