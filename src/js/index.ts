import "../assets/index.scss";
import {
	ApiInterface,
	getApi,
	PoiInterface,
	UserEntityInterface,
	ViewType
} from "@navvis/ivion";
import {ToggleabblePoiService} from "./services/ToggleabblePoiService";
import {connect, MqttClient} from "mqtt";
import {SidebarMenuDashboard} from "./components/sidebar-menu-dashboard/SidebarMenuDashboard";
import {PoiChart} from "./components/poi-chart/PoiChart";
import {PoiHelperService} from "./services/PoiHelperService";
import {
	FormattedSensorDatum,
	SensorDataHelperService,
	SensorDataType,
	SensorDatum,
	SensorStates,
	SensorTypeDictionary
} from "./services/SensorDataHelperService";
import {
	ConfigsType,
	Configuration,
	PoiConfiguration
} from "./components/poi-configuration/PoiConfiguration";
import {CommunicationService} from "./services/CommunicationService";
import {LimitedLengthArray} from "./components/common/LimitedLengthArray";

/**
 * Maps POI ids to actual POI objects for easy traversal.
 */
interface PoiDictionary
{
	[id: number]: PoiInterface;
}

/**
 * Poi custom data format. All sensory POIs have to follow this format.
 */
interface PoiCustomData
{
	sensorId: number;
	threshold: SensorDataType;
	value: SensorDataType;
}
declare var Clappr:any;

/**
 * The main class for a sample app which deals with getting sensor data over MQTT,
 * plotting them in poi details dialog, and showing the ones that are in alert in a dashboard
 */
class IoTDashboardApp
{
	// Replace this field with your IV instance address
	private readonly baseUrl: string = "https://park.iv.navvis.com";

	// Replace this field with your backend address
	private readonly serverUrl: string = "https://navvis-simulator-5hlm6.ondigitalocean.app";
	// private readonly serverUrl: string = "http://localhost:3000";

	// Replace this field with your MQTT broker address
	// private readonly dockerAddr = "localhost";
	private readonly dockerAddr = "navvis-api.devsy.tech";

	private readonly mqttPort = 15673;

	private ivApi: ApiInterface;

	private readonly LOCALE: string = "en";

	// Configure to change the distance needed for a POI to be consider nearby.
	private readonly DISTANCE_THRESHOLD = 10;

	// Append this variable to add new sensor types. Note that the group name must match the key.
	private readonly SENSOR_TYPES: SensorTypeDictionary = {
		"Temperature": {
			group: "Temperature",
			threshold: 55,
			types: [{
				title: "Temperature Alert",
				state: SensorStates.ALERT
			},
				{
					title: "Temperature Normal",
					state: SensorStates.NORMAL
				}
			],
			range: [10, 100],
			topic: "temperature",
			unit: "°C"
		},
		"Pressure": {
			group: "Pressure",
			types: [{
				title: "Pressure Alert",
				state: SensorStates.ALERT
			},
				{
					title: "Pressure Normal",
					state: SensorStates.NORMAL
				}
			],
			threshold: 2,
			range: [0.5, 10],
			topic: "pressure",
			unit: "atm"
		},
	};

	// Configure to change the max number of data points of historical sensor data.
	private readonly HISTORICAL_DATA_LENGTH = 30;

	// Configure to change the topic prefix.
	private topicPrefix = "iot";

	private topics: string[] = [];

	private nearbyPois: PoiDictionary = {};

	private historicalData: LimitedLengthArray<FormattedSensorDatum>;

	private poiId: number;

	private client: MqttClient;

	private threshold: number;

	private sensorId: number;

	private wideMode = false;

	private toggleablePoiService: ToggleabblePoiService;

	private poiHelperService: PoiHelperService;

	private sensorDataHelperService: SensorDataHelperService;

	private communicationService: CommunicationService;

	private sidebarMenuDashboard: SidebarMenuDashboard;

	private poiChart: PoiChart;

	private poiConfiguration: PoiConfiguration;

	constructor()
	{
		getApi(this.baseUrl).then((iv) =>
		{
			this.ivApi = iv;

			// Page is first loaded and the user is logged in.
			if (this.ivApi.site.service.activeSite)
			{
				this.init();
			}
			else
			{
				// Listen to site change.
				const siteLoadConnection = this.ivApi.site.service.activeSiteSelected.connect(
					(site, oldSite) =>
					{
						// The first site is loaded after page reload, Run init() once.
						this.init();
						siteLoadConnection.disconnect();
					});
			}
		}).catch(() =>
		{
			console.error("Connection to the IndoorViewer can't be established!");
		});
	}

