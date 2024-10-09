import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaClient, Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { CurrentUser } from 'src/auth';
import { ListResponse, PaginationDto } from 'src/common';
import { hasRoles, ObjectManipulator } from 'src/helpers';
import { CreateUserDto, UpdateUserDto } from './dto';

const USER_INCLUDE = {
  createdBy: { select: { id: true, username: true, email: true } },
  updatedBy: { select: { id: true, username: true, email: true } },
  deletedBy: { select: { id: true, username: true, email: true } },
};

const EXCLUDE_FIELDS: (keyof User)[] = ['password', 'createdById', 'updatedById', 'deletedById'];

@Injectable()
export class UsersService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to the database \\(^.^)/');
  }

  async create(createUserDto: CreateUserDto): Promise<Partial<User>> {
    try {
      const { password, ...data } = createUserDto;
      this.logger.log(`Creating user: ${JSON.stringify(data)}`);

      const userPassword = password || this.generateRandomPassword();

      const hashedPassword = bcrypt.hashSync(userPassword, 10);

      const newUser = await this.user.create({ data: { ...data, password: hashedPassword } });

      const cleanUser = ObjectManipulator.exclude(newUser, ['password', 'createdById', 'updatedById', 'deletedById']);

      return { ...cleanUser, password: userPassword };
    } catch (error) {
      this.logger.error(error);
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'Error creating the user',
      });
    }
  }

  async findAll(pagination: PaginationDto, user: CurrentUser): Promise<ListResponse<User>> {
    try {
      this.logger.log(`findAll() - ${JSON.stringify(pagination)} ,requesting: ${user.id}`);
      const { page, limit } = pagination;
      const isAdmin = hasRoles(user.roles, [Role.Admin]);

      const where = isAdmin ? {} : { deletedAt: null };

      const [data, total] = await Promise.all([
        this.user.findMany({ take: limit, skip: (page - 1) * limit, where }),
        this.user.count({ where }),
      ]);

      const lastPage = Math.ceil(total / limit);

      return {
        meta: { total, page, lastPage },
        data: data.map((item) => ObjectManipulator.exclude(item, ['password'])),
      };
    } catch (error) {
      this.logger.error(error);
      throw new RpcException({ status: HttpStatus.BAD_REQUEST, message: 'Error fetching users' });
    }
  }

  async findOne(id: string, currentUser: CurrentUser): Promise<Partial<User>> {
    try {
      this.logger.log(`findOne() - ${id}, requesting: ${currentUser.id}`);
      const isAdmin = hasRoles(currentUser.roles, [Role.Admin]);

      const where = isAdmin ? { id } : { id, deletedAt: null };

      const user = await this.user.findFirst({ where, include: USER_INCLUDE });

      if (!user) throw new RpcException({ status: HttpStatus.NOT_FOUND, message: `User with id ${id} not found` });

      return this.excludeFields(user);
    } catch (error) {
      this.logger.error(error);
      throw new RpcException({ status: HttpStatus.BAD_REQUEST, message: 'Error fetching the user' });
    }
  }

  async findByUsername(username: string, currentUser: CurrentUser): Promise<Partial<User>> {
    try {
      this.logger.log(`findByUsername() - ${username}, requesting: ${currentUser.id}`);
      const idAdmin = hasRoles(currentUser.roles, [Role.Admin]);
      const where = idAdmin ? { username } : { username, deletedAt: null };

      const user = await this.user.findFirst({ where, include: USER_INCLUDE });

      if (!user)
        throw new RpcException({ status: HttpStatus.NOT_FOUND, message: `User with username ${username} not found` });

      return ObjectManipulator.exclude(user, ['password', 'createdById', 'updatedById', 'deletedById']);
    } catch (error) {
      this.logger.error(error);
      throw new RpcException({ status: HttpStatus.BAD_REQUEST, message: 'Error fetching the user' });
    }
  }

  async findOneWithMeta(id: string, currentUser: CurrentUser): Promise<Partial<User>> {
    try {
      this.logger.log(`findOneWithMeta() - ${id}, requesting: ${currentUser.id}`);
      const idAdmin = hasRoles(currentUser.roles, [Role.Admin]);
      const where = idAdmin ? { id } : { id, deletedAt: null };

      const user = await this.user.findUnique({ where, include: USER_INCLUDE });

      if (!user) throw new RpcException({ status: HttpStatus.NOT_FOUND, message: `User with id ${id} not found` });

      return ObjectManipulator.exclude(user, ['password', 'createdById', 'updatedById', 'deletedById']);
    } catch (error) {
      this.logger.error(error);
      throw new RpcException({ status: HttpStatus.BAD_REQUEST, message: 'Error fetching the user' });
    }
  }

  async findOneWithSummary(id: string, currentUser: CurrentUser): Promise<Partial<User>> {
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

  async update(updateUserDto: UpdateUserDto, currentUser: CurrentUser): Promise<Partial<User>> {
    try {
      this.logger.log(`Updating user: ${JSON.stringify(updateUserDto)}, requesting: ${currentUser.id}`);
      const { id, ...data } = updateUserDto;

      await this.findOne(id, currentUser);

      const updatedUser = await this.user.update({
        where: { id },
        data: { ...data, updatedById: currentUser.id },
        include: USER_INCLUDE,
      });

      return this.excludeFields(updatedUser);
    } catch (error) {
      this.logger.error(error);
      throw new RpcException({ status: HttpStatus.BAD_REQUEST, message: 'Error updating the user' });
    }
  }

  async remove(id: string, currentUser: CurrentUser): Promise<Partial<User>> {
    try {
      this.logger.log(`Removing user: ${id}, requesting: ${currentUser.id}`);

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
      this.logger.error(error);
      throw new RpcException({ status: HttpStatus.BAD_REQUEST, message: 'Error removing the user' });
    }
  }

  async restore(id: string, currentUser: CurrentUser): Promise<Partial<User>> {
    try {
      this.logger.log(`Restoring user: ${id}, requesting: ${currentUser.id}`);
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
      this.logger.log(error);
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

  private excludeFields(user: User) {
    return ObjectManipulator.exclude(user, EXCLUDE_FIELDS);
  }
}
