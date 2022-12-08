import {ApiInterface, PoiInterface, PoiTypeInterface} from "@navvis/ivion";

/**
 * Generic POI type interface. Can be extended to suit the app's needs.
 */
export interface PoiStateType
{
	title: string;
}

/**
 * Generic POI group interface. Can be extended to suit the app's needs.
 */
export interface PoiStateGroup
{
	group: string;
	types: PoiStateType[];
}

/**
 * Dictionary for easy traversal of POI groups.
 */
export interface PoiGroupDictionary
{
	[group: string]: PoiStateGroup;
}

/**
 * The class that contains helper functions to query and fetch pois.
 */
export class PoiHelperService
{
	constructor(private ivApi: ApiInterface, private readonly LOCALE: string) {}

	/**
	 * Save the POI to the server.
	 * @param {PoiInterface} poi POI to be saved
	 * @returns {Promise<PoiInterface>} A promise with the saved POI object from the server.
	 */
	public savePoi(poi: PoiInterface): Promise<PoiInterface>
	{
		return this.ivApi.poi.repository.save(poi).then((pois) =>
		pois[0]);
	}

	/**
	 * Save multiple POIs to the server.
	 * @param {PoiInterface[]} pois POI to be saved
	 * @returns {Promise<PoiInterface>} A promise with the saved POI object from the server.
	 */
	public savePois(pois: PoiInterface[]): Promise<PoiInterface[]>
	{
		return this.ivApi.poi.repository.save(pois).then((pois) =>
		{
			const savedPois = pois;
			this.ivApi.poi.service.refreshPois();
			return savedPois;
		});
	}

	/**
	 * Updates custom data of the POI.
	 * @param {number} id Poi id
	 * @param {string} customData Poi custom data
	 * @returns {Promise<PoiInterface>} A promise with the saved POI object from the server.
	 */
	public updateCustomData(id: number, customData: string): Promise<PoiInterface>
	{
		return this.ivApi.poi.repository.findOne(id).then((poi) =>
		{
			poi.customData = customData;
			return this.savePoi(poi).catch((e) => console.error(e));
		});
	}

	/**
	 * Checks whether required POI types and groups exist. If they don't, creates them.
	 * @param {PoiGroupDictionary} poiGroupDict POI groups and types that will be initialized
	 * @returns {Promise<void>} Promise that gets resolved when all POI types in the given group dictionary are initialized
	 */
	public initPoiTypes(poiGroupDict: PoiGroupDictionary): Promise<void>
	{
		return this.ivApi.poi.poiTypeGroupRepository.findAll().then(async(poiTypeGroups) =>
		{
			const poiTypeGroupNames = poiTypeGroups.map((group) => group.name[this.LOCALE]);
			const sensoryGroups = Object.values(poiGroupDict).map((type) => type.group);

			for (const group of sensoryGroups)
			{
				// Group already created. No need to do anything else.
				if (poiTypeGroupNames.includes(group))
				{
					console.log(`POI Group: ${group} already exists. Move on...`);
					continue;
				}
				await this.initPoiTypesOfGroup(poiGroupDict[group]);
			}
		});
	}

	/**
	 * Creates given POI group and its children types.
	 * @param {PoiStateGroup} poiGroupObj POI group and types that will be initialized
	 * @returns <Promise<void> Promise that gets resolved when all POI types in the given group are initialized
	 */
	private initPoiTypesOfGroup(poiGroupObj: PoiStateGroup): Promise<void>
	{
		// Create the group.
		const currGroup = this.ivApi.poi.poiTypeGroupRepository.create();
		currGroup.name[this.LOCALE] = poiGroupObj.group;
		return this.ivApi.poi.poiTypeGroupRepository.save(currGroup).then((newGroup) =>
		{
			// POI Group created succesfully! Start creating the types under it.
			console.log(`POI group created successfully!: ${newGroup[0].name[this.LOCALE]}`);

			const poiTypes: PoiTypeInterface[] = [];
			for (const poiTypeObj of poiGroupObj.types)
			{
				const newType = this.ivApi.poi.poiTypeRepository.create();
				newType.poiTypeGroup = newGroup[0];
				newType.name[this.LOCALE] = poiTypeObj.title;
				poiTypes.push(newType);
			}
			return this.ivApi.poi.poiTypeRepository.save(poiTypes).then(() =>
			{
				const poiTypesTitles = poiTypes.map((type) => type.name);
				console.log(`POI types created successfully!: ${poiTypesTitles}`);
			}).catch(() =>
			{
				console.error("Error! Can't create POI types.");
			});
		}).catch(() =>
		{
			console.error(`Error! Can't create POI group. : ${poiGroupObj.group}`);
		});
	}
}
