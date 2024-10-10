export class ObjectManipulator {
  /**
   * Safely delete a key from an object
   * @param obj The object to be manipulated
   * @param key The key to be deleted
   * @returns void
   */
  static safeDelete<T extends object, K extends keyof T>(obj: T, key: K): void {
    if (!(key in obj)) {
      console.warn(`Property ${String(key)} does not exist on the object.`);
      return;
    }

    delete obj[key];
  }

  /**
   * Excludes specific keys from an object and returns a new object without those keys.
   *
   * @template T - The type of the object.
   * @param {T} obj - The object to exclude keys from.
   * @param {(keyof T)[]} keys - An array of keys to be excluded from the object.
   * @returns {Partial<T>} - A new object with the specified keys excluded.
   *
   * @example
   * const user = { id: '1', username: 'john_doe', password: 'secret' };
   * const cleanUser = ObjectManipulator.exclude(user, ['password']);
   * console.log(cleanUser); // Output: { id: '1', username: 'john_doe' }
   */
  static exclude<T extends object>(obj: T, keys: (keyof T)[]): Partial<T> {
    return Object.fromEntries(Object.entries(obj).filter(([key]) => !keys.includes(key as keyof T))) as Partial<T>;
  }
}