	/**
	 * The entry point for the sample app. Checks whether all required POI types are required
	 * and calls start() function.
	 */
	private init(): void
	{
		this.poiHelperService = new PoiHelperService(this.ivApi, this.LOCALE);

		// Check if required POI types exist.
		this.poiHelperService.initPoiTypes(this.SENSOR_TYPES).then(() =>
		{
			this.start();
		}).catch(() =>
		{
			console.error("Couldn't initiate necessary POI groups!");
		});
	}

	/**
	 * The main function for the sample app which deals with getting sensor data over MQTT,
	 * plotting them in poi details dialog, and showing the ones that are in alert in a dashboard
	 */
	private start(): void
	{
		// Initiate components and services
		this.toggleablePoiService =
			new ToggleabblePoiService(this.ivApi, this.SENSOR_TYPES, this.LOCALE);
		this.sensorDataHelperService = new SensorDataHelperService();
		this.communicationService = new CommunicationService(this.baseUrl, this.serverUrl);

		this.poiChart = new PoiChart("poi-chart");
		this.poiConfiguration = new PoiConfiguration("poi-config");
		this.sidebarMenuDashboard = new SidebarMenuDashboard(this.ivApi);
		this.historicalData =
			new LimitedLengthArray<FormattedSensorDatum>(this.HISTORICAL_DATA_LENGTH);

		// Add sidebar dashboard to the sidebar menu
		this.ivApi.ui.sidebarMenuService.items.push(this.sidebarMenuDashboard.dashboard);

		this.ivApi.view.service.setPrimaryView(ViewType.MAP);

		this.client = connect(`https://${this.dockerAddr}:${this.mqttPort}/wss`, {protocol: "wss"});

		this.client.on("message", this.handleMqttMessage.bind(this));

		// Periodically update sidebar menu dashboard.
		setInterval(() =>
		{
			this.handleSidebarDashboardRefresh();
		}, 500);

		// Subscribe to all nearby pois when the app is loaded
		this.subscribeToNearbyPois();

		// Subscribe to all nearby pois when camera is moved
		this.ivApi.view.service.onTransitionEnd.connect(this.subscribeToNearbyPois.bind(this));

		// Clean up after poi delete
		this.ivApi.poi.service.onPoiDelete.connect(this.handlePoiDelete.bind(this));

		// Main logic of the app. Handles everything about the poi dialog.
		this.ivApi.poi.service.onPoiOpen.connect(this.handlePoiOpen.bind(this));

		// Cleans up current selected POI variables.
		this.ivApi.poi.service.onPoiClose.connect(this.handlePoiClose.bind(this));

		// Creates / adjusts custom data of sensory type POIs.
		this.ivApi.poi.service.onPoiSave.connect(this.handlePoiSave.bind(this));
	}

	/**
	 * Subscribes to the messages of sensors that are connected to nearby pois
	 */
	private subscribeToNearbyPois(): void
	{
		// If the nearbyPois variable is already set (most likely camera is moved to another location)
		// Then save any changes that might be made on those pois.
		if (Object.keys(this.nearbyPois).length > 0)
		{
			this.poiHelperService.savePois(Object.values(this.nearbyPois)).catch((e) =>
			{
				console.error(e);
			});
		}

		// Unsubscribe from all topics.
		if (this.topics.length > 0)
		{
			this.client.unsubscribe(this.topics);
		}
		this.topics = [];

		this.findNearbyPois().then((pois) =>
		{
			for (const poi of pois)
			{
				// Try will fail if the customData of the POI is not configured properly.
				// This should not happen normally.
				try
				{
					const customData: PoiCustomData = JSON.parse(poi.customData);

					// Fill nearbyPois
					this.nearbyPois[poi.id] = poi;

					// This should not happen in normal cases.
					if (!customData.sensorId)
					{
						console.error(`SensorId of poi: ${poi.title} not found!`);
						continue;
					}

					const poiGroup = poi.poiType.poiTypeGroup.name[this.LOCALE];
					const topic = this.SENSOR_TYPES[poiGroup].topic;
					this.topics.push(`${this.topicPrefix}/${topic}/${customData.sensorId}`);
				}
				catch (e)
				{
					console.error(`${poi.title} has incompatible customData.`);
				}
			}

			// Subscribe to all topics corresponding to nearby POIs.
			this.client.subscribe(this.topics);
		}).catch(() => {});
	}

