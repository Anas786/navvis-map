/**
 * Gives an array with a maximum length. If the array tries to exceed that limit, the last element gets popped.
 * Used for storing sensor historical data.
 */
export class LimitedLengthArray<T> extends Array<T>
{
	constructor(private maxLength: number)
	{
		super();
		// Set the prototype explicitly.
		// Important!! If you want to extend LimitedLengthArray you need to manually set the prototype.
		// https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
		Object.setPrototypeOf(this, LimitedLengthArray.prototype);
	}

	/**
	 * Pushes item/items to the array. If the array tries to extend the max limit, older elements are popped.
	 * @param {T[]} items Item/s that is wanted to be pushed to the array.
	 * @template T
	 * @returns {number} Length of the array
	 */
	public push(...items: T[]): number
	{
		super.push(...items);
		while (this.length > this.maxLength)
		{
			this.shift();
		}
		return this.length;
	}

	/**
	 * Empties the array.
	 */
	public empty(): void
	{
		this.length = 0;
	}
}
