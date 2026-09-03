import { UserModel } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { PublicUser, User } from '../types';

function toPublicAccount(user: User): PublicUser {
  const { password_hash, email_verification_code_hash, email_verification_expires_at, ...rest } = user;
  return rest;
}

export const AdminService = {
  async listUsers(page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;
    const { users, total } = await UserModel.listAccounts(pageSize, offset);
    return {
      users: users.map(toPublicAccount),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  },

  async suspendUser(id: string): Promise<PublicUser> {
    const user = await UserModel.setStatus(id, 'suspended');
    if (!user) throw ApiError.notFound('Account not found');
    return toPublicAccount(user);
  },

  async reactivateUser(id: string): Promise<PublicUser> {
    const user = await UserModel.setStatus(id, 'active');
    if (!user) throw ApiError.notFound('Account not found');
    return toPublicAccount(user);
  },

  async deleteUser(id: string): Promise<void> {
    const deleted = await UserModel.hardDelete(id);
    if (!deleted) throw ApiError.notFound('Account not found');
  },
};