	/**
	 * Finds all nearby POIs
	 * @returns {Promise<PoiInterface[]>} Return a promise that holds array of nearby POIs
	 */
	private findNearbyPois(): Promise<PoiInterface[]>
	{
		// ThreeJS camera
		const camera = this.ivApi.view.mainView.getCamera();

		// Coordinate of the camera in the local space.
		const cameraLocalLocation = camera.position.clone();

		// Coordinate of the camera in the global space.
		const cameraGlobalLocation = this.ivApi.transform.service.localToGlobal
			.transform(cameraLocalLocation);

		const filter = this.ivApi.poi.repository.createFilterBuilder().build();

		// Wide mode corresponds to the checkbox in the sidebar menu dashboard.
		// If wide mode is enabled no filter is applied to location (looks at all POIs)
		if (!this.wideMode)
		{
			filter.x = cameraGlobalLocation.x;
			filter.y = cameraGlobalLocation.y;
			filter.z = cameraGlobalLocation.z;
			filter.radius = this.DISTANCE_THRESHOLD;
		}

		// Get all POIs that passes the filter.
		return this.ivApi.poi.repository.filter(filter).then((pois) =>
		{
			this.ivApi.poi.service.unhighlightPois(Object.values(this.nearbyPois));
			this.nearbyPois = {};
			// Filter the result once again to get only the sensory POIs.
			const nearbyPois = pois.filter((poi) =>
			{
				const poiGroup = poi.poiType.poiTypeGroup.name[this.LOCALE];
				return this.sensorDataHelperService.isSensor(poiGroup, this.SENSOR_TYPES);
			});
			this.ivApi.poi.service.highlightPois(nearbyPois);
			return nearbyPois;
		});
	}

	/**
	 * Handles GET request for the sensor historical data endpoint
	 * @param {SensorDatum[]} historicalData Http request
	 * @param {string} type POI group name
	 */
	private handleHistoricalSensorDataQuery(historicalData: SensorDatum[], type: string): void
	{
		this.historicalData.empty();

		const formattedData = this.sensorDataHelperService.formatSensorData(historicalData);
		formattedData.forEach((datum) =>
		{
			this.historicalData.push(datum);
		});

		this.poiChart.drawChart(this.historicalData, this.threshold, this.SENSOR_TYPES[type].range);
	}

	/**
	 * Handles incoming Mqtt messages.
	 * Updates poi title and the chart.
	 * @param {string} topic Topic of the incoming message
	 * @param {string} message Body of the incoming message
	 */
	private handleMqttMessage(topic: string, message: string): void
	{
		const sensorData: SensorDatum = JSON.parse(message.toString());

		console.log(sensorData)

		for (const poi of Object.values(this.nearbyPois))
		{
			const oldCustomData: PoiCustomData = JSON.parse(poi.customData);

			if (oldCustomData.sensorId !== sensorData.id)
			{
				continue;
			}
			const poiGroup = poi.poiType.poiTypeGroup.name[this.LOCALE];

			const customData: PoiCustomData = {
				sensorId: oldCustomData.sensorId,
				threshold: oldCustomData.threshold || this.SENSOR_TYPES[poiGroup].threshold,
				value: sensorData.value
			};

			poi.customData = JSON.stringify(customData);

			// Check if poi title is already in format "50°C-XYZ".
			// If it is at that format, poiTitle = XYZ, else poiTitle is all of the title.
			// regex matches the substring following the first - character
			const poiTitleMatch = poi.title.match("-(.*)");
			const poiTitle = poiTitleMatch && poiTitleMatch[1] ? poiTitleMatch[1] : poi.title;

			// Used for showing the sensor data in the poi title.
			poi.title = `${sensorData.value} ${this.SENSOR_TYPES[poiGroup].unit}-${poiTitle}`;

			if (this.poiId && this.poiId === poi.id)
			{
				// Appends the new datum to chart data and redraws the chart.
				// Note that this array has a fixed length
				// so if it reaches the length threshold, the earliest data will be popped.
				this.historicalData.push({
					value: sensorData.value,
					date: new Date(sensorData.timestamp)
				});
				const range = this.SENSOR_TYPES[poiGroup].range;
				this.poiChart.drawChart(this.historicalData, this.threshold, range);
			}

			if (sensorData.value > customData.threshold)
			{
				this.toggleablePoiService.switchPoiToOn(poi);
			}
			else
			{
				this.toggleablePoiService.switchPoiToOff(poi);
			}

			this.nearbyPois[poi.id] = poi;
		}
	}

