import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaClient, Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { ListResponse, PaginationDto } from 'src/common';
import { ObjectManipulator } from 'src/helpers';
import { hasRoles } from 'src/helpers/validate-roles.helper';
import { CreateUserDto, UpdateUserDto } from './dto';
import { UserModel } from './interfaces';

@Injectable()
export class UsersService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to the database \\(^.^)/');
  }

  /**
   * Creates a new user with the provided data.
   *
   * @param {CreateUserDto} createUserDto - The data transfer object containing the information to create the user.
   * @returns {Promise<Partial<User>>} A promise that resolves to the created user object.
   */
  async create(createUserDto: CreateUserDto): Promise<Partial<User>> {
    const user = await this.user.create({ data: { ...createUserDto, password: bcrypt.hashSync(createUserDto.password, 10) } });

    return ObjectManipulator.exclude(user, ['password']);
  }

  /**
   * Retrieves a paginated list of users based on the provided pagination parameters and user roles.
   *
   * @param {PaginationDto} paginationDto - The pagination parameters including page number and limit.
   * @param {UserModel} user - The user making the request, used to determine access level.
   * @returns {Promise<ListResponse<User>>} A promise that resolves to a paginated list of users with metadata.
   */
  async findAll(paginationDto: PaginationDto, user: UserModel): Promise<ListResponse<User>> {
    const { page, limit } = paginationDto;
    const isAdmin = hasRoles(user.roles, [Role.Admin]);

    const where = isAdmin ? {} : { deletedAt: null };
    const total = await this.user.count({ where });
    const lastPage = Math.ceil(total / limit);

    const data = await this.user.findMany({
      take: limit,
      skip: (page - 1) * limit,
      where,
    });

    return {
      meta: { total, page, lastPage },
      data: data.map((item) => ObjectManipulator.exclude(item, ['password'])),
    };
  }

  /**
   * Retrieves a user by their ID, including the creator's information.
   *
   * @param {string} id - The ID of the user to retrieve.
   * @returns {Promise<Partial<User>>} A promise that resolves to a partial user object, excluding sensitive information.
   * @throws {RpcException} If the user with the specified ID is not found.
   */
  async findOne(id: string): Promise<Partial<User>> {
    const user = await this.user.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, username: true, email: true },
        },
      },
    });

    if (!user)
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `User with id ${id} not found`,
      });

    return ObjectManipulator.exclude(user, ['password']);
  }

  /**
   * Retrieves a user by their email or username, including the creator's information.
   *
   * @param {{ email?: string; username?: string }} data - An object containing either email or username to search for the user.
   * @returns {Promise<Partial<User>>} A promise that resolves to a partial user object, excluding sensitive information.
   * @throws {RpcException} If the user with the specified email or username is not found.
   */
  async findByEmailOrUsername(data: { email?: string; username?: string }): Promise<Partial<User>> {
    const { email, username } = data;

    const user = await this.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
      include: {
        creator: {
          select: { id: true, username: true, email: true },
        },
      },
    });

    if (!user) {
      const filter = email ? 'email' : 'username';
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `User with ${filter} ${email || username} not found`,
      });
    }

    return ObjectManipulator.exclude(user, ['password']);
  }

  /**
   * Retrieves a user by their ID, including additional metadata like creator and creatorOf information.
   *
   * @param {string} id - The ID of the user to retrieve.
   * @returns {Promise<Partial<User>>} A promise that resolves to a partial user object with metadata, excluding sensitive information.
   * @throws {RpcException} If the user with the specified ID is not found.
   */
  async findOneWithMeta(id: string): Promise<Partial<User>> {
    const user = await this.user.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, username: true, email: true },
        },
        creatorOf: {
          select: { id: true, username: true, email: true, createdAt: true, updatedAt: true },
        },
      },
    });

    if (!user)
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `User with id ${id} not found`,
      });

    const cleanUser = ObjectManipulator.exclude(user, ['password']);

    return {
      ...cleanUser,
    };
  }

  /**
   * Retrieves a user by their ID with a summary of basic information.
   *
   * @param {string} id - The ID of the user to retrieve.
   * @returns {Promise<Partial<User>>} A promise that resolves to a partial user object containing only basic information.
   * @throws {RpcException} If the user with the specified ID is not found.
   */
  async findOneWithSummary(id: string): Promise<Partial<User>> {
    const user = await this.user.findUnique({
      where: { id },
      select: { id: true, username: true, email: true },
    });

    if (!user)
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `User with id ${id} not found`,
      });

    return user;
  }

  /**
   * Updates a user with the provided data.
   *
   * @param {UpdateUserDto} updateUserDto - The data transfer object containing the information to update the user.
   * @returns {Promise<Partial<User>>} A promise that resolves to the updated user object, excluding sensitive information.
   * @throws {RpcException} If the user with the specified ID is not found.
   */
  async update(updateUserDto: UpdateUserDto): Promise<Partial<User>> {
    const { id, ...data } = updateUserDto;

    await this.findOne(id);

    return this.user.update({ where: { id }, data });
  }

  /**
   * Soft deletes a user by marking them as disabled.
   *
   * @param {string} id - The ID of the user to remove.
   * @returns {Promise<Partial<User>>} A promise that resolves to the updated user object, excluding sensitive information.
   * @throws {RpcException} If the user with the specified ID is not found or is already disabled.
   */
  async remove(id: string): Promise<Partial<User>> {
    const user = await this.findOne(id);

    if (user.deletedAt)
      throw new RpcException({
        status: HttpStatus.CONFLICT,
        message: `User with id ${id} is already disabled`,
      });

    return this.user.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /**
   * Restores a previously disabled user.
   *
   * @param {string} id - The ID of the user to restore.
   * @returns {Promise<Partial<User>>} A promise that resolves to the updated user object, excluding sensitive information.
   * @throws {RpcException} If the user with the specified ID is not found or is already enabled.
   */
  async restore(id: string): Promise<Partial<User>> {
    const user = await this.findOne(id);

    if (user.deletedAt === null)
      throw new RpcException({
        status: HttpStatus.CONFLICT,
        message: `User with id ${id} is already enabled`,
      });

    return this.user.update({ where: { id }, data: { deletedAt: null } });
  }
}
