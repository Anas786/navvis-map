import {ApiInterface, PoiInterface, PoiTypeInterface} from "@navvis/ivion";
import {SensorStates, SensorTypeDictionary} from "./SensorDataHelperService";

/**
 * Maps group names to their state POI types.
 */
interface ToggleablePoiGroupDictionary
{
	[group: string]: { [state: string]: PoiTypeInterface };
}

/**
 * The class that contains all the functions that are needed to create a toggleable POI
 * In the current system the POI type (Temperature, Pressure) is POI group type
 * and POI states (Alert, Normal) are POI types.
 */
export class ToggleabblePoiService
{
	// Maps type names to actual PoiTypeInterface objects
	private sensorPoiStates: ToggleablePoiGroupDictionary = {};

	constructor(private ivApi: ApiInterface, private readonly SENSOR_TYPES: SensorTypeDictionary,
		private readonly LOCALE: string)
	{
		this.ivApi.poi.poiTypeRepository.findAll().then((poiTypes) =>
		{
			const alertStates: string[] = [];
			const normalStates: string[] = [];

			// Divide the POI types according to their state for easy traversal.
			for (const groupObj of Object.values(this.SENSOR_TYPES))
			{
				for (const typeObj of groupObj.types)
				{
					if (typeObj.state === SensorStates.NORMAL)
					{
						normalStates.push(typeObj.title);
					}
					else if (typeObj.state === SensorStates.ALERT)
					{
						alertStates.push(typeObj.title);
					}
				}
			}

			// Map the actual PoiTypeInterface objects to the dictionary.
			for (const poiType of poiTypes)
			{
				const poiTypeName = poiType.name[this.LOCALE];
				const poiGroup = poiType.poiTypeGroup.name[this.LOCALE];

				this.sensorPoiStates[poiGroup] = this.sensorPoiStates[poiGroup] || {};

				if (alertStates.includes(poiTypeName))
				{
					this.sensorPoiStates[poiGroup].ON = poiType;
				}
				else if (normalStates.includes(poiTypeName))
				{
					this.sensorPoiStates[poiGroup].OFF = poiType;
				}
			}
		})
			.catch(console.log);
	}

	/**
	 * Toggles the given POI to the on State
	 * @param {PoiInterface} poi The POI that needs to be toggled.
	 * @returns {PoiInterface} poi that's been toggled
	 */
	public switchPoiToOn(poi: PoiInterface): PoiInterface
	{
		const poiGroup = poi.poiType.poiTypeGroup.name[this.LOCALE];
		poi.poiType = this.sensorPoiStates[poiGroup].ON;
		this.ivApi.poi.service.refreshPois();
		return poi;
	}

	/**
	 * Toggles the given POI to the off state
	 * @param {PoiInterface} poi The POI that needs to be toggled.
	 * @returns {PoiInterface} poi that's been toggled
	 */
	public switchPoiToOff(poi: PoiInterface): PoiInterface
	{
		const poiGroup = poi.poiType.poiTypeGroup.name[this.LOCALE];
		poi.poiType = this.sensorPoiStates[poiGroup].OFF;
		this.ivApi.poi.service.refreshPois();
		return poi;
	}

}