	/**
	 * Handles periodically refreshing sidebar menu dashboard
	 */
	private handleSidebarDashboardRefresh(): void
	{
		const poisOnAlert: PoiInterface[] = [];
		for (const poi of Object.values(this.nearbyPois))
		{
			const customData: PoiCustomData = JSON.parse(poi.customData);
			if (customData.value > customData.threshold)
			{
				poisOnAlert.push(poi);
			}
		}
		this.sidebarMenuDashboard.refreshItems(poisOnAlert);

		const wideModeCheckbox = <HTMLInputElement>document.getElementById("wide-mode-checkbox");

		if (wideModeCheckbox)
		{
			if (wideModeCheckbox.checked !== this.wideMode)
			{
				this.subscribeToNearbyPois();
			}
			wideModeCheckbox.checked = this.wideMode;
		}
	}

	/**
	 * Handles fetching the list of sensor ids. Holds the main logic of creating the configuration
	 * module for the POI dialog.
	 * @param {number[]} sensorIds Array of available sensor IDs.
	 * @param {string} poiGroup name of the POI group
	 * @param {PoiCustomData} customData Custom data field of the POI. Holds threshold, sensor id
	 */
	private handleFetchSensorId(sensorIds: number[], poiGroup: string,
		customData: PoiCustomData): void
	{
		const options: HTMLOptionElement[] = [];

		// Populate sensor id dropdown
		sensorIds.forEach((id) =>
		{
			const option = document.createElement("option");
			option.value = id.toString();
			option.text = id.toString();
			options.push(option);
		});

		const configs: Configuration = {};
		configs["threshold"] = {
			label: "Threshold",
			type: ConfigsType.SLIDER,
			min: this.SENSOR_TYPES[poiGroup].range[0],
			max: this.SENSOR_TYPES[poiGroup].range[1],
			value: customData.threshold || this.SENSOR_TYPES[poiGroup].threshold
		};

		configs["sensorId"] = {
			label: "Sensor ID",
			type: ConfigsType.DROPDOWN,
			options: options,
			value: customData.sensorId || 0
		};

		const inputBoxes = this.poiConfiguration.addToDialog(configs);

		inputBoxes["threshold"].addEventListener("change", this.handleThresholdChange.bind(this));

		inputBoxes["sensorId"].addEventListener("change", (ev) =>
		{
			this.handleSensorIdChange(ev, poiGroup);
		});
	}

	/**
	 * Handles threshold value changes in POI dialog configuration module.
	 * @param {Event} ev Input element event
	 */
	private handleThresholdChange(ev: Event): void
	{
		const thresholdBox = <HTMLInputElement>(ev.target);
		this.threshold = parseFloat(thresholdBox.value);
		const currValue = this.historicalData[0] ? this.historicalData[0].value
			: undefined;
		const customData: PoiCustomData = {
			value: currValue,
			threshold: this.threshold,
			sensorId: this.sensorId
		};
		this.poiHelperService.updateCustomData(this.poiId, JSON.stringify(customData))
			.catch((e) => console.error(e));
	}

