import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { ListResponse, PaginationDto } from 'src/common';
import { ExceptionHandler, hasRoles, ObjectManipulator } from 'src/helpers';
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
  private readonly logger = new Logger(UserService.name);
  private readonly user: PrismaService['user'];
  private readonly exHandler = new ExceptionHandler(this.logger, UserService.name);

  constructor(
    private readonly prismaService: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    this.user = this.prismaService.user;
  }

  async create(createUserDto: CreateUserDto): Promise<UserResponse> {
    try {
      const { password, ...data } = createUserDto;
      this.logger.log(`Creating user: ${JSON.stringify(data)}`);

      const userPassword = password || this.generateRandomPassword();

      const hashedPassword = bcrypt.hashSync(userPassword, 10);

      const newUser = await this.user.create({ data: { ...data, password: hashedPassword }, include: USER_INCLUDE });

      const cleanUser = this.excludeFields(newUser);

      this.clearCache();

      return { ...cleanUser, password: userPassword };
    } catch (error) {
      if (error.code === 'P2002' && error.meta?.target?.includes('username'))
        throw new RpcException({ status: HttpStatus.CONFLICT, message: 'Nombre de usuario ya existe' });

      if (error.code === 'P2002' && error.meta?.target?.includes('email'))
        throw new RpcException({ status: HttpStatus.CONFLICT, message: 'Correo electrónico ya existe' });

      this.exHandler.process(error, 'Error creating the user');
    }
  }

  async findAll(pagination: PaginationDto, user: CurrentUser): Promise<ListResponse<User>> {
    this.logger.log(`Fetching users: ${JSON.stringify(pagination)}, user: ${user.id} - ${user.username}`);
    const { page, limit } = pagination;
    const isAdmin = hasRoles(user.roles, [Role.Admin]);

    const where = isAdmin ? {} : { deletedAt: null };

    const [data, total] = await Promise.all([
      this.user.findMany({
        take: limit,
        skip: (page - 1) * limit,
        where,
        orderBy: { createdAt: 'desc' },
        include: USER_INCLUDE,
      }),
      this.user.count({ where }),
    ]);

    const lastPage = Math.ceil(total / limit);

    return {
      meta: { total, page, lastPage },
      data: data.map((item) => this.excludeFields(item)),
    };
  }

  async findOne(id: string, currentUser: CurrentUser): Promise<UserResponse> {
    this.logger.log(`Fetching user: ${id}, user: ${currentUser.id} - ${currentUser.username}`);
    const isAdmin = hasRoles(currentUser.roles, [Role.Admin]);

    const where = isAdmin ? { id } : { id, deletedAt: null };

    const user = await this.user.findFirst({ where, include: USER_INCLUDE });

    if (!user)
      throw new RpcException({ status: HttpStatus.NOT_FOUND, message: `[ERROR] User with id ${id} not found` });

    return this.excludeFields(user);
  }

  async findByUsername(username: string, currentUser: CurrentUser): Promise<UserResponse> {
    this.logger.log(`Fetching user: ${username}, user: ${currentUser.id} - ${currentUser.username}`);
    const idAdmin = hasRoles(currentUser.roles, [Role.Admin]);
    const where = idAdmin ? { username } : { username, deletedAt: null };

    const user = await this.user.findFirst({ where, include: USER_INCLUDE });

    if (!user)
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `[ERROR] User with username ${username} not found`,
      });

    return this.excludeFields(user);
  }

  async findOneWithSummary(id: string, currentUser: CurrentUser): Promise<UserSummary> {
    this.logger.log(`Fetching user: ${id}, user: ${currentUser.id} - ${currentUser.username}`);
    const idAdmin = hasRoles(currentUser.roles, [Role.Admin]);
    const where = idAdmin ? { id } : { id, deletedAt: null };

    const user = await this.user.findFirst({ where, select: { id: true, username: true, email: true } });

    if (!user)
      throw new RpcException({ status: HttpStatus.NOT_FOUND, message: `[ERROR] User with id ${id} not found` });

    return user;
  }

  async findByIds(ids: string[], currentUser: CurrentUser): Promise<UserSummary[]> {
    this.logger.log(`Fetching users: ${ids}, user: ${currentUser.id} - ${currentUser.username}`);

    const data = await this.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, username: true, email: true },
    });

    return data;
  }

  async update(updateUserDto: UpdateUserDto, currentUser: CurrentUser): Promise<UserResponse> {
    try {
      this.logger.log(
        `Updating user: ${JSON.stringify(updateUserDto)}, user: ${currentUser.id} - ${currentUser.username}`,
      );
      const { id, ...data } = updateUserDto;

      await this.findOne(id, currentUser);

      const updatedUser = await this.user.update({
        where: { id },
        data: { ...data, updatedById: currentUser.id },
        include: USER_INCLUDE,
      });

      this.clearCache();

      return this.excludeFields(updatedUser);
    } catch (error) {
      this.exHandler.process(error, 'Error updating the user');
    }
  }

  async remove(id: string, currentUser: CurrentUser): Promise<UserResponse> {
    try {
      this.logger.log(`Removing user: ${id}, user: ${currentUser.id} - ${currentUser.username}`);

      const user = await this.findOne(id, currentUser);

      if (user.deletedAt)
        throw new RpcException({
          status: HttpStatus.CONFLICT,
          message: `[ERROR] User with id ${id} is already disabled`,
        });

      const updatedUser = await this.user.update({
        where: { id },
        data: { deletedAt: new Date(), deletedById: currentUser.id },
        include: USER_INCLUDE,
      });

      this.clearCache();

      return this.excludeFields(updatedUser);
    } catch (error) {
      this.exHandler.process(error, 'Error removing the user');
    }
  }

  async restore(id: string, currentUser: CurrentUser): Promise<UserResponse> {
    try {
      this.logger.log(`Restoring user: ${id}, user: ${currentUser.id} - ${currentUser.username}`);
      const user = await this.findOne(id, currentUser);

      if (user.deletedAt === null)
        throw new RpcException({
          status: HttpStatus.CONFLICT,
          message: `[ERROR] User with id ${id} is already enabled`,
        });

      const updatedUser = await this.user.update({
        where: { id },
        data: { deletedAt: null, deletedById: null, updatedById: currentUser.id },
        include: USER_INCLUDE,
      });

      this.clearCache();

      return this.excludeFields(updatedUser);
    } catch (error) {
      this.exHandler.process(error, 'Error restoring the user');
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

  private clearCache() {
    this.cacheManager.reset();
  }
}
