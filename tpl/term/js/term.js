/*global tstring, page_globals, SHOW_DEBUG, event_manager, map_factory, biblio_row_fields, data_manager, dedalo_logged, Promise, common, page, console, mint_row, DocumentFragment  */
/*eslint no-undef: "error"*/
"use strict";



var term = {


	/**
	* VARS
	*/
		section_tipo			: null,
		section_id				: null,
		main_title				: null,
		export_data_container	: null,
		row_detail				: null,



	/**
	* SET_UP
	* When the HTML page is loaded
	*/
	set_up : async function(options) {

		const self = this

		// options
			self.section_tipo			= options.section_tipo
			self.section_id				= options.section_id
			self.main_title				= options.main_title // HTMLElement
			self.export_data_container	= options.export_data_container
			self.row_detail				= options.row_detail

		// export_data_buttons added once
			const export_data_buttons = page.render_export_data_buttons()
			self.export_data_container.appendChild(export_data_buttons)
			self.export_data_container.classList.add('hide')

		// suggestions_form_button
			const contact_form_button = page.create_suggestions_button()
			self.export_data_container.appendChild(contact_form_button)

		if (self.section_id) {

			// table
				const table = page.thesaurus_map[self.section_tipo]

			// Check table exists
				if (!table) {
					self.main_title.textContent = 'Error'
					self.row_detail.textContent = 'Invalid table value for: ' + self.section_tipo + '_' + self.section_id
					console.error('Invalid table value for:', self.section_tipo + '_' + self.section_id);
					return
				}

			// search by section_tipo, section_id
				const row = await self.get_row_data({
					section_tipo	: self.section_tipo,
					section_id		: self.section_id,
					table			: table
				})

			// Check row exists
				if (!row || !row.term_id) {
					self.main_title.textContent = 'Error'
					self.row_detail.textContent = 'This record does not exist: ' + self.section_tipo + '_' + self.section_id
					console.error('This record does not exist:', self.section_tipo + '_' + self.section_id);
					return
				}

			// get_thesaurus_name
				// get first item and get the last parent
				self.render_main_title(row)

			// draw row
				self.draw_row({
					target	: self.row_detail,
					row		: row
				})

			// send event data_request_done (used by buttons download)
				event_manager.publish('data_request_done', {
					request_body	: null,
					result			: {
						term : row
					},
					// export_data_parser : page.export_parse_term_data
				})

			// show export_data_container
				self.export_data_container.classList.remove('hide')

		}
		else{
			self.row_detail.innerHTML = 'Error. Invalid section_id'
		}

		return true
	},//end set_up



	/**
	* GET_ROW_DATA
	* Get database term row from thesaurus
	* @param object options
	* {
	* 	section_tipo: string
	* 	section_id: string|int
	* 	table: string
	* }
	* @return array data
	*/
	get_row_data : async function(options) {

		// options
			const section_tipo	= options.section_tipo
			const section_id	= parseInt(options.section_id)
			const table			= options.table

		// request
			const response = await data_manager.request({
				body : {
					dedalo_get				: 'records',
					table					: table,
					db_name					: page_globals.WEB_DB,
					lang					: page_globals.WEB_CURRENT_LANG_CODE,
					ar_fields				: ['*'],
					count					: false,
					limit					: 0,
					sql_filter				: `section_id = ${section_id}`,
					resolve_portals_custom	: {
						bibliography	: 'bibliographic_references'
					}
				}
			})

		const row = response.result && response.result[0]
			? response.result[0]
			: {};

		// data parsed
			const data = page.parse_term(row)

		// bibliographic_references_data. Inject already resolve bibliography to bibliographic_references_data
		// and restore bibliography value (unified way for speed from thesaurus.js)
			if (data.bibliography) {
				// used to render_info_block
				data.bibliographic_references_data = data.bibliography
				// property not used, only for export purposes
				data.bibliography = data.bibliography.map(el => el.section_id)
			}

		// debug
			if(SHOW_DEBUG===true) {
				console.log('debug get_row_data response:', response);
				console.log('debug get_row_data data:', data);
			}

		return data
	},//end get_row_data



	/**
	* GET_RELATED_TYPE
	* Get database term row from thesaurus
	* @param int section_id
	* @return array data
	*/
	get_related_type : async function(section_id) {

		// request
			const response = await data_manager.request({
				body : {
					lang		: page_globals.WEB_CURRENT_LANG_CODE,
					db_name		: page_globals.WEB_DB,
					dedalo_get	: 'records',
					table		: 'catalog',
					ar_fields	: ['section_id','ref_coins_image_obverse','ref_coins_image_reverse'], // ,'ref_coins_image_obverse','ref_coins_image_reverse'
					limit		: 1,
					order		: 'RAND()',
					count		: false,
					sql_filter	: `(
						ref_type_design_obverse_iconography_data LIKE '%"${section_id}"%' OR
						ref_type_design_reverse_iconography_data LIKE '%"${section_id}"%'
					) AND "ref_coins_image_obverse" IS NOT NULL`
				}
			})

		const row = response.result && response.result[0]
			? response.result[0]
			: {};

		// debug
			if(SHOW_DEBUG===true) {
				console.log('get_related_type response:', response);
			}

		return row
	},//end get_related_type



	/**
	* DRAW_ROW
	* Render thesaurus row
	* @param object options
	* {
	* 	target	: HTMLElement self.row_detail,
	*	row		: object row
	* }
	*/
	draw_row : function(options) {

		// options
			const row_object	= options.row;
			const container		= options.target

		// check row_object
			if (!row_object || !row_object.section_id) {
				console.warn("Warning! draw_row row_object no found in options");
				return null;
			}

		// fix row_object
			self.row_object = row_object

		// short vars
			const section_tipo	= row_object.tld
			const section_id	= row_object.section_id

		// fragment
			const fragment = new DocumentFragment();

		// container select and clean container div
			while (container.hasChildNodes()) {
				container.removeChild(container.lastChild);
			}

		// Cite of record
			const cite_container = document.querySelector('.golden-separator')
			requestAnimationFrame(
				() => {
					const title = page_globals.OWN_CATALOG_ACRONYM + ' ' + row_object.term_id
					page.render_cite_record(
						row_object,
						cite_container,
						title
					)
				}
			)

		// Dédalo link for editors
			if (dedalo_logged===true) {

				const url = page_globals.__WEB_BASE_URL__ + `/dedalo/core/page/?tipo=${section_tipo}&section_id=${section_id}`

				const link = common.create_dom_element({
					element_type	: 'a',
					class_name		: 'section_id go_to_dedalo',
					text_content	: row_object.section_id,
					href			: url,
					parent			: fragment
				})
				link.setAttribute('target', '_blank');
			}

		// illustration (image svg)
			if (row_object.illustration) {

				const url = page_globals.__WEB_BASE_URL__ + row_object.illustration

				// illustration
				common.create_dom_element({
					element_type	: 'img',
					class_name		: 'illustration',
					src				: url,
					parent			: fragment
				})
			}else if(row_object.table==='ts_iconography') {

				// iconography uses the first type image instead a SVG (random order)

				const type_images_container = common.create_dom_element({
					element_type	: 'div',
					class_name		: 'type_images_container invisible',
					parent			: fragment
				})

				term.get_related_type(row_object.section_id)
				.then(function(type_row){

					// image obverse
						if (type_row.ref_coins_image_obverse) {
							const thumb_obverse = type_row.ref_coins_image_obverse.replace('/1.5MB/', '/thumb/')
							const image_obverse = common.create_dom_element({
								element_type	: 'img',
								class_name		: 'type_image',
								src				: page_globals.__WEB_MEDIA_BASE_URL__ + thumb_obverse,
								parent			: type_images_container
							})
							const obverse_load_handler = () => {
								requestAnimationFrame(
									() => {
										image_obverse.src = page_globals.__WEB_MEDIA_BASE_URL__ + type_row.ref_coins_image_obverse
									}
								)
							}
							image_obverse.addEventListener('load', obverse_load_handler)
						}

					// image reverse
						if (type_row.ref_coins_image_reverse) {
							const thumb_reverse = type_row.ref_coins_image_reverse.replace('/1.5MB/', '/thumb/')
							const image_reverse = common.create_dom_element({
								element_type	: 'img',
								class_name		: 'type_image',
								src				: page_globals.__WEB_MEDIA_BASE_URL__ + thumb_reverse,
								parent			: type_images_container
							})
							const reverse_load_handler = () => {
								requestAnimationFrame(
									() => {
										image_reverse.src = page_globals.__WEB_MEDIA_BASE_URL__ + type_row.ref_coins_image_reverse
									}
								)
							}
							image_reverse.addEventListener('load', reverse_load_handler)
						}

					// show type_images_container
					type_images_container.classList.remove('invisible')
				})
			}else{

				// utf8_term
				common.create_dom_element({
					element_type	: 'div',
					class_name		: 'utf8_term',
					inner_html		: row_object.term,
					parent			: fragment
				})
			}

		// term and definition
			if (row_object.term && row_object.term.length>0) {

				// line
					const lineTittleWrap = common.create_dom_element({
						element_type	: 'div',
						class_name		: 'line-tittle-wrap',
						parent			: fragment
					})

				// term
					common.create_dom_element({
						element_type	: 'div',
						class_name		: 'line-tittle golden-color',
						inner_html		: row_object.term,
						parent			: lineTittleWrap
					})

				// definition
					// if (row_object.definition && row_object.definition.length>0) {
					// 	const definition = row_object.definition;
					// 	common.create_dom_element({
					// 		element_type	: 'div',
					// 		class_name		: 'info_value',
					// 		inner_html		: definition,
					// 		parent			: lineTittleWrap
					// 	})
					// }
			}//end if (row_object.term && row_object.term.length>0)

		// info_block
			const info_block = common.create_dom_element({
				element_type	: 'div',
				class_name		: 'block_container info hide',
				parent			: fragment
			})
			// render info
			requestAnimationFrame(
				() => {
					term.render_info(row_object, info_block)
				}
			)

		// parents
			if (row_object.parents && row_object.parents.length) {
				const parents_container = common.create_dom_element({
					element_type	: 'div',
					class_name		: 'block_container parents_container hide',
					parent			: fragment
				})
				// render parents
				requestAnimationFrame(
					() => {
						const table		= page.thesaurus_map[row_object.tld]
						const parents	= row_object.parents.reverse()
						term.render_terms(
							table,
							parents,
							parents_container
						)
					}
				)
			}

		// bibliography
			// if (row_object.bibliography && row_object.bibliography.length>0) {

			// 	const bibliography_container = common.create_dom_element({
			// 		element_type	: 'div',
			// 		class_name		: 'bibliography_container',
			// 		parent			: fragment
			// 	})

			// 	//create the graphical red line that divide blocks
			// 	const lineSeparator = common.create_dom_element({
			// 		element_type	: 'div',
			// 		class_name		: 'info_line separator',
			// 		parent			: bibliography_container
			// 	})
			// 	//create the tittle block inside a red background
			// 	common.create_dom_element({
			// 		element_type	: 'label',
			// 		class_name		: 'big_label',
			// 		text_content	: tstring.bibliographic_references || 'Bibliographic references',
			// 		parent			: lineSeparator
			// 	})

			// 	const bibliography_block = common.create_dom_element({
			// 		element_type	: 'div',
			// 		class_name		: 'info_text_block',
			// 		parent			: bibliography_container
			// 	})

			// 	const ref_biblio = row_object.bibliography
			// 	const ref_biblio_length	= ref_biblio.length
			// 	for (let i = 0; i < ref_biblio_length; i++) {

			// 		// build full ref biblio node
			// 		const biblio_row_node = biblio_row_fields.render_row_bibliography(ref_biblio[i])

			// 		const biblio_row_wrapper = common.create_dom_element({
			// 			element_type	: 'div',
			// 			class_name		: 'bibliographic_reference',
			// 			parent			: bibliography_block
			// 		})
			// 		biblio_row_wrapper.appendChild(biblio_row_node)
			// 	}
			// }

		// other permanent URI
			if (row_object.uri && row_object.uri.length>0) {

				//create the graphical red line that divide blocks
				// const lineSeparator = common.create_dom_element({
				// 	element_type	: "div",
				// 	class_name		: "info_line separator",
				// 	parent 			: line
				// })
				for (let i = 0; i < row_object.uri.length; i++) {

					const el		= row_object.uri[i]
					const label		= el.label || "URI"
					const uri_text	= '<a class="icon_link info_value" href="' + el.value + '" target="_blank"> ' + label  + '</a>'

					common.create_dom_element({
						element_type	: 'span',
						inner_html		: uri_text,
						parent			: fragment
					})
				}
			}

		// coins (countermarks only)
			const coins_container = common.create_dom_element({
				element_type	: 'div',
				class_name		: 'block_container coins_container hide',
				parent			: fragment
			})
			// render coins list
			requestAnimationFrame(
				() => {
					term.render_coins(row_object, coins_container)
				}
			)

		// types
			const types_container = common.create_dom_element({
				element_type	: 'div',
				class_name		: 'block_container types_container hide',
				parent			: fragment
			})

			// area type (@see page.thesaurus_area_tables)
			const area_type = page.thesaurus_area_tables[row_object.table]

			// render types list
			requestAnimationFrame(
				() => {
					switch (area_type) {

						case 'iconography':
							term.render_iconography_types(row_object, types_container)
							break;

						case 'epigraphy':
							// use default

						default:
							term.render_types(row_object, types_container)
							break;
					}
				}
			)

		// container final add
		container.appendChild(fragment)


		return container
	},//end draw_row



	/**
	* RENDER_INFO
	* Creates the main info (ID, time frame, definition, scope note, bibliography)
	* @param object row
	* @param HTMLElement container
	* @return bool
	*/
	render_info : async (row, container) => {

		// add spinner
			const spinner = common.create_dom_element({
				element_type	: 'span',
				class_name		: 'spinner',
				parent			: container
			})

		// show container
			container.classList.remove('hide')

		// render whole info block using thesaurus method
			const info_block_node = await thesaurus.render_info_block(row)

		// remove spinner
			spinner.remove()

		// set as loaded
			container.classList.add('loaded')

		// append final node
			container.appendChild(info_block_node)


		return true
	},//end render_info



	/**
	* RENDER_COINS
	* Used by countermarks to render related coins
	* @param object row
	* @param HTMLElement container
	* @return bool
	*/
	render_coins : async (row, container) => {

		// ar_relations
			const ar_relations = row.dd_relations && row.dd_relations.length >0
				? row.dd_relations.filter(el => el.section_tipo && el.section_tipo==='numisdata4') // coins = numisdata4
				: []

			if (ar_relations.length<1) {
				return false
			}

		// info line label + gold line bellow
			const info_line_separator = common.create_dom_element({
				element_type	: 'div',
				class_name		: 'info_line separator',
				parent			: container
			})
			common.create_dom_element({
				element_type	: 'label',
				class_name		: 'big_label',
				inner_html		: tstring.coins || 'Coins',
				parent			: info_line_separator
			})

		// add spinner
			const spinner = common.create_dom_element({
				element_type	: 'span',
				class_name		: 'spinner',
				parent			: container
			})

		// show container
			container.classList.remove('hide')

		// data
			const data = await thesaurus.load_relations_data(row, ar_relations)
			if (!data) {
				spinner.remove()
				container.classList.add('hide')
				return false
			}

		// remove spinner
			spinner.remove()

		// set as loaded
			container.classList.add('loaded')

		// countermarks_container
			const countermarks_container = common.create_dom_element({
				element_type	: 'div',
				class_name		: 'epi_container coins_list countermarks_container',
				parent			: container
			})

		// render coins
			const data_length = data.length
			for (let i = 0; i < data_length; i++) {
				const row = data[i]
				// render type_row_fields
				const coin_node	= type_row_fields_min.type_row_fields.draw_coin(row)
				// add node
				countermarks_container.appendChild(coin_node)
			}
			page.activate_images_gallery(countermarks_container)


		return true
	},//end render_coins



	/**
	* RENDER_TYPES
	* Used by countermarks to render related types
	* @param object row
	* @param HTMLElement container
	* @return bool
	*/
	render_types : async (row, container) => {

		// ar_legends. get term relations with legends (where these have been used)
			const ar_legends = row.dd_relations && row.dd_relations.length >0
				? row.dd_relations.filter(el => el.section_tipo && el.section_tipo==='numisdata41') // legends = numisdata41
				: []

		// info line label + gold line bellow
			const info_line_separator = common.create_dom_element({
				element_type	: 'div',
				class_name		: 'info_line separator',
				parent			: container
			})
			common.create_dom_element({
				element_type	: 'label',
				class_name		: 'big_label',
				inner_html		: tstring.types || 'Types',
				parent			: info_line_separator
			})

		// add spinner
			const spinner = common.create_dom_element({
				element_type	: 'span',
				class_name		: 'spinner',
				parent			: container
			})

		// show container
			container.classList.remove('hide')

		// data
			const data = await thesaurus.load_legends_data(row, ar_legends)
			// debug
			if(SHOW_DEBUG===true) {
				// console.log('debug row:', row);
				// console.log('debug data:', data);
			}
			if (!data || data.length<1) {
				spinner.remove()
				container.classList.add('hide')
				return false
			}

		// legends_container
			const legends_container = common.create_dom_element({
				element_type	: 'div',
				class_name		: 'epi_container types_list legends_container',
				parent			: container
			})

		// render all
			catalog.draw_rows({
				target	: legends_container,
				ar_rows	: data
			})
			.then(function(result_node){

				spinner.remove()
				// set as loaded
				container.classList.add('loaded')

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
					console.warn('catalog.errors:', catalog.errors);
				}
			})


		return true
	},//end render_types



	/**
	* RENDER_ICONOGRAPHY_TYPES
	* Used by countermarks to render related types
	* @param object row
	* @param HTMLElement container
	* @return bool
	*/
	render_iconography_types : async (row, container) => {

		// info line label + gold line bellow
			const info_line_separator = common.create_dom_element({
				element_type	: 'div',
				class_name		: 'info_line separator',
				parent			: container
			})
			common.create_dom_element({
				element_type	: 'label',
				class_name		: 'big_label',
				inner_html		: tstring.types || 'Types',
				parent			: info_line_separator
			})

		// add spinner
			const spinner = common.create_dom_element({
				element_type	: 'span',
				class_name		: 'spinner',
				parent			: container
			})

		// show container
			container.classList.remove('hide')

		// load types data
			const data = await thesaurus.load_types_data(row, row.section_id)
			if (!data) {
				spinner.remove()
				container.classList.add('hide')
				return false
			}

		// legends_container
			const legends_container = common.create_dom_element({
				element_type	: 'div',
				class_name		: 'epi_container types_list legends_container',
				parent			: container
			})

		// render DOM nodes
		await catalog.draw_rows({
			target	: legends_container,
			ar_rows	: data
		})
		.then(function(result_node){

			spinner.remove()
			// set as loaded
			container.classList.add('loaded')

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
				console.warn('catalog.errors:', catalog.errors);
			}
		})


		return true
	},//end render_iconography_types



	/**
	* RENDER_TERMS
	* Used to render parents and children terms
	* @param string table
	* @param array ar_term_id
	* @param HTMLElement container
	* @return bool
	*/
	render_terms : async (table, ar_term_id, container) => {

		const self = this

		// clean container
			while (container.firstChild) {
				container.removeChild(container.firstChild);
			}

		// show container
			container.classList.remove('hide')

		// add spinner
			const spinner = common.create_dom_element({
				element_type	: 'span',
				class_name		: 'spinner',
				parent			: container
			})

		// sql_filter
			const ar_section_id = ar_term_id.map(el => {

				const regex = /_(\d+)/gm;
				const m = regex.exec(el)

				return m[1] ?? null
			})
			const sql_filter = 'section_id IN (' + ar_section_id.join(',') + ')'

		// order custom
			const order = `FIELD(section_id, ${ar_section_id.join(',')})`

		// get terms info
			const response = await data_manager.request({
				body : {
					dedalo_get	: 'records',
					table		: table,
					db_name		: page_globals.WEB_DB,
					lang		: page_globals.WEB_CURRENT_LANG_CODE,
					ar_fields	: ['*'],
					count		: false,
					limit		: 0,
					sql_filter	: sql_filter,
					order		: order
				}
			})

		// remove spinner
			spinner.remove()

			// error case
				if (!response.result) {
					console.error('Error getting records. API response:', response);
					return false
				}

			// header
				common.create_dom_element({
					element_type	: 'span',
					class_name		: 'block_label',
					inner_html		: tstring.parents || 'Parents',
					parent			: container
				})

			// parents_list
				const parents_list = common.create_dom_element({
					element_type	: 'div',
					class_name		: 'parents_list',
					parent			: container
				})

			// data parsed
			const rows = response.result.map(el => page.parse_term( el ) )
			// const rows = page.parse_tree_data(response.result)
			const rows_length = rows.length
			// iterate in reverse order for parents
			// for (let i = rows_length - 1; i >= 0; i--) {
			for (let i = 0; i < rows_length; i++) {

				const row = rows[i]

				// base_line
					const tree_node = thesaurus.render_base_line(row)
					const line = common.create_dom_element({
						element_type	: 'div',
						class_name		: 'tree_node line',
						parent			: parents_list
					})
					line.appendChild(tree_node)

				// tree_node
					// const tree_node = thesaurus.render_tree_node(row)
					// parents_list.appendChild(tree_node)

				// title from first parent
					// if (i===rows_length-1) {
					// 	requestAnimationFrame(
					// 		() => {
					// 			const base_title = 'Term' // self.main_title.innerHTML
					// 			self.main_title.innerHTML = `${base_title} > ${row.term}`;
					// 		}
					// 	)
					// }
			}//end for (let i = rows_length - 1; i >= 0; i--)

		// set container as loaded
			container.classList.add('loaded')


		return true
	},//end render_terms



	/**
	* RENDER_MAIN_TITLE
	* Renders page main tile at top of the page
	* Initial value is 'Term' and becomes like 'Term > Greek'
	* @param object row
	* @return bool
	*/
	render_main_title : (row) => {

		const self = this

		if (row.parents) {

			// get first parent (top level parent) as 'scell1_1'
			const first_parent				= row.parents[row.parents.length - 1];
			// split term_id to get tld (section_tipo) and section_id
			const parent_parts				= first_parent.split('_')
			const first_parent_tld			= parent_parts[0]
			const first_parent_section_id	= parent_parts[1]
			// check safe values
			if (!first_parent_tld || !first_parent_section_id) {
				console.log('Unable to get parent tld or section_id:', first_parent);
				return false
			}

			// table (from first_parent that could be different of row tld on cross-linked thesaurus)
			const table = page.thesaurus_map[first_parent_tld]

			data_manager.request({
				body : {
					dedalo_get		: 'records',
					table			: table,
					db_name			: page_globals.WEB_DB,
					lang			: page_globals.WEB_CURRENT_LANG_CODE,
					ar_fields		: ['term'],
					count			: false,
					limit			: 1,
					sql_filter		: `term_id = '${first_parent}'` // search by column term_id
					// sql_filter	: `section_id = ${first_parent_section_id}` // search by column section_id
				}
			})
			.then((response)=>{
				if(SHOW_DEBUG===true) {
					console.log('debug render_main_title response:', response);
				}

				if (!response.result) {
					return
				}

				const base_title = '' // self.main_title.innerHTML
				const term = response.result[0] && response.result[0].term
					? response.result[0].term
					: null
				if (!term) {
					console.error('Unable to get term from term_id. row:', row.term_id, response);
					self.main_title.innerHTML = `${base_title}`;
					return false
				}
				self.main_title.innerHTML = term;
			})
		}

		return true
	}//end render_main_title



}//end term
