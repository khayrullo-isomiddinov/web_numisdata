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
			db_name    : "web_numisdata_mib_pre", // PRO is not available yet ! page_globals.WEB_DB ||
 			table      : 'ts_web',
			ar_fields  : ['titulo', 'cuerpo', 'norder', 'web_path'],
			lang       : 'lg-spa',
			sql_filter : "web_path = 'regression_vars'",
			order      : 'norder ASC',
			limit      : 1000
		};

		load_promise = data_manager.request({ body: request_body })
			.then((response) => {
				console.log(response)
				console.log(request_body)
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
     * Filters the original data exactly as in the R logic, with added numeric safety.
     * Equivalent base logic:
     * keep <- IR_Ant > 10
     *
     * Assumed variable mapping:
     * IR_Ant   -> regression_vars.ir_ant
     * D_A_Ant  -> regression_vars.d_anv
     * D_R_Ant  -> regression_vars.d_rev
     *
     * @returns {Promise<Object>}
     */
    filter_regression_data: function() {
    return this.load_regression_vars().then(() => {
        const IR_Ant  = Array.isArray(this.regression_vars.ir_ant) ? this.regression_vars.ir_ant : [];
        const D_A_Ant = Array.isArray(this.regression_vars.anvers) ? this.regression_vars.anvers : [];
        const D_R_Ant = Array.isArray(this.regression_vars.revers) ? this.regression_vars.revers : [];

        const maxLen = Math.min(IR_Ant.length, D_A_Ant.length, D_R_Ant.length);

        const keep = [];
        for (let i = 0; i < maxLen; i++) {
            const ir = Number(IR_Ant[i]);
            const da = Number(D_A_Ant[i]);
            const dr = Number(D_R_Ant[i]);

            keep.push(
                Number.isFinite(ir) &&
                Number.isFinite(da) &&
                Number.isFinite(dr) &&
                ir > 10 &&
                da > 0 &&
                dr > 0
            );
        }

        const IR_Ant_filtrat  = IR_Ant.slice(0, maxLen).filter((_, i) => keep[i]).map(Number);
        const D_A_Ant_filtrat = D_A_Ant.slice(0, maxLen).filter((_, i) => keep[i]).map(Number);
        const D_R_Ant_filtrat = D_R_Ant.slice(0, maxLen).filter((_, i) => keep[i]).map(Number);

        return {
            keep,
            IR_Ant_filtrat,
            D_A_Ant_filtrat,
            D_R_Ant_filtrat
        };
    });
},

    /**
     * Calculates the log-log regression coefficients for obverse and reverse.
     * Equivalent to the R code using lm(log(Y) ~ log(X)).
     *
     * Returns:
     * alphaA, betaA for obverse
     * alphaR, betaR for reverse
     *
     * @returns {Promise<Object>}
     */
    get_log_regression_coefficients: function() {
        if (this.regression_fit_cache) {
            return Promise.resolve(this.regression_fit_cache);
        }

        return this.filter_regression_data().then((filtered) => {
            const X   = filtered.IR_Ant_filtrat.map(v => Math.log(v));
            const Y_A = filtered.D_A_Ant_filtrat.map(v => Math.log(v));
            const Y_R = filtered.D_R_Ant_filtrat.map(v => Math.log(v));

            const fitA = this.coefficients(X, Y_A);
            const fitR = this.coefficients(X, Y_R);

            const result = {
                X,
                Y_A,
                Y_R,
                alphaA: fitA.a,
                betaA : fitA.b,
                alphaR: fitR.a,
                betaR : fitR.b,
                filtered
            };

            this.regression_fit_cache = result;

            if (SHOW_DEBUG === true) {
                console.log("---> get_log_regression_coefficients", result);
            }

            return result;
        });
    },

    /**
     * Predicts Y from a log-log model:
     * log(Y) = alpha + beta * log(X)
     * therefore:
     * Y = exp(alpha + beta * log(X))
     *
     * @param {number} x
     * @param {number} alpha
     * @param {number} beta
     * @returns {number}
     */
    predict_potential: function(x, alpha, beta) {
        if (!Number.isFinite(x) || x <= 0) return NaN;
        return Math.exp(alpha + beta * Math.log(x));
    },

    /**
     * Prepares data traces for the obverse regression model.
     * Uses filtered observed data and a power-law fitted curve.
     *
     * @param {string|Element} regression_model_chart_container
     * @returns {Promise<Array<Object>>}
     */
    plot_anv: function(regression_model_chart_container) {
        return this.get_log_regression_coefficients().then((fit) => {
            const {
                alphaA,
                betaA,
                filtered: {
                    IR_Ant_filtrat,
                    D_A_Ant_filtrat
                }
            } = fit;

            const minIR = Math.min(...IR_Ant_filtrat);
            const maxIR = Math.max(...IR_Ant_filtrat);

            const x_vals = Array.from(
                { length: 2000 },
                (_, i) => minIR + (i / 1999) * (maxIR - minIR)
            );

            const y_vals = x_vals.map(x => this.predict_potential(x, alphaA, betaA));

            const traces = [
                {
                    x: IR_Ant_filtrat,
                    y: D_A_Ant_filtrat,
                    mode: "markers",
                    type: "scatter",
                    name: "Datos observados",
                    marker: { color: "skyblue" },
                    hovertemplate:
                        "Num. monedas: %{x}<br>" +
                        "Estimación cuños: %{y}<extra></extra>",
                    xaxis: "x1",
                    yaxis: "y1"
                },
                {
                    x: x_vals,
                    y: y_vals,
                    mode: "lines",
                    type: "scatter",
                    name: "Modelo estimado",
                    line: { color: "lightsteelblue", width: 2 },
                    xaxis: "x1",
                    yaxis: "y1"
                }
            ];

            return traces;
        });
    },

    /**
     * Calculates IR and die approximation for an emblem (obverse),
     * using the log-log fitted model.
     *
     * @param {Object} emblem
     * @returns {Promise<{ir: number, approx: number}>}
     */
    calculation_IR_anv: function(emblem) {
        const index = emblem.full_coins_reference_calculable || [];

        let ir = 0;
        for (let i = 0; i < index.length; i++) {
            if (index[i] === true) ir++;
        }

        return this.get_log_regression_coefficients().then(({ alphaA, betaA }) => {
            const approx = this.predict_potential(ir, alphaA, betaA);
            return { ir, approx };
        });
    },

    /**
     * Generates scatter trace for current search results (obverse).
     *
     * @param {Array<Object>} parsed_data
     * @param {string|Element} regression_model_chart_container
     * @returns {Promise<Array<Object>>}
     */
    plot_points_regression_anv: function(parsed_data, regression_model_chart_container) {
        const self = this;
        const emblems = parsed_data.slice(1);

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
                mode: "markers",
                type: "scatter",
                name: "Aproximación",
                customdata: vect_tipos.map(o => [o.ceca, o.id, o.ref_ceca, o.num]),
                hovertemplate:
                    "Ceca: %{customdata[0]}<br>" +
                    "MIB: %{customdata[1]} | %{customdata[2]} / %{customdata[3]}<br>" +
                    "Num. monedas: %{x}<br>" +
                    "Estimación cuños anverso: %{y}<extra></extra>",
                marker: {
                    color: "darkblue",
                    size: 10,
                    line: { width: 2, color: "black" }
                },
                xaxis: "x1",
                yaxis: "y1"
            };

            return [pointsTrace];
        });
    },

    /**
     * Prepares data traces for the reverse regression model.
     * Uses filtered observed data and a power-law fitted curve.
     *
     * @param {string|Element} regression_model_chart_container
     * @returns {Promise<Array<Object>>}
     */
    plot_rev: function(regression_model_chart_container) {
        return this.get_log_regression_coefficients().then((fit) => {
            const {
                alphaR,
                betaR,
                filtered: {
                    IR_Ant_filtrat,
                    D_R_Ant_filtrat
                }
            } = fit;

            const minIR = Math.min(...IR_Ant_filtrat);
            const maxIR = Math.max(...IR_Ant_filtrat);

            const x_vals = Array.from(
                { length: 2000 },
                (_, i) => minIR + (i / 1999) * (maxIR - minIR)
            );

            const y_vals = x_vals.map(x => this.predict_potential(x, alphaR, betaR));

            const traces = [
                {
                    x: IR_Ant_filtrat,
                    y: D_R_Ant_filtrat,
                    mode: "markers",
                    type: "scatter",
                    name: "Datos observados",
                    marker: { color: "skyblue" },
                    hovertemplate:
                        "Num. monedas: %{x}<br>" +
                        "Estimación cuños: %{y}<extra></extra>",
                    xaxis: "x2",
                    yaxis: "y2"
                },
                {
                    x: x_vals,
                    y: y_vals,
                    mode: "lines",
                    type: "scatter",
                    name: "Modelo estimado",
                    line: { color: "lightsteelblue", width: 2 },
                    xaxis: "x2",
                    yaxis: "y2"
                }
            ];

            return traces;
        });
    },

    /**
     * Calculates IR and die approximation for an emblem (reverse),
     * using the log-log fitted model.
     *
     * @param {Object} emblem
     * @returns {Promise<{ir: number, approx: number}>}
     */
    calculation_IR_rev: function(emblem) {
        const index = emblem.full_coins_reference_calculable || [];

        let ir = 0;
        for (let i = 0; i < index.length; i++) {
            if (index[i] === true) ir++;
        }

        return this.get_log_regression_coefficients().then(({ alphaR, betaR }) => {
            const approx = this.predict_potential(ir, alphaR, betaR);
            return { ir, approx };
        });
    },

    /**
     * Generates scatter trace for current search results (reverse).
     *
     * @param {Array<Object>} parsed_data
     * @param {string|Element} regression_model_chart_container
     * @returns {Promise<Array<Object>>}
     */
    plot_points_regression_rev: function(parsed_data, regression_model_chart_container) {
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
                mode: "markers",
                type: "scatter",
                name: "Aproximación",
                customdata: vect_tipos.map(o => [o.ceca, o.id, o.ref_ceca, o.num]),
                hovertemplate:
                    "Ceca: %{customdata[0]}<br>" +
                    "MIB: %{customdata[1]} | %{customdata[2]} / %{customdata[3]}<br>" +
                    "Num. monedas: %{x}<br>" +
                    "Estimación cuños reverso: %{y}<extra></extra>",
                marker: {
                    color: "darkblue",
                    size: 10,
                    line: { width: 2, color: "black" }
                },
                xaxis: "x2",
                yaxis: "y2"
            };

            return [pointsTrace];
        });
    },

    /**
     * Orchestrates the full regression plotting for both models.
     *
     * @param {string|Element} regression_model_chart_container
     * @param {Array<Object>} parsed_data
     * @returns {Promise<void>}
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
     *
     * @private
     * @param {string|Element} container
     * @param {Array<Object>} tracesAnv
     * @param {Array<Object>} tracesRev
     * @param {Object} labels
     */
    _render_rev_anv_d3: function(container, tracesAnv, tracesRev, labels) {
        const root = (typeof container === "string") ? document.querySelector(container) : container;
        if (!root) return;

        root.innerHTML = "";
        root.style.overflowX = "auto";
        root.style.overflowY = "hidden";
        root.style.maxWidth  = "100%";
        if (getComputedStyle(root).position === "static") root.style.position = "relative";

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

        const viewportW = root.clientWidth || 900;
        const width = Math.max(1200, Math.floor(viewportW * 0.9));
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
            const allPts = series.flatMap(s => s.points).filter(d =>
                Number.isFinite(d.x) && Number.isFinite(d.y)
            );

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

            const lineGen = d3.line()
                .defined(d => Number.isFinite(d.x) && Number.isFinite(d.y))
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

            series.filter(s => s.kind === "points").forEach(s => {
                const validPoints = s.points.filter(d =>
                    Number.isFinite(d.x) && Number.isFinite(d.y)
                );

                const circles = g.selectAll(null)
                    .data(validPoints)
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

                const TARGET = "rgb(20,80,200)";
                const norm = (v) => (v || "").replace(/\s+/g, "").toLowerCase();

                tooltip.style("opacity", 0);

                circles
                    .on("mouseenter.tooltip", null)
                    .on("mousemove.tooltip", null)
                    .on("mouseleave.tooltip", null);

                circles
                    .filter(function() {
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
     *
     * @private
     * @param {Array<Object>} traces
     * @returns {Array<Object>}
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
                    r: (t.name === "Aproximación") ? 4 : 5,
                    fill: getFill,
                    stroke: t.marker?.line?.color ?? "#000",
                    strokeWidth: t.marker?.line?.width ?? 2
                }
            };
        });
    },

    /**
     * Calculates simple linear regression coefficients for y = a + b*x
     *
     * @param {number[]} X
     * @param {number[]} Y
     * @returns {{a: number, b: number}}
     */
    coefficients: function(X, Y) {
        const n = Math.min(X.length, Y.length);

        if (!n) {
            return { a: NaN, b: NaN };
        }

        const meanX = X.slice(0, n).reduce((acc, v) => acc + v, 0) / n;
        const meanY = Y.slice(0, n).reduce((acc, v) => acc + v, 0) / n;

        let N = 0;
        let D = 0;

        for (let i = 0; i < n; i++) {
            N += (X[i] - meanX) * (Y[i] - meanY);
            D += Math.pow(X[i] - meanX, 2);
        }

        if (D === 0) {
            return { a: NaN, b: NaN };
        }

        const b = N / D;
        const a = meanY - b * meanX;

        return { a, b };
    }

};
