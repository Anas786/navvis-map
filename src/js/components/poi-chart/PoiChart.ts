import * as d3 from "d3";
import {FormattedSensorDatum} from "../../services/SensorDataHelperService";
import {PoiDialogModule} from "../common/PoiDialogModule";

/**
 * The class that contains all the functions that are needed to create and append a chart to POI dialog
 */
export class PoiChart extends PoiDialogModule
{
	private static readonly MARGIN = {TOP: 25, RIGHT: 15, BOTTOM: 25, LEFT: 25};

	private static readonly HEIGHT = 200 - PoiChart.MARGIN.LEFT - PoiChart.MARGIN.RIGHT;

	private static readonly WIDTH = 395 - PoiChart.MARGIN.TOP - PoiChart.MARGIN.BOTTOM;

	constructor(elementId: string)
	{
		super(elementId);
	}

	/**
	 * Draws a chart with the given data and appends the chart to the poi details dialog.
	 * If there is already a chart appended to the dialog, it removes it and redraws the chart.
	 * @param {FormattedSensorDatum[]} chartData Data of the chart
	 * @param {number} threshold Threshold value
	 * @param {number[]} yDomain Threshold value
	 */
	public drawChart(chartData: FormattedSensorDatum[], threshold: number, yDomain: number[]): void
	{
		const poiChart = this.createContainer();

		// Initiate the plot. Create initial tags
		const svg = d3.select(`#${poiChart.id}`).append("svg")
			.attr("width", PoiChart.WIDTH + PoiChart.MARGIN.LEFT + PoiChart.MARGIN.RIGHT)
			.attr("height", PoiChart.HEIGHT + PoiChart.MARGIN.TOP + PoiChart.MARGIN.BOTTOM)
			.append("g")
			.attr("transform",
				"translate(" + PoiChart.MARGIN.LEFT + "," + PoiChart.MARGIN.TOP + ")");

		// Axis domains and scales. x domain is time, y domain is temperature from 10-100
		const xDomain = d3.extent(chartData, (d) => d.date);
		const xScale = d3.scaleTime().range([0, PoiChart.WIDTH]).domain(xDomain);
		const yScale = d3.scaleLinear().range([PoiChart.HEIGHT, 0]).domain(yDomain);

		// Line generator function
		const valueline = d3.line<FormattedSensorDatum>()
			.x((d) => xScale(d.date))
			.y((d) => yScale(d.value))
			.curve(d3.curveMonotoneX);

		// Threshold line declaration
		const warnLine = {lineValue: threshold, label: "Threshold"};

		// Add the plot line itself
		svg.append("path")
			.data([chartData])
			.attr("class", "line")
			.attr("d", valueline);

		// Create the x axis line
		svg.append("g")
			.attr("class", "x axis")
			.attr("transform", "translate(0," + PoiChart.HEIGHT + ")")
			.call(d3.axisBottom(xScale));

		// Create the y axis line
		svg.append("g")
			.attr("class", "y axis")
			.call(d3.axisLeft(yScale));

		// Add circles to all datapoints
		svg.selectAll(".dot")
			.data(chartData)
			.enter()
			.append("circle") // Uses the enter().append() method
			.attr("class", "dot") // Assign a class for styling
			.attr("cx", (d) => xScale(d.date))
			.attr("cy", (d) => yScale(d.value))
			.attr("r", 5);

		// y axis label
		svg.append("text")
			.attr("x", 0)
			.attr("y", 0)
			.text("Sensor Value");

		// Draw the threshold line
		svg.append("line")
			.attr("x1", xScale(xDomain[0]))
			.attr("y1", yScale(warnLine.lineValue))
			.attr("x2", xScale(xDomain[1]))
			.attr("y2", yScale(warnLine.lineValue))
			.attr("class", "zeroline");
	}
}
