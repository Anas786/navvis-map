import {
	ApiInterface,
	IconInfoInterface,
	PoiInterface,
	SidebarMenuItemInterface
} from "@navvis/ivion";

/**
 * The class that contains all the functions that are needed to create a sidebar menu sensor dashboard
 */
export class SidebarMenuDashboard
{
	public dashboard: SidebarMenuItemInterface;

	constructor(private readonly ivApi: ApiInterface)
	{
		const icon: IconInfoInterface = {
			className: "material-icons",
			ligature: "warning",
			path: ""
		};
		const items: SidebarMenuItemInterface[] = [];
		this.dashboard = {
			title: "Sensor Alert Dashboard",
			icon: icon,
			isPreviewIconVisible: () => true,
			isFullscreen: false,
			isVisible: () => true,
			items: items,
			onClick: () => true,
			template: "./sidebar-menu-dashboard.html"
		};
	}

	/**
	 * Add or update the pois in the dashboard
	 * Removes all of the items of the dashboard and adds the given ones.
	 * @param {PoiInterface[]} pois Pois that will be added to the dashboard.
	 */
	public refreshItems(pois: PoiInterface[]): void
	{
		const icon: IconInfoInterface = {
			className: "material-icons",
			ligature: "warning",
			path: ""
		};
		const items: SidebarMenuItemInterface[] = [];
		this.dashboard.items = pois.map((poi) => ({
			title: poi.title,
			icon: icon,
			isPreviewIconVisible: () => true,
			isFullscreen: false,
			isVisible: () => true,
			items: items,
			onClick: () =>
			{
				this.ivApi.ui.sidebarMenuService.closeMenu();
				this.ivApi.poi.service.openPoi(poi);
			},
			template: ""
		}));
	}
}

