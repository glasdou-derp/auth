export enum Role {
  User = 'User',
  Admin = 'Admin',
  Moderator = 'Moderator',
}

export interface CurrentUser {
  id: string;
  username: string;
  email: string;
  roles: Role[];
  createdAt: Date;
  updateAt: Date;
  deletedAt?: Date;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  roles: Role[];
  createdAt: Date | null;
  updatedAt: Date | null;
  deletedAt: Date | null;
  createdBy: UserSummary | null;
  updatedBy: UserSummary | null;
  deletedBy: UserSummary | null;
  password?: string;
}

export interface UserSummary {
  id: string;
  username: string;
  email: string;
}
