import {PoiGroupDictionary, PoiStateGroup, PoiStateType} from "./PoiHelperService";

export type SensorDataType = number;

/**
 * Formatted sensor data format coming from the sensors.
 */
export interface FormattedSensorDatum 
{
	value: SensorDataType;
	date: Date;
}

/**
 * Unformatted sensor data format.
 */
export interface SensorDatum 
{
	id: number;
	value: SensorDataType;
	timestamp: string;
}

/**
 * Enum that contains all possible POI states.
 */
export enum SensorStates
{
	ALERT,
	NORMAL
}

/**
 * Interface that extends generic POI type interface to fit sensors.
 */
export interface SensorStatePoiType extends PoiStateType
{
	title: string;
	state: SensorStates;
}

/**
 * Encapsulates everything needed to create a new sensor type. Extends generic POI group interface.
 */
export interface SensorType extends PoiStateGroup
{
	group: string;
	threshold: number;
	types: SensorStatePoiType[];
	range: number[];
	topic: string;
	unit: string;
}

/**
 * Maps POI group names to sensor type objects.
 */
export interface SensorTypeDictionary extends PoiGroupDictionary
{
	[group: string]: SensorType;
}

/**
 * The class that contains the functions needed to organize and format sensor data
 */
export class SensorDataHelperService
{
	constructor() {}

	/**
	 * Formats the sensor data, removes unnecessary fields, changes timestamp to a JS Date object.
	 * @param {SensorDatum[]} data Unformatted sensor data array
	 * @returns {FormattedSensorDatum[]} Formatted sensor data array
	 */
	public formatSensorData(data: SensorDatum[]): FormattedSensorDatum[]
	{
		const formattedData: FormattedSensorDatum[] = [];

		for (const datum of data)
		{
			formattedData.push({
				value: datum.value,
				date: new Date(datum.timestamp)
			});
		}
		return formattedData;
	}

	/**
	 * Checks whether the given POI group supports adding sensors.
	 * @param {string} poiGroup POI group name
	 * @param {SensorTypeDictionary} sensorTypes POI group name
	 * @returns {boolean} true if POI group supports sensors
	 */
	public isSensor(poiGroup: string, sensorTypes: SensorTypeDictionary): boolean
	{
		return (Object.keys(sensorTypes).includes(poiGroup));
	}

}
