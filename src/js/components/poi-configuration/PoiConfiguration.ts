import {PoiDialogModule} from "../common/PoiDialogModule";

/**
 * The type that defines the possible input types a configuration object can take.
 */
export enum ConfigsType
{
	DROPDOWN,
	SLIDER,
	TEXT
}

/**
 * The dictionary type that holds the configuration modules that will be added.
 */
export interface Configuration 
{
	[key: string]: {
		label: string;
		type: ConfigsType;
		min?: number;
		max?: number;
		options?: HTMLOptionElement[];
		value: number;
	};
}

/**
 * Maps Configuration object keys to their newly created corresponding HTML elements.
 */
interface InputBoxesDictionary 
{
	[key: string]: HTMLElement;
}

/**
 * The class that contains all the functions that are needed to create and append a configuration panel to POI dialog
 */
export class PoiConfiguration extends PoiDialogModule
{
	constructor(elementId: string)
	{
		super(elementId);
	}

	/**
	 * Appends a configuration panel that contains various input fields to the POI dialog.
	 * @param {Configuration} configs Configuration template that is used to define input fields
	 */
	public addToDialog(configs: Configuration): InputBoxesDictionary
	{
		const poiConfig = this.createContainer();
		const videoContainer = document.getElementById("camera-video");
		if(videoContainer != null) {
			videoContainer.remove()
		}

		const inputBoxes: InputBoxesDictionary = {};

		for (const [key, config] of Object.entries(configs))
		{
			const container = document.createElement("div");
			container.classList.add("row");
			container.style.margin = "0 10px 0 10px";
			container.appendChild(document.createTextNode(config.label));

			if (config.type === ConfigsType.TEXT)
			{
				const inputBox = document.createElement("input");
				inputBox.type = "text";
				inputBox.value = config.value.toString();
				inputBox.style.cssFloat = "right";
				inputBoxes[key] = inputBox;
				container.appendChild(inputBox);
			}
			else if (config.type === ConfigsType.SLIDER)
			{
				const inputBox = document.createElement("input");
				inputBox.type = "range";
				inputBox.value = config.value.toString();
				inputBox.min = config.min.toString();
				inputBox.max = config.max.toString();

				const sliderValueLabel = document.createElement(`span`);
				sliderValueLabel.style.cssFloat = "right";
				sliderValueLabel.textContent = config.value.toString();
				inputBox.addEventListener("change", (ev) =>
				{
					const slider = <HTMLInputElement>ev.target;
					sliderValueLabel.textContent = slider.value;
				});

				inputBoxes[key] = inputBox;
				container.appendChild(sliderValueLabel);
				container.appendChild(inputBox);

			}
			else if (config.type === ConfigsType.DROPDOWN)
			{
				const inputBox = document.createElement("select");
				config.options.forEach((option) =>
				{
					inputBox.options.add(option);
				});

				inputBox.style.cssFloat = "right";
				inputBoxes[key] = inputBox;
				container.appendChild(inputBox);
				setTimeout(() =>
				{
					inputBox.value = config.value.toString();
				}, 50);
			}
			poiConfig.appendChild(container);
		}

		return inputBoxes;
	}
}
