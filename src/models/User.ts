import { query } from '../db/pool';
import { User } from '../types';

export const UserModel = {
  async create(input: {
    email: string;
    passwordHash: string;
    fullName: string;
    businessName?: string | null;
    phone?: string | null;
  }): Promise<User> {
    const { rows } = await query<User>(
      `INSERT INTO users (email, password_hash, full_name, business_name, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.email.toLowerCase(), input.passwordHash, input.fullName, input.businessName ?? null, input.phone ?? null],
    );
    return rows[0];
  },

  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await query<User>(
      `SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase()],
    );
    return rows[0] ?? null;
  },

  async findById(id: string): Promise<User | null> {
    const { rows } = await query<User>(`SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL`, [id]);
    return rows[0] ?? null;
  },

  async touchLastLogin(id: string): Promise<void> {
    await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [id]);
  },

  async getStorageUsage(id: string): Promise<{ used: string; quota: string } | null> {
    const { rows } = await query<{ used: string; quota: string }>(
      `SELECT storage_used_bytes AS used, storage_quota_bytes AS quota FROM users WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  },
};
