import { HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import { PaginationDto } from 'src/common';
import { ObjectManipulator } from 'src/helpers';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { CurrentUser, Role, UserResponse, UserSummary } from './interfaces';
import { UserService } from './user.service';

const mockPrisma = {
  user: { create: jest.fn(), findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};
const mockUserSummary: UserSummary = { id: '1', username: 'current', email: 'current@google.com' };
const mockCurrentUser: CurrentUser = {
  id: '1',
  username: 'current',
  email: 'current@google.com',
  roles: [Role.Admin],
  createdAt: new Date(),
  updateAt: new Date(),
};
const mockUserResult: UserResponse = {
  id: '10',
  username: 'test',
  email: 'test@test.com',
  roles: [Role.User],
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  createdBy: mockUserSummary,
  updatedBy: null,
  deletedBy: null,
};
const USER_INCLUDE = {
  createdBy: { select: { id: true, username: true, email: true } },
  updatedBy: { select: { id: true, username: true, email: true } },
  deletedBy: { select: { id: true, username: true, email: true } },
};

describe('UserService', () => {
  let userService: UserService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [UserService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    userService = moduleRef.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe('create', () => {
    const createUserDto: CreateUserDto = {
      username: mockUserResult.username,
      email: mockUserResult.email,
      roles: mockUserResult.roles,
      createdById: '1',
    };

    it('should create a new user with a provided password', async () => {
      mockPrisma.user.create.mockResolvedValue(mockUserResult);

      const result = await userService.create({ ...createUserDto, password: 'password123' });

      expect(result).toEqual({ ...mockUserResult, password: 'password123' });
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: { ...createUserDto, password: expect.any(String) },
        include: USER_INCLUDE,
      });
    });

    it('should create a new user with a generated password if none is provided', async () => {
      const createdUser = { ...mockUserResult, ...createUserDto, password: 'hashedPassword' };
      mockPrisma.user.create.mockResolvedValue(createdUser);

      const result = await userService.create(createUserDto);

      expect(result).toHaveProperty('password');
      expect(result.password).not.toBe('');
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: { ...createUserDto, password: expect.any(String) },
        include: USER_INCLUDE,
      });
    });

    it('should log an error if user creation fails', async () => {
      const error = new Error('User creation failed');
      mockPrisma.user.create.mockRejectedValue(error);

      await expect(userService.create(createUserDto)).rejects.toThrow('User creation failed');
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: { ...createUserDto, password: expect.any(String) },
        include: USER_INCLUDE,
      });
    });
  });

  describe('findAll', () => {
    const paginationDto: PaginationDto = { page: 1, limit: 10 };
    const mockUsers = [mockUserResult];

    it('should return a list of users with pagination for non-admin users', async () => {
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await userService.findAll(paginationDto, { ...mockCurrentUser, roles: [Role.User] });

      expect(result.data).toEqual([ObjectManipulator.exclude(mockUserResult, ['password'])]);
      expect(result.meta).toEqual({ total: 1, page: 1, lastPage: 1 });
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        take: 10,
        skip: 0,
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: USER_INCLUDE,
      });
      expect(mockPrisma.user.count).toHaveBeenCalledWith({ where: { deletedAt: null } });
    });

    it('should return a list of users with pagination for admin users', async () => {
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await userService.findAll(paginationDto, mockCurrentUser);

      expect(result.data).toEqual([ObjectManipulator.exclude(mockUserResult, ['password'])]);
      expect(result.meta).toEqual({ total: 1, page: 1, lastPage: 1 });
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        take: 10,
        skip: 0,
        where: {},
        orderBy: { createdAt: 'desc' },
        include: USER_INCLUDE,
      });
      expect(mockPrisma.user.count).toHaveBeenCalledWith({ where: {} });
    });
  });

  describe('findOne', () => {
    const userId = '10';

    it('should return a user if found by an admin', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUserResult);

      const result = await userService.findOne(userId, mockCurrentUser);

      expect(result).toEqual(mockUserResult);
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: userId },
        include: USER_INCLUDE,
      });
    });

    it('should return a user if found by a non-admin', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUserResult);

      const result = await userService.findOne(userId, { ...mockCurrentUser, roles: [Role.User] });

      expect(result).toEqual(mockUserResult);
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: userId, deletedAt: null },
        include: USER_INCLUDE,
      });
    });

    it('should throw an error if user is not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(userService.findOne(userId, mockCurrentUser)).rejects.toThrow('User with id 10 not found');
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: userId },
        include: USER_INCLUDE,
      });
    });
  });

  describe('findByUsername', () => {
    const username = 'test';

    it('should return a user if found by an admin', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUserResult);

      const result = await userService.findByUsername(username, mockCurrentUser);

      expect(result).toEqual(mockUserResult);
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { username },
        include: USER_INCLUDE,
      });
    });

    it('should return a user if found by a non-admin', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUserResult);

      const result = await userService.findByUsername(username, { ...mockCurrentUser, roles: [Role.User] });

      expect(result).toEqual(mockUserResult);
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { username, deletedAt: null },
        include: USER_INCLUDE,
      });
    });

    it('should throw an error if user is not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(userService.findByUsername(username, mockCurrentUser)).rejects.toThrow(
        'User with username test not found',
      );
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { username },
        include: USER_INCLUDE,
      });
    });
  });

  describe('findOneWithSummary', () => {
    const userId = '10';

    it('should return a user summary if found by an admin', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUserSummary);

      const result = await userService.findOneWithSummary(userId, mockCurrentUser);

      expect(result).toEqual(mockUserSummary);
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: userId },
        select: { id: true, username: true, email: true },
      });
    });

    it('should return a user summary if found by a non-admin', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUserSummary);

      const result = await userService.findOneWithSummary(userId, { ...mockCurrentUser, roles: [Role.User] });

      expect(result).toEqual(mockUserSummary);
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: userId, deletedAt: null },
        select: { id: true, username: true, email: true },
      });
    });

    it('should throw an error if user summary is not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(userService.findOneWithSummary(userId, mockCurrentUser)).rejects.toThrow(
        'User with id 10 not found',
      );
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: userId },
        select: { id: true, username: true, email: true },
      });
    });
  });

  describe('update', () => {
    const updateUserDto: UpdateUserDto = {
      id: '10',
      username: 'updatedUser',
      email: 'updated@test.com',
      roles: [Role.User],
    };

    it('should update a user successfully', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUserResult);
      mockPrisma.user.update.mockResolvedValue({
        ...mockUserResult,
        ...updateUserDto,
        updatedBy: mockUserSummary,
        updatedAt: new Date(),
      });

      const result = await userService.update(updateUserDto, mockCurrentUser);
      const { id, ...data } = updateUserDto;

      expect(result).toEqual({
        ...mockUserResult,
        ...updateUserDto,
        updatedBy: mockUserSummary,
        updatedAt: expect.any(Date),
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id },
        data: { ...data, updatedById: mockCurrentUser.id },
        include: USER_INCLUDE,
      });
    });

    it('should throw an error if update fails', async () => {
      const { id, ...data } = updateUserDto;
      mockPrisma.user.findFirst.mockResolvedValue(mockUserResult);
      mockPrisma.user.update.mockRejectedValue(new Error('Update failed'));

      await expect(userService.update(updateUserDto, mockCurrentUser)).rejects.toThrow('Error updating the user');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id },
        data: { ...data, updatedById: mockCurrentUser.id },
        include: USER_INCLUDE,
      });
    });
  });

  describe('remove', () => {
    const userId = '10';

    it('should remove a user successfully', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUserResult);
      const removedUser = { ...mockUserResult, deletedAt: new Date(), deletedBy: mockUserSummary };
      mockPrisma.user.update.mockResolvedValue(removedUser);

      const result = await userService.remove(userId, mockCurrentUser);

      expect(result).toEqual(ObjectManipulator.exclude(removedUser, ['password']));
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { deletedAt: expect.any(Date), deletedById: mockCurrentUser.id },
        include: USER_INCLUDE,
      });
    });

    it('should throw an error if user is already disabled', async () => {
      const disabledUser = { ...mockUserResult, deletedAt: new Date() }; // Simulate the user is already disabled
      mockPrisma.user.findFirst.mockResolvedValueOnce(disabledUser);

      await expect(userService.remove(userId, mockCurrentUser)).rejects.toThrow(
        new RpcException({
          status: HttpStatus.CONFLICT,
          message: `[ERROR] User with id ${userId} is already disabled`,
        }),
      );

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should throw an error if user removal fails', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUserResult);
      mockPrisma.user.update.mockRejectedValue(new Error('Removal failed'));

      await expect(userService.remove(userId, mockCurrentUser)).rejects.toThrow('Error removing the user');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { deletedAt: expect.any(Date), deletedById: mockCurrentUser.id },
        include: USER_INCLUDE,
      });
    });
  });

  describe('restore', () => {
    const userId = '10';

    it('should restore a user successfully', async () => {
      const restoredUser = { ...mockUserResult, deletedAt: null, updatedBy: mockUserSummary };
      mockPrisma.user.findFirst.mockResolvedValue({
        ...mockUserResult,
        deletedAt: new Date(),
      });
      mockPrisma.user.update.mockResolvedValue(restoredUser);

      const result = await userService.restore(userId, mockCurrentUser);

      expect(result).toEqual(restoredUser);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { deletedAt: null, deletedById: null, updatedById: mockCurrentUser.id },
        include: USER_INCLUDE,
      });
    });

    it('should throw an error if user is already enabled', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUserResult);

      await expect(userService.restore(userId, mockCurrentUser)).rejects.toThrow(
        `[ERROR] User with id ${userId} is already enabled`,
      );
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should throw an error if user restoration fails', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUserResult, deletedAt: new Date() });
      mockPrisma.user.update.mockRejectedValue(new Error('Restoration failed'));

      await expect(userService.restore(userId, mockCurrentUser)).rejects.toThrow('Error restoring the user');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { deletedAt: null, deletedById: null, updatedById: mockCurrentUser.id },
        include: USER_INCLUDE,
      });
    });
  });
});
