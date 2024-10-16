import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '@prisma/client';
import { ListResponse, PaginationDto } from 'src/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { CurrentUser, Role, UserResponse, UserSummary } from './interfaces';
import { UserController } from './user.controller';
import { UserService } from './user.service';

const mockPrisma = { user: { findFirst: jest.fn() }, $connect: jest.fn(), $disconnect: jest.fn() };
const mockUserResult: UserResponse = {
  id: '10',
  username: 'test',
  email: 'test@test.com',
  roles: [Role.User],
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  createdBy: null,
  updatedBy: null,
  deletedBy: null,
};
const mockUserSummary: UserSummary = { id: '1', username: 'parent', email: 'parent@google.com' };
const mockCurrentUser: CurrentUser = {
  id: '1',
  username: 'current',
  email: 'current@google.com',
  roles: [Role.Admin],
  createdAt: new Date(),
  updateAt: new Date(),
};
const mockUserService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  findByUsername: jest.fn(),
  findOneWithSummary: jest.fn(),
  findByIds: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  restore: jest.fn(),
};

describe('UserController', () => {
  let userService: UserService;
  let userController: UserController;
  let cacheManager: Cache;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: UserService, useValue: mockUserService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn() } },
      ],
    }).compile();

    userService = moduleRef.get<UserService>(UserService);
    cacheManager = moduleRef.get<Cache>(CACHE_MANAGER);
    userController = new UserController(userService, cacheManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  test('health should return service status', () => {
    const result = userController.health();
    expect(result).toBe('users service is up and running!');
  });

  describe('create', () => {
    const createUserDto: CreateUserDto = {
      username: 'test',
      email: 'test@test.com',
      roles: ['User'],
      createdById: '1',
    };

    it('should create a new user', async () => {
      const result = {
        ...mockUserResult,
        id: Math.random().toString(),
        createdBy: mockUserSummary,
        updatedBy: mockUserSummary,
      };

      jest.spyOn(userService, 'create').mockImplementation(async () => result);

      expect(await userController.create(createUserDto)).toBe(result);
    });

    it('should throw an error if user creation fails', async () => {
      jest.spyOn(userService, 'create').mockImplementation(async () => {
        throw new Error('User creation failed');
      });

      await expect(userController.create(createUserDto)).rejects.toThrow('User creation failed');
    });
  });

  describe('findAll', () => {
    const paginationDto: PaginationDto = { page: 1, limit: 10 };
    const listResponse: ListResponse<User> = {
      data: [mockUserResult],
      meta: { total: 1, page: 1, lastPage: 1 },
    };

    it('should return a paginated list of users', async () => {
      jest.spyOn(userService, 'findAll').mockImplementation(async () => listResponse);

      const result = await userController.findAll({ paginationDto, user: mockCurrentUser });
      expect(result).toBe(listResponse);
    });

    it('should throw an error if retrieving users fails', async () => {
      jest.spyOn(userService, 'findAll').mockImplementation(async () => {
        throw new Error('Retrieving users failed');
      });

      await expect(userController.findAll({ paginationDto, user: mockCurrentUser })).rejects.toThrow(
        'Retrieving users failed',
      );
    });
  });

  describe('findOne', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';
    const payload = { id: userId, user: mockCurrentUser };

    it('should return cached response if available', async () => {
      const cachedUser = mockUserResult;

      jest.spyOn(cacheManager, 'get').mockResolvedValue(cachedUser);

      const result = await userController.findOne(payload);

      expect(cacheManager.get).toHaveBeenCalledWith(`user:id:${userId}`);
      expect(result).toEqual(cachedUser);
      expect(userService.findOne).not.toHaveBeenCalled();
    });

    it('should fetch user from service if not cached', async () => {
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
      jest.spyOn(userService, 'findOne').mockResolvedValue(mockUserResult);
      jest.spyOn(cacheManager, 'set').mockResolvedValue(undefined);

      const result = await userController.findOne(payload);

      expect(cacheManager.get).toHaveBeenCalledWith(`user:id:${userId}`);
      expect(userService.findOne).toHaveBeenCalledWith(userId, mockCurrentUser);
      expect(cacheManager.set).toHaveBeenCalledWith(`user:id:${userId}`, mockUserResult);
      expect(result).toEqual(mockUserResult);
    });

    it('should throw an error if user ID is invalid', async () => {
      const invalidPayload = { id: 'invalid-id', user: mockCurrentUser };

      await expect(userController.findOne(invalidPayload)).rejects.toThrow('Invalid user ID');
    });

    it('should throw an error if user retrieval fails', async () => {
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
      jest.spyOn(userService, 'findOne').mockImplementation(async () => {
        throw new Error('User retrieval failed');
      });

      await expect(userController.findOne(payload)).rejects.toThrow('User retrieval failed');
    });
  });

  describe('findOneByUsername', () => {
    const username = 'testuser';
    const payload = { username, user: mockCurrentUser };

    it('should return cached response if available', async () => {
      const cachedUser = mockUserResult;

      jest.spyOn(cacheManager, 'get').mockResolvedValue(cachedUser);

      const result = await userController.findOneByUsername(payload);

      expect(cacheManager.get).toHaveBeenCalledWith(`user:username:${username}`);
      expect(result).toEqual(cachedUser);
      expect(userService.findByUsername).not.toHaveBeenCalled();
    });

    it('should fetch user from service if not cached', async () => {
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
      jest.spyOn(userService, 'findByUsername').mockResolvedValue(mockUserResult);
      jest.spyOn(cacheManager, 'set').mockResolvedValue(undefined);

      const result = await userController.findOneByUsername(payload);

      expect(cacheManager.get).toHaveBeenCalledWith(`user:username:${username}`);
      expect(userService.findByUsername).toHaveBeenCalledWith(username, mockCurrentUser);
      expect(cacheManager.set).toHaveBeenCalledWith(`user:username:${username}`, mockUserResult);
      expect(result).toEqual(mockUserResult);
    });

    it('should throw an error if user retrieval by username fails', async () => {
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
      jest.spyOn(userService, 'findByUsername').mockImplementation(async () => {
        throw new Error('User retrieval by username failed');
      });

      await expect(userController.findOneByUsername(payload)).rejects.toThrow('User retrieval by username failed');
    });
  });

  describe('findOneWithSummary', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';
    const payload = { id: userId, user: mockCurrentUser };

    it('should return a user summary by ID', async () => {
      jest.spyOn(userService, 'findOneWithSummary').mockImplementation(async () => mockUserSummary);

      const result = await userController.findOneWithSummary(payload);
      expect(result).toBe(mockUserSummary);
    });

    it('should throw an error if user summary retrieval fails', async () => {
      jest.spyOn(userService, 'findOneWithSummary').mockImplementation(async () => {
        throw new Error('User summary retrieval failed');
      });

      await expect(userController.findOneWithSummary(payload)).rejects.toThrow('User summary retrieval failed');
    });

    it('should throw an error if the user ID is invalid', async () => {
      try {
        await userController.findOneWithSummary({ id: 'invalid-id', user: mockCurrentUser });
      } catch (error) {
        expect(error).toEqual(new Error('Invalid user ID'));
      }
    });
  });

  describe('findByIds', () => {
    const userIds = ['123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001'];
    const payload = { ids: userIds, user: mockCurrentUser };
    const userSummaries: UserSummary[] = [mockUserSummary, { id: '2', username: 'child', email: 'child@google.com' }];

    it('should return cached response if available', async () => {
      jest.spyOn(cacheManager, 'get').mockResolvedValue(userSummaries);

      const result = await userController.findByIds(payload);

      expect(cacheManager.get).toHaveBeenCalledWith(`users:ids:${userIds.join(',')}`);
      expect(result).toEqual(userSummaries);
      expect(userService.findByIds).not.toHaveBeenCalled();
    });

    it('should fetch user summaries from service if not cached', async () => {
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
      jest.spyOn(userService, 'findByIds').mockResolvedValue(userSummaries);
      jest.spyOn(cacheManager, 'set').mockResolvedValue(undefined);

      const result = await userController.findByIds(payload);

      expect(cacheManager.get).toHaveBeenCalledWith(`users:ids:${userIds.join(',')}`);
      expect(userService.findByIds).toHaveBeenCalledWith(userIds, mockCurrentUser);
      expect(cacheManager.set).toHaveBeenCalledWith(`users:ids:${userIds.join(',')}`, userSummaries);
      expect(result).toEqual(userSummaries);
    });

    it('should throw an error if some user IDs are invalid', async () => {
      const invalidPayload = { ids: ['invalid-id', '123e4567-e89b-12d3-a456-426614174001'], user: mockCurrentUser };

      await expect(userController.findByIds(invalidPayload)).rejects.toThrow('[ERROR] Some user IDs are invalid');
    });

    it('should throw an error if user summaries retrieval fails', async () => {
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
      jest.spyOn(userService, 'findByIds').mockImplementation(async () => {
        throw new Error('User summaries retrieval failed');
      });

      await expect(userController.findByIds(payload)).rejects.toThrow('User summaries retrieval failed');
    });
  });

  describe('update', () => {
    const updateUserDto: UpdateUserDto = {
      id: '10',
      username: 'updatedTest',
      email: 'updatedTest@test.com',
      roles: ['User'],
    };

    it('should update a user', async () => {
      const result = {
        ...mockUserResult,
        username: updateUserDto.username,
        email: updateUserDto.email,
        updatedBy: mockUserSummary,
      };

      jest.spyOn(userService, 'update').mockImplementation(async () => result);

      expect(await userController.update({ updateUserDto, user: mockCurrentUser })).toBe(result);
    });

    it('should throw an error if user update fails', async () => {
      jest.spyOn(userService, 'update').mockImplementation(async () => {
        throw new Error('User update failed');
      });

      await expect(userController.update({ updateUserDto, user: mockCurrentUser })).rejects.toThrow(
        'User update failed',
      );
    });
  });

  describe('remove', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';
    const payload = { id: userId, user: mockCurrentUser };

    it('should remove a user by ID', async () => {
      const deletedResult = { ...mockUserResult, deletedAt: new Date(), deletedBy: mockUserSummary };
      jest.spyOn(userService, 'remove').mockImplementation(async () => deletedResult);

      const result = await userController.remove(payload);
      expect(result).toBe(deletedResult);
    });

    it('should throw an error if user removal fails', async () => {
      jest.spyOn(userService, 'remove').mockImplementation(async () => {
        throw new Error('User removal failed');
      });

      await expect(userController.remove(payload)).rejects.toThrow('User removal failed');
    });

    it('should throw an error if the user ID is invalid', async () => {
      try {
        await userController.remove({ id: 'invalid-id', user: mockCurrentUser });
      } catch (error) {
        expect(error).toEqual(new Error('Invalid user ID'));
      }
    });
  });

  describe('restore', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';
    const payload = { id: userId, user: mockCurrentUser };

    it('should restore a user by ID', async () => {
      const restoredResult = { ...mockUserResult, deletedAt: null, deletedBy: null };
      jest.spyOn(userService, 'restore').mockImplementation(async () => restoredResult);

      const result = await userController.restore(payload);
      expect(result).toBe(restoredResult);
    });

    it('should throw an error if user restoration fails', async () => {
      jest.spyOn(userService, 'restore').mockImplementation(async () => {
        throw new Error('User restoration failed');
      });

      await expect(userController.restore(payload)).rejects.toThrow('User restoration failed');
    });

    it('should throw an error if the user ID is invalid', async () => {
      try {
        await userController.restore({ id: 'invalid-id', user: mockCurrentUser });
      } catch (error) {
        expect(error).toEqual(new Error('Invalid user ID'));
      }
    });
  });
});
