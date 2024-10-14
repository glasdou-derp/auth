import { JwtService } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';
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

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwtMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    authService = moduleRef.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe('login', () => {
    test('should return the user and token after login', async () => {
      prismaMock.user.findFirst.mockResolvedValue(user); // Mock the PrismaClient's user.findFirst method
      jest.spyOn(bcrypt, 'compareSync').mockReturnValue(true); // Mock the bcrypt.compareSync method

      const res = await authService.login({ username: user.username, password: 'password' }); // Call the login method

      expect(res).toEqual({ user, token }); // Assert the result
    });

    test('should throw an error if user is not found', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null); // Mock the PrismaClient's user.findFirst method

      await expect(authService.login({ username: 'nonexistent', password: 'password' })).rejects.toThrow(RpcException); // Assert the error
    });

    test('should throw an error if password is invalid', async () => {
      prismaMock.user.findFirst.mockResolvedValue(user); // Mock the PrismaClient's user.findFirst method
      jest.spyOn(bcrypt, 'compareSync').mockReturnValue(false); // Mock the bcrypt.compareSync method

      await expect(authService.login({ username: user.username, password: 'wrong-password' })).rejects.toThrow(
        RpcException,
      ); // Assert the error
    });
  });

  describe('verifyToken', () => {
    test('should return the user and a new token if the token is valid', async () => {
      jest.spyOn(jwtMock, 'verify').mockReturnValue({ id: user.id, iat: 0, exp: 0 }); // Mock the jwtService.verify method
      jest.spyOn(jwtMock, 'sign').mockReturnValue(token); // Mock the jwtService.sign method
      prismaMock.user.findFirst.mockResolvedValue(user); // Mock the PrismaClient's user.findFirst method
      const res = await authService.verifyToken(token); // Call the verifyToken method

      expect(res).toEqual({ user, token }); // Assert the result
    });

    test('should throw an error if the token is invalid', async () => {
      jest.spyOn(jwtMock, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      }); // Mock the jwtService.verify method to throw an error

      await expect(authService.verifyToken('invalid-token')).rejects.toThrow(RpcException); // Assert the error
    });

    test('should throw an error if the user is not found', async () => {
      jest.spyOn(jwtMock, 'verify').mockReturnValue({ id: user.id, iat: 0, exp: 0 }); // Mock the jwtService.verify method
      prismaMock.user.findFirst.mockResolvedValue(null); // Mock the PrismaClient's user.findFirst method

      await expect(authService.verifyToken(token)).rejects.toThrow(RpcException); // Assert the error
    });
  });
});
