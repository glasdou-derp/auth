import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Controller, HttpStatus, Inject } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { User } from '@prisma/client';
import { isUUID } from 'class-validator';

import { ListResponse, PaginationDto } from 'src/common';
import { CreateUserDto, UpdateUserDto } from './dto';
import { CurrentUser, UserResponse, UserSummary } from './interfaces';
import { UserService } from './user.service';

@Controller()
export class UserController {
  constructor(
    private readonly usersService: UserService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Handles the 'user.health' message pattern to check the health of the users service.
   *
   * @returns {string} A message indicating the users service is up and running.
   */
  @MessagePattern('user.health')
  health(): string {
    return 'users service is up and running!';
  }

  /**
   * Handles the 'user.create' message pattern to create a new user.
   *
   * @param {CreateUserDto} createUserDto - The data transfer object containing the information to create the user.
   * @returns {Promise<UserResponse>} A promise that resolves to the created user object, excluding sensitive information.
   */
  @MessagePattern('user.create')
  create(@Payload() createUserDto: CreateUserDto): Promise<UserResponse> {
    return this.usersService.create(createUserDto);
  }

  /**
   * Handles the 'user.findAll' message pattern to retrieve a paginated list of user.
   *
   * @param {{ paginationDto: PaginationDto; user: CurrentUser }} payload - An object containing pagination parameters and the requesting user.
   * @returns {Promise<ListResponse<User>>} A promise that resolves to a paginated list of users with metadata.
   */
  @MessagePattern('user.all')
  findAll(@Payload() payload: { paginationDto: PaginationDto; user: CurrentUser }): Promise<ListResponse<User>> {
    const { paginationDto, user } = payload;
    return this.usersService.findAll(paginationDto, user);
  }

  /**
   * Handles the 'user.find.id' message pattern to retrieve a user by their ID.
   *
   * @param {string} id - The ID of the user to retrieve.
   * @returns {Promise<UserResponse>} A promise that resolves to the found user object, excluding sensitive information.
   */
  @MessagePattern('user.find.id')
  async findOne(@Payload() payload: { id: string; user: CurrentUser }): Promise<UserResponse> {
    const { id, user } = payload;

    if (!isUUID(id)) throw new RpcException({ status: HttpStatus.BAD_REQUEST, message: 'Invalid user ID' });

    return this.getCachedResponse(`user:id:${id}`, () => this.usersService.findOne(id, user));
  }

  /**
   * Handles the 'user.find.username' message pattern to retrieve a user by their username.
   *
   * @param {string} username - The username of the user to retrieve.
   * @returns {Promise<UserResponse>} A promise that resolves to the found user object, excluding sensitive information.
   */
  @MessagePattern('user.find.username')
  async findOneByUsername(@Payload() payload: { username: string; user: CurrentUser }): Promise<UserResponse> {
    const { username, user } = payload;

    return this.getCachedResponse(`user:username:${username}`, () => this.usersService.findByUsername(username, user));
  }

  /**
   * Handles the 'user.find.summary' message pattern to retrieve a user by their ID with a summary of basic information.
   *
   * @param {string} id - The ID of the user to retrieve.
   * @returns {Promise<UserResponse>} A promise that resolves to the found user object containing only basic information.
   */
  @MessagePattern('user.find.summary')
  async findOneWithSummary(@Payload() payload: { id: string; user: CurrentUser }): Promise<UserSummary> {
    const { id, user } = payload;

    if (!isUUID(id)) throw new RpcException({ status: HttpStatus.BAD_REQUEST, message: 'Invalid user ID' });

    return this.getCachedResponse(`user:summary:${id}`, () => this.usersService.findOneWithSummary(id, user));
  }

  @MessagePattern('user.find.ids')
  async findByIds(@Payload() payload: { ids: string[]; user: CurrentUser }): Promise<UserSummary[]> {
    const { ids, user } = payload;

    if (!ids.every((id) => isUUID(id)))
      throw new RpcException({ status: HttpStatus.BAD_REQUEST, message: '[ERROR] Some user IDs are invalid' });

    if (!user) throw new RpcException({ status: HttpStatus.UNAUTHORIZED, message: '[ERROR] Unauthorized' });

    return this.getCachedResponse(`users:ids:${ids.join(',')}`, () => this.usersService.findByIds(ids, user));
  }

  /**
   * Handles the 'user.update' message pattern to update a user.
   *
   * @param {UpdateUserDto} updateUserDto - The data transfer object containing the information to update the user.
   * @returns {Promise<UserResponse>} A promise that resolves to the updated user object, excluding sensitive information.
   */
  @MessagePattern('user.update')
  update(@Payload() payload: { updateUserDto: UpdateUserDto; user: CurrentUser }): Promise<UserResponse> {
    const { updateUserDto, user } = payload;

    return this.usersService.update(updateUserDto, user);
  }

  /**
   * Handles the 'user.remove' message pattern to soft delete a user.
   *
   * @param {string} id - The ID of the user to remove.
   * @returns {Promise<UserResponse>} A promise that resolves to the updated user object, excluding sensitive information.
   */
  @MessagePattern('user.remove')
  remove(@Payload() payload: { id: string; user: CurrentUser }): Promise<UserResponse> {
    const { id, user } = payload;

    if (!isUUID(id)) throw new RpcException({ status: HttpStatus.BAD_REQUEST, message: 'Invalid user ID' });

    return this.usersService.remove(id, user);
  }

  /**
   * Handles the 'user.restore' message pattern to restore a previously disabled user.
   *
   * @param {string} id - The ID of the user to restore.
   * @returns {Promise<UserResponse>} A promise that resolves to the updated user object, excluding sensitive information.
   */
  @MessagePattern('user.restore')
  restore(@Payload() payload: { id: string; user: CurrentUser }): Promise<UserResponse> {
    const { id, user } = payload;

    if (!isUUID(id)) throw new RpcException({ status: HttpStatus.BAD_REQUEST, message: 'Invalid user ID' });

    return this.usersService.restore(id, user);
  }

  private async getCachedResponse<T>(cacheKey: string, fetchFunction: () => Promise<T>): Promise<T> {
    const cachedResponse = await this.cacheManager.get<T>(cacheKey);

    if (cachedResponse) return cachedResponse;

    const response = await fetchFunction();
    await this.cacheManager.set(cacheKey, response);

    return response;
  }
}