	/**
	 * Handles sensor ID changes in POI dialog configuration module.
	 * @param {Event} ev Input element event
	 * @param {string} poiGroup POI group name
	 */
	private handleSensorIdChange(ev: Event, poiGroup: string): void
	{
		const sensorIdBox = <HTMLSelectElement>(ev.target);
		const oldTopic = `${this.topicPrefix}/${this.SENSOR_TYPES[poiGroup].topic}/${this.sensorId}`;
		this.sensorId = parseFloat(sensorIdBox.value);
		const newTopic = `${this.topicPrefix}/${this.SENSOR_TYPES[poiGroup].topic}/${this.sensorId}`;

		const currValue = this.historicalData[0] ? this.historicalData[0].value : undefined;
		const customData: PoiCustomData = {
			value: currValue,
			threshold: this.threshold,
			sensorId: this.sensorId
		};
		this.poiHelperService.updateCustomData(this.poiId, JSON.stringify(customData))
			.catch((e) => console.error(e));

		this.topics = this.topics.filter((topic) => topic !== oldTopic);
		this.client.unsubscribe(oldTopic);
		this.topics.push(newTopic);
		this.client.subscribe(newTopic);

		const topic = this.SENSOR_TYPES[poiGroup].topic;
		this.communicationService.fetchHistoricalData(topic, customData.sensorId)
			.then((historicalData) =>
			{
				this.handleHistoricalSensorDataQuery(historicalData, poiGroup);
			}).catch(() => {});
	}

	/**
	 * Handles closing POI dialog. Cleans up current POI variables
	 * @param {PoiInterface} poi POI that is being closed
	 */
	private handlePoiClose(poi: PoiInterface): void
	{
		this.ivApi.poi.service.highlightPois([poi]);
		this.poiId = undefined;
		this.historicalData.empty();
		this.threshold = undefined;
		this.sensorId = undefined;
	}

	/**
	 * Handles deleting a POI. Cleans up MQTT topics.
	 * @param {PoiInterface} poi POI that is being closed
	 */
	private handlePoiDelete(poi: PoiInterface): void
	{
		const poiGroup = poi.poiType.poiTypeGroup.name[this.LOCALE];
		if (this.sensorDataHelperService.isSensor(poiGroup, this.SENSOR_TYPES))
		{
			const customData: PoiCustomData = JSON.parse(poi.customData);
			const oldTopic = `${this.topicPrefix}/${this.SENSOR_TYPES[poiGroup].topic}/${customData.sensorId}`;
			this.client.unsubscribe(oldTopic);
			delete this.nearbyPois[poi.id];
		}
	}

	/**
	 * Handles saving or creating a POI. Inserts default threshold and sensor ID values if they are
	 * not present.
	 * @param {PoiInterface} poi POI that is being saved
	 * @param {boolean} created true if a new POI is being created, false otherwise
	 */
	private handlePoiSave(poi: PoiInterface, created: boolean): void
	{
		if (created)
		{
			this.poiConfiguration.remove();
			this.poiChart.remove();
		}
		const poiGroup = poi.poiType.poiTypeGroup.name[this.LOCALE];

		// No need to do anything extra if the POI is not a sensor.
		if (!this.sensorDataHelperService.isSensor(poiGroup, this.SENSOR_TYPES))
		{
			return;
		}
		// Try will fail if the customData of the POI is not configured properly.
		// This should not happen normally.
		try
		{
			const customData = JSON.parse(poi.customData);
			const newCustomData: PoiCustomData = {
				sensorId: customData.sensorId || undefined,
				value: customData.value || undefined,
				threshold: customData.threshold || this.SENSOR_TYPES[poiGroup].threshold
			};
			this.poiHelperService.updateCustomData(poi.id, JSON.stringify(newCustomData))
				.catch((err) =>
				{
					console.log(err);
				});
		}
		catch (e)
		{
			const customData: PoiCustomData = {
				sensorId: undefined,
				value: undefined,
				threshold: this.SENSOR_TYPES[poiGroup].threshold
			};
			this.poiHelperService.updateCustomData(poi.id, JSON.stringify(customData))
				.catch((err) =>
				{
					console.log(err);
				});
		}
	}

	cameraPlay() {
		var playerElement = document.getElementById("player-wrapper");
  
		var r = 3; // Retry attempts
  
		var player = new Clappr.Player({
		//   source: 'https://multiplatform-f.akamaihd.net/i/multi/will/bunny/big_buck_bunny_,640x360_400,640x360_700,640x360_1000,950x540_1500,.f4v.csmil/master.m3u8',
		  source: 'https://birwaz.store/hls/test.m3u8',
		  disableErrorScreen: true, // Disable the internal error screen plugin
		  height: 350,
		  width: '100%',
		  events: {
			onError: function(e: Error) {
			  r--;
			  var s = player.options.source;
			  // Replace previous line by the following line to simulate successful recovery
			  // var s = (r > 2) ? player.options.source : 'http://clappr.io/highline.mp4';
			  var t = 10;
			  var retry = function() {
				if (t === 0) {
				  var o = player.options;
				  o.source = s;
				  player.configure(o);
				  return;
				}
				Clappr.$('#retryCounter').text(t);
				t--;
				setTimeout(retry, 1000);
			  };
			  player.configure({
				autoPlay: true,
				source: 'playback.error',
				playbackNotSupportedMessage: 'Network fatal error.' + ((r > 0)
					? ' Retrying in <span id="retryCounter"></span> seconds ...'
					: ' All retry attempts failed'),
			  });
			  if (r > 0) {
				retry();
			  }
			}
		  }
		});
  
		player.attachTo(playerElement);
	}

