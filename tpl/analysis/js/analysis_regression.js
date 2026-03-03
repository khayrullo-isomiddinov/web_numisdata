/**
 * @module analysis_regression
 * @description Provides regression analysis and visualization logic for the numismatic catalog.
 * This module handles loading regression data, calculating rarity indices, and rendering
 * D3.js charts for obverse and reverse die estimations.
 *
 * How to:
 * 1 - Loading type information (weight, diameter, material, etc.) from charts:
 *     When a user clicks on a data point in a generated graph, use the `type_tooltip_callback(options)`
 *     function exported from `analysis.js`. It fetches the full catalog record from the Dedalo API
 *     and returns a Promise resolving to an HTML Element with the rendered data for the tooltip.
 *     Example options: { id: section_id, type_number: ref_num, mint: mint_name }
 */

/**
 * Module-level cache for the in-flight loading promise.
 * Moving this outside the exported object ensures we prevent parallel
 * requests even if object properties are spread.
 * @type {Promise|null}
 */
let load_promise = null;


export const analysis_regression = {

	regression_vars: null,

	/**
	 * Initializes the regression module.
	 * Loads the necessary regression variables.
	 * @returns {Promise<void>}
	 */
	init: function() {
		return this.load_regression_vars().then((vars) => {
            if(SHOW_DEBUG===true) {
                console.log("keys:", Object.keys(vars));
                console.log("ir length:", vars.ir ? vars.ir.length : undefined);
            }
		});
	},

	/**
	 * Loads regression variables from the database.
	 * Returns a cached promise if a request is already in flight or already completed.
	 *
	 * @returns {Promise<Object>} A promise that resolves to the regression variables object.
	 */
	load_regression_vars: function() {
        // 1. If we already have the data, return it immediately in a resolved promise
        if(this.regression_vars) {
            return Promise.resolve(this.regression_vars)
        }

        // 2. If a request is already in flight, return that same promise to avoid redundant calls
        if (load_promise) {
            // When the promise resolves, make sure this object instance gets the data
            return load_promise.then(vars => {
                this.regression_vars = vars;
                return vars;
            });
        }

        if(page_globals.WEB_DB === "web_numisdata_mib") {
            console.error('This database is not available yet! Use web_numisdata_mib_pre instead')
        }

		const request_body = {
			dedalo_get : 'records',
			db_name    : page_globals.WEB_DB || "web_numisdata_mib_pre", // PRO is not available yet !
 			table      : 'ts_web',
			ar_fields  : ['titulo', 'cuerpo', 'norder', 'web_path'],
			lang       : 'lg-spa',
			sql_filter : "web_path = 'regression_vars'",
			order      : 'norder ASC',
			limit      : 1000
		};

		load_promise = data_manager.request({ body: request_body })
			.then((response) => {
				const vars = Object.fromEntries(
					response.result
						.filter(r => r.titulo && r.cuerpo)
						.map(r => [r.titulo, JSON.parse(r.cuerpo)])
				);

                this.regression_vars = vars;

                if(SHOW_DEBUG===true) {
                    console.log('---> regression_vars loaded', this.regression_vars)
                }

				return vars;
			})
            .finally(() => {
                // Clear the promise when done so it can be re-fetched if needed (though here we have regression_vars)
                load_promise = null;
            });

        return load_promise;
	},

	/**
	 * Prepares data traces for the obverse (anverso) regression model.
	 * @param {string|Element} regression_model_chart_container - The container where the chart will be rendered (not used directly here but passed for context).
	 * @returns {Promise<Array<Object>>} A promise that resolves to an array of trace objects for the chart.
	 * @example
	 * analysis.plot_anv('#chart-container').then(traces => { ... });
	 */
	plot_anv: function(regression_model_chart_container) {

		return this.load_regression_vars().then(() => {

			// Si quieres mantener nombres como antes:
			const IR = this.regression_vars.ir;
			const D_anv = this.regression_vars.d_anv;

			// Si estos también vienen de regression_vars:
			const IR_ant = this.regression_vars.ir_ant;
			const Anvers = this.regression_vars.anvers;

			// Obtain coefficients
			const { a, b } = this.coefficients(IR, D_anv);

			const minIR = Math.min(...IR);
			const maxIR = Math.max(...IR);

			// Generate x_vals
			const x_vals = Array.from(
				{ length: 2000 },
				(_, i) => minIR + (i / 1999) * (maxIR - minIR)
			);

			// Generate y_vals
			const y_vals = x_vals.map(x => a + b * x);

			const traces = [
				{
					x: IR_ant,
					y: Anvers,
					mode: 'markers',
					type: 'scatter',
					name: 'Datos observados',
					marker: { color: 'skyblue' },
					hovertemplate:
						"Num. monedas: %{x}<br>" +
						"Estimación cuños: %{y}<extra></extra>",
					xaxis: 'x1',
					yaxis: 'y1'
				},
				{
					x: x_vals,
					y: y_vals,
					mode: 'lines',
					type: 'scatter',
					name: 'Modelo estimado',
					line: { color: 'lightsteelblue', width: 2 },
					xaxis: 'x1',
					yaxis: 'y1'
				}
			];

			return traces;
		});
	},

	/**
	 * Calculates the Index of Rarity (IR) and die approximation for an emblem (obverse).
	 * @param {Object} emblem - The emblem/type data object.
	 * @param {Array<boolean>} emblem.full_coins_reference_calculable - Array indicating which coins are calculable.
	 * @returns {Promise<{ir: number, approx: number}>} Object containing the calculated IR and estimated number of dies.
	 */
	calculation_IR_anv: function (emblem) {
		const index = emblem.full_coins_reference_calculable || [];

		// Define counter
		let ir = 0;
		for (let i = 0; i < index.length; i++) {
			if (index[i] === true) ir++;
		}

		// Asegurar que regression_vars está cargado
		return this.load_regression_vars().then(() => {
			const IR = this.regression_vars.ir;
			const D_anv = this.regression_vars.d_anv;

			const { a, b } = this.coefficients(IR, D_anv);

			const approx = a + b * ir;

			return { ir, approx };
		});
	},

	/**
	 * Generates a scatter trace for the specific data points of the current search results (obverse).
	 * @param {Array<Object>} parsed_data - The search results data.
	 * @param {string|Element} regression_model_chart_container - Container reference.
	 * @returns {Promise<Array<Object>>} Array containing the point trace object.
	 */
	plot_points_regression_anv: function(parsed_data, regression_model_chart_container){

		const self = this;
		const emblems = parsed_data.slice(1); // saltas el 0 como antes

		return Promise.all(
			emblems.map(emblem => self.calculation_IR_anv(emblem).then(({ ir, approx }) => {
				return {
					ir,
					approx,
					ceca: emblem.p_mint,
					id: emblem.term_section_id,
					num: emblem.ref_type_number,
					ref_ceca: emblem.ref_mint_number
				};
			}))
		).then((vect_tipos) => {

			const xValues = vect_tipos.map(obj => obj.ir);
			const yValues = vect_tipos.map(obj => obj.approx);

			const pointsTrace = {
				x: xValues,
				y: yValues,
				mode: 'markers',
				type: 'scatter',
				name: 'Aproximación',
				customdata: vect_tipos.map(o => [o.ceca, o.id, o.ref_ceca, o.num]),
				hovertemplate:
					"Ceca: %{customdata[0]}<br>" +
					"MIB: %{customdata[1]} | %{customdata[2]} / %{customdata[3]}<br>" +
					"Num. monedas: %{x}<br>" +
					"Estimación cuños anverso: %{y}<extra></extra>",
				marker: {
					color: 'darkblue',
					size: 10,
					line: { width: 2, color: 'black' }
				},
				xaxis: 'x1',
				yaxis: 'y1'
			};

			return [pointsTrace];
		});
	},

	/**
	 * Prepares data traces for the reverse (reverso) regression model.
	 * @param {string|Element} regression_model_chart_container - Container reference.
	 * @returns {Promise<Array<Object>>} A promise that resolves to an array of trace objects.
	 */
	plot_rev: function(regression_model_chart_container) {

		return this.load_regression_vars().then(() => {

			const IR    = this.regression_vars.ir;
			const D_rev = this.regression_vars.d_rev;

			// Si estos también vienen de regression_vars:
			const IR_ant = this.regression_vars.ir_ant;  // o this.IR_ant si lo sigues cargando por otro lado
			const Revers = this.regression_vars.revers;  // o this.Revers

			// Obtain coefficients
			const { a, b } = this.coefficients(IR, D_rev);

			const minIR = Math.min(...IR);
			const maxIR = Math.max(...IR);

			// Generate x_vals
			const x_vals = Array.from(
				{ length: 2000 },
				(_, i) => minIR + (i / 1999) * (maxIR - minIR)
			);

			// Generate y_vals
			const y_vals = x_vals.map(x => a + b * x);

			const traces = [
				{
					x: IR_ant,
					y: Revers,
					mode: 'markers',
					type: 'scatter',
					name: 'Datos observados',
					marker: { color: 'skyblue' },
					hovertemplate:
						"Num. monedas: %{x}<br>" +
						"Estimación cuños: %{y}<extra></extra>",
					xaxis: 'x2',
					yaxis: 'y2'
				},
				{
					x: x_vals,
					y: y_vals,
					mode: 'lines',
					type: 'scatter',
					name: 'Modelo estimado',
					line: { color: 'lightsteelblue', width: 2 },
					xaxis: 'x2',
					yaxis: 'y2'
				}
			];

			return traces;
		});
	},

	/**
	 * Calculates the IR and die approximation for an emblem (reverse).
	 * @param {Object} emblem - The emblem/type data object.
	 * @returns {Promise<{ir: number, approx: number}>}
	 */
	calculation_IR_rev: function (emblem) {
		const index = emblem.full_coins_reference_calculable || [];

		let ir = 0;
		for (let i = 0; i < index.length; i++) {
			if (index[i] === true) ir++;
		}

		return this.load_regression_vars().then(() => {
			const IR = this.regression_vars.ir;
			const D_rev = this.regression_vars.d_rev;

			const { a, b } = this.coefficients(IR, D_rev);

			const approx = a + b * ir;

			return { ir, approx };
		});
	},

	/**
	 * Generates a scatter trace for the specific data points of the current search results (reverse).
	 * @param {Array<Object>} parsed_data - The search results data.
	 * @param {string|Element} regression_model_chart_container - Container reference.
	 * @returns {Promise<Array<Object>>} Array containing the point trace object.
	 */
	plot_points_regression_rev : function(parsed_data, regression_model_chart_container){

		const self = this;
		const emblems = parsed_data.slice(1);

		return Promise.all(
			emblems.map(emblem =>
				self.calculation_IR_rev(emblem).then(({ ir, approx }) => ({
					ir,
					approx,
					ceca: emblem.p_mint,
					id: emblem.term_section_id,
					num: emblem.ref_type_number,
					ref_ceca: emblem.ref_mint_number
				}))
			)
		).then((vect_tipos) => {

			const xValues = vect_tipos.map(obj => obj.ir);
			const yValues = vect_tipos.map(obj => obj.approx);

			const pointsTrace = {
				x: xValues,
				y: yValues,
				mode: 'markers',
				type: 'scatter',
				name: 'Aproximación',
				customdata: vect_tipos.map(o => [o.ceca, o.id, o.ref_ceca, o.num]),
				hovertemplate:
					"Ceca: %{customdata[0]}<br>" +
					"MIB: %{customdata[1]} | %{customdata[2]} / %{customdata[3]}<br>" +
					"Num. monedas: %{x}<br>" +
					"Estimación cuños reverso: %{y}<extra></extra>",
				marker: {
					color: 'darkblue',
					size: 10,
					line: { width: 2, color: 'black' }
				},
				xaxis: 'x2',
				yaxis: 'y2'
			};

			return [pointsTrace];
		});
	},

	/**
	 * Orchestrates the full regression plotting for both obverse and reverse models.
	 * Loads data, calculates points, prepares traces, and triggers the D3 rendering.
	 * @param {string|Element} regression_model_chart_container - Target DOM element or selector.
	 * @param {Array<Object>} parsed_data - Search result data to plot.
	 * @returns {Promise<void>}
	 * @example
	 * analysis.plot_rev_and_anv('#my-regression-chart', resultsData);
	 */
	plot_rev_and_anv: function(regression_model_chart_container, parsed_data) {
		return Promise.all([
			this.plot_rev(regression_model_chart_container),
			this.plot_points_regression_rev(parsed_data, regression_model_chart_container),
			this.plot_anv(regression_model_chart_container),
			this.plot_points_regression_anv(parsed_data, regression_model_chart_container)
		]).then(([revModel, revPoints, anvModel, anvPoints]) => {
			const tracesRev = [...revModel, ...revPoints];
			const tracesAnv = [...anvModel, ...anvPoints];

			this._render_rev_anv_d3(regression_model_chart_container, tracesAnv, tracesRev, {
				xLabel: "Índice de Rareza (IR)",
				yLabel: "Número de cuños estimado"
			});
		});
	},

	/**
	 * Renders the obverse and reverse regression charts using D3.js.
	 * @private
	 * @param {string|Element} container - Chart container.
	 * @param {Array<Object>} tracesAnv - Obverse data traces.
	 * @param {Array<Object>} tracesRev - Reverse data traces.
	 * @param {Object} labels - Axis labels.
	 * @param {string} labels.xLabel - Label for X axis.
	 * @param {string} labels.yLabel - Label for Y axis.
	 */
	_render_rev_anv_d3: function(container, tracesAnv, tracesRev, labels) {
		const root = (typeof container === "string") ? document.querySelector(container) : container;
		if (!root) return;

		root.innerHTML = "";
		root.style.overflowX = "auto";
		root.style.overflowY = "hidden";
		root.style.maxWidth  = "100%";
		if (getComputedStyle(root).position === "static") root.style.position = "relative";

		// tooltip
		const tooltip = d3.select(root)
			.append("div")
			.style("position", "absolute")
			.style("pointer-events", "none")
			.style("opacity", 0)
			.style("background", "rgba(226, 227, 227, 0.98)")
			.style("border", "1px solid #ccc")
			.style("border-radius", "6px")
			.style("padding", "8px 10px")
			.style("font", "12px sans-serif")
			.style("box-shadow", "0 4px 14px rgba(0,0,0,0.12)");

		//const width = root.clientWidth || 900;
		const viewportW = root.clientWidth || 900;
		const width = Math.max(1200, Math.floor(viewportW * 90));
		const panelHeight = 260;
		const gap = 40;
		const margin = { top: 40, right: 20, bottom: 45, left: 65 };

		const panels = [
			{ title: "Anverso", traces: tracesAnv },
			{ title: "Reverso", traces: tracesRev }
		];

		const height = panels.length * panelHeight + (panels.length - 1) * gap;

		const svg = d3.select(root)
			.append("svg")
			.attr("width", width)
			.attr("height", height);

		panels.forEach((p, i) => {
			const yOffset = i * (panelHeight + gap);

			svg.append("text")
				.attr("x", width / 2)
				.attr("y", yOffset + 22)
				.attr("text-anchor", "middle")
				.attr("font-size", 16)
				.attr("fill", "#000")
				.text(p.title);

			const g = svg.append("g")
				.attr("transform", `translate(${margin.left},${yOffset + margin.top})`);

			const innerW = width - margin.left - margin.right;
			const innerH = panelHeight - margin.top - margin.bottom;

			const series = this._traces_to_series(p.traces);
			const allPts = series.flatMap(s => s.points);

			const x = d3.scaleLinear()
				.domain(d3.extent(allPts, d => d.x)).nice()
				.range([0, innerW]);

			const y = d3.scaleLinear()
				.domain(d3.extent(allPts, d => d.y)).nice()
				.range([innerH, 0]);

			g.append("g")
				.attr("transform", `translate(0,${innerH})`)
				.call(d3.axisBottom(x).ticks(6));

			g.append("g")
				.call(d3.axisLeft(y).ticks(5));

			g.append("text")
				.attr("x", innerW / 2)
				.attr("y", innerH + 38)
				.attr("text-anchor", "middle")
				.attr("font-size", 12)
				.text(labels.xLabel);

			g.append("text")
				.attr("transform", "rotate(-90)")
				.attr("x", -innerH / 2)
				.attr("y", -50)
				.attr("text-anchor", "middle")
				.attr("font-size", 12)
				.text(labels.yLabel);

			// líneas
			const lineGen = d3.line()
				.x(d => x(d.x))
				.y(d => y(d.y));

			series.filter(s => s.kind === "line").forEach(s => {
				g.append("path")
					.datum(s.points)
					.attr("fill", "none")
					.attr("stroke", s.style.stroke ?? "#9aa0a6")
					.attr("stroke-width", s.style.strokeWidth ?? 2)
					.attr("d", lineGen);
			});

			// puntos
			series.filter(s => s.kind === "points").forEach(s => {
				const circles = g.selectAll(null)
					.data(s.points)
					.join("circle")
					.attr("cx", d => x(d.x))
					.attr("cy", d => y(d.y))
					.attr("r", s.style.r ?? 3)
					.attr("fill", d => {
						if (!s.keepColor) return "white";
						return (typeof s.style.fill === "function") ? s.style.fill(d) : (s.style.fill ?? "white");
					})
					.attr("stroke", s.style.stroke ?? "#000")
					.attr("stroke-width", s.style.strokeWidth ?? 2);

				// tooltip
				const TARGET = "rgb(20,80,200)";
				const norm = (v) => (v || "").replace(/\s+/g, "").toLowerCase();

				tooltip.style("opacity", 0);

				circles
					.on("mouseenter.tooltip", null)
					.on("mousemove.tooltip", null)
					.on("mouseleave.tooltip", null);

				circles
					.filter(function () {
						const fillAttr = this.getAttribute("fill");
						const fillComp = getComputedStyle(this).fill;
						return norm(fillAttr) === norm(TARGET) || norm(fillComp) === norm(TARGET);
					})
					.on("mouseenter.tooltip", (event, d) => {
						tooltip.style("opacity", 1);
						tooltip.html(`
							<div><b>Ceca:</b> ${d.customdata?.[0] ?? ""}</div>
							<div><b>MIB:</b> ${d.customdata?.[1] ?? ""} | ${d.customdata?.[2] ?? ""} / ${d.customdata?.[3] ?? ""}</div>
							<div><b>Num. monedas:</b> ${d.x}</div>
							<div><b>Estimación cuños:</b> ${d.y}</div>
						`);
					})
					.on("mousemove.tooltip", (event) => {
						const tt = tooltip.node();
						const parent = tt.offsetParent || root;

						const pRect = parent.getBoundingClientRect();
						const cRect = event.currentTarget.getBoundingClientRect();

						const ttW = tt.offsetWidth;
						const ttH = tt.offsetHeight;

						const xCenter = (cRect.left - pRect.left) + cRect.width / 2;

						const sx = parent.scrollLeft || 0;
						const sy = parent.scrollTop || 0;

						const left = xCenter + sx - ttW / 2;
						const top  = (cRect.top - pRect.top) + sy - ttH - 8;

						tooltip.style("left", `${left}px`).style("top", `${top}px`);
					})
					.on("mouseleave.tooltip", () => tooltip.style("opacity", 0));
			});
		});
	},

	/**
	 * Converts Plotly-like traces into D3-compatible series objects.
	 * Maps styles and extracts point data.
	 * @private
	 * @param {Array<Object>} traces - Array of Plotly-formatted trace objects.
	 * @returns {Array<Object>} Array of processed series for D3.
	 */
	_traces_to_series: function(traces) {
		const COLOR_TRACE_NAME = "Aproximación";

		return (traces || []).map(t => {
			const mode = (t.mode || "").toLowerCase();
			const isLine = mode.includes("lines");

			const points = (t.x || []).map((xVal, i) => ({
				x: +xVal,
				y: +(t.y?.[i]),
				i,
				name: t.name ?? "",
				text: Array.isArray(t.text) ? (t.text[i] ?? "") : (t.text ?? ""),
				customdata: Array.isArray(t.customdata) ? (t.customdata[i] ?? null) : (t.customdata ?? null)
			}));

			if (isLine) {
				return {
					kind: "line",
					points,
					name: t.name,
					style: {
						stroke: t.line?.color ?? "#9aa0a6",
						strokeWidth: t.line?.width ?? 2
					}
				};
			}

			const markerColor = (t.name === "Aproximación") ? "rgb(20, 80, 200)" : t.marker?.color;
			const getFill = (d) =>
				Array.isArray(markerColor) ? (markerColor[d.i] ?? "white") : (markerColor ?? "white");

			return {
				kind: "points",
				points,
				name: t.name,
				keepColor: (t.name === COLOR_TRACE_NAME),
				style: {
					//r: (typeof t.marker?.size === "number") ? t.marker.size : 3,
					r: (t.name === "Aproximación") ? 4 : 5,
					fill: getFill,
					stroke: t.marker?.line?.color ?? "#000",
					strokeWidth: t.marker?.line?.width ?? 2
				}
			};
		});
	},

	/**
	 * Calculates the linear regression coefficients (y = ax + b) for a given set of data points.
	 *
	 * @param {number[]} IR_Ant - Independent variable values (X-axis, e.g., index/sequence).
	 * @param {number[]} D_A_Ant - Dependent variable values (Y-axis, e.g., diameter/weight).
	 * @returns {{a: number, b: number}} An object containing the intercept 'a' and the slope 'b'.
	 */
	coefficients: function(IR_Ant, D_A_Ant){
		const n = IR_Ant.length;

		const IR_Mitja = IR_Ant.reduce((a, b) => a + b, 0) / n;
		const D_A_Mitja = D_A_Ant.reduce((a, b) => a + b, 0) / n;

		let N = 0;
		let D = 0;

		for (let i = 0; i < n; i++) {
			N += (IR_Ant[i] - IR_Mitja) * (D_A_Ant[i] - D_A_Mitja);
			D += Math.pow(IR_Ant[i] - IR_Mitja, 2);

		}

		const b_R = N / D;
		const a_R = D_A_Mitja - b_R * IR_Mitja;

		return { a: a_R, b: b_R };
	}
};
