import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { PrismaService } from 'src/prisma/prisma.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const user = {
  id: '1',
  username: 'test',
  email: 'test@example.com',
  password: 'hashed-password',
  roles: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  createdById: '1',
  updatedById: '1',
  deletedById: null,
};
const token = 'test-token';
const prismaMock = { user: { findFirst: jest.fn() }, $connect: jest.fn(), $disconnect: jest.fn() };
const jwtMock = { sign: jest.fn(() => token), verify: jest.fn(() => ({ id: user.id, iat: 0, exp: 0 })) };

describe('AuthController', () => {
  let authController: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwtMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: { log: jest.fn(), error: jest.fn() } },
      ],
    }).compile();
    authController = moduleRef.get<AuthController>(AuthController);
    authService = moduleRef.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should call AuthService login method with correct parameters', async () => {
    const loginDto = { username: 'test', password: 'test' };

    const loginSpy = jest
      .spyOn(authService, 'login')
      .mockImplementation(async () => ({ user, token: 'test-jwt-token' }));

    await authController.login(loginDto);
    expect(loginSpy).toHaveBeenCalledWith(loginDto);
  });

  it('should return the user and token after login', async () => {
    const loginDto = { username: 'test', password: 'test' };

    jest.spyOn(authService, 'login').mockImplementation(async () => ({ user, token: 'test-jwt-token' }));

    const result = await authController.login(loginDto);
    expect(result).toEqual({
      user,
      token: 'test-jwt-token',
    });
  });

  it('should call AuthService verifyToken method with correct parameters', async () => {
    const token = 'test-jwt-token';

    const verifyTokenSpy = jest
      .spyOn(authService, 'verifyToken')
      .mockImplementation(async () => ({ user, token: 'test-jwt-token' }));

    await authController.verifyToken(token);
    expect(verifyTokenSpy).toHaveBeenCalledWith(token);
  });

  it('should throw an error if login fails', async () => {
    const loginDto = { username: 'test', password: 'wrong-password' };

    jest.spyOn(authService, 'login').mockImplementation(async () => {
      throw new Error('Invalid credentials');
    });

    await expect(authController.login(loginDto)).rejects.toThrow('Invalid credentials');
  });

  it('should throw an error if verifyToken fails', async () => {
    const token = 'invalid-jwt-token';

    jest.spyOn(authService, 'verifyToken').mockImplementation(async () => {
      throw new Error('Invalid token');
    });

    await expect(authController.verifyToken(token)).rejects.toThrow('Invalid token');
  });
});
