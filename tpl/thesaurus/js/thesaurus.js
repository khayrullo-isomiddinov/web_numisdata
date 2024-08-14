/*global $, tstring, page_globals, SHOW_DEBUG, page, psqo_factory, __WEB_TEMPLATE_WEB__, Promise, common, WEB_AREA, document, DocumentFragment, tstring, console, form_factory, data_manager, tree_factory */
/*eslint no-undef: "error"*/
/*jshint esversion: 6 */
"use strict";



var thesaurus =  {


	/**
	* VARS
	*/
		// search_options
		search_options : {},

		// view_mode. rows view mode. default is 'list'. Others could be 'map', 'timeline' ..
		view_mode : null,

		// global filters
		filters		: {},
		filter_op	: "AND",
		draw_delay	: 200, // ms

		// form. instance of form_factory
		form : null,

		// list. instance of form_list
		list : null,

		// map. instance of form_map
		map : null,

		// timeline. instance of form_timeline
		timeline : null,

		// table (array)
		table : [],

		// root_term (array)
		root_term : [],

		// term_id (from url get request)
		term_id : null,

		// utf_models. Used by epigraphy
		utf_models : [
			'scell2_3', // ts_greek Signo estándar UTF
			'scxpu2_3',	 // ts_punic Signo estándar UTF
			'scxibo2_3', // ts_northern_palaeohispanic Signo estándar UTF
			'scxibm2_3', // ts_southern_palaeohispanic Signo estándar UTF
			'sctxr2_3', // ts_south_palaeohispanic Signo estándar UTF
			'sclat2_3', // ts_latinSigno estándar UTF
		],



	/**
	* SET_UP
	*/
	set_up : function(options) { // async
		// console.log("-> thesaurus set_up options:", options);

		const self = this

		// options
			self.table		= options.table; // self table (array)
			self.root_term	= options.root_term; // self root_term (array)
			self.term_id	= options.term_id
			self.ar_fields	= options.ar_fields
			const rows_list	= options.rows_list

		// root_term catalog
			// if (WEB_AREA==='mints_hierarchy') {

			// 	self.root_term = await (async function(){

			// 		data_manager.request({
			// 			dedalo_get	: 'records',
			// 			db_name		: page_globals.WEB_DB,
			// 			table		: 'catalog',
			// 			ar_fields	: ['section_id'],
			// 			lang		: page_globals.WEB_CURRENT_LANG_CODE,
			// 			sql_filter	: 'parent_term_id=["hierarchy1_262"]',
			// 			limit		: 0,
			// 			count		: false
			// 		})
			// 		.then(function(response){
			// 			console.log("response:",response);
			// 		})
			// 	}) ()
			// }

		// set view_mode default
			self.view_mode = 'tree'

		// spinner
			const spinner = common.create_dom_element({
				element_type	: "div",
				class_name		: "spinner"
			})

		// form. Created DOM form
			self.render_form({
				container : document.getElementById("items_container")
			})
			.then(function(){
				rows_list.appendChild(spinner)
			})

		// tree. load tree data and render tree nodes
			self.load_tree_data({})
			.then(function(response){
				console.log("/// set_up load_tree_data response:", response);

				// result check
					if (!response.result) {
						console.error(`Invalid API response!`);
						return false
					}

				// check root_term
					const root_term_length = self.root_term.length
					for (let i = 0; i < root_term_length; i++) {
						const term_id = self.root_term[i]
						const found = response.result.find(el => el.term_id===term_id)
						if (!found) {
							console.error(`ERROR: Broken tree branch. Root term '${term_id}' not found! Check if it is published`);
							// common.create_dom_element({
							// 	element_type	: 'div',
							// 	class_name		: 'broken_branch no_results_found',
							// 	inner_html		: `Sorry. Broken branch <b>${term_id}</b>. Tree it is not available.`,
							// 	parent			: rows_list
							// })
							// spinner.remove()
							// return false
							continue
						}
					}

				// render data
					self.render_data({
						target		: rows_list,
						ar_rows		: response.result,
						set_hilite	: (self.term_id && self.term_id.length>0)
					})
					.then(function(){
						spinner.remove()
					})
			})


		return true
	},//end set_up



	/**
	* LOAD_TREE_DATA
	* Call to API and load json data results of search
	*/
	load_tree_data : function(options) {

		const self = this

		// const default_fields = [
			// 	'section_id',
			// 	'term_id',
			// 	'term',
			// 	'childrens',
			// 	'code',
			// 	'dd_relations',
			// 	'descriptor',
			// 	'illustration',
			// 	'indexation',
			// 	'model',
			// 	'norder',
			// 	'parent',
			// 	'related',
			// 	'scope_note',
			// 	'space',
			// 	'time',
			// 	'tld',
			// 	'mib_bibliography',
			// 	'dd_relations'
			// ]

		// options
			const filter	= options.filter || null
			const ar_fields	= options.ar_fields || self.ar_fields || ["*"]
			const order		= options.order || "norder ASC"
			const table		= options.table || self.table.join(',')

		// sort vars
			const lang = page_globals.WEB_CURRENT_LANG_CODE

		// parse_sql_filter
			const group = []
			const parse_sql_filter = function(filter){

				if (filter) {

					const op		= Object.keys(filter)[0]
					const ar_query	= filter[op]

					const ar_filter = []
					const ar_query_length = ar_query.length
					for (let i = 0; i < ar_query_length; i++) {

						const item = ar_query[i]

						const item_op = Object.keys(item)[0]
						if(item_op==="AND" || item_op==="OR") {

							const current_filter_line = "(" + parse_sql_filter(item) + ")"
							ar_filter.push(current_filter_line)
							continue;
						}

						const filter_line = (item.field.indexOf("AS")!==-1)
							? "" +item.field+""  +" "+ item.op +" "+ item.value
							: "`"+item.field+"`" +" "+ item.op +" "+ item.value

						ar_filter.push(filter_line)

						// group
							if (item.group) {
								group.push(item.group)
							}
					}
					return ar_filter.join(" "+op+" ")
				}

				return null
			}

		// parsed_filters
			const sql_filter = parse_sql_filter(filter)

		// filter adds
			const filter_end = WEB_AREA==='mints_hierarchy'
				? (sql_filter ? " AND (term_table='mints')" : "(term_table='mints')")
				: sql_filter

		// debug
			if(SHOW_DEBUG===true) {
				// console.log("--- load_tree_data parsed sql_filter:")
				// console.log(sql_filter)
			}

		// request
			const body = {
				dedalo_get	: 'records',
				db_name		: page_globals.WEB_DB,
				table		: table,
				ar_fields	: ar_fields,
				lang		: lang,
				sql_filter	: filter_end,
				limit		: 0,
				// group	: (group.length>0) ? group.join(",") : null,
				count		: false,
				order		: order
			}
			if (WEB_AREA==='mints_hierarchy') {
				body.process_result	= {
					fn				: 'process_result::add_parents_or_children',
					columns_name	: ['parents']
				}
			}
			const js_promise = data_manager.request({
				body : body
			})
			// js_promise.then((response)=>{
			// 	console.log("--- load_tree_data API response:",response);
			// 	if (response.result) {
			// 		sessionStorage.setItem('tree_data', JSON.stringify(response.result));
			// 	}
			// })


		return js_promise
	},//end load_tree_data



	/**
	* RENDER_DATA
	* Render received DB data based on 'view_mode' (list, map, timeline)
	* @return bool
	*/
	render_data : function(options) {

		const self = this

		return new Promise(function(resolve){

			const ar_rows	= options.ar_rows
			const target	= common.is_node(options.target)
				? options.target
				: document.getElementById(options.target)
				// modify element class
				target.className = ""; // reset target class
				target.classList.add(self.view_mode)

			const set_hilite = options.set_hilite || false

			const view_mode	= self.view_mode
			const root_term	= self.root_term

			switch(view_mode) {

				case 'tree':
				default:
					// const hilite_terms = (self.term_id)
					// 	? [self.term_id]
					// 	: null;
					self.data_clean	= page.parse_tree_data(
						ar_rows,
						(self.term_id) ? [self.term_id] : null, // hilite_terms,
						self.root_term
					) // prepares data to use in list
					if(SHOW_DEBUG===true) {
						// console.log("self.data_clean:",self.data_clean);
					}
					// temporal
						// console.log("self.data_clean:",self.data_clean);
						// for (let i = 0; i < self.clean_data.length; i++) {
						// 	const relations = self.clean_data[i]
						// 	if (relations && relations.length>0) {
						// 		const ar = []
						// 		for (let h = 0; h < relations.length; h++) {

						// 			const id = relations[h].section_id + '_' + relations[h].section_tipo
						// 			if (ar.indexOf(id)!==-1) {
						// 				console.warn("Error. Duplicated itme:", id, self.clean_data[i]);
						// 			}else{
						// 				ar.push(id)
						// 			}
						// 		}
						// 	}
						// }
					self.tree		= self.tree || new tree_factory() // creates / get existing instance of tree
					self.tree.init({
						target		: target,
						data		: self.data_clean,
						root_term	: root_term,
						set_hilite	: set_hilite,
						render_node : self.render_tree_node
					})
					self.tree.render()
					.then(function(){
						resolve(true)
					})
					break;
			}
		})
	},//end render_data



	/**
	* RENDER_TREE_NODE
	* @return DOM node tree_node
	*/
	render_tree_node : function(row) {

		const self = this // is 'tree_factory' instance

		// node wrapper
			const tree_node = common.create_dom_element({
				element_type	: "div",
				class_name		: "tree_node",
				id				: row.term_id
			})
			// add properties to node
			tree_node.term_id	= row.term_id
			tree_node.parent	= row.parent

		// term
			const ar_value = []
			if (row.code && row.code.length>0) {
				ar_value.push(row.code)
			}
			ar_value.push(row.term)
			const term_value	= ar_value.join(' | ') // row.term //+ " <small>[" + row.term_id + "]</small>"
			const to_hilite		= (row.hilite && row.hilite===true)
			const term_css		= to_hilite===true ? " hilite" : ""
			const term = common.create_dom_element({
				element_type	: 'span',
				class_name		: 'term' + term_css,
				inner_html		: term_value,
				parent			: tree_node
			})
			if(SHOW_DEBUG===true) {
				term.title = row.term_id
			}

		// scroll
			// self.scrolled = false
			// if (to_hilite && self.scrolled===false) {
			// 	// console.log("to_hilite:",row.term, row.term_id);
			// 	common.when_in_dom(tree_node, function(){
			// 		tree_node.scrollIntoView()
			// 	})
			// 	self.scrolled = true
			// }

		// nd (no descriptor)
			if (row.nd && row.nd.length>0) {
				common.create_dom_element({
					element_type	: "span",
					class_name		: "nd",
					inner_html		: "[" + row.nd.join(", ") + "]",
					parent			: tree_node
				})
			}

		// illustration (svg)
			if (row.illustration && row.illustration.length>0) {
				const image = common.create_dom_element({
					element_type	: "img",
					class_name		: "illustration",
					src				: page_globals.__WEB_BASE_URL__ + row.illustration,
					parent			: tree_node
				})
				const outsideClickListener = (event) => {
					const target = event.target;
					if (target===image) {
						image.classList.toggle('big')
					}else{
						image.classList.remove('big')
					}
				}
				// document event click
				document.addEventListener('click', outsideClickListener)
			}

		// buttons
			// button scope_note
				if (row.scope_note && row.scope_note.length>0) {
					const btn_scope_note = common.create_dom_element({
						element_type	: "span",
						class_name		: "btn_scope_note",
						parent			: tree_node
					})
					btn_scope_note.addEventListener("mousedown", function(){
						if (this.classList.contains("open")) {
							scope_note.classList.add("hide")
							this.classList.remove("open")
						}else{
							scope_note.classList.remove("hide")
							this.classList.add("open")
						}
					})
				}

			// button definition
				if (row.definition && row.definition.length>0) {
					const btn_definition = common.create_dom_element({
						element_type	: "span",
						class_name		: "btn_definition",
						parent			: tree_node
					})
					btn_definition.addEventListener("mousedown", function(){
						if (this.classList.contains("open")) {
							definition.classList.add("hide")
							this.classList.remove("open")
						}else{
							definition.classList.remove("hide")
							this.classList.add("open")
						}
					})
				}

			// button relations
				let btn_relations
				if (row.relations && row.relations.length>0) {
					btn_relations = common.create_dom_element({
						element_type	: "span",
						class_name		: "btn_relations",
						// inner_html	: "Relations",
						parent			: tree_node
					})
					btn_relations.addEventListener("mousedown", function(){
						if (this.classList.contains("open")) {
							relations_container.classList.add("hide")
							this.classList.remove("open")
						}else{
							relations_container.classList.remove("hide")
							this.classList.add("open")
						}
					})
				}

			// button indexation
				let btn_indexation
				if (row.indexation && row.indexation.length>0) {
					btn_indexation = common.create_dom_element({
						element_type	: "span",
						class_name		: "btn_indexation",
						// inner_html	: "indexation",
						parent			: tree_node
					})
					btn_indexation.addEventListener("mousedown", function(){
						if (this.classList.contains("open")) {
							indexation_container.classList.add("hide")
							this.classList.remove("open")
						}else{
							indexation_container.classList.remove("hide")
							this.classList.add("open")
						}
					})
				}

			// button children (arrow open)
				if (row.children && row.children.length>0) {

					const open_style = row.state==="opened" ? " open" : ""
					const arrow = common.create_dom_element({
						element_type	: "span",
						class_name		: "arrow" + open_style,
						parent			: tree_node
					})
					arrow.addEventListener("mousedown", function(e){
						e.stopPropagation()

						// state  set based on current classList contains open/hide
							let new_state
							if (this.classList.contains("open")) {
								branch.classList.add("hide")
								this.classList.remove("open")
								// new_state
								new_state = "closed"
							}else{
								branch.classList.remove("hide")
								this.classList.add("open")
								// new_state
								new_state = "opened"
							}

						// state update (sessionStorage)
							const current_state = self.tree_state[row.term_id]
							if (current_state!==new_state) {
								// current_state.state = new_state
								self.tree_state[row.term_id] = new_state
								// update sessionStorage tree_state var
								sessionStorage.setItem('tree_state_' + WEB_AREA, JSON.stringify(self.tree_state));
							}
					})
				}

			// buttons_additional
				const buttons_additional = common.create_dom_element({
					element_type	: 'span',
					class_name		: 'buttons_additional',
					parent			: tree_node
				})

			// links based on WEB_AREA value (mints_hierarchy, symbols, iconography, countermarks)
			switch (WEB_AREA) {
				case 'mints_hierarchy':
					// link to mint
					if (row.term_table && row.term_table==='mints' && row.term_data && row.term_data[0]) {

						const link = common.create_dom_element({
							element_type	: "a",
							class_name		: "icon_link",
							parent			: term
						})
						link.addEventListener("click", function(){

							const url = 'mint/' + row.term_data[0]
							// const windowFeatures = "popup";
							window.open(url, "mint", null);
						})
					}
					break;

				case 'epigraphy': {
					// epigraphy

					// is_grouper
						const groupers = [
							'scell2_2', // ts_greek
							'scxpu2_2', // ts_punic
							'scxibo2_2', // ts_northern_palaeohispanic
							'scxibm2_2', // ts_southern_palaeohispanic
							'sctxr2_2', // ts_south_palaeohispanic
							'sclat2_2', // ts_latin
							// 'scsym2_1', // ts_symbols
							// 'sccmk2_1' // ts_countermarks
						]
						const is_grouper = row.model && groupers.includes(row.model) && row.children

					// is_latin
						const is_latin = row.term_id.includes('sclat1') || thesaurus.utf_models.includes(row.model)

					// legends
						const build_legends = () => {
							// debug

							// ar_legends. get term relations with legends (where these have been used)
								const ar_legends = row.dd_relations && row.dd_relations.length >0
									? row.dd_relations.filter(el => el.section_tipo && el.section_tipo==='numisdata41') // legends = numisdata41
									: []

							// groupers case
								if (is_grouper) {
									// get children data
									const grouper_children = self.data.filter(el => row.children.includes(el.term_id))
									// add every children legends to ar_legends array
									const grouper_children_length = grouper_children.length
									for (let i = 0; i < grouper_children_length; i++) {
										const child = grouper_children[i]
										const current_ar_legends = child.dd_relations && child.dd_relations.length >0
											? child.dd_relations.filter(el => el.section_tipo && el.section_tipo==='numisdata41') // legends = numisdata41
											: []
										ar_legends.push(...current_ar_legends)
									}
								}

							if (ar_legends.length || is_latin===true) {

								// debug
									if (row.term_id==='scxibo1_11') {
										console.log('scxibo1_11 ar_legends:', ar_legends);
									}
									// console.log('ar_legends (numisdata41):', ar_legends);

								// load_and_render
									const load_and_render = async () => {

										// relations_data load
										if (!link_legends.data) {
											// fix parsed data
											link_legends.data = await thesaurus.load_legends_data(row, ar_legends)
										}
										if (!link_legends.data || link_legends.data.length===0) {
											return
										}

										// render legends
										const render_legends = () => {

											// close container if is already displayed
												if (container_additional.legends_container) {
													container_additional.legends_container.remove()
													container_additional.legends_container = undefined
													return
												}

											// data
												const data = link_legends.data
												if (!data) {
													return
												}
												console.log('data:', data);

											// legends_container: create a new one if not already exists
												const legends_container = container_additional.legends_container
													? container_additional.legends_container
													: (()=>{
														const legends_container = common.create_dom_element({
															element_type	: 'div',
															class_name		: 'epi_container legends_container',
															parent			: container_additional
														})
														container_additional.legends_container = legends_container
														return legends_container
													  })();

											// render types with same layout than catalog list
												// const data_length = data.length
												// for (let i = 0; i < data_length; i++) {
												// 	const current_row = data[i]
												// 	current_row.add_denomination = true // Allow display denomination like 'Bronze'
												// 	const node = catalog_row_fields.draw_item(current_row)
												// 	legends_container.appendChild(node)
												// }

											// render all
												catalog.draw_rows({
													target	: legends_container,
													ar_rows	: data
												})
												.then(function(result_node){
													if (!result_node.hasChildNodes()) {
														// Something wrong happens
														common.create_dom_element({
															element_type	: 'div',
															class_name		: 'warning',
															inner_html		: 'Invalid result! <br>' + catalog.errors.join('<br>'),
															parent			: result_node
														})
														// ar_legends
														common.create_dom_element({
															element_type	: 'pre',
															class_name		: 'json',
															inner_html		: 'legends references: <br>' + JSON.stringify(ar_legends, null, 2),
															parent			: result_node
														})
														// ar_legends
														const data_preview = data.map((el) => {
															return {
																catalog_section_id	: el.section_id,
																term_table			: el.term_table,
																term_section_id		: el.term_section_id,
																term_section_tipo	: el.term_section_tipo[0],
																term				: el.term
															}
														})
														common.create_dom_element({
															element_type	: 'pre',
															class_name		: 'json',
															inner_html		: 'catalog data: <br>' + JSON.stringify(data_preview, null, 2),
															parent			: result_node
														})
														console.log('catalog.errors:', catalog.errors);
													}
												})
										}//end render_legends

										// active link (opacity transition fadeIn)
											const fade_in = () => {
												link_legends.classList.add('active')
												// display hidden node container_additional
												container_additional.classList.remove('hide')
											}
											requestAnimationFrame(fade_in)

										render_legends()
									}//end load_and_render

								// link legends node
									const link_legends = common.create_dom_element({
										element_type	: 'a',
										class_name		: 'epi_link legends_link',
										inner_html		: (tstring.legends || 'Legends'),
										parent			: buttons_additional
									})
									link_legends.addEventListener('mousedown', load_and_render)
									if(SHOW_DEBUG===true) {
										link_legends.title = 'term_id:' + row.term_id + '\nar_legends: ' + JSON.stringify(ar_legends)
									}
							}//end if (ar_legends.length)
						}//end build_legends

					// delay milliseconds
						// const delay = is_grouper
						// 	? 350
						// 	: 10

					// set node only when it is in DOM (to save browser resources)
						// const observer = new IntersectionObserver(function(entries) {
						// 	const entry = entries[1] || entries[0]
						// 	if (entry.isIntersecting===true || entry.intersectionRatio > 0) {
						// 		observer.disconnect();
						// 		// build_legends()
						// 		page.dd_request_idle_callback(build_legends)
						// 	}
						// }, { threshold: [0] });
						// setTimeout(function(){
						// 	observer.observe(term);
						// }, delay)
						build_legends()
					break;
				}

				case 'countermarks': {
					// countermarks

					// coins OLD
						/*
						if (row.illustration && row.illustration.length>0) {
							// countermark_obverse_data
							// countermark_reverse_data

							// set node only when it is in DOM (to save browser resources)
								const observer = new IntersectionObserver(function(entries) {
									const entry = entries[1] || entries[0]
									if (entry.isIntersecting===true || entry.intersectionRatio > 0) {
										observer.disconnect();

										// delegates check task to worker. When finish, show link button if target result exists
											const current_worker = new Worker(__WEB_TEMPLATE_WEB__ + '/thesaurus/js/worker.js');
											const body = {
												code		: page_globals.API_WEB_USER_CODE,
												lang		: page_globals.WEB_CURRENT_LANG_CODE,
												db_name		: page_globals.WEB_DB,
												dedalo_get	: 'records',
												table		: 'coins',
												ar_fields	: ['section_id'],
												limit		: 1,
												count		: false,
												order		: 'lang ASC',
												sql_filter	: `(countermark_obverse_data LIKE '%"${row.section_id}"%' OR countermark_reverse_data LIKE '%"${row.section_id}"%')`
											}
											current_worker.postMessage({
												url		: page_globals.JSON_TRIGGER_URL,
												body	: body
											});
											current_worker.onmessage = function(e) {
												current_worker.terminate()

												const api_response = e.data
												if (api_response.result && api_response.result.length>0) {
													const link_countermarks = common.create_dom_element({
														element_type	: "a",
														class_name		: "icon_link",
														parent			: term
													})
													link_countermarks.addEventListener("click", function(){

														const filter = {
														  "$or": [
															{
															  "$and": [
																{
																  "$and": [
																	{
																	  "id": "countermark_obverse_data",
																	  "field": "countermark_obverse_data",
																	  "q": ""+row.section_id+"",
																	  "q_type": "q",
																	  "op": "LIKE"
																	}
																  ]
																}
															  ]
															},
															{
															  "$and": [
																{
																  "$and": [
																	{
																	  "id": "countermark_reverse_data",
																	  "field": "countermark_reverse_data",
																	  "q": ""+row.section_id+"",
																	  "q_type": "q",
																	  "op": "LIKE"
																	}
																  ]
																}
															  ]
															}
														  ]
														};
														const encoded_psqo = psqo_factory.encode_psqo(filter)
														const url = 'coins/?psqo=' + encoded_psqo
														// const windowFeatures = "popup";
														window.open(url, "mint", null);
													})
												}
											}
									}
								}, { threshold: [0] });
								observer.observe(term);
						}
						*/

					// groupers
						const groupers = [
							'sccmk2_1' // ts_countermarks
						]
						const is_grouper = row.model && groupers.includes(row.model) && row.children

					// countermarks
						const build_countermarks = () => {

							// ar_relations
								const ar_relations = row.dd_relations && row.dd_relations.length >0
									? row.dd_relations.filter(el => el.section_tipo && el.section_tipo==='numisdata4') // coins = numisdata4
									: []

							// groupers case
								if (is_grouper) {
									// get children data
									const grouper_children = self.data.filter(el => row.children.includes(el.term_id))
									// add every children legends to ar_legends array
									const grouper_children_length = grouper_children.length
									for (let i = 0; i < grouper_children_length; i++) {
										const child = grouper_children[i]
										const current_ar_relations = child.dd_relations && child.dd_relations.length > 0
											? child.dd_relations.filter(el => el.section_tipo && el.section_tipo==='numisdata41') // legends = numisdata41
											: []
										ar_relations.push(...current_ar_relations)
									}
								}

							if (ar_relations.length) {

								// load_and_render
									const load_and_render = async () => {

										// relations_data load
										if (!link_countermarks.data) {
											// fix parsed data
											link_countermarks.data = await thesaurus.load_relations_data(row, ar_relations)
										}
										if (!link_countermarks.data || link_countermarks.data.length===0) {
											return
										}

										// render countermarks
										const render_countermarks = () => {

											// close container
												if (container_additional.countermarks_container) {
													container_additional.countermarks_container.remove()
													container_additional.countermarks_container = undefined
													return
												}

											// data
												const data = link_countermarks.data
												if (!data) {
													return
												}

											// countermarks_container
												const countermarks_container = container_additional.countermarks_container
													? container_additional.countermarks_container
													: (()=>{
														const countermarks_container = common.create_dom_element({
															element_type	: 'div',
															class_name		: 'epi_container coins_list countermarks_container',
															parent			: container_additional
														})
														container_additional.countermarks_container = countermarks_container
														return countermarks_container
													  })();

											// render coins
												const data_length = data.length
												for (let i = 0; i < data_length; i++) {
													const row = data[i]
													const coin_node	= type_row_fields_min.type_row_fields.draw_coin(row)
													countermarks_container.appendChild(coin_node)
												}
										}//end render_countermarks

										// active link (opacity transition)
											const fade_in = () => {
												link_countermarks.classList.add('active')
												container_additional.classList.remove('hide')
											}
											requestAnimationFrame(fade_in)

										render_countermarks()
									}//end load_and_render

								// link countermarks node
									const link_countermarks = common.create_dom_element({
										element_type	: 'a',
										class_name		: 'epi_link countermarks_link',
										inner_html		: (tstring.coins || 'Coins'),
										parent			: buttons_additional
									})
									link_countermarks.addEventListener('mousedown', load_and_render)
									if(SHOW_DEBUG===true) {
										link_countermarks.title = 'term_id:' + row.term_id + '\nar_legends: ' + JSON.stringify(ar_relations)
									}
							}//end if (ar_relations.length)
						}//end build_countermarks

					// set node only when it is in DOM (to save browser resources)
						// const observer = new IntersectionObserver(function(entries) {
						// 	const entry = entries[1] || entries[0]
						// 	if (entry.isIntersecting===true || entry.intersectionRatio > 0) {
						// 		observer.disconnect();
						// 		// build_countermarks()
						// 		page.dd_request_idle_callback(build_countermarks)
						// 	}
						// }, { threshold: [0] });
						// setTimeout(function(){
						// 	observer.observe(term);
						// }, 1)
						build_countermarks()
					break;
				}

				case 'symbols':
					// catalog
					if (row.illustration && row.illustration.length>0) {
						// ref_type_symbol_obverse_data
						// ref_type_symbol_reverse_data

						// set node only when it is in DOM (to save browser resources)
							const observer = new IntersectionObserver(function(entries) {
								const entry = entries[1] || entries[0]
								if (entry.isIntersecting===true || entry.intersectionRatio > 0) {
									observer.disconnect();

									// delegates check task to worker. When finish, show link button if target result exists
										const current_worker = new Worker(__WEB_TEMPLATE_WEB__ + '/thesaurus/js/worker.js');
										const body = {
											code		: page_globals.API_WEB_USER_CODE,
											lang		: page_globals.WEB_CURRENT_LANG_CODE,
											db_name		: page_globals.WEB_DB,
											dedalo_get	: 'records',
											table		: 'catalog',
											ar_fields	: ['section_id'],
											limit		: 1,
											count		: false,
											order		: 'lang ASC',
											sql_filter	: `(ref_type_symbol_obverse_data LIKE '%"${row.section_id}"%' OR ref_type_symbol_reverse_data LIKE '%"${row.section_id}"%')`
										}
										current_worker.postMessage({
											url		: page_globals.JSON_TRIGGER_URL,
											body	: body
										});
										current_worker.onmessage = function(e) {
											current_worker.terminate()

											const api_response = e.data
											if (api_response.result && api_response.result.length>0) {
												const link_symbols = common.create_dom_element({
													element_type	: "a",
													class_name		: "icon_link",
													parent			: term
												})
												link_symbols.addEventListener("click", function(){

													const filter = {
													  "$or": [
														{
														  "$and": [
															{
															  "$and": [
																{
																  "id": "ref_type_symbol_obverse_data",
																  "field": "ref_type_symbol_obverse_data",
																  "q": ""+row.section_id+"",
																  "q_type": "q",
																  "op": "LIKE"
																}
															  ]
															}
														  ]
														},
														{
														  "$and": [
															{
															  "$and": [
																{
																  "id": "ref_type_symbol_reverse_data",
																  "field": "ref_type_symbol_reverse_data",
																  "q": ""+row.section_id+"",
																  "q_type": "q",
																  "op": "LIKE"
																}
															  ]
															}
														  ]
														}
													  ]
													};
													const encoded_psqo = psqo_factory.encode_psqo(filter)
													const url = 'catalog/?psqo=' + encoded_psqo
													// const windowFeatures = "popup";
													window.open(url, "mint", null);
												})
											}
										}
								}
							}, { threshold: [0] });
							observer.observe(term);
					}
					break;

				case 'iconography':
					// catalog
					// if (!row.children || row.children.length===0) {
						// ref_type_design_obverse_iconography_data
						// ref_type_design_reverse_iconography_data

						// set node only when it is in DOM (to save browser resources)
							const observer = new IntersectionObserver(function(entries) {
								const entry = entries[1] || entries[0]
								if (entry.isIntersecting===true || entry.intersectionRatio > 0) {
									observer.disconnect();

									// delegates chek task to worker. When finish, show link button if target result exists
										const current_worker = new Worker(__WEB_TEMPLATE_WEB__ + '/thesaurus/js/worker.js');
										const body = {
											code		: page_globals.API_WEB_USER_CODE,
											lang		: page_globals.WEB_CURRENT_LANG_CODE,
											db_name		: page_globals.WEB_DB,
											dedalo_get	: 'records',
											table		: 'catalog',
											ar_fields	: ['section_id','ref_coins_image_obverse','ref_coins_image_reverse'],
											limit		: 1,
											count		: false,
											order		: 'lang ASC',
											sql_filter	: `(ref_type_design_obverse_iconography_data LIKE '%"${row.section_id}"%' OR ref_type_design_reverse_iconography_data LIKE '%"${row.section_id}"%')`
										}
										current_worker.postMessage({
											url		: page_globals.JSON_TRIGGER_URL,
											body	: body
										});
										current_worker.onmessage = function(e) {
											current_worker.terminate()

											const api_response = e.data
											if (api_response.result && api_response.result.length>0) {
												const link_iconography = common.create_dom_element({
													element_type	: "a",
													class_name		: "icon_link",
													parent			: term
												})
												link_iconography.addEventListener("click", function(){

													const filter = {
													  "$or": [
														{
														  "$and": [
															{
															  "$and": [
																{
																  "id": "ref_type_design_obverse_iconography_data",
																  "field": "ref_type_design_obverse_iconography_data",
																  "q": ""+row.section_id+"",
																  "q_type": "q",
																  "op": "LIKE"
																}
															  ]
															}
														  ]
														},
														{
														  "$and": [
															{
															  "$and": [
																{
																  "id": "ref_type_design_reverse_iconography_data",
																  "field": "ref_type_design_reverse_iconography_data",
																  "q": ""+row.section_id+"",
																  "q_type": "q",
																  "op": "LIKE"
																}
															  ]
															}
														  ]
														}
													  ]
													};
													const encoded_psqo = psqo_factory.encode_psqo(filter)
													const url = 'catalog/?psqo=' + encoded_psqo
													// const windowFeatures = "popup";
													window.open(url, "mint", null);
												})

												if (api_response.result[0].ref_coins_image_obverse) {
													const url		= api_response.result[0].ref_coins_image_obverse
													const url_thumb	= url.replace('/1.5MB/','/thumb/')
													const image	= common.create_dom_element({
														element_type	: "img",
														class_name		: 'illustration thumb_image',
														src				: page_globals.__WEB_BASE_URL__ + url_thumb,
														parent			: term
													})
													const outsideClickListener = (event) => {
														const target = event.target;
														if (target===image) {
															image.classList.toggle('big')
															image.src = page_globals.__WEB_BASE_URL__ + url
														}else{
															image.classList.remove('big')
															image.src = page_globals.__WEB_BASE_URL__ + url_thumb
														}
													}
													// document event click
													document.addEventListener('click', outsideClickListener)
												}
												if (api_response.result[0].ref_coins_image_reverse) {
													const url		= api_response.result[0].ref_coins_image_reverse
													const url_thumb	= url.replace('/1.5MB/','/thumb/')
													const image	= common.create_dom_element({
														element_type	: "img",
														class_name		: 'illustration thumb_image',
														src				: page_globals.__WEB_BASE_URL__ + url_thumb,
														parent			: term
													})
													const outsideClickListener = (event) => {
														const target = event.target;
														if (target===image) {
															image.classList.toggle('big')
															image.src = page_globals.__WEB_BASE_URL__ + url
														}else{
															image.classList.remove('big')
															image.src = page_globals.__WEB_BASE_URL__ + url_thumb
														}
													}
													// document event click
													document.addEventListener('click', outsideClickListener)
												}
											}
										}
								}
							}, { threshold: [0] });
							observer.observe(term);
					// }
					break;

				default:
					// nothing to do
					break;
			}

		// wrappers
			// scope note wrapper
				let scope_note
				if (row.scope_note && row.scope_note.length>0) {

					const hide_style = row.state==="opened" ? "" : " hide"

					// scope_note
						const scope_note_text = row.scope_note.replace(/^\s*<br\s*\/?>|<br\s*\/?>\s*$/g,'');
						scope_note = common.create_dom_element({
							element_type	: "div",
							class_name		: "scope_note hide",
							inner_html		: scope_note_text,
							parent			: tree_node
						})
				}

			// scope note wrapper
				let definition
				if (row.definition && row.definition.length>0) {
					// definition
						const definition_text = row.definition.replace(/^\s*<br\s*\/?>|<br\s*\/?>\s*$/g,'');
						definition = common.create_dom_element({
							element_type	: "div",
							class_name		: "definition hide",
							inner_html		: definition_text,
							parent			: tree_node
						})
				}

			// container_additional (contains legends and countermarks)
				const container_additional = common.create_dom_element({
					element_type	: 'div',
					class_name		: 'container_additional hide',
					parent			: tree_node
				})

			// relations wrapper
				let relations_container
				if (row.relations && row.relations.length>0) {

					// relations_container
						relations_container = common.create_dom_element({
							element_type	: "div",
							class_name		: "relations_container hide",
							parent			: tree_node
						})

						// Callback function to execute when mutations are observed
						const callback = function(mutationsList, observer) {
							// Use traditional 'for loops' for IE 11
							for(let mutation of mutationsList) {
								if (mutation.type==='attributes' && mutation.attributeName==='class') {
										// console.log('The ' + mutation.attributeName + ' attribute was modified.');
										// console.log("mutationsList:",mutationsList);
										// console.log("mutationsList.target:",mutationsList[0].target);
									if (!mutationsList[0].target.classList.contains("hide")) {

										// draw nodes
										self.render_relation_nodes(row, relations_container, self, false)

										// Stop observing
										observer.disconnect();
									}
								}
							}
						};

						// Create an observer instance linked to the callback function
						const observer = new MutationObserver(callback);

						// Start observing the target node for configured mutations
						observer.observe(relations_container, { attributes: true, childList: false, subtree: false });

						// console.log("self.hilite_relations_limit:",self.hilite_relations_limit, self.hilite_relations_showed);

						if (row.hilite===true && self.hilite_relations_showed<self.hilite_relations_limit) {
							// relations_container.classList.remove("hide")
							// btn_relations.click()
							relations_container.classList.remove("hide")
							btn_relations.classList.add("open")

							// increment hilite_relations_showed until reach self.hilite_relations_limit
							self.hilite_relations_showed++
						}
				}

			// indexation wrapper
				let indexation_container
				if (row.indexation && row.indexation.length>0) {

					// indexation_container
						indexation_container = common.create_dom_element({
							element_type	: "div",
							class_name		: "indexation_container hide",
							parent			: tree_node
						})

						// Callback function to execute when mutations are observed
						const callback = function(mutationsList, observer) {
							// Use traditional 'for loops' for IE 11
							for(let mutation of mutationsList) {
								if (mutation.type==='attributes' && mutation.attributeName==='class') {
										// console.log('The ' + mutation.attributeName + ' attribute was modified.');
										// console.log("mutationsList:",mutationsList);
										// console.log("mutationsList.target:",mutationsList[0].target);
									if (!mutationsList[0].target.classList.contains("hide")) {

										// draw nodes
										self.render_indexation_nodes(row, indexation_container, self)

										// Stop observing
										observer.disconnect();
									}
								}
							}
						};

						// Create an observer instance linked to the callback function
						const observer = new MutationObserver(callback);

						// Start observing the target node for configured mutations
						observer.observe(indexation_container, { attributes: true, childList: false, subtree: false });

						// console.log("self.hilite_indexation_limit:",self.hilite_indexation_limit, self.hilite_indexation_showed);

						if (row.hilite===true && self.hilite_indexation_showed<self.hilite_indexation_limit) {
							// indexation_container.classList.remove("hide")
							// btn_indexation.click()
							indexation_container.classList.remove("hide")
							btn_indexation.classList.add("open")

							// increment hilite_indexation_showed until reach self.hilite_indexation_limit
							self.hilite_indexation_showed++
						}
				}

			// children wrapper
			let branch
			if (row.children && row.children.length>0) {

				const hide_style = row.state==="opened" ? "" : " hide"

				// branch
					branch = common.create_dom_element({
						element_type	: "div",
						class_name		: "branch" + hide_style,
						parent			: tree_node
					})

				tree_node.branch = branch

			}else{

				tree_node.branch = null
			}


		return tree_node
	},//end render_tree_node



	/**
	* RENDER_FORM
	* Create logic and view of search
	*/
	render_form : function(options) {

		const self = this

		return new Promise(function(resolve){

			const fragment = new DocumentFragment()

			// form_factory instance
				self.form = self.form || new form_factory()

			// inputs

				// global_search
					const global_search_container = common.create_dom_element({
						element_type	: "div",
						class_name		: "global_search_container form-row fields",
						parent			: fragment
					})
					// input global search
						self.form.item_factory({
							id			: "term",
							name		: "term",
							class_name	: 'global_search',
							label		: tstring.term || "Term",
							q_column	: "term",
							eq			: "LIKE",
							eq_in		: "%",
							eq_out		: "%",
							// q_table	: "catalog",
							parent		: global_search_container,
							callback	: function(form_item) {
								const node_input = form_item.node_input
								self.activate_autocomplete(node_input) // node_input is the form_item.node_input
							}
						})
					// button hide toggle advanced
						// const button_show_advanced = common.create_dom_element({
						// 	element_type	: "input",
						// 	type			: "button",
						// 	class_name		: "",
						// 	value			: tstring.advanced || "Advanced",
						// 	parent			: fragment
						// })
						// button_show_advanced.addEventListener("click", function(){
						// 	advanced_search_container.classList.toggle("hide")
						// })


			// submit button
				const submit_group = common.create_dom_element({
					element_type	: "div",
					class_name 		: "form-group submit field",
					parent 			: fragment
				})
				const submit_button = common.create_dom_element({
					element_type	: "input",
					type 			: "submit",
					id 				: "submit",
					value 			: tstring.search || "Search",
					class_name 		: "btn btn-light btn-block primary",
					parent 			: submit_group
				})
				submit_button.addEventListener("click",function(e){
					e.preventDefault()
					self.form_submit()
				})


			// form_node
				self.form.node = common.create_dom_element({
					element_type	: "form",
					id				: "search_form",
					class_name		: "form-inline form_factory"
				})
				self.form.node.appendChild(fragment)


			// add node
				options.container.appendChild(self.form.node)

			resolve(self.form.node)
		})
	},//end render_form



	/**
	* ACTIVATE_AUTOCOMPLETE
	*/
	activate_autocomplete : function(element) {

		const self = this

		// (!) define current_form_item in this scope to allow set and access from different places
		let current_form_item

		const cache = {}
		$(element).autocomplete({
			delay 	 : 150,
			minLength: 1,
			source 	 : function( request, response ) {

				const term = request.term

				// (!) fix selected form_item (needed to access from select)
				current_form_item	= self.form.form_items[element.id]
				const q_column		= current_form_item.q_column // Like 'term'

				// search
					self.search_rows({
						q			: term,
						q_column	: q_column,
						limit		: 25
					})
					.then((api_response) => {

						// return results in standard format (label, value)

						const ar_result = []
						const len  		= api_response.result.length
						for (let i = 0; i < len; i++) {

							const item = api_response.result[i]

							ar_result.push({
								label : item.label,
								value : item.value
							})

							// const current_ar_value = (item.name.indexOf("[")===0)
							// 	? JSON.parse(item.name)
							// 	: [item.name]

							// for (let j = 0; j < current_ar_value.length; j++) {

							// 	const item_name = current_ar_value[j]
							// 	// const item_name = item.name.replace(/[\["|"\]]/g, '')

							// 	const found = ar_result.find(el => el.value===item_name)
							// 	if (!found) {
							// 		ar_result.push({
							// 			label : item_name, // item_name,
							// 			value : item_name // item.name
							// 		})
							// 	}
							// }
						}

						// cache . Use only when there are no cross filters
							// if (filter[op].length===1) {
								// cache[ term ] = ar_result
							// }

						// debug
							if(SHOW_DEBUG===true) {
								// console.log("--- autocomplete api_response:",api_response);
								// console.log("autocomplete ar_result:",ar_result);
							}

						response(ar_result)
					})
			},
			// When a option is selected in list
			select: function( event, ui ) {
				// prevent set selected value to autocomplete input
				event.preventDefault();

				// add_selected_value . Create input and button nodes and add it to current_form_item
				self.form.add_selected_value(current_form_item, ui.item.label, ui.item.value)

				// reset input value
				this.value = ''

				return false;
			},
			// When a option is focus in list
			focus: function() {
				// prevent value inserted on focus
				return false;
			},
			close: function( event, ui ) {

			},
			change: function( event, ui ) {

			},
			response: function( event, ui ) {
				//console.log(ui);
			}
		})
		.on("keydown", function( event ) {
			//return false
			//console.log(event)
			if ( event.keyCode===$.ui.keyCode.ENTER  ) {
				// prevent set selected value to autocomplete input
				//event.preventDefault();
				//var term = $(this).val();
				$(this).autocomplete('close')
			}//end if ( event.keyCode===$.ui.keyCode.ENTER  )
		})// bind
		.focus(function() {
			$(this).autocomplete('search', null)
		})
		.blur(function() {
			//$(element).autocomplete('close');
		})


		return true
	},//end activate_autocomplete



	/**
	* SEARCH_ROWS
	* @return promise
	*	resolve array of objects
	*/
	search_rows : function(options) {
		// console.log("----> search_rows options:",options);

		const self = this

		return new Promise(function(resolve){
			const t0 = performance.now()

			const q				= options.q
			const q_column		= options.q_column
			const q_selected	= options.q_selected || null
			const limit			= options.limit

			// data . Simplifies data format (always on data_clean)
			const data = self.data_clean.map(item => {
				const element = {
					term		: item.term,
					scope_note	: item.scope_note,
					parent		: item.parent,
					term_id		: item.term_id,
					nd			: item.nd
				}
				return element
			})

			// find_text
				let counter = 1
				function find_text(row) {

					if (limit>0 && counter>limit) {
						return false
					}

					let find = false

					// q try
						if (q && q.length>0) {

							if(!q_column || !row[q_column]){
								return false
							}

							// remove accents from text
							const text_normalized = row[q_column].normalize("NFD").replace(/[\u0300-\u036f]/g, "")

							const regex	= RegExp(q, 'i')
							find = regex.test(text_normalized)

							// try with nd
								if (!find && row.nd && row.nd.length>0) {
									for (let k = 0; k < row.nd.length; k++) {
										// console.log("row.nd[k]:",row.nd[k]);
										const text_normalized = row.nd[k].normalize("NFD").replace(/[\u0300-\u036f]/g, "")

										find = regex.test(text_normalized)

										if (find===true) {
											break;
										}
									}
								}
						}

					// q_selected try. Check user selections from autocomplete
						if (!find && q_selected) {
							for (let i = 0; i < q_selected.length; i++) {
								if(row.term_id===q_selected[i]) {
									find = true
									break;
								}
							}
						}

					if (find===true) {
						counter++;
					}

					return find
				}

			// found filter
				const found = data.filter(find_text)

			// result . Format result array to allow autocomplete to manage it
				const result = found.map(item => {

					// parent info (for desambiguation)
						const parent_term_id	= item.parent[0]
						const parent_row		= self.data_clean.find(el => el.term_id===parent_term_id)
						const parent_label		= parent_row ? (" (" + parent_row.term +")") : ''
						const nd_text			= item.nd ? (' ['+item.nd.join(', ')+']') : ''

					const label = item.term + nd_text + parent_label

					const element = {
						label	: label,
						value	: item.term_id
					}
					return element
				})

			// response. Format like a regular database result from API
				const response = {
					result	: result,
					debug	: {
						time : performance.now()-t0
					}
				}

			resolve(response)
		})
	},//end search_rows



	/**
	* FORM_SUBMIT
	* Form submit launch search
	*/
	form_submit : function() {

		const self = this

		// filter. Is built looking at form input values
			// const filter		= self.build_filter()
			const form_items	= self.form.form_items
			const form_item		= form_items.term

		// search rows exec against API
			const js_promise = self.search_rows({
				q			: form_item.q,
				q_column	: form_item.q_column,
				q_selected	: form_item.q_selected,
				limit		: 0
			})
			.then((response)=>{

				// debug
					if(SHOW_DEBUG===true) {
						// console.log("--- form_submit response:",response)
					}

				const to_hilite = response.result.map(el => el.value)

				// remove self.term_id to avoid hilite again
					self.term_id = null

				// rows_list_node
					const rows_list_node	= document.getElementById('rows_list')
					while (rows_list_node.hasChildNodes()) {
						rows_list_node.removeChild(rows_list_node.lastChild);
					}
					// add spinner
						const spinner	= common.create_dom_element({
							element_type	: "div",
							id				: "spinner",
							class_name		: "spinner",
							parent			: rows_list_node
						})

				// load_tree_data
					self.load_tree_data({})
					.then(function(response){
						console.log("/// form_submit load_tree_data response:", response);
						// console.log("to_hilite:",to_hilite);

						// const ar_rows = response.result
						const ar_rows = response.result.map(function(row){
							if (to_hilite.indexOf(row.term_id)!==-1) {
								row.hilite	= true
								row.status	= "closed"
							}
							return row
						})

						// render_data
							self.render_data({
								target		: rows_list_node,
								ar_rows		: ar_rows,
								set_hilite	: true
							})
							.then(function(){
								spinner.remove()
							})
					})
			})


		return js_promise
	},//end form_submit



	/**
	* LOAD_LEGENDS_DATA
	* 	Catalog search of related legends
	* @param object row
	* 	Table row from API response result
	* @param array ar_legends
	* 	Related legends from
	* @return object api_response
	*/
	load_legends_data : function(row, ar_legends) {

		const self = this

		// latin grouper case
		// children of latin groupers are not calculated by related ar_legends, but from a catalog search
		// this is more expensive, but needs to be done is this way at now
			const is_latin_grouper = row.term_id.includes('sclat1') && row.model && row.model.includes('sclat2_2')
			if (is_latin_grouper) {
				return new Promise(function(resolve){

					const ar_promise = []
					const children = self.data_clean.filter(el => row.children && row.children.includes(el.term_id))
					const children_length = children.length
					for (let i = 0; i < children_length; i++) {

						const child = children[i]

						// get term relations with legends (where these have been used)
						const ar_legends = child.dd_relations && child.dd_relations.length >0
							? child.dd_relations.filter(el => el.section_tipo && el.section_tipo==='numisdata41') // legends = numisdata41
							: []
						// API call
							const load_promise = thesaurus.load_legends_data(child, ar_legends)
							ar_promise.push(load_promise)
					}
					Promise.all(ar_promise).then((values) => {
						const data = values.flat()
						resolve(data)
					});
				})
			}

		// filter
			const legends_filter = []
			const ar_legends_length = ar_legends.length
			for (let i = 0; i < ar_legends_length; i++) {
				const item = ar_legends[i]
				// search catalog column ref_type_legend_obverse_data / ref_type_design_reverse_data the related legend section_id
				legends_filter.push(
					`ref_type_legend_obverse_data LIKE '%"${item.section_id}"%' OR ref_type_legend_reverse_data LIKE '%"${item.section_id}"%'`
				)
			}
			// latin case. Additional search in plain text for Unicode letters
			const is_latin = row.term_id.includes('sclat1') || thesaurus.utf_models.includes(row.model)
			if (is_latin===true &&
				ar_legends.length===0 &&
				!row.model.includes('sclat2_2') // exclude rows with model 'sclat2_2' grouper
				) {
				legends_filter.push(
					`ref_type_legend_obverse_text LIKE '%${row.term}%' OR ref_type_legend_reverse_text LIKE '%${row.term}%'`
				)
			}
			const sql_filter = `term_table = 'types' AND (` + legends_filter.join(' OR ') + ')'

			// debug
				if (row.term_id==='sclat1_96') {
					console.log('sclat1_96 sql_filter:', sql_filter);
				}

		// search_rows
			const js_promise = catalog.search_rows({
				sql_filter		: sql_filter,
				limit 			: 0,
				process_result	: {
					fn		: 'process_result::add_parents_and_children_recursive',
					columns	: [{name : "parents"}]
				}
			})


		return js_promise


		// return data_manager.request({
		// 	body : {
		// 		code		: page_globals.API_WEB_USER_CODE,
		// 		lang		: page_globals.WEB_CURRENT_LANG_CODE,
		// 		db_name		: page_globals.WEB_DB,
		// 		dedalo_get	: 'records',
		// 		table		: 'catalog',
		// 		ar_fields	: '*',
		// 		count		: false,
		// 		limit		: 0,
		// 		sql_filter	: sql_filter,
		// 		process_result	: {
		// 			fn		: 'process_result::add_parents_and_children_recursive',
		// 			columns	: [{name : "parents"}]
		// 		}
		// 	}
		// })
	},//end load_legends_data



	/**
	* LOAD_RELATIONS_DATA
	* 	Coins search of related countermarks
	* @param object row
	* 	Table row from API response result
	* @param array ar_relations
	* 	Related countermarks from
	* @return object api_response
	*/
	load_relations_data : async function(row, ar_relations) {

		// filter
			// const relations_filter = []
			// const ar_relations_length = ar_relations.length
			// for (let i = 0; i < ar_relations_length; i++) {
			// 	const item = ar_relations[i]
			// 	relations_filter.push(
			// 		// `countermark_obverse_data LIKE '%"${item.section_id}"%' OR countermark_reverse_data LIKE '%"${item.section_id}"%'`
			// 		`section_id = ${item.section_id}`
			// 	)
			// }
			// const sql_filter = relations_filter.join(' OR ')
		// filter optimized
			const section_id_list = ar_relations.map(el => el.section_id).join(',')
			const coins_sql_filter = `section_id IN (${section_id_list})`

		const api_response = await data_manager.request({
			body : {
				code			: page_globals.API_WEB_USER_CODE,
				lang			: page_globals.WEB_CURRENT_LANG_CODE,
				db_name			: page_globals.WEB_DB,
				dedalo_get		: 'records',
				table			: 'coins',
				ar_fields		: '*',
				count			: false,
				sql_filter		: coins_sql_filter,
				resolve_portals_custom	: {
					'bibliography_data'	: 'bibliographic_references'
				}
			}
		})

		if (!api_response.result) {
			console.error('Invalid api_response result:', api_response);
			return []
		}

		const data = page.parse_coin_data(api_response.result)

		// parse MIB additional info about type and mint
			const data_length = data.length
			for (let i = 0; i < data_length; i++) {

				const item = data[i]

				const catalogue_type_mint = item.catalogue_type_mint || []
				const mib_key = catalogue_type_mint.indexOf('MIB')
				if (mib_key===-1) {
					continue;
				}

				// additional_info
				// Used in type_row_fields.draw_coin
				item.additional_info = {
					type		: item.type[mib_key],
					mint		: item.mint_name,
					mint_number	: item.mint_number[mib_key]
				}
			}


		return data
		/*
			const ar_calls = []

			// search types in catalog using types list
				const ar_filter = ar_relations.map(function(item){
					return `coin_references LIKE '%"${item.section_id}"%'`;
				})
				const sql_filter = 'term_table=\'types\' AND ('+ar_filter.join(' OR ')+')'

				const catalog_ar_fields = ['*']

				const catalog_request_options = {
					dedalo_get	: 'records',
					db_name		: page_globals.WEB_DB,
					lang		: page_globals.WEB_CURRENT_LANG_CODE,
					table		: 'catalog',
					ar_fields	: catalog_ar_fields,
					sql_filter	: sql_filter,
					limit		: 0,
					count		: false,
					offset		: 0,
					order		: "term ASC"
				}
				ar_calls.push({
					id		: 'catalog_request',
					options	: catalog_request_options
				})

			// search coins
				const coins_request_options = {
					dedalo_get	: 'records',
					db_name		: page_globals.WEB_DB,
					lang		: page_globals.WEB_CURRENT_LANG_CODE,
					table		: 'coins',
					ar_fields	: ['*'],
					sql_filter	: coins_sql_filter,
					limit		: 0,
					count		: false,
					offset		: 0,
					order		: null,
					resolve_portals_custom	: {
						"bibliography_data" : "bibliographic_references"
					}
				}
				ar_calls.push({
					id		: 'coins_request',
					options	: coins_request_options
				})

			// request
				const api_response = await data_manager.request({
					body : {
						dedalo_get	: 'combi',
						ar_calls	: ar_calls
					}
				})

			if (!api_response.result) {
				console.error('Invalid api_response result:', api_response);
				return []
			}

			const catalog_response = api_response.result.find(function(el){
				return el.id==='catalog_request'
			})
			const types_rows = page.parse_catalog_data(catalog_response.result)

			const coins_response = api_response.result.find(function(el){
				return el.id==='coins_request'
			})
			const coins_rows = page.parse_coin_data(coins_response.result)

			const data = {
				types_rows : types_rows,
				coins_rows : coins_rows
			}
			console.log('data:', data);

			return data
			*/
	}//end load_relations_data



}//end thesaurus
