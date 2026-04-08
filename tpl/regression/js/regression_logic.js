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

import { type_tooltip_callback } from "./regression.js";
//import { type_tooltip_callback } from "./analysis.js";
//console.log("type_tooltip_callback:", type_tooltip_callback);
// Función auxiliar para extraer el número MIB del tooltip

export const regression_logic = {

	regression_vars: null,
	bootstrap_cache: null,

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
				if (SHOW_DEBUG === true) {
					console.log(response)
					console.log(request_body)
				}
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

			const max_len = Math.min(IR_Ant.length, D_A_Ant.length, D_R_Ant.length);

			const keep = [];
			for (let i = 0; i < max_len; i++) {
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

			const IR_Ant_filtrat  = IR_Ant.slice(0, max_len).filter((_, i) => keep[i]).map(Number);
			const D_A_Ant_filtrat = D_A_Ant.slice(0, max_len).filter((_, i) => keep[i]).map(Number);
			const D_R_Ant_filtrat = D_R_Ant.slice(0, max_len).filter((_, i) => keep[i]).map(Number);

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
	* Calculates a quantile from a sorted numeric array.
	*
	* @param {number[]} sorted_arr
	* @param {number} q
	* @returns {number}
	*/
	quantile_sorted: function(sorted_arr, q) {
		const n = sorted_arr.length;
		if (!n) return NaN;
		if (n === 1) return sorted_arr[0];

		const pos = (n - 1) * q;
		const base = Math.floor(pos);
		const rest = pos - base;

		if ((base + 1) < n) {
			return sorted_arr[base] + rest * (sorted_arr[base + 1] - sorted_arr[base]);
		}
		return sorted_arr[base];
	},

	/**
	* Returns bootstrap percentile band for a prediction matrix row.
	*
	* @param {number[]} values
	* @returns {{lwr:number, med:number, upr:number}}
	*/
	bootstrap_band_from_vector: function(values) {
		const clean = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b);

		if (!clean.length) {
			return { lwr: NaN, med: NaN, upr: NaN };
		}

		return {
			lwr: this.quantile_sorted(clean, 0.025),
			med: this.quantile_sorted(clean, 0.5),
			upr: this.quantile_sorted(clean, 0.975)
		};
	},

	/**
	* Calculates bootstrap confidence bands for obverse and reverse
	* from 1 to 500 coins, following the same logic as the R code.
	*
	* @param {number} B Number of bootstrap iterations
	* @returns {Promise<Object>}
	*/
	get_bootstrap_bands: function(B = 2000) {
		if (this.bootstrap_cache && this.bootstrap_cache.B === B) {
			return Promise.resolve(this.bootstrap_cache);
		}

		return this.get_log_regression_coefficients().then((fit) => {
			const {
				alphaA,
				betaA,
				alphaR,
				betaR,
				filtered: {
					IR_Ant_filtrat,
					D_A_Ant_filtrat,
					D_R_Ant_filtrat
				}
			} = fit;

			const n = IR_Ant_filtrat.length;
			const Mgrid = Array.from({ length: 1500 }, (_, i) => i + 1);

			if (!n) {
				const emptyBand = Mgrid.map(m => ({
					m,
					lwr: NaN,
					med: NaN,
					upr: NaN
				}));

				const result = {
					B,
					Mgrid,
					bandA: emptyBand,
					bandR: emptyBand,
					oneDieA: { ir: NaN, lwr: NaN, med: NaN, upr: NaN },
					oneDieR: { ir: NaN, lwr: NaN, med: NaN, upr: NaN }
				};

				this.bootstrap_cache = result;
				return result;
			}

			const pred_a = Array.from({ length: Mgrid.length }, () => new Array(B).fill(NaN));
			const pred_r = Array.from({ length: Mgrid.length }, () => new Array(B).fill(NaN));

			// IR donde la recta central predice exactamente 1 cuño
			const ir_at_one_a = Math.exp(-alphaA / betaA);
			const ir_at_one_r = Math.exp(-alphaR / betaR);

			const pred_atOneA = new Array(B).fill(NaN);
			const pred_atOneR = new Array(B).fill(NaN);

			for (let b = 0; b < B; b++) {
				const idx = Array.from({ length: n }, () => Math.floor(Math.random() * n));

				const Xb   = idx.map(i => Math.log(IR_Ant_filtrat[i]));
				const YA_b = idx.map(i => Math.log(D_A_Ant_filtrat[i]));
				const YR_b = idx.map(i => Math.log(D_R_Ant_filtrat[i]));

				const fit_a_b = this.coefficients(Xb, YA_b);
				const fit_r_b = this.coefficients(Xb, YR_b);

				const alpha_a_b = fit_a_b.a;
				const beta_a_b  = fit_a_b.b;
				const alpha_r_b = fit_r_b.a;
				const beta_r_b  = fit_r_b.b;

				// distribución bootstrap del "1 cuño"
				pred_atOneA[b] = this.predict_potential(ir_at_one_a, alpha_a_b, beta_a_b);
				pred_atOneR[b] = this.predict_potential(ir_at_one_r, alpha_r_b, beta_r_b);

				for (let j = 0; j < Mgrid.length; j++) {
					const m = Mgrid[j];

					pred_a[j][b] = this.predict_potential(m, alpha_a_b, beta_a_b);
					pred_r[j][b] = this.predict_potential(m, alpha_r_b, beta_r_b);
				}
			}

			const bandA = pred_a.map((row, i) => ({
				m: Mgrid[i],
				...this.bootstrap_band_from_vector(row)
			}));

			const bandR = pred_r.map((row, i) => ({
				m: Mgrid[i],
				...this.bootstrap_band_from_vector(row)
			}));

			const oneDieA = {
				ir: ir_at_one_a,
				...this.bootstrap_band_from_vector(pred_atOneA)
			};

			const oneDieR = {
				ir: ir_at_one_r,
				...this.bootstrap_band_from_vector(pred_atOneR)
			};

			const result = {
				B,
				Mgrid,
				bandA,
				bandR,
				oneDieA,
				oneDieR
			};

			this.bootstrap_cache = result;

			if (SHOW_DEBUG === true) {
				console.log("---> bootstrap bands", result);
			}

			return result;
		});
	},

	/**
	* Gets the bootstrap interval for a specific IR value.
	* Uses nearest integer in [1, 500].
	*
	* @param {number} ir
	* @param {Array<Object>} band
	* @returns {{lwr:number, med:number, upr:number}|null}
	*/
	get_bootstrap_interval_for_ir: function(ir, band) {
		if (!Number.isFinite(ir) || ir < 1 || ir > 1500 || !Array.isArray(band)) {
			return null;
		}

		const m = Math.round(ir);
		const row = band[m - 1];

		if (!row) return null;

		return {
			lwr: row.lwr,
			med: row.med,
			upr: row.upr
		};
	},

	/**
	* Formats a numeric value for tooltip display.
	*
	* @param {number} value
	* @param {number} digits
	* @returns {string}
	*/
	format_tooltip_number: function(value, digits = 2) {
		return Number.isFinite(value) ? value.toFixed(digits) : "NA";
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

			const min_ir = Math.min(...IR_Ant_filtrat);
			const max_ir = Math.max(...IR_Ant_filtrat,1500);

			const x_vals = Array.from(
				{ length: 2000 },
				(_, i) => min_ir + (i / 1999) * (max_ir - min_ir)
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
	* Generates scatter trace for current search results (obverse),
	*
	* @param {Array<Object>} parsed_data
	* @param {string|Element} regression_model_chart_container
	* @returns {Promise<Array<Object>>}
	*/
	plot_points_regression_anv: function(parsed_data, regression_model_chart_container) {
		const emblems = parsed_data.slice(1);

		return Promise.all([
			Promise.all(
				emblems.map(emblem => this.calculation_IR_anv(emblem).then(({ ir, approx }) => {
					if (SHOW_DEBUG === true) {
						console.log("emblem completo:", emblem);
					}
					// Obtener el número MIB correcto del catálogo
				let correct_mib_number = emblem.ref_type_number; // valor por defecto
					return {
						ir,
						approx,
						ceca: Array.isArray(emblem.p_mint) ? emblem.p_mint[0] : emblem.p_mint,//emblem.p_mint,
						id: emblem.section_id,   //term_section_id, //id. emblem.section.id
						num: emblem.ref_type_number,
						ref_ceca: emblem.ref_mint_number
					};
				}))
			),
			this.get_bootstrap_bands()
		]).then(([vect_tipos, bootstrap]) => {
			const vect_tipos_with_ci = vect_tipos.map(obj => {
				const approx_display = Math.max(1, obj.approx);

				const ci = (obj.approx < 1)
					? bootstrap.oneDieA
					: this.get_bootstrap_interval_for_ir(obj.ir, bootstrap.bandA);

				return {
					...obj,
					approx_display,
					ci_lwr: ci ? ci.lwr : NaN,
					ci_med: ci ? ci.med : NaN,
					ci_upr: ci ? ci.upr : NaN
				};
			});

			const x_values = vect_tipos_with_ci.map(obj => obj.ir);
			const y_values = vect_tipos_with_ci.map(obj => obj.approx_display);

			const points_trace = {
				x: x_values,
				y: y_values,
				mode: "markers",
				type: "scatter",
				name: "Aproximación",
				customdata: vect_tipos_with_ci.map(o => [
					o.ceca,
					o.id,
					o.ref_ceca,
					o.num,
					o.ci_lwr,
					o.ci_med,
					o.ci_upr
				]),
				hovertemplate:
					"Ceca: %{customdata[0]}<br>" +
					"MIB: %{customdata[1]} | %{customdata[2]} / %{customdata[3]}<br>" +
					"Num. monedas: %{x}<br>" +
					"Estimación cuños anverso: %{y}<br>" +
					"IC bootstrap 95%: [%{customdata[4]}, %{customdata[6]}]<br>" +
					"Mediana bootstrap: %{customdata[5]}<extra></extra>",
				marker: {
					color: "darkblue",
					size: 10,
					line: { width: 2, color: "black" }
				},
				xaxis: "x1",
				yaxis: "y1"
			};

			return [points_trace];
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

			const min_ir = Math.min(...IR_Ant_filtrat);
			const max_ir = Math.max(...IR_Ant_filtrat,1500);

			const x_vals = Array.from(
				{ length: 2000 },
				(_, i) => min_ir + (i / 1999) * (max_ir - min_ir)
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
	* Generates scatter trace for current search results (reverse),
	* including bootstrap confidence interval in customdata.
	*
	* @param {Array<Object>} parsed_data
	* @param {string|Element} regression_model_chart_container
	* @returns {Promise<Array<Object>>}
	*/
	plot_points_regression_rev: function(parsed_data, regression_model_chart_container) {
		const emblems = parsed_data.slice(1);

		return Promise.all([
			Promise.all(
				emblems.map(emblem =>
					this.calculation_IR_rev(emblem).then(({ ir, approx }) => ({
						ir,
						approx,
						ceca: Array.isArray(emblem.p_mint) ? emblem.p_mint[0] : emblem.p_mint,//emblem.p_mint,
						id: emblem.section_id,//emblem.term_section_id,
						num: emblem.ref_type_number,
						ref_ceca: emblem.ref_mint_number
					}))
				)
			),
			this.get_bootstrap_bands()
		]).then(([vect_tipos, bootstrap]) => {
			const vect_tipos_with_ci = vect_tipos.map(obj => {
				const approx_display = Math.max(1, obj.approx);

				const ci = (obj.approx < 1)
					? bootstrap.oneDieR
					: this.get_bootstrap_interval_for_ir(obj.ir, bootstrap.bandR);

				return {
					...obj,
					approx_display,
					ci_lwr: ci ? ci.lwr : NaN,
					ci_med: ci ? ci.med : NaN,
					ci_upr: ci ? ci.upr : NaN
				};
			});

			const x_values = vect_tipos_with_ci.map(obj => obj.ir);
			const y_values = vect_tipos_with_ci.map(obj => obj.approx_display);

			const points_trace = {
				x: x_values,
				y: y_values,
				mode: "markers",
				type: "scatter",
				name: "Aproximación",
				customdata: vect_tipos_with_ci.map(o => [
					o.ceca,
					o.id,
					o.ref_ceca,
					o.num,
					o.ci_lwr,
					o.ci_med,
					o.ci_upr
				]),
				hovertemplate:
					"Ceca: %{customdata[0]}<br>" +
					"MIB: %{customdata[1]} | %{customdata[2]} / %{customdata[3]}<br>" +
					"Num. monedas: %{x}<br>" +
					"Estimación cuños reverso: %{y}<br>" +
					"IC bootstrap 95%: [%{customdata[4]}, %{customdata[6]}]<br>" +
					"Mediana bootstrap: %{customdata[5]}<extra></extra>",
				marker: {
					color: "darkblue",
					size: 10,
					line: { width: 2, color: "black" }
				},
				xaxis: "x2",
				yaxis: "y2"
			};

			return [points_trace];
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
	extract_mib_number: function(tooltip_element, fallback = "?") {
		const text = tooltip_element.textContent || tooltip_element.innerText || "";
		const match = text.match(/MIB\s*(\d+)/i);
		if (match) {
			return match[1];
		}

		const mibElement =
			tooltip_element.querySelector('[class*="mib"]') ||
			tooltip_element.querySelector('[class*="MIB"]');

		if (mibElement) {
			const mibText = mibElement.textContent || "";
			const mibMatch = mibText.match(/\d+/);
			if (mibMatch) return mibMatch[0];
		}

		return fallback;
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

		const info_box = d3.select(root)
			.append("div")
			.style("margin-top", "16px")
			.style("padding", "24px 32px")
			.style("background", "#f3f3f3")
			.style("border-radius", "4px")
			.style("max-width", "420px")
			.style("font-family", "sans-serif")
			.style("color", "#666")
			.style("display", "none")
			.text("Haz click en un punto azul para ver la información.");

		const viewport_w = root.clientWidth || 900;
		const width = Math.max(2500, Math.floor(viewport_w * 0.9));
		const panel_height = 300;
		const gap = 40;
		const margin = { top: 40, right: 20, bottom: 45, left: 65 };

		const panels = [
			{ title: "Anverso", traces: tracesAnv },
			{ title: "Reverso", traces: tracesRev }
		];

		const height = panels.length * panel_height + (panels.length - 1) * gap;

		const svg = d3.select(root)
			.append("svg")
			.attr("width", width)
			.attr("height", height);

		panels.forEach((p, i) => {
			const y_offset = i * (panel_height + gap);

			svg.append("text")
				.attr("x", width / 2)
				.attr("y", y_offset + 22)
				.attr("text-anchor", "middle")
				.attr("font-size", 16)
				.attr("fill", "#000")
				.text(p.title);

			const g = svg.append("g")
				.attr("transform", `translate(${margin.left},${y_offset + margin.top})`);

			const inner_w = width - margin.left - margin.right;
			const inner_h = panel_height - margin.top - margin.bottom;

			const series = this._traces_to_series(p.traces);
			const all_pts = series.flatMap(s => s.points).filter(d =>
				Number.isFinite(d.x) && Number.isFinite(d.y)
			);

			const x = d3.scaleLinear()
				.domain(d3.extent(all_pts, d => d.x)).nice()
				.range([0, inner_w]);

			const y = d3.scaleLinear()
				.domain(d3.extent(all_pts, d => d.y)).nice()
				.range([inner_h, 0]);

			g.append("g")
				.attr("transform", `translate(0,${inner_h})`)
				.call(d3.axisBottom(x).ticks(6));

			g.append("g")
				.call(d3.axisLeft(y).ticks(5));

			g.append("text")
				.attr("x", inner_w / 2)
				.attr("y", inner_h + 38)
				.attr("text-anchor", "middle")
				.attr("font-size", 12)
				.text(labels.xLabel);

			g.append("text")
				.attr("transform", "rotate(-90)")
				.attr("x", -inner_h / 2)
				.attr("y", -50)
				.attr("text-anchor", "middle")
				.attr("font-size", 12)
				.text(labels.yLabel);

			const line_gen = d3.line()
				.defined(d => Number.isFinite(d.x) && Number.isFinite(d.y))
				.x(d => x(d.x))
				.y(d => y(d.y));

			series.filter(s => s.kind === "line").forEach(s => {
				g.append("path")
					.datum(s.points)
					.attr("fill", "none")
					.attr("stroke", s.style.stroke ?? "#9aa0a6")
					.attr("stroke-width", s.style.strokeWidth ?? 2)
					.attr("d", line_gen);
			});

			series.filter(s => s.kind === "points" && s.keepColor).forEach(s => {
				const valid_pts = s.points.filter(d =>
					Number.isFinite(d.x) && Number.isFinite(d.y)
				);

				const circles = g.selectAll(null)
					.data(valid_pts)
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

				const blue_circles = circles.filter(function() {
					const fill_attr = this.getAttribute("fill");
					const fill_comp = getComputedStyle(this).fill;
					return norm(fill_attr) === norm(TARGET) || norm(fill_comp) === norm(TARGET);
				});

				blue_circles
					.style("cursor", "pointer")
					.on("mouseenter.tooltip", async (event, d) => {
						tooltip.style("opacity", 1);

						const options = {
							id: d.customdata?.[1],
							type_number: d.customdata?.[3],
							mint: d.customdata?.[0]
						};

						try {
							const tooltip_element = await type_tooltip_callback(options);
							const mib_number = this.extract_mib_number(
								tooltip_element,
								d.customdata?.[3] ?? "?"
							);

							tooltip.html(`
								<div><b>Ceca:</b> ${d.customdata?.[0] ?? ""}</div>
								<div><b>MIB:</b> ${mib_number} | ${d.customdata?.[2] ?? ""} / ${d.customdata?.[3] ?? ""}</div>
								<div><b>Num. monedas:</b> ${this.format_tooltip_number(d.x, 0)}</div>
								<div><b>Estimación cuños:</b> ${this.format_tooltip_number(d.y, 2)}</div>
								<div><b>Intervalo de confianza:</b> [${this.format_tooltip_number(d.customdata?.[4], 2)}, ${this.format_tooltip_number(d.customdata?.[6], 2)}]</div>
								<div><b>Mediana del intervalo:</b> ${this.format_tooltip_number(d.customdata?.[5], 2)}</div>
							`);
						} catch (error) {
							tooltip.html(`
								<div><b>Ceca:</b> ${d.customdata?.[0] ?? ""}</div>
								<div><b>MIB:</b> ${d.customdata?.[3] ?? "?"} | ${d.customdata?.[2] ?? ""} / ${d.customdata?.[3] ?? ""}</div>
								<div><b>Num. monedas:</b> ${this.format_tooltip_number(d.x, 0)}</div>
								<div><b>Estimación cuños:</b> ${this.format_tooltip_number(d.y, 2)}</div>
								<div><b>IC bootstrap 95%:</b> [${this.format_tooltip_number(d.customdata?.[4], 2)}, ${this.format_tooltip_number(d.customdata?.[6], 2)}]</div>
								<div><b>Mediana bootstrap:</b> ${this.format_tooltip_number(d.customdata?.[5], 2)}</div>
							`);
						}
					})
					.on("mousemove.tooltip", (event) => {
						const tt = tooltip.node();
						const parent = tt.offsetParent || root;

						const p_rect = parent.getBoundingClientRect();
						const c_rect = event.currentTarget.getBoundingClientRect();

						const tt_w = tt.offsetWidth;
						const tt_h = tt.offsetHeight;

						const x_center = (c_rect.left - p_rect.left) + c_rect.width / 2;

						const sx = parent.scrollLeft || 0;
						const sy = parent.scrollTop || 0;

						const left = x_center + sx - tt_w / 2;
						const top  = (c_rect.top - p_rect.top) + sy - tt_h - 8;

						tooltip.style("left", `${left}px`).style("top", `${top}px`);
					})
					.on("mouseleave.tooltip", () => {
						tooltip.style("opacity", 0);
					})
					.on("click", async (event, d) => {
						event.preventDefault();
						event.stopPropagation();

						// Mostrar loading en el panel izquierdo también
						let panels_container = root.querySelector(".panels-container");

						if (!panels_container) {
							panels_container = document.createElement("div");
							panels_container.className = "panels-container";
							panels_container.style.cssText = `
								display: flex;
								flex-direction: row;
								gap: 20px;
								margin-top: 20px;
							`;
							root.appendChild(panels_container);
						}

						panels_container.innerHTML = "";
						const left_panel = document.createElement("div");
						left_panel.style.cssText = `
							flex: 0 0 320px;
							background: #f8f9fa;
							border-radius: 8px;
							padding: 20px;
							font-family: sans-serif;
							border: 1px solid #e0e0e0;
						`;
						left_panel.innerHTML = `<div style="text-align: center; padding: 20px;">Cargando...</div>`;

						const right_panel = document.createElement("div");
						right_panel.style.cssText = `
							flex: 1;
							background: white;
							border-radius: 8px;
							padding: 20px;
							border: 1px solid #e0e0e0;
							max-height: 500px;
							overflow-y: auto;
						`;
						right_panel.innerHTML = `<div style="text-align: center; padding: 20px;">Cargando...</div>`;

						panels_container.appendChild(left_panel);
						panels_container.appendChild(right_panel);

						try {
							const options = {
								id: d.customdata?.[1],
								type_number: d.customdata?.[3],
								mint: d.customdata?.[0]
							};

							const tooltip_element = await type_tooltip_callback(options);
							tooltip_element.innerHTML = tooltip_element.innerHTML.replace(
								/(\s*)(Bronce\b)/i,
								"<br>$2"
							);

							const mib_number = extract_mib_number(tooltip_element);

							left_panel.innerHTML = `
								<h3 style="margin: 0 0 15px 0; border-bottom: 2px solid #4a90e2; padding-bottom: 10px;">
									Resumen Estadístico
								</h3>
								<div style="display:grid; grid-template-columns: auto auto; gap: 12px; font-size: 13px;">
									<div style="font-weight: bold;">Ceca:</div>
									<div>${d.customdata?.[0] ?? ""}</div>

									<div style="font-weight: bold;">MIB:</div>
									<div>${mib_number} | ${d.customdata?.[2] ?? ""} / ${d.customdata?.[3] ?? ""}</div>

									<div style="font-weight: bold;">Nº Monedas:</div>
									<div>${this.format_tooltip_number(d.x, 0)}</div>

									<div style="font-weight: bold;">Estimación cuños:</div>
									<div>${this.format_tooltip_number(d.y, 2)}</div>

									<div style="font-weight: bold;">Intervalo de confianza:</div>
									<div>[${this.format_tooltip_number(d.customdata?.[4], 2)}, ${this.format_tooltip_number(d.customdata?.[6], 2)}]</div>

									<div style="font-weight: bold;">Mediana:</div>
									<div>${this.format_tooltip_number(d.customdata?.[5], 2)}</div>
								</div>
							`;

							right_panel.innerHTML = "";
							right_panel.appendChild(tooltip_element);

						} catch (error) {
							left_panel.innerHTML = `<div style="color: #c00;">Error: ${error.message}</div>`;
							right_panel.innerHTML = `<div style="color: #c00;">Error: ${error.message}</div>`;
						}

						function extract_mib_number(tooltip_element) {
							const text = tooltip_element.textContent || tooltip_element.innerText;
							const match = text.match(/MIB\s*(\d+)/i);
							if (match) {
								return match[1];
							}

							const mib_element = tooltip_element.querySelector('[class*="mib"]') ||
												tooltip_element.querySelector('[class*="MIB"]');
							if (mib_element) {
								const mib_text = mib_element.textContent;
								const mib_match = mib_text.match(/\d+/);
								if (mib_match) return mib_match[0];
							}

							return d.customdata?.[3] ?? "?";
						}
					});
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
			const is_line = mode.includes("lines");

			const points = (t.x || []).map((x_val, i) => {
				const cd = Array.isArray(t.customdata) ? (t.customdata[i] ?? null) : (t.customdata ?? null);
				const mintRaw = Array.isArray(cd?.[0]) ? cd[0][0] : cd?.[0];
				const mint = (typeof mintRaw === "string") ? mintRaw.split("|")[0].trim() : mintRaw;

				const rawY = +(t.y?.[i]);
				const y_val = Number.isFinite(rawY) ? Math.max(1, rawY) : rawY;

				return {
					x: +x_val,
					y: y_val,
					i,
					name: t.name ?? "",
					text: Array.isArray(t.text) ? (t.text[i] ?? "") : (t.text ?? ""),
					customdata: cd,
					id: cd?.[1],//Number(cd?.[1]),
					type_number: cd?.[3],
					mint: cd?.[0]//mint
				};
			});

			if (is_line) {
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

			const marker_color = (t.name === "Aproximación") ? "rgb(20, 80, 200)" : t.marker?.color;
			const get_fill = (d) =>
				Array.isArray(marker_color) ? (marker_color[d.i] ?? "white") : (marker_color ?? "white");

			return {
				kind: "points",
				points,
				name: t.name,
				keepColor: (t.name === COLOR_TRACE_NAME),
				style: {
					r: (t.name === "Aproximación") ? 4 : 5,
					fill: get_fill,
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

		const mean_x = X.slice(0, n).reduce((acc, v) => acc + v, 0) / n;
		const mean_y = Y.slice(0, n).reduce((acc, v) => acc + v, 0) / n;

		let N = 0;
		let D = 0;

		for (let i = 0; i < n; i++) {
			N += (X[i] - mean_x) * (Y[i] - mean_y);
			D += Math.pow(X[i] - mean_x, 2);
		}

		if (D === 0) {
			return { a: NaN, b: NaN };
		}

		const b = N / D;
		const a = mean_y - b * mean_x;

		return { a, b };
	},

};