	protected createVideoContainer(): HTMLElement
	{
		const poiDetailsPanel = document.getElementById("poi-details-panel");

		// If there is already a drawn chart, remove it.
		// this.remove();

		// Create the container and add cosmetic classes
		// const poiModuleContainer = document.createElement("div");
		// poiModuleContainer.classList.add("panel-body");
		// poiModuleContainer.classList.add("border-top");

		// Create video container
		const videoContainer = document.createElement("div");
		videoContainer.id = "camera-video"
		videoContainer.classList.add("panel-body");
		videoContainer.classList.add("border-top");
		videoContainer.innerHTML = "<div id=\"player-wrapper\"></div>";


		// Append the chart and the container to the poi dialog
		// poiDetailsPanel.append(poiModuleContainer);
		// poiModuleContainer.append(module);
		poiDetailsPanel.append(videoContainer);
		this.cameraPlay();
		return videoContainer;
	}

	/**
	 * Handles opening a POI. Holds the main logic. Creates modules that needs to be added to
	 * the POI dialog such as chart or configuration module.
	 * @param {PoiInterface} poi POI that is being saved
	 */
	private handlePoiOpen(poi: PoiInterface): void
	{
		const poiGroup = poi.poiType.poiTypeGroup.name[this.LOCALE];
		setTimeout(()=>{
			const videoContainer = document.getElementById("video-cam");
			if(poi.poiType.name.en == "Information" && videoContainer == null) {
				this.createVideoContainer()
			}
		},50)

		// If the poi isn't a sensor, remove all extra modules and go to the POI.
		if (!this.sensorDataHelperService.isSensor(poiGroup, this.SENSOR_TYPES))
		{
			this.poiConfiguration.remove();
			this.poiChart.remove();
			this.ivApi.poi.service.goToPoi(poi).catch((err) =>
			{
				console.log(err);
			});
			return;
		}

		// Wait a short while so that all DOM elements of the poi dialog are loaded.
		setTimeout(() =>
		{
			const customData: PoiCustomData = JSON.parse(poi.customData);

			const poiGroup = poi.poiType.poiTypeGroup.name[this.LOCALE];

			this.communicationService.fetchSensorIds(this.SENSOR_TYPES[poiGroup].topic)
				.then((sensorIds) =>
				{
					this.handleFetchSensorId(sensorIds, poiGroup, customData);
				}).catch(() => {});

			this.poiId = poi.id;

			// If there is no attached threshold for some reason, attach the default threshold.
			this.threshold = customData.threshold || this.SENSOR_TYPES[poiGroup].threshold;

			// If there is no attached sensor for some reason, attach the default sensorId.
			this.sensorId = customData.sensorId || 0;

			// Fetch historical data to plot the chart.
			const topic = this.SENSOR_TYPES[poiGroup].topic;
			this.communicationService.fetchHistoricalData(topic, customData.sensorId)
				.then((historicalData) =>
				{
					this.handleHistoricalSensorDataQuery(historicalData, poiGroup);

				}).catch(() => {});
		}, 50);
	}

	/**
	 * Checks whether a guest user can access the app.
	 * @param {boolean} isPrivate Flag that indicates whether the IV instance is private or not
	 * @param {UserEntityInterface} user User that wants to access the app
	 * @returns {boolean} True if the user can access the app, false otherwise
	 */
	private static guestUserCanAccessApp(isPrivate: boolean, user: UserEntityInterface): boolean
	{
		return !isPrivate && user.isGuest();
	}
}

(<any>window).IoTDashboardApp = new IoTDashboardApp();
