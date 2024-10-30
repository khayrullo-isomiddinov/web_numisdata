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

		// sign_group_models. Used by epigraphy
		sign_group_models : [
			'scell2_2', // ts_greek Signo estándar UTF
			'scxpu2_2',	 // ts_punic Signo estándar UTF
			'scxibo2_2', // ts_northern_palaeohispanic Signo estándar UTF
			'scxibm2_2', // ts_southern_palaeohispanic Signo estándar UTF
			'sctxr2_2', // ts_south_palaeohispanic Signo estándar UTF
			'sclat2_2', // ts_latinSigno estándar UTF
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
	* RENDER_FORM
	* Create the search form
	* @param object options
	* @return promise
	* 	resolve(self.form.node)
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
	* Add predictive text behaviour to the input form
	* @param HTMLElment element
	* @return bool
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
	*
	* @param object options
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
	* @return promise js_promise
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

		// utf grouper case
		// children of utf sign_group are not calculated by related ar_legends, but from a catalog search
		// this is more expensive, but needs to be done is this way at now
			// const is_utf_grouper = row.term_id.includes('sclat1') && row.model && row.model.includes('sclat2_2')
			const is_utf_grouper = !!(row.model && thesaurus.sign_group_models.includes(row.model))
			// debug
				if(SHOW_DEBUG===true) {
					// if (row.term_id==='scell1_171') {
					// 	console.log('is_utf_grouper:', row.term_id, row.model, is_utf_grouper);
					// }
				}
			if (is_utf_grouper) {

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
			// utf case. Additional search in plain text for Unicode letters
			const is_utf = thesaurus.utf_models.includes(row.model)
			if (is_utf===true &&
				ar_legends.length===0 &&
				// !row.model.includes('sclat2_2') // exclude rows with model 'sclat2_2' grouper
				!thesaurus.sign_group_models.includes(row.model)
				) {
				legends_filter.push(
					`ref_type_legend_obverse_text LIKE '%${row.term}%' OR ref_type_legend_reverse_text LIKE '%${row.term}%'`
				)
				// debug
					if(SHOW_DEBUG===true) {
						// if (row.term_id==='scell1_171') {
						// 	console.log('legends_filter pushed:', row.term_id, row.model, legends_filter);
						// }
					}
			}
			const sql_filter = `term_table = 'types' AND (` + legends_filter.join(' OR ') + ')'

			// debug
				if(SHOW_DEBUG===true) {
					// if (row.term_id==='sclat1_96') {
					// 	console.log('sclat1_96 sql_filter:', sql_filter);
					// }
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
	},//end load_legends_data



	/**
	* LOAD_TYPES_DATA
	* Catalog search of related types
	* Used by render_thesaurus_link.render_iconography_links
	* @param object row
	* 	Table row from API response result
	* @param int section_id
	* 	Current row section_id
	* @return object api_response
	*/
	load_types_data : function(row, section_id) {

		const self = this

		// filter
			const sql_filter = `(ref_type_design_obverse_iconography_data LIKE '%"${section_id}"%' OR ref_type_design_reverse_iconography_data LIKE '%"${section_id}"%')`

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
	},//end load_types_data



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
	},//end load_relations_data



	/**
	* LOAD_bibliography_DATA
	* 	bibliographic_references search of related countermarks
	* @param object row
	* 	Table row from API response result
	* @param array bibliography
	* 	Related bibliographic_references from
	* @return array data
	*/
	load_bibliography_data : async function(row, bibliography) {

		// sql_filter
			const section_id_list	= bibliography.join(',')
			const sql_filter		= `section_id IN (${section_id_list})`

		const api_response = await data_manager.request({
			body : {
				code			: page_globals.API_WEB_USER_CODE,
				lang			: page_globals.WEB_CURRENT_LANG_CODE,
				db_name			: page_globals.WEB_DB,
				dedalo_get		: 'records',
				table			: 'bibliographic_references',
				ar_fields		: '*',
				count			: false,
				sql_filter		: sql_filter,
				// resolve_portals_custom	: {
				// 	'publications_data'	: 'publications'
				// }
			}
		})

		if (!api_response.result) {
			console.error('Invalid api_response result:', api_response);
			return []
		}

		// data don't need to parse it
		const data = api_response.result


		return data
	},//end load_bibliography_data



	/**
	* GET_THESAURUS_NAME
	* Resolves the section thesaurus name based on tld
	* like 'Countermarks' from 'sccmk1'
	* Uses page.thesaurus_map object
	* @param string tld
	* @return string|null
	*/
	get_thesaurus_name : (tld) => {

		const map = page.thesaurus_map
		console.log('map:', map, tld);

		if (map[tld]) {
			// like 'ts_countermarks'
			const name = map[tld].replace('ts_', '');

			return tstring[name] || name;
		}

		return null
	},//end get_thesaurus_name



	/**
	* SHOW_LINK
	* Determines it current row has link or not
	* based on term model (tyoplogy)
	* @param object row
	* @return bool
	*/
	show_link : (row) => {

		switch (WEB_AREA) {

			// mints
			case 'mints_hierarchy':
				if (row.term_table && row.term_table==='mints' && row.term_data && row.term_data[0]) {
					return true
				}
				break;

			// other thesaurus
			default:
				if (!row.model) {
					return true
				}

				try {
					const regex			= /\d+$/;
					const section_id	= parseInt(regex.exec(row.model))
					if (section_id>2) {
						return true
					}
				} catch (error) {
					console.error(error)
				}
				break;
		}


		return false
	}//end show_link



}//end thesaurus
