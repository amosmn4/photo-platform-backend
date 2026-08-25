import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserModel } from '../models/User';
import { RefreshTokenModel } from '../models/RefreshToken';
import { generateOpaqueToken, hashToken } from '../utils/token';
import { ApiError } from '../utils/ApiError';
import { JwtAccessPayload, PublicUser, User } from '../types';

function toPublicUser(user: User): PublicUser {
  const { password_hash, ...rest } = user;
  return rest;
}

export const AuthService = {
  async register(input: { email: string; password: string; fullName: string; businessName?: string }) {
    const existing = await UserModel.findByEmail(input.email);
    if (existing) throw ApiError.conflict('An account with this email already exists');

    const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);
    const user = await UserModel.create({
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      businessName: input.businessName ?? null,
    });
    return toPublicUser(user);
  },

  async login(input: { email: string; password: string; userAgent?: string; ipAddress?: string }) {
    const user = await UserModel.findByEmail(input.email);
    if (!user) throw ApiError.unauthorized('Invalid email or password');

    const valid = await bcrypt.compare(input.password, user.password_hash);
    if (!valid) throw ApiError.unauthorized('Invalid email or password');

    if (user.status === 'suspended') throw ApiError.forbidden('This account has been suspended');

    await UserModel.touchLastLogin(user.id);

    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user.id, input.userAgent, input.ipAddress);

    return { user: toPublicUser(user), accessToken, refreshToken };
  },

  signAccessToken(user: Pick<User, 'id' | 'role'>): string {
    const payload: JwtAccessPayload = { sub: user.id, role: user.role };
    const options: jwt.SignOptions = { expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'] };
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
  },

  async issueRefreshToken(userId: string, userAgent?: string, ipAddress?: string): Promise<string> {
    const { raw, hash } = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
    await RefreshTokenModel.create({ userId, tokenHash: hash, userAgent, ipAddress, expiresAt });
    return raw;
  },

  /** Rotates a refresh token: the old one is revoked and a new pair is issued.
   *  Rotation on every use limits the blast radius of a stolen refresh token
   *  to a single unused window. */
  async refresh(rawRefreshToken: string, userAgent?: string, ipAddress?: string) {
    const hash = hashToken(rawRefreshToken);
    const existing = await RefreshTokenModel.findValidByHash(hash);
    if (!existing) throw ApiError.unauthorized('Invalid or expired refresh token');

    const user = await UserModel.findById(existing.user_id);
    if (!user || user.status === 'suspended') throw ApiError.unauthorized('Account not available');

    await RefreshTokenModel.revoke(hash);
    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user.id, userAgent, ipAddress);

    return { accessToken, refreshToken, user: toPublicUser(user) };
  },

  async logout(rawRefreshToken: string): Promise<void> {
    await RefreshTokenModel.revoke(hashToken(rawRefreshToken));
  },

  verifyAccessToken(token: string): JwtAccessPayload {
    try {
      return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtAccessPayload;
    } catch {
      throw ApiError.unauthorized('Invalid or expired access token');
    }
  },
};
