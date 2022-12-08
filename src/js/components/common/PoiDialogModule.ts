/**
 * The abstract class that represents all modular extensions to the poi details dialog.
 */
export abstract class PoiDialogModule
{
	protected constructor(private elementId: string) {}

	/**
	 * Creates the poi dialog module and its container. Assigns id and necessary classes.
	 * If it is already created, redraws it.
	 * @returns {Promise<PoiInterface>} A promise with the saved POI object from the server.
	 */
	protected createContainer(): HTMLElement
	{
		console.log(this.elementId)
		const poiDetailsPanel = document.getElementById("poi-details-panel");

		// If there is already a drawn chart, remove it.
		this.remove();

		// Create the container and add cosmetic classes
		const poiModuleContainer = document.createElement("div");
		poiModuleContainer.classList.add("panel-body");
		poiModuleContainer.classList.add("border-top");

		// Create the chart and add cosmetic classes
		const module = document.createElement("div");
		module.classList.add("collapse-content");
		module.classList.add("poi-description");
		module.id = this.elementId;

		// Append the chart and the container to the poi dialog
		poiDetailsPanel.append(poiModuleContainer);
		poiModuleContainer.append(module);
		// poiDetailsPanel.append(videoContainer);

		return module;
	}

	/**
	 * Removes the module from the poi details dialog.
	 */
	public remove(): void
	{
		const poiModuleEl = document.getElementById(this.elementId);
		if (poiModuleEl && poiModuleEl.parentElement)
		{
			document.getElementById(this.elementId).parentElement.remove();
		}
	}
}
