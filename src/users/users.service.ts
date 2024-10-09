import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaClient, Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { CurrentUser } from 'src/auth';
import { ListResponse, PaginationDto } from 'src/common';
import { hasRoles, ObjectManipulator } from 'src/helpers';
import { CreateUserDto, UpdateUserDto } from './dto';

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
  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      const { password, ...data } = createUserDto;

      const userPassword = password || this.generateRandomPassword();

      const hashedPassword = bcrypt.hashSync(userPassword, 10);

      const newUser = await this.user.create({ data: { ...data, password: hashedPassword } });

      return { ...newUser, password: userPassword };
    } catch (error) {
      this.logger.error(error);
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'Error creating the user',
      });
    }
  }

  /**
   * Retrieves a paginated list of users based on the provided pagination parameters and user roles.
   *
   * @param {PaginationDto} paginationDto - The pagination parameters including page number and limit.
   * @param {CurrentUser} user - The user making the request, used to determine access level.
   * @returns {Promise<ListResponse<User>>} A promise that resolves to a paginated list of users with metadata.
   */
  async findAll(paginationDto: PaginationDto, user: CurrentUser): Promise<ListResponse<User>> {
    const { page, limit } = paginationDto;
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
  }

  /**
   * Retrieves a user by their ID, including the creator's information.
   *
   * @param {string} id - The ID of the user to retrieve.
   * @returns {Promise<Partial<User>>} A promise that resolves to a partial user object, excluding sensitive information.
   * @throws {RpcException} If the user with the specified ID is not found.
   */
  async findOne(id: string, currentUser: CurrentUser): Promise<Partial<User>> {
    const idAdmin = hasRoles(currentUser.roles, [Role.Admin]);

    const where = idAdmin ? { id } : { id, deletedAt: null };

    const user = await this.user.findFirst({
      where,
      include: {
        createdBy: { select: { id: true, username: true, email: true } },
        updatedBy: { select: { id: true, username: true, email: true } },
        deletedBy: { select: { id: true, username: true, email: true } },
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
  async findByUsername(username: string, currentUser: CurrentUser): Promise<Partial<User>> {
    const idAdmin = hasRoles(currentUser.roles, [Role.Admin]);
    const where = idAdmin ? { username } : { username, deletedAt: null };

    const user = await this.user.findFirst({
      where,
      include: {
        createdBy: { select: { id: true, username: true, email: true } },
        updatedBy: { select: { id: true, username: true, email: true } },
        deletedBy: { select: { id: true, username: true, email: true } },
      },
    });

    if (!user) {
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `User with username ${username} not found`,
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
  async findOneWithMeta(id: string, currentUser: CurrentUser): Promise<Partial<User>> {
    const idAdmin = hasRoles(currentUser.roles, [Role.Admin]);
    const where = idAdmin ? { id } : { id, deletedAt: null };

    const user = await this.user.findUnique({
      where,
      include: {
        createdBy: { select: { id: true, username: true, email: true } },
        updatedBy: { select: { id: true, username: true, email: true } },
        deletedBy: { select: { id: true, username: true, email: true } },

        creatorOf: { select: { id: true, username: true, email: true, createdAt: true } },
        updaterOf: { select: { id: true, username: true, email: true, updatedAt: true } },
        deleterOf: { select: { id: true, username: true, email: true, deletedAt: true } },
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
  async findOneWithSummary(id: string, currentUser: CurrentUser): Promise<Partial<User>> {
    const idAdmin = hasRoles(currentUser.roles, [Role.Admin]);
    const where = idAdmin ? { id } : { id, deletedAt: null };

    const user = await this.user.findUnique({
      where,
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
  async update(updateUserDto: UpdateUserDto, currentUser: CurrentUser): Promise<Partial<User>> {
    const { id, ...data } = updateUserDto;

    await this.findOne(id, currentUser);

    return this.user.update({ where: { id }, data: { ...data, updatedById: currentUser.id } });
  }

  /**
   * Soft deletes a user by marking them as disabled.
   *
   * @param {string} id - The ID of the user to remove.
   * @returns {Promise<Partial<User>>} A promise that resolves to the updated user object, excluding sensitive information.
   * @throws {RpcException} If the user with the specified ID is not found or is already disabled.
   */
  async remove(id: string, currentUser: CurrentUser): Promise<Partial<User>> {
    const user = await this.findOne(id, currentUser);

    if (user.deletedAt)
      throw new RpcException({
        status: HttpStatus.CONFLICT,
        message: `User with id ${id} is already disabled`,
      });

    return this.user.update({ where: { id }, data: { deletedAt: new Date(), deletedById: currentUser.id } });
  }

  /**
   * Restores a previously disabled user.
   *
   * @param {string} id - The ID of the user to restore.
   * @returns {Promise<Partial<User>>} A promise that resolves to the updated user object, excluding sensitive information.
   * @throws {RpcException} If the user with the specified ID is not found or is already enabled.
   */
  async restore(id: string, currentUser: CurrentUser): Promise<Partial<User>> {
    const user = await this.findOne(id, currentUser);

    if (user.deletedAt === null)
      throw new RpcException({
        status: HttpStatus.CONFLICT,
        message: `User with id ${id} is already enabled`,
      });

    return this.user.update({
      where: { id },
      data: { deletedAt: null, deletedById: null, updatedById: currentUser.id },
    });
  }

  private generateRandomPassword(length: number = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    let generatedPassword = '';

    const charsLength = chars.length;

    for (let i = 0; i < length; i++) generatedPassword += chars.charAt(Math.floor(Math.random() * charsLength));

    return generatedPassword;
  }
}
