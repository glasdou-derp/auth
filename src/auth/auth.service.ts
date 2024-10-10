import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { envs } from 'src/config';
import { ObjectManipulator } from 'src/helpers';
import { LoginDto } from './dto';
import { AuthResponse, JwtPayload } from './interfaces';

@Injectable()
export class AuthService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('AuthService');

  constructor(private readonly jwtService: JwtService) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to the database \\(^.^)/');
  }

  /**
   * Authenticates a user based on the provided login credentials.
   * If the credentials are valid, returns the user data and a JWT token.
   * If the credentials are invalid, throws an exception with an appropriate error message.
   *
   * @param {LoginDto} loginDto - The Data Transfer Object containing the login credentials.
   * @returns {Promise<AuthResponse>} A promise that resolves with the authenticated user data and a JWT token.
   * @throws {RpcException} If the credentials are invalid or any other error occurs during the authentication process.
   */
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    try {
      const { username, password } = loginDto;

      const user = await this.user.findFirst({ where: { username } });

      if (!user) throw new RpcException({ status: HttpStatus.UNAUTHORIZED, message: 'Invalid credentials' });

      const isValidPassword = bcrypt.compareSync(password, user.password);

      if (!isValidPassword) throw new RpcException({ status: HttpStatus.UNAUTHORIZED, message: 'Invalid credentials' });

      ObjectManipulator.safeDelete(user, 'password');

      return { user, token: this.signToken({ id: user.id }) };
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new RpcException({ status: HttpStatus.BAD_REQUEST, message: error.message });
    }
  }

  /**
   * Verifies a JWT token and returns the associated user data and a new token if the token is valid.
   * If the token is invalid or expired, throws an exception with an appropriate error message.
   *
   * @param {string} token - The JWT token to be verified.
   * @returns {Promise<AuthResponse>} A promise that resolves with the authenticated user data and a new JWT token.
   * @throws {RpcException} If the token is invalid or any other error occurs during the verification process.
   */
  async verifyToken(token: string): Promise<AuthResponse> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: envs.jwtSecret,
      });

      ObjectManipulator.safeDelete(payload, 'exp');
      ObjectManipulator.safeDelete(payload, 'iat');

      const user = await this.user.findFirst({ where: { id: payload.id } });

      if (!user) {
        throw new RpcException({
          status: HttpStatus.UNAUTHORIZED,
          message: 'Invalid token',
        });
      }

      return {
        user: user,
        token: this.signToken({ id: user.id }),
      };
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new RpcException({ status: HttpStatus.UNAUTHORIZED, message: 'Invalid token' });
    }
  }

  /**
   * Signs a JWT token with the given payload and expiration time.
   *
   * @param {JwtPayload} payload - The payload to include in the JWT token.
   * @param {string | number} [expiresIn='4h'] - The expiration time for the token, defaulting to 4 hours.
   * @returns {string} The signed JWT token.
   */
  private signToken(payload: JwtPayload, expiresIn: string | number = '4h'): string {
    return this.jwtService.sign(payload, { expiresIn });
  }
}
