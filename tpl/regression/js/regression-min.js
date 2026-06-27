var regression_min = (function (exports) {
	'use strict';

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


	/**
	 * Callback for tooltip rendering in violin-boxplot visualizations.
	 * Fetches additional catalog data for a specific type and returns its rendered representation.
	 * @param {Object} options - Tooltip options.
	 * @param {string} options.id - Section ID of the record.
	 * @param {string} options.type_number - Type number string.
	 * @param {string} options.mint - Mint name.
	 * @returns {Promise<Element>} The DOM element representing the tooltip content.
	 */
	async function type_tooltip_callback(options) {
		if (SHOW_DEBUG === true) {
			console.warn("---> type_tooltip_callback options", options);
		}
		const section_id = options.id;
		const type_number = options.type_number;
		const mint = options.mint;

		const catalog_ar_fields = ["*"];

		const catalog_request_options = {
			dedalo_get: "records",
			lang: page_globals.WEB_CURRENT_LANG_CODE,
			table: "catalog",
			ar_fields: catalog_ar_fields,
			section_id: section_id,
			limit: 1,
			count: false,
		};

		const api_response = await data_manager.request({
			body: catalog_request_options,
		});

		if (SHOW_DEBUG === true) {
			console.warn("---> type_tooltip_callback api_response", api_response);
		}

		const type_data = api_response.result || null;

		if (!type_data) {
			return common.create_dom_element({
				element_type: "div",
				text_content: `Could not find number ${type_number} for mint ${mint} in the database.`,
			});
		}
		const type_row = page.parse_catalog_data(type_data)[0];

		// set true to render material and denomination
		type_row.add_denomination = true;

		const type_node = catalog_row_fields.draw_item(type_row);

		if (type_node) {
			// Remove style of coins images container, since it is hardcoded to 124mm
			type_node.getElementsByClassName("coins_images")[0].removeAttribute("style");
		}

		return type_node;
	}


	const regression_logic = {

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
				console.error('This database is not available yet! Use web_numisdata_mib_pre instead');
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
						console.log(response);
						console.log(request_body);
					}
					const vars = Object.fromEntries(
						response.result
							.filter(r => r.titulo && r.cuerpo)
							.map(r => {
								try {
									return [r.titulo, JSON.parse(r.cuerpo)];
								} catch (e) {
									if (SHOW_DEBUG === true) {
										console.error('load_regression_vars: skipping malformed cuerpo for', r.titulo, e);
									}
									return null;
								}
							})
							.filter(entry => entry !== null)
					);

					this.regression_vars = vars;

					if(SHOW_DEBUG===true) {
						console.log('---> regression_vars loaded', this.regression_vars);
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
		* D_A_Ant  -> regression_vars.anvers
		* D_R_Ant  -> regression_vars.revers
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
		* @param {number[]|Float64Array} values
		* @returns {{lwr:number, med:number, upr:number}}
		*/
		bootstrap_band_from_vector: function(values) {
			const clean = values instanceof Float64Array
				? values.filter(v => Number.isFinite(v)).sort()
				: values.filter(v => Number.isFinite(v)).sort((a, b) => a - b);

			if (!clean.length) {
				return { lwr: NaN, med: NaN, upr: NaN };
			}

			return {
				lwr: this.quantile_sorted(clean, 0.025),
				med: this.quantile_sorted(clean, 0.5),
				upr: this.quantile_sorted(clean, 0.975)
			};
		},

		bootstrap_promise: null,
		bootstrap_promise_B: 0,
		bootstrap_promise_limit: 0,

		/**
		* Calculates bootstrap confidence bands for obverse and reverse
		* from 1 to max_ir_limit coins, following the same logic as the R code.
		* Optimized with fits caching and pre-calculated logs.
		*
		* @param {number} B Number of bootstrap iterations
		* @param {number} max_ir_limit
		* @returns {Promise<Object>}
		*/
		get_bootstrap_bands: function(B = 2000, max_ir_limit = 1500) {
			const limit = Math.round(max_ir_limit);

			if (this.bootstrap_cache && this.bootstrap_cache.B === B && this.bootstrap_cache.Mgrid.length >= limit) {
				return Promise.resolve(this.bootstrap_cache);
			}

			if (this.bootstrap_promise && this.bootstrap_promise_B === B && this.bootstrap_promise_limit >= limit) {
				return this.bootstrap_promise;
			}

			this.bootstrap_promise_B = B;
			this.bootstrap_promise_limit = limit;

			this.bootstrap_promise = this.get_log_regression_coefficients().then((fit) => {
				const {
					alphaA, betaA, alphaR, betaR,
					filtered: {
						IR_Ant_filtrat,
						D_A_Ant_filtrat,
						D_R_Ant_filtrat
					}
				} = fit;

				const n = IR_Ant_filtrat.length;
				const Mgrid = new Int32Array(limit);
				const log_Mgrid = new Float64Array(limit);
				for (let i = 0; i < limit; i++) {
					const m = i + 1;
					Mgrid[i] = m;
					log_Mgrid[i] = Math.log(m);
				}

				if (!n) {
					const emptyBand = Array.from(Mgrid, m => ({ m, lwr: NaN, med: NaN, upr: NaN }));
					const res = {
						B, Mgrid: Array.from(Mgrid), bandA: emptyBand, bandR: emptyBand,
						oneDieA: { ir: NaN, lwr: NaN, med: NaN, upr: NaN },
						oneDieR: { ir: NaN, lwr: NaN, med: NaN, upr: NaN }
					};
					this.bootstrap_cache = res;
					return res;
				}

				// Pre-calculate logs of training data for maximum inner-loop performance
				const log_IR = new Float64Array(n);
				const log_DA = new Float64Array(n);
				const log_DR = new Float64Array(n);
				for (let i = 0; i < n; i++) {
					log_IR[i] = Math.log(IR_Ant_filtrat[i]);
					log_DA[i] = Math.log(D_A_Ant_filtrat[i]);
					log_DR[i] = Math.log(D_R_Ant_filtrat[i]);
				}

				// Results buffers
				const pred_a = new Float64Array(limit * B);
				const pred_r = new Float64Array(limit * B);

				const ir_at_one_a = Math.exp(-alphaA / betaA);
				const log_ir_at_one_a = Math.log(ir_at_one_a);
				const ir_at_one_r = Math.exp(-alphaR / betaR);
				const log_ir_at_one_r = Math.log(ir_at_one_r);

				const pred_atOneA = new Float64Array(B);
				const pred_atOneR = new Float64Array(B);

				// Reusable sampling buffers
				const Xb = new Float64Array(n);
				const YAb = new Float64Array(n);
				const YRb = new Float64Array(n);

				for (let b = 0; b < B; b++) {
					// Resampling
					for (let k = 0; k < n; k++) {
						const r = (Math.random() * n) | 0; // Faster floor
						Xb[k]  = log_IR[r];
						YAb[k] = log_DA[r];
						YRb[k] = log_DR[r];
					}

					// Fits
					const fit_a_b = this.coefficients(Xb, YAb);
					const fit_r_b = this.coefficients(Xb, YRb);

					const aA = fit_a_b.a, bA = fit_a_b.b;
					const aR = fit_r_b.a , bR = fit_r_b.b;

					// Distribution bootstrap of "1 die"
					pred_atOneA[b] = Math.exp(aA + bA * log_ir_at_one_a);
					pred_atOneR[b] = Math.exp(aR + bR * log_ir_at_one_r);

					// Loop for Mgrid predictions
					for (let j = 0; j < limit; j++) {
						const log_m = log_Mgrid[j];
						pred_a[j * B + b] = Math.exp(aA + bA * log_m);
						pred_r[j * B + b] = Math.exp(aR + bR * log_m);
					}
				}

				const bandA = new Array(limit);
				const bandR = new Array(limit);
				const tmp = new Float64Array(B);

				for (let j = 0; j < limit; j++) {
					const offset = j * B;

					for (let b = 0; b < B; b++) tmp[b] = pred_a[offset + b];
					bandA[j] = { m: Mgrid[j], ...this.bootstrap_band_from_vector(tmp) };

					for (let b = 0; b < B; b++) tmp[b] = pred_r[offset + b];
					bandR[j] = { m: Mgrid[j], ...this.bootstrap_band_from_vector(tmp) };
				}

				const result = {
					B,
					Mgrid: Array.from(Mgrid),
					bandA,
					bandR,
					oneDieA: { ir: ir_at_one_a, ...this.bootstrap_band_from_vector(pred_atOneA) },
					oneDieR: { ir: ir_at_one_r, ...this.bootstrap_band_from_vector(pred_atOneR) }
				};

				this.bootstrap_cache = result;
				return result;
			}).finally(() => {
				this.bootstrap_promise = null;
			});

			return this.bootstrap_promise;
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
			if (!Array.isArray(band) || !Number.isFinite(ir) || ir < 1 || ir > band.length) {
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
		plot_anv: function(regression_model_chart_container, max_requested_ir = 0) {
			const max_ir = Math.max(max_requested_ir, 10);
			return Promise.all([
				this.get_log_regression_coefficients(),
				this.get_bootstrap_bands(2000, max_ir)
			]).then(([fit, bootstrap]) => {
				const {
					alphaA, betaA,
					filtered: { IR_Ant_filtrat, D_A_Ant_filtrat }
				} = fit;
				const { Mgrid, bandA } = bootstrap;

				// Filter observed data to fit the display range
				const observed_x = [];
				const observed_y = [];
				for (let i = 0; i < IR_Ant_filtrat.length; i++) {
					if (IR_Ant_filtrat[i] <= max_ir) {
						observed_x.push(IR_Ant_filtrat[i]);
						observed_y.push(D_A_Ant_filtrat[i]);
					}
				}

				const min_ir = (observed_x.length > 0) ? Math.min(...observed_x) : 0;
				const x_vals = Array.from({ length: 2000 }, (_, i) => min_ir + (i / 1999) * (max_ir - min_ir));
				const y_vals = x_vals.map(x => this.predict_potential(x, alphaA, betaA));

				const traces = [
					{
						x: Mgrid,
						y: bandA.map(row => row.lwr),
						fill: "none",
						mode: "lines",
						line: { width: 1, color: "rgba(153, 127, 90, 0.2)" },
						type: "scatter",
						name: "Lwr",
						hoverinfo: "skip",
						showlegend: false,
						xaxis: "x1", yaxis: "y1"
					},
					{
						x: Mgrid,
						y: bandA.map(row => row.upr),
						fill: "tonexty",
						fillcolor: "rgba(153, 127, 90, 0.1)", // Transparent brand color for band
						mode: "lines",
						line: { width: 1, color: "rgba(153, 127, 90, 0.2)" },
						type: "scatter",
						name: "Upr",
						hoverinfo: "skip",
						showlegend: false,
						xaxis: "x1", yaxis: "y1"
					},
					{
						x: observed_x,
						y: observed_y,
						mode: "markers",
						type: "scatter",
						name: "Datos observados",
						marker: { color: "#c7ba9d" }, // Lighter beige for historical context
						xaxis: "x1", yaxis: "y1"
					},
					{
						x: x_vals,
						y: y_vals,
						mode: "lines",
						type: "scatter",
						name: "Modelo estimado",
						line: { color: "#997f5a", width: 2 },
						xaxis: "x1", yaxis: "y1"
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
		plot_points_regression_anv: function(parsed_data, regression_model_chart_container, max_ir = 1500) {
			const emblems = parsed_data.slice(1);

			return Promise.all([
				this.get_log_regression_coefficients(),
				this.get_bootstrap_bands(2000, max_ir)
			]).then(([fit, bootstrap]) => {
				const { alphaA, betaA } = fit;

				// Compute IR + approx synchronously using cached coefficients (no per-emblem promise hops)
				const vect_tipos = emblems.map(emblem => {
					const index = emblem.full_coins_reference_calculable || [];
					let ir = 0;
					for (let i = 0; i < index.length; i++) {
						if (index[i] === true) ir++;
					}
					const approx = this.predict_potential(ir, alphaA, betaA);
					return {
						ir,
						approx,
						ceca: Array.isArray(emblem.p_mint) ? emblem.p_mint[0] : emblem.p_mint,
						id: emblem.section_id,
						num: emblem.ref_type_number,
						ref_ceca: emblem.ref_mint_number
					};
				});

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
						color: "#997f5a",
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
		plot_rev: function(regression_model_chart_container, max_requested_ir = 0) {
			const max_ir = Math.max(max_requested_ir, 10);
			return Promise.all([
				this.get_log_regression_coefficients(),
				this.get_bootstrap_bands(2000, max_ir)
			]).then(([fit, bootstrap]) => {
				const {
					alphaR, betaR,
					filtered: { IR_Ant_filtrat, D_R_Ant_filtrat }
				} = fit;
				const { Mgrid, bandR } = bootstrap;

				const observed_x = [];
				const observed_y = [];
				for (let i = 0; i < IR_Ant_filtrat.length; i++) {
					if (IR_Ant_filtrat[i] <= max_ir) {
						observed_x.push(IR_Ant_filtrat[i]);
						observed_y.push(D_R_Ant_filtrat[i]);
					}
				}

				const min_ir = (observed_x.length > 0) ? Math.min(...observed_x) : 0;
				const x_vals = Array.from({ length: 2000 }, (_, i) => min_ir + (i / 1999) * (max_ir - min_ir));
				const y_vals = x_vals.map(x => this.predict_potential(x, alphaR, betaR));

				const traces = [
					{
						x: Mgrid,
						y: bandR.map(row => row.lwr),
						fill: "none",
						mode: "lines",
						line: { width: 1, color: "rgba(153, 127, 90, 0.2)" },
						type: "scatter",
						name: "Lwr",
						hoverinfo: "skip",
						showlegend: false,
						xaxis: "x2", yaxis: "y2"
					},
					{
						x: Mgrid,
						y: bandR.map(row => row.upr),
						fill: "tonexty",
						fillcolor: "rgba(153, 127, 90, 0.1)",
						mode: "lines",
						line: { width: 1, color: "rgba(153, 127, 90, 0.2)" },
						type: "scatter",
						name: "Upr",
						hoverinfo: "skip",
						showlegend: false,
						xaxis: "x2", yaxis: "y2"
					},
					{
						x: observed_x,
						y: observed_y,
						mode: "markers",
						type: "scatter",
						name: "Datos observados",
						marker: { color: "#c7ba9d" },
						xaxis: "x2", yaxis: "y2"
					},
					{
						x: x_vals,
						y: y_vals,
						mode: "lines",
						type: "scatter",
						name: "Modelo estimado",
						line: { color: "#997f5a", width: 2 },
						xaxis: "x2", yaxis: "y2"
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
		plot_points_regression_rev: function(parsed_data, regression_model_chart_container, max_ir = 1500) {
			const emblems = parsed_data.slice(1);

			return Promise.all([
				this.get_log_regression_coefficients(),
				this.get_bootstrap_bands(2000, max_ir)
			]).then(([fit, bootstrap]) => {
				const { alphaR, betaR } = fit;

				// Compute IR + approx synchronously using cached coefficients (no per-emblem promise hops)
				const vect_tipos = emblems.map(emblem => {
					const index = emblem.full_coins_reference_calculable || [];
					let ir = 0;
					for (let i = 0; i < index.length; i++) {
						if (index[i] === true) ir++;
					}
					const approx = this.predict_potential(ir, alphaR, betaR);
					return {
						ir,
						approx,
						ceca: Array.isArray(emblem.p_mint) ? emblem.p_mint[0] : emblem.p_mint,
						id: emblem.section_id,
						num: emblem.ref_type_number,
						ref_ceca: emblem.ref_mint_number
					};
				});

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
						color: "#997f5a",
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
			const max_ir_search = this._get_max_ir_from_parsed_data(parsed_data);

			return this.get_log_regression_coefficients().then((fit) => {
				const max_ir_observed = (fit.filtered.IR_Ant_filtrat.length > 0) ? Math.max(...fit.filtered.IR_Ant_filtrat) : 0;
				// Prioritize search results max IR to "fit" the graph to the results, plus a tiny margin.
				// If no results, default to observed max.
				const max_ir = (max_ir_search > 0) ? Math.max(max_ir_search * 1.02, 10) : max_ir_observed;

				return Promise.all([
					this.plot_rev(regression_model_chart_container, max_ir),
					this.plot_points_regression_rev(parsed_data, regression_model_chart_container, max_ir),
					this.plot_anv(regression_model_chart_container, max_ir),
					this.plot_points_regression_anv(parsed_data, regression_model_chart_container, max_ir)
				]).then(([revModel, revPoints, anvModel, anvPoints]) => {
					const tracesRev = [...revModel, ...revPoints];
					const tracesAnv = [...anvModel, ...anvPoints];

					this._render_rev_anv_d3(regression_model_chart_container, tracesAnv, tracesRev, {
						xLabel: "Índice de Rareza (IR)",
						yLabel: "Número de cuños estimado"
					});
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
		 * Calculates the maximum IR value from a parsed data set of emblems.
		 *
		 * @private
		 * @param {Array<Object>} parsed_data
		 * @returns {number}
		 */
		_get_max_ir_from_parsed_data: function(parsed_data) {
			if (!Array.isArray(parsed_data)) return 0;
			return parsed_data.slice(1).reduce((max, emblem) => {
				const index = emblem.full_coins_reference_calculable || [];
				let ir = 0;
				for (let i = 0; i < index.length; i++) {
					if (index[i] === true) ir++;
				}
				return Math.max(max, ir);
			}, 0);
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

			d3.select(root)
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
			const width = viewport_w;
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

				// Fit axes tightly to the data range, preventing large blank spaces at the right or top.
				const x_max = d3.max(all_pts, d => d.x) || 10;
				const y_max = d3.max(all_pts, d => d.y) || 10;

				const x = d3.scaleLinear()
					.domain([0, x_max])
					.range([0, inner_w]);

				const y = d3.scaleLinear()
					.domain([0, y_max * 1.05])
					.range([inner_h, 0]);

				// Create a unique clip path for this panel to prevent data bleeding across axes
				const clipId = `clip-${i}-${Math.floor(Math.random() * 100000)}`;
				svg.append("defs").append("clipPath")
					.attr("id", clipId)
					.append("rect")
					.attr("width", inner_w)
					.attr("height", inner_h);

				// Define independent zoom behavior
				const zoom = d3.zoom()
					.scaleExtent([1, 15])
					.extent([[0, 0], [inner_w, inner_h]])
					.on("zoom", (event) => {
						const newX = event.transform.rescaleX(x);
						const newY = event.transform.rescaleY(y);

						// Update axes
						gx.call(d3.axisBottom(newX).ticks(6));
						gy.call(d3.axisLeft(newY).ticks(5));

						// Update lines and paths
						const new_line = d3.line()
							.defined(d => Number.isFinite(d.x) && Number.isFinite(d.y))
							.x(d => newX(d.x))
							.y(d => newY(d.y));

						plot_area.selectAll("path").attr("d", new_line);

						// Update points
						plot_area.selectAll("circle")
							.attr("cx", d => newX(d.x))
							.attr("cy", d => newY(d.y));
					});

				// Transparent overlay for pan/zoom gestures
				const zoom_overlay = g.append("rect")
					.attr("width", inner_w)
					.attr("height", inner_h)
					.attr("fill", "transparent")
					.attr("pointer-events", "all")
					.call(zoom)
					.on("dblclick.zoom", (event) => {
						// Double click reset: restore position (tx=0, ty=0) and scale (k=1)
						event.preventDefault();

						// Smooth transition to original state
						zoom_overlay.transition().duration(750)
							.call(zoom.transform, d3.zoomIdentity);

						// Also clear any active point highlights for a full reset
						svg.selectAll("circle")
							.style("stroke", "#000")
							.style("stroke-width", 2)
							.attr("r", circle_d => (circle_d?.name === "Aproximación" ? 4 : 5));
					});

				// Content area (clipped)
				const plot_area = g.append("g")
					.attr("clip-path", `url(#${clipId})`);

				const gx = g.append("g")
					.attr("transform", `translate(0,${inner_h})`)
					.call(d3.axisBottom(x).ticks(6));

				const gy = g.append("g")
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
					plot_area.append("path")
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

					const circles = plot_area.selectAll(null)
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

					const blue_circles = circles.filter(d => d.name === "Aproximación");

					// Stale-tooltip guard: increments on each hover so async resolutions
					// from previous hovers can be detected and ignored.
					let hover_token = 0;

					blue_circles
						.style("cursor", "pointer")
						.style("transition", "stroke 0.2s, stroke-width 0.2s, r 0.2s")
						.on("mouseenter.tooltip", async (event, d) => {
							const token = ++hover_token;
							tooltip.style("opacity", 1);

							const options = {
								id: d.customdata?.[1],
								type_number: d.customdata?.[3],
								mint: d.customdata?.[0]
							};

							try {
								const tooltip_element = await type_tooltip_callback(options);
								// Ignore stale resolution if user has moved to another point
								if (token !== hover_token) return;
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
								if (token !== hover_token) return;
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

							let left = x_center + sx - tt_w / 2;
							let top  = (c_rect.top - p_rect.top) + sy - tt_h - 12;

							// Boundary checks to prevent cutting off at edges
							const margin = 10;
							const max_left = p_rect.width - tt_w - margin;

							if (left < margin) left = margin;
							if (left > max_left) left = max_left;

							// Flip to bottom if it goes off-top
							if (top < margin) {
								top = (c_rect.top - p_rect.top) + sy + c_rect.height + 12;
							}

							tooltip.style("left", `${left}px`).style("top", `${top}px`);
						})
						.on("mouseleave.tooltip", () => {
							hover_token++; // invalidate any in-flight tooltip request
							tooltip.style("opacity", 0);
						})
						.on("click", async (event, d) => {
							event.preventDefault();
							event.stopPropagation();

							// Identify and highlight the active point across both graphs
							const section_id = d.customdata?.[1];
							if (section_id) {
								// Reset all points to their default state
								svg.selectAll("circle")
									.style("stroke", "#573c3cff")
									.style("stroke-width", 2)
									.attr("r", function(circle_d) {
										// Return to original radius based on trace type
										return (circle_d?.name === "Aproximación") ? 4 : 5;
									});

								// Highlight points matching the clicked section ID in both panels
								svg.selectAll("circle")
									.filter(circle_d => circle_d && circle_d.customdata?.[1] === section_id)
									.style("stroke", "#997f5a") // Site main color
									.style("stroke-width", 4)
									.attr("r", 6);
							}

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
							min-height: 500px;
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
							height: auto;
							min-height: 500px;
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

								const mib_number = this.extract_mib_number(tooltip_element, d.customdata?.[3] ?? "?");

								left_panel.innerHTML = `
								<h3 style="margin: 0 0 15px 0; border-bottom: 2px solid #997f5a; padding-bottom: 10px;">
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
					(typeof mintRaw === "string") ? mintRaw.split("|")[0].trim() : mintRaw;

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

				const marker_color = (t.name === "Aproximación") ? "#997f5a" : t.marker?.color;
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
		 * Calculates simple linear regression coefficients for y = a + b*x.
		 * Optimized with simple loops and numeric operations.
		 *
		 * @param {number[]|Float64Array} X
		 * @param {number[]|Float64Array} Y
		 * @returns {{a: number, b: number}}
		 */
		coefficients: function(X, Y) {
			const n = X.length < Y.length ? X.length : Y.length;
			if (n === 0) return { a: NaN, b: NaN };

			let sum_x = 0;
			let sum_y = 0;
			for (let i = 0; i < n; i++) {
				sum_x += X[i];
				sum_y += Y[i];
			}
			const mean_x = sum_x / n;
			const mean_y = sum_y / n;

			let num = 0;
			let den = 0;
			for (let i = 0; i < n; i++) {
				const dx = X[i] - mean_x;
				num += dx * (Y[i] - mean_y);
				den += dx * dx;
			}

			if (den === 0) return { a: NaN, b: NaN };

			const b = num / den;
			const a = mean_y - b * mean_x;

			return { a, b };
		},
	};

	/**
	 * @fileoverview Analysis module for MIB project.
	 * Handles the generation of charts (weight, diameter, clock) and regression models
	 * based on coin catalog data filtered via a user-facing search form.
	 *
	 * @module analysis
	 *
	 * @example
	 * // Basic setup
	 * import { regression } from './tpl/regression/js/regression.js';
	 *
	 * regression.set_up({
	 *   area_name: 'catalog_regression',
	 *   form_items_container: document.getElementById('form_container'),
	 *   regression_model_chart_container: document.getElementById('regression_model_chart'),
	 * });
	 */



	/**
	 * Main regression controller object.
	 * Integrates regression analysis functions and manages the UI for data filtering and visualization.
	 */
	const regression =  {

		// Include regression_logic module functions
		...regression_logic,

		/**
		 * Form factory instance used to build the search interface.
		 * @type {form_factory|null}
		 */
		form: null,

		/**
		 * Form submit button element.
		 * @type {HTMLButtonElement|null}
		 */
		submit_button: null,

		/**
		 * Area name for the current context.
		 * @type {string|null}
		 */
		area_name				: null,

		/**
		 * Current row data if applicable.
		 * @type {Object|null}
		 */
		row						: null,

		// DOM containers
		/** @type {HTMLElement|null} Container for data export controls. */
		export_data_container				: null,
		/** @type {HTMLElement|null} Container where the form items are rendered. */
		form_items_container				: null,
		/** @type {HTMLElement|null} Container for the regression model visualization. */
		regression_model_chart_container	: null,

		/**
		 * Color hexadecimal code for each denomination
		 * @type {{
		 * 	section_id: number,
		 * 	color: string
		 * }[]}
		 */
		denomination_colors: null,

		/**
		 * Initializes the regression module by setting up DOM containers,
		 * loading denomination colors, and rendering the search form.
		 *
		 * @param {Object} options - Configuration options for the module.
		 * @param {string} options.area_name - Name of the current working area.
		 * @param {HTMLElement} options.export_data_container - Container for export buttons.
		 * @param {Object} options.row - Current record data.
		 * @param {HTMLElement} options.form_items_container - Target container for the form.
		 * @param {HTMLElement} options.regression_model_chart_container - Target container for regression plot.
		 * @returns {boolean} Returns true if setup was initiated successfully.
		 */
		set_up : function(options) {

			const self = this;

			// options
				self.area_name							= options.area_name;
				self.export_data_container				= options.export_data_container;
				self.row								= options.row;
				self.form_items_container				= options.form_items_container;
				self.regression_model_chart_container	= options.regression_model_chart_container;
				self.pdf_current						= options.pdf_current;

			// form (render first so submit_button exists before async color load resolves)
				const form_node = self.render_form();
				self.form_items_container.appendChild(form_node);

			// denomination colors + first auto search, both gated on form readiness
				self.load_denomination_colors()
					.then(() => self.auto_search());

			return true
		},//end set_up

		/**
		 * Executes a first search with a random mint automatically.
		 */
		auto_search : function() {

			const self = this;

			// request possible mint values from catalog
			const request_body = {
				dedalo_get	: 'records',
				table		: 'catalog',
				ar_fields	: ['p_mint'],
				limit		: 50,
				group		: 'p_mint'
			};

			data_manager.request({
				body : request_body
			})
			.then((response)=>{
				if (response.result && response.result.length > 0) {
					// filter results to get valid mint names
					const mints = response.result
						.map(r => {
							try {
								return (typeof r.p_mint === 'string') ? JSON.parse(r.p_mint) : r.p_mint
							} catch(e) {
								return null
							}
						})
						.filter(val => Array.isArray(val) && val.length > 0)
						.map(val => val[0]);

					if (mints.length > 0) {
						// pick a random mint
						const random_mint = mints[Math.floor(Math.random() * mints.length)];

						// find mint form item and set its value
						const mint_item = self.form.form_items['mint'];
						if (mint_item) {
							mint_item.node_input.value = random_mint;
							mint_item.q = random_mint;

							// trigger input event to update floating label
							mint_item.node_input.dispatchEvent(new Event('input'));
							// trigger blur event to ensure label is positioned correctly
							mint_item.node_input.dispatchEvent(new Event('blur'));

							// auto-submit search
							self.form_submit();
						}
					}
				}
			})
			.catch((err) => {
				if(SHOW_DEBUG===true) {
					console.error('auto_search error:', err);
				}
			});
		},

		/**
		 * Call the Dedalo API and obtain colors for the different denominations
		 * Loads color definitions for different coin denominations from the Dedalo API.
		 * These colors are used for consistent visualization across different charts.
		 * Once colors are loaded, the search submit button is enabled.
		 *
		 * @returns {void}
		 */
		load_denomination_colors : async function() {

			const self = this;

			const request_body = {
				dedalo_get	: 'records',
				table		: 'ts_object',
				ar_fields	: ['color', 'section_id', 'term'],
				sql_filter	: "color IS NOT NULL AND color != ''",
				lang		: page_globals.WEB_CURRENT_LANG_CODE
			};

			const api_response = await data_manager.request({
				body : request_body
			});
			if(SHOW_DEBUG) {
				console.log('load_denomination_colors API call response', api_response);
			}

			const result = api_response.result || [];
			self.denomination_colors = result
				.filter((ele) => ele.color && ele.color.length)
				.map((ele) => {
					return {
						section_id	: ele.section_id,
						color		: ele.color
					}
				});

			if(SHOW_DEBUG) {
				console.log('load_denomination_colors processed colors', self.denomination_colors);
			}

			// Enable submit button
			self.submit_button.disabled = false;
		},

		/**
		 * Renders the search form using the `form_factory`.
		 * Configures multiple input fields like Mint, Number, Material, Denomination,
		 * Culture, Iconography, and a Period range slider with auto-complete functionality.
		 *
		 * @returns {HTMLFormElement} The constructed form element.
		 */
		render_form : function() {

			const self = this;

			// DocumentFragment is like a virtual DOM
			const fragment = new DocumentFragment();

			// form_factory instance
				self.form = self.form || new form_factory();

			const form_row = common.create_dom_element({
				element_type	: "div",
				class_name		: "form-row fields",
				parent			: fragment
			});

			// mint
				self.form.item_factory({
					id				: "mint",
					name			: "mint",
					label			: tstring.mint || "mint",
					q_column		: "p_mint",
					value_wrapper	: ['["', '"]'], // to obtain ["value"] in selected value only
					eq				: "LIKE",
					eq_in			: "%",
					eq_out			: "%",
					is_term			: true,
					parent			: form_row,
					callback		: function(form_item) {
						self.form.activate_autocomplete({
							form_item	: form_item,
							table		: 'catalog'
						});
					}
				});

			// number
				self.form.item_factory({
					id 			: "number",
					name 		: "number",
					q_column 	: "term",
					q_table 	: "types",
					label		: tstring.number_key || "Number & Key",
					is_term 	: false,
					parent		: form_row,
					group_op 	: '$or',
					callback	: function(form_item) {
						self.form.activate_autocomplete({
							form_item	: form_item,
							table		: 'catalog'
						});
					}
				});

			// material
				self.form.item_factory({
					id 			: "material",
					name 		: "material",
					q_column 	: "ref_type_material",
					q_table 	: "any",
					label		: tstring.material || "material",
					is_term 	: false,
					parent		: form_row,
					callback	: function(form_item) {
						self.form.activate_autocomplete({
							form_item	: form_item,
							table		: 'catalog'
						});
					}
				});

			// denomination
				self.form.item_factory({
					id 			: "denomination",
					name 		: "denomination",
					q_column 	: "ref_type_denomination",
					q_table 	: "any",
					label		: tstring.denomination || "denomination",
					is_term 	: false,
					parent		: form_row,
					callback	: function(form_item) {
						self.form.activate_autocomplete({
							form_item	: form_item,
							table		: 'catalog'
						});
					}
				});

			// culture
				self.form.item_factory({
					id				: "culture",
					name			: "culture",
					label			: tstring.culture || "culture",
					q_column		: "p_culture",
					value_wrapper	: ['["','"]'], // to obtain ["value"] in selected value only
					eq_in			: "%",
					eq_out			: "%",
					is_term			: true,
					parent			: form_row,
					callback		: function(form_item) {
						self.form.activate_autocomplete({
							form_item	: form_item,
							table		: 'catalog'
						});
					}
				});

			// iconography_obverse
				self.form.item_factory({
					id				: "iconography_obverse",
					name			: "iconography_obverse",
					label			: tstring.iconography_obverse || "iconography obverse",
					q_column		: "ref_type_design_obverse_iconography",
					value_split		: ' | ',
					q_splittable	: true,
					q_selected_eq	: 'LIKE',
					eq_in			: "%",
					eq_out			: "%",
					// q_table		: "ts_period",
					is_term			: false,
					parent			: form_row,
					callback	: function(form_item) {
						self.form.activate_autocomplete({
							form_item	: form_item,
							table		: 'catalog'
						});
					}
				});

			// iconography_reverse
				self.form.item_factory({
					id				: "iconography_reverse",
					name			: "iconography_reverse",
					label			: tstring.iconography_reverse || "iconography reverse",
					q_column		: "ref_type_design_reverse_iconography",
					value_split		: ' | ',
					q_splittable	: true,
					q_selected_eq	: 'LIKE',
					eq_in			: "%",
					eq_out			: "%",
					// q_table		: "ts_period",
					is_term			: false,
					parent			: form_row,
					callback		: function(form_item) {
						self.form.activate_autocomplete({
							form_item	: form_item,
							table		: 'catalog'
						});
					}
				});

			// range slider date (range_slider) (!) WORKING HERE
				self.form.item_factory({
					id			: "range_slider",
					name		: "range_slider",
					input_type	: 'range_slider',
					label		: tstring.period || "Period",
					class_name	: 'range_slider',
					q_column	: "ref_date_in,ref_date_end",
					// eq		: "LIKE",
					// eq_in	: "",
					// eq_out	: "%",
					// q_table	: "catalog",
					sql_filter	: null,
					parent		: form_row,
					callback	: function(form_item) {

						// const form_item				= this
						const node_input				= form_item.node_input;
						const range_slider_value_in		= node_input.parentNode.querySelector('#range_slider_in');
						const range_slider_value_out	= node_input.parentNode.querySelector('#range_slider_out');

						/**
						 * Configures and initializes the jQuery UI range slider for period filtering.
						 * Fetches the available year range from the catalog and updates the UI inputs.
						 */
						function set_up_slider() {

							// compute range years
							self.get_catalog_range_years()
							.then(function(range_data){
								if(SHOW_DEBUG===true) {
									console.log('---> range_data', range_data);
								}

								// destroy current slider instance if already exists
									if ($(node_input).slider("instance")) {
										$(node_input).slider("destroy");
									}

								// reset filter
									form_item.sql_filter = null;

								// set inputs values from database
									range_slider_value_in.value	= range_data.min;
									range_slider_value_in.addEventListener("change",function(e){
										const value = (e.target.value>=range_data.min)
											? e.target.value
											: range_data.min;
										$(node_input).slider( "values", 0, value );
										e.target.value = value;
									});
									range_slider_value_out.value = range_data.max;
									range_slider_value_out.addEventListener("change",function(e){
										const value = (e.target.value<=range_data.max)
											? e.target.value
											: range_data.max;
										$(node_input).slider( "values", 1, value );
										e.target.value = value;
									});

								// active jquery slider
									$(node_input).slider({
										range	: true,
										min		: range_data.min,
										max		: range_data.max,
										step	: 1,
										values	: [ range_data.min, range_data.max ],
										slide	: function( event, ui ) {
											// update input values on user drag slide points
											range_slider_value_in.value	 = ui.values[0];
											range_slider_value_out.value = ui.values[1];
											// console.warn("-----> slide range form_item.sql_filter:",form_item.sql_filter);
										},
										change: function( event, ui ) {
											// update form_item sql_filter value on every slider change
											form_item.sql_filter = "(ref_date_in >= " + ui.values[0] + " AND ref_date_in <= "+ui.values[1]+")"; // AND (ref_date_end <= " + ui.values[1] + " OR ref_date_end IS NULL)
											form_item.q = ui.value;
											// console.warn("-----> change range form_item.sql_filter:", form_item.sql_filter);
										}
									});
							});
						}

						// initial_map_loaded event (triggered on initial map data is ready)
						// event_manager.subscribe('initial_map_loaded', set_up_slider)
						set_up_slider();
					}
				});

			// submit button
				const submit_group = common.create_dom_element({
					element_type	: "div",
					class_name		: "form-group field button_submit",
					parent			: fragment
				});
				self.submit_button = common.create_dom_element({
					element_type	: "input",
					type			: "submit",
					id				: "submit",
					value			: tstring.search || "Search",
					class_name		: "btn btn-light btn-block primary",
					parent			: submit_group
				});
				self.submit_button.disabled = true;  // disable the button until the denomination colors are loaded
				self.submit_button.addEventListener("click", function (e) {
					e.preventDefault();
					self.form_submit(form);
				});

			// reset button
				const reset_button = common.create_dom_element({
					element_type	: "input",
					type			: "button",
					id				: "button_reset",
					value			: tstring.reset || 'Reset',
					class_name		: "btn btn-light btn-block secondary button_reset",
					parent			: submit_group
				});
				reset_button.addEventListener("click", function (e) {
					e.preventDefault();
					window.location.replace(window.location.pathname);
				});

			// operators
				// fragment.appendChild( forms.build_operators_node() )
				const operators_node = self.form.build_operators_node();
				fragment.appendChild( operators_node );

			// the form element itself!
				const form = common.create_dom_element({
					element_type	: "form",
					id				: "search_form",
					class_name		: "form-inline"
				});
				form.appendChild(fragment);


			return form
		},//end render_form

		/**
		 * Handles form submission and search execution.
		 * 1. Collects and builds filters from form items.
		 * 2. Cleans up previous results and UI state (show/hide sections, clear charts).
		 * 3. Executes API request for catalog rows.
		 * 4. Processes the results into datasets for weights, diameters, axes, and regression.
		 * 5. Instantiates and renders chart wrappers for each data category.
		 *
		 * @param {Object} form_obj - The form element or object (reserved for future use).
		 * @param {Object} [options={}] - Optional parameters.
		 * @param {boolean} [options.scroll_result=true] - Whether to scroll to results after search.
		 * @param {Object[]} [options.form_items] - Custom form items to use for filter building.
		 * @returns {Promise<Object[]>} A promise that resolves with the parsed and processed search data.
		 */
		form_submit : function(form_obj, options={}) {

			const self = this;

			// options
				typeof options.scroll_result==="boolean" ? options.scroll_result : true;
				const form_items	= options.form_items || self.form.form_items;

			// build filter
				const filter = self.form.build_filter({
					form_items: form_items
				});

			// empty filter case
				if (!filter || filter.length<1) {
					return false
				}

			// loading
				// cleanup html
					self.regression_model_chart_container.replaceChildren();
					document.getElementById('regression_model_section').classList.add('hide');

				// spinner
					const result = document.getElementById('result');
					const spinner = common.create_dom_element({
						element_type	: 'div',
						class_name		: 'spinner',
						parent			: result
					});

			// search rows exec against API
				const js_promise = self.search_rows({
					filter			: filter,
					limit			: 0,
					process_result	: {
						fn		: 'process_result::add_parents_and_children_recursive',
						columns	: [{name : "parents"}]
					}
				})
				.then((parsed_data)=>{
					if(SHOW_DEBUG===true) {
						console.log('---> parsed_data', parsed_data);
					}

					event_manager.publish('form_submit', parsed_data);

					// Reference calculable. Filter result rows with full_coins_reference_calculable data.
					const reference_calculable = parsed_data.filter( el => {
						return el.full_coins_reference_calculable && el.full_coins_reference_calculable.length > 0
					});

					// Modelo_Regresión
					if (!IS_PRODUCTION) { // Only display in PRE from now (!)
						if (reference_calculable.length) {

							// Show hidden DOM node 'regression_model_chart_container'
							document.getElementById('regression_model_section').classList.remove('hide');

							this.plot_rev_and_anv(this.regression_model_chart_container,parsed_data)
								.then(() => {
									// show pdf section if available
									if (self.pdf_current) {
										requestAnimationFrame(() => {
											const pdf_section = document.getElementById('pdf_section');
											if (pdf_section) {
												pdf_section.classList.remove('hide');
											}
										});
									}
								})
								.catch((err) => {
									if(SHOW_DEBUG===true) {
										console.error('plot_rev_and_anv error:', err);
									}
								});
						}
					}
				})
				.catch((err) => {
					if(SHOW_DEBUG===true) {
						console.error('form_submit search error:', err);
					}
				})
				.finally(() => {
					spinner.remove();
				});


			return js_promise
		},

		/**
		 * Performs a search in the catalog records.
		 * @param {Object} options - Search options.
		 * @param {Object} [options.filter] - Search filter.
		 * @param {Array<string>} [options.ar_fields=['*']] - Fields to retrieve.
		 * @param {string} [options.order='norder ASC'] - Sort order.
		 * @param {number} [options.limit=100] - Result limit.
		 * @returns {Promise<Array<Object>>} A promise that resolves to the parsed catalog data.
		 */
		search_rows : function(options) {

			const self = this;

			// sort vars
				const filter			= options.filter || null;
				const ar_fields			= options.ar_fields || ["*"];
				const order				= options.order || "norder ASC";
				const lang				= page_globals.WEB_CURRENT_LANG_CODE;
				const process_result	= options.process_result || null;
				const limit				= options.limit != undefined
											? options.limit
											: 100;

			return new Promise(function(resolve, reject){
				// parse_sql_filter
					const group = [];
				// parsed filters
					const sql_filter = self.form.parse_sql_filter(filter);
				// request
					const request_body = {
						dedalo_get		: 'records',
						table			: 'catalog',
						ar_fields		: ar_fields,
						lang			: lang,
						sql_filter		: sql_filter,
						limit			: limit,
						group			: (group.length>0) ? group.join(",") : null,
						count			: false,
						order			: order,
						process_result	: process_result
					};
					data_manager.request({
						body : request_body
					})
					.then((response)=>{

						// data parsed
						const data = page.parse_catalog_data(response.result);

						resolve(data);
					})
					.catch((err)=>{
						reject(err);
					});
			})
		},

		/**
		 * Retrieves the minimum and maximum year range from the catalog.
		 * @returns {Promise<{min: number, max: number}>}
		 */
		get_catalog_range_years : function() {

			return new Promise(function(resolve, reject){

				const ar_fields = ['id','section_id','MIN(ref_date_in + 0) AS min','MAX(ref_date_in + 0) AS max'];

				const request_body = {
					dedalo_get		: 'records',
					db_name			: page_globals.WEB_DB,
					lang			: page_globals.WEB_CURRENT_LANG_CODE,
					table			: 'catalog',
					ar_fields		: ar_fields,
					limit			: 0,
					count			: false,
					offset			: 0,
					order			: 'id ASC'
				};
				data_manager.request({
					body : request_body
				})
				.then(function(api_response){
					if (SHOW_DEBUG === true) ;

					let min = 0;
					let max = 0;
					if (api_response.result) {
						for (let i = 0; i < api_response.result.length; i++) {
							const row = api_response.result[i];
							const current_min = parseInt(row.min);
							if (min===0 || current_min<min) {
								min = current_min;
							}
							const current_max = parseInt(row.max);
							// if (current_max>min) {
								max = current_max;
							// }
						}
					}

					const data = {
						min : min,
						max : max
					};

					resolve(data);
				})
				.catch((err)=>{
					reject(err);
				});
			})
		}, //end get_catalog_range_years

	};//end analysis

	exports.regression = regression;
	exports.type_tooltip_callback = type_tooltip_callback;

	return exports;

})({});
