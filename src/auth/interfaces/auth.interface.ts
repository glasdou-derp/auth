import { User } from '@prisma/client';

export interface JwtPayload {
  id: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface SignedToken extends JwtPayload {
  iat: number;
  exp: number;
}
