import { HttpStatus, Inject, Injectable, LoggerService } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ListResponse, PaginationDto } from 'src/common';
import { hasRoles, ObjectManipulator } from 'src/helpers';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { CurrentUser, UserResponse, UserSummary } from './interfaces';

const USER_INCLUDE = {
  createdBy: { select: { id: true, username: true, email: true } },
  updatedBy: { select: { id: true, username: true, email: true } },
  deletedBy: { select: { id: true, username: true, email: true } },
};

const EXCLUDE_FIELDS: (keyof User)[] = ['password', 'createdById', 'updatedById', 'deletedById'];

@Injectable()
export class UserService {
  private readonly user: PrismaService['user'];

  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
    private readonly prismaService: PrismaService,
  ) {
    this.user = this.prismaService.user;
  }

  async create(createUserDto: CreateUserDto): Promise<UserResponse> {
    try {
      const { password, ...data } = createUserDto;
      this.logInfo(`Creating user: ${JSON.stringify(data)}`);

      const userPassword = password || this.generateRandomPassword();
      console.log('🚀 ~ UserService ~ create ~ userPassword:', userPassword);

      const hashedPassword = bcrypt.hashSync(userPassword, 10);

      const newUser = await this.user.create({ data: { ...data, password: hashedPassword }, include: USER_INCLUDE });

      const cleanUser = this.excludeFields(newUser);

      return { ...cleanUser, password: userPassword };
    } catch (error) {
      this.logError(error);
      throw new RpcException({ status: HttpStatus.BAD_REQUEST, message: 'Error creating the user' });
    }
  }

  async findAll(pagination: PaginationDto, user: CurrentUser): Promise<ListResponse<User>> {
    try {
      this.logInfo(`findAll() - ${JSON.stringify(pagination)}, requesting: ${user.id}`);
      const { page, limit } = pagination;
      const isAdmin = hasRoles(user.roles, [Role.Admin]);

      const where = isAdmin ? {} : { deletedAt: null };

      const [data, total] = await Promise.all([
        this.user.findMany({ take: limit, skip: (page - 1) * limit, where, orderBy: { createdAt: 'desc' } }),
        this.user.count({ where }),
      ]);

      const lastPage = Math.ceil(total / limit);

      return {
        meta: { total, page, lastPage },
        data: data.map((item) => ObjectManipulator.exclude(item, ['password'])),
      };
    } catch (error) {
      this.logError(error);
      throw new RpcException({ status: HttpStatus.BAD_REQUEST, message: 'Error fetching users' });
    }
  }

  async findOne(id: string, currentUser: CurrentUser): Promise<UserResponse> {
    try {
      this.logInfo(`findOne() - ${id}, requesting: ${currentUser.id}`);
      const isAdmin = hasRoles(currentUser.roles, [Role.Admin]);

      const where = isAdmin ? { id } : { id, deletedAt: null };

      const user = await this.user.findFirst({ where, include: USER_INCLUDE });

      if (!user) throw new RpcException({ status: HttpStatus.NOT_FOUND, message: `User with id ${id} not found` });

      return this.excludeFields(user);
    } catch (error) {
      this.logError(error);
      throw new RpcException({ status: HttpStatus.BAD_REQUEST, message: 'Error fetching the user' });
    }
  }

  async findByUsername(username: string, currentUser: CurrentUser): Promise<UserResponse> {
    try {
      this.logInfo(`findByUsername() - ${username}, requesting: ${currentUser.id}`);
      const idAdmin = hasRoles(currentUser.roles, [Role.Admin]);
      const where = idAdmin ? { username } : { username, deletedAt: null };

      const user = await this.user.findFirst({ where, include: USER_INCLUDE });

      if (!user)
        throw new RpcException({ status: HttpStatus.NOT_FOUND, message: `User with username ${username} not found` });

      return this.excludeFields(user);
    } catch (error) {
      this.logError(error);
      throw new RpcException({ status: HttpStatus.BAD_REQUEST, message: 'Error fetching the user' });
    }
  }

  async findOneWithSummary(id: string, currentUser: CurrentUser): Promise<UserSummary> {
    try {
      this.logger.log(`findOneWithSummary() - ${id}, requesting: ${currentUser.id}`);
      const idAdmin = hasRoles(currentUser.roles, [Role.Admin]);
      const where = idAdmin ? { id } : { id, deletedAt: null };

      const user = await this.user.findFirst({ where, select: { id: true, username: true, email: true } });

      if (!user) throw new RpcException({ status: HttpStatus.NOT_FOUND, message: `User with id ${id} not found` });

      return user;
    } catch (error) {
      this.logger.error(error);
      throw new RpcException({ status: HttpStatus.BAD_REQUEST, message: 'Error fetching the user' });
    }
  }

  async update(updateUserDto: UpdateUserDto, currentUser: CurrentUser): Promise<UserResponse> {
    try {
      this.logInfo(`Updating user: ${JSON.stringify(updateUserDto)}, requesting: ${currentUser.id}`);
      const { id, ...data } = updateUserDto;

      await this.findOne(id, currentUser);

      const updatedUser = await this.user.update({
        where: { id },
        data: { ...data, updatedById: currentUser.id },
        include: USER_INCLUDE,
      });

      return this.excludeFields(updatedUser);
    } catch (error) {
      this.logError(error);
      throw new RpcException({ status: HttpStatus.BAD_REQUEST, message: 'Error updating the user' });
    }
  }

  async remove(id: string, currentUser: CurrentUser): Promise<UserResponse> {
    try {
      this.logInfo(`Removing user: ${id}, requesting: ${currentUser.id}`);

      const user = await this.findOne(id, currentUser);

      if (user.deletedAt)
        throw new RpcException({ status: HttpStatus.CONFLICT, message: `User with id ${id} is already disabled` });

      const updatedUser = await this.user.update({
        where: { id },
        data: { deletedAt: new Date(), deletedById: currentUser.id },
        include: USER_INCLUDE,
      });

      return this.excludeFields(updatedUser);
    } catch (error) {
      this.logError(error);
      throw new RpcException({ status: HttpStatus.BAD_REQUEST, message: 'Error removing the user' });
    }
  }

  async restore(id: string, currentUser: CurrentUser): Promise<UserResponse> {
    try {
      this.logInfo(`Restoring user: ${id}, requesting: ${currentUser.id}`);
      const user = await this.findOne(id, currentUser);

      if (user.deletedAt === null)
        throw new RpcException({ status: HttpStatus.CONFLICT, message: `User with id ${id} is already enabled` });

      const updatedUser = await this.user.update({
        where: { id },
        data: { deletedAt: null, deletedById: null, updatedById: currentUser.id },
        include: USER_INCLUDE,
      });

      return this.excludeFields(updatedUser);
    } catch (error) {
      this.logError(error);
      throw new RpcException({ status: HttpStatus.BAD_REQUEST, message: 'Error restoring the user' });
    }
  }

  private generateRandomPassword(length: number = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    let generatedPassword = '';

    const charsLength = chars.length;

    for (let i = 0; i < length; i++) generatedPassword += chars.charAt(Math.floor(Math.random() * charsLength));

    return generatedPassword;
  }

  private excludeFields(user: User): UserResponse {
    return ObjectManipulator.exclude<User>(user, EXCLUDE_FIELDS) as UserResponse;
  }

  private logInfo(message: string) {
    this.logger.log(message, { context: UserService.name });
  }

  private logError(message: string) {
    this.logger.error(message, { context: UserService.name });
  }
}
