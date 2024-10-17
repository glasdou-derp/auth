import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';
import * as bcrypt from 'bcrypt';
import { envs } from 'src/config';
import { ExceptionHandler, ObjectManipulator } from 'src/helpers';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoginDto } from './dto';
import { AuthResponse, JwtPayload, SignedToken } from './interfaces';

@Injectable()
export class AuthService {
  private readonly user = this.prismaService.user;
  private readonly logger = new Logger(AuthService.name);
  private readonly exHandler = new ExceptionHandler(this.logger, AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prismaService: PrismaService,
  ) {}

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
      this.logger.log(`Authenticating user with username: ${loginDto.username}`);
      const { username, password } = loginDto;

      const user = await this.user.findFirst({ where: { username } });

      if (!user) throw new RpcException({ status: HttpStatus.UNAUTHORIZED, message: '[ERROR] Invalid credentials' });

      const isValidPassword = bcrypt.compareSync(password, user.password);

      if (!isValidPassword)
        throw new RpcException({ status: HttpStatus.UNAUTHORIZED, message: '[ERROR] Invalid credentials' });

      ObjectManipulator.safeDelete(user, 'password');

      return { user, token: this.signToken({ id: user.id }) };
    } catch (error) {
      this.exHandler.process(error);
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
      this.logger.log('Verifying token');

      const payload = this.jwtService.verify<SignedToken>(token, { secret: envs.jwtSecret });

      const { id } = ObjectManipulator.exclude(payload, ['exp', 'iat']);

      const user = await this.user.findFirst({ where: { id } });

      if (!user) throw new RpcException({ status: HttpStatus.UNAUTHORIZED, message: 'Invalid token' });

      const tokenSigned = this.signToken({ id: user.id });

      return { user: user, token: tokenSigned };
    } catch (error) {
      this.exHandler.process(error);
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
