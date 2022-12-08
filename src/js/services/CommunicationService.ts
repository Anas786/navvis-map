import {SensorDatum} from "./SensorDataHelperService";

/**
 * The class that contains helper functions to fetch data from a remote location such as a server.
 */
export class CommunicationService
{
	constructor(private readonly ivUrl: string, private readonly serverUrl: string) {}

	/**
	 * Fetch some data from an endpoint. Sends HTTP GET request, with response type = json.
	 * @param {string} endpoint POI to be saved
	 * @template T
	 * @returns {Promise<T>} A promise that holds the response of the GET request.
	 */
	private fetch<T>(endpoint: string): Promise<T>
	{
		return new Promise<T>((resolve, reject) =>
		{
			const xhr = new XMLHttpRequest();
			xhr.open("GET", endpoint, true);
			xhr.responseType = "json";
			xhr.onload = () =>
			{
				// Success
				if (xhr.status === 200)
				{
					resolve(xhr.response);
				}
				// Application level errors
				else
				{
					reject(xhr.response);
				}
			};
			// Network level errors
			xhr.onerror = () =>
			{
				reject(xhr.response);
			};
			xhr.send();
		});
	}

	/**
	 * Fetches historical data of a sensor from the backend.
	 * @param {string} topic Corresponding MQTT topic
	 * @param {string} sensorId Corresponding sensor ID
	 * @returns {Promise<SensorDatum[]>} A promise that holds the historical data of sensors
	 */
	public fetchHistoricalData(topic: string, sensorId: number): Promise<SensorDatum[]>
	{
		return this.fetch<SensorDatum[]>(`${this.serverUrl}/${topic}?id=${sensorId}`);
	}

	/**
	 * Fetches ids of all sensor publishing to a topic.
	 * @param {string} topic Corresponding MQTT topic
	 * @returns {Promise<number[]>} A promise that holds the ids of sensors
	 */
	public fetchSensorIds(topic: string): Promise<number[]>
	{
		return this.fetch<number[]>(`${this.serverUrl}/${topic}`);
	}

}
