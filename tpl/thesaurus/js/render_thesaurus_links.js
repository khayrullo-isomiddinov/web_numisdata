/*global $, tstring, page_globals, SHOW_DEBUG, page, thesaurus, __WEB_TEMPLATE_WEB__, Promise, common, WEB_AREA, document, DocumentFragment, tstring, console, form_factory, data_manager, tree_factory */
/*eslint no-undef: "error"*/
/*jshint esversion: 6 */
"use strict";



// render_thesaurus_links



/**
* RENDER_ICONOGRAPHY_LINKS
* Creates the DOM nodes for iconography links
* Called from render_thesaurus.render_tree_node
* @param object row
* @param HTMLElment buttons_additional
* @param HTMLelement container_additional
* @return void
*/
thesaurus.render_iconography_links = (row, buttons_additional, container_additional) => {

	// check_references
		const check_references = () => {

			return new Promise(function(resolve){

				// delegates check task to worker. When finish, show link button if target result exists
				const current_worker = new Worker(__WEB_TEMPLATE_WEB__ + '/thesaurus/js/worker.js');
				const body = {
					code		: page_globals.API_WEB_USER_CODE,
					lang		: page_globals.WEB_CURRENT_LANG_CODE,
					db_name		: page_globals.WEB_DB,
					dedalo_get	: 'records',
					table		: 'catalog',
					ar_fields	: ['section_id'], // ,'ref_coins_image_obverse','ref_coins_image_reverse'
					limit		: 1,
					count		: false,
					sql_filter	: `(
						ref_type_design_obverse_iconography_data LIKE '%"${row.section_id}"%' OR
						ref_type_design_reverse_iconography_data LIKE '%"${row.section_id}"%'
					)`
				}
				current_worker.postMessage({
					url		: page_globals.JSON_TRIGGER_URL,
					body	: body
				});
				current_worker.onmessage = function(e) {
					current_worker.terminate()

					const api_response = e.data
					if (api_response.result && api_response.result.length>0) {
						resolve(true)
					}

					resolve(false);
				}
			})
		}

	// load_and_render
		const load_and_render = async (e) => {
			e.stopPropagation()

			const link_types = e.target

			// add_spinner
			thesaurus.add_spinner(container_additional)

			// types data load once and store it into link_types button
			if (!link_types.data) {
				// fix parsed data
				link_types.data = await thesaurus.load_types_data(row, row.section_id)
			}

			// no results case
			if (!link_types.data || link_types.data.length===0) {
				thesaurus.remove_spinner(container_additional)
				return
			}

			// render_types
			const render_types = () => {

				thesaurus.remove_spinner(container_additional)

				// close container if is already displayed
					if (container_additional.types_container) {
						container_additional.types_container.remove()
						container_additional.types_container = undefined
						return
					}

				// data
					const data = link_types.data
					if (!data) {
						return
					}

				// types_container: create a new one if not already exists
					const types_container = container_additional.types_container
						? container_additional.types_container
						: (()=>{
							const types_container = common.create_dom_element({
								element_type	: 'div',
								class_name		: 'epi_container types_container',
								parent			: container_additional
							})
							container_additional.types_container = types_container
							return types_container
						  })();

				// render types with same layout than catalog list
					catalog.draw_rows({
						target	: types_container,
						ar_rows	: data
					})
					.then(function(result_node){
						// no result case
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
			}//end render_types

			// active link (opacity transition fadeIn)
			requestAnimationFrame(
				() => {
					link_types.classList.add('active')
					// display hidden node container_additional
					container_additional.classList.remove('hide')
				}
			)

			render_types()
		}//end load_and_render

	// set node only when it is in DOM (to save browser resources)
		const observer = new IntersectionObserver(async function(entries) {
			const entry = entries[1] || entries[0]
			if (entry.isIntersecting===true || entry.intersectionRatio > 0) {
				observer.disconnect();

				// check_references. Checks if any type references this row
					const has_references = await check_references()
					if (!has_references) {
						return
					}

				// link types node
					const link_types = common.create_dom_element({
						element_type	: 'a',
						class_name		: 'epi_link types_link',
						inner_html		: (tstring.types || 'Types'),
						parent			: buttons_additional
					})
					// mousedown event
					link_types.addEventListener('mousedown', load_and_render)
					if(SHOW_DEBUG===true) {
						link_types.title = 'term_id:' + row.term_id
					}
			}
		}, { threshold: [0] });
		observer.observe(buttons_additional);

	// debug
		if(SHOW_DEBUG===true) {
			if (row.term_id=="icon1_93") {
				console.log('row:', row);
			}
		}
}//end render_iconography_links



/**
* RENDER_COUNTERMARKS_LINKS
* Creates the DOM nodes for countermarks links
* Called from render_thesaurus.render_tree_node
* @param object row
* @param HTMLElment buttons_additional
* @param HTMLelement container_additional
* @return void
*/
thesaurus.render_countermarks_links = (row, buttons_additional, container_additional) => {

	// sign_group
		const sign_group = [
			'sccmk2_2' // ts_countermarks
		]
		const is_sign_group = !!(row.model && sign_group.includes(row.model) && row.children)

	// countermarks
		const build_countermarks = () => {

			// ar_relations
				const ar_relations = row.dd_relations && row.dd_relations.length >0
					? row.dd_relations.filter(el => el.section_tipo && el.section_tipo==='numisdata4') // coins = numisdata4
					: []

			// sign_group case
				if (is_sign_group) {
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

						// add_spinner
						thesaurus.add_spinner(container_additional)

						// relations_data load
						if (!link_countermarks.data) {
							// fix parsed data
							link_countermarks.data = await thesaurus.load_relations_data(row, ar_relations)
						}
						if (!link_countermarks.data || link_countermarks.data.length===0) {
							thesaurus.remove_spinner(container_additional)
							return
						}

						// render countermarks
						const render_countermarks = () => {

							thesaurus.remove_spinner(container_additional)

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
									// render type_row_fields
									const coin_node	= type_row_fields_min.type_row_fields.draw_coin(row)
									countermarks_container.appendChild(coin_node)
								}
								page.activate_images_gallery(countermarks_container)
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

	// build_countermarks
		build_countermarks()

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
}//end render_countermarks_links



/**
* RENDER_EPIGRAPHY_LINKS
* Creates the DOM nodes for epigraphy links
* Called from render_thesaurus.render_tree_node
* @param object row
* @param HTMLElment buttons_additional
* @param HTMLelement container_additional
* @param object self
* 	Is a tree_factory instance
* @return void
*/
thesaurus.render_epigraphy_links = (row, buttons_additional, container_additional, self) => {

	// is_sign_group
		const is_sign_group = !!(row.model && thesaurus.sign_group_models.includes(row.model) && row.children)
		// debug
			if(SHOW_DEBUG===true) {
				// if (row.term_id==='scell1_171') {
				// 	console.warn('is_sign_group:', is_sign_group);
				// 	console.log('is_sign_group:', row.term_id, row.model, is_sign_group);
				// 	console.log('row.children:', row.term_id, row.model, row);
				// }
			}

	// is_utf
		const is_utf = !!(row.model && thesaurus.utf_models.includes(row.model))
		// debug
			if(SHOW_DEBUG===true) {
				// if (row.term_id==='scell1_171') {
				// 	console.log('is_utf:', row.term_id, is_utf);
				// }
			}

	// legends
		const build_legends = () => {

			// ar_legends. get term relations with legends (where these have been used)
				const ar_legends = row.dd_relations && row.dd_relations.length >0
					? row.dd_relations.filter(el => el.section_tipo && el.section_tipo==='numisdata41') // legends = numisdata41
					: []

			// sign_group case
				if (is_sign_group) {
					// get children data from tree_factory.data
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

			if (ar_legends.length || is_utf===true || is_sign_group===true) {

				// debug
					if(SHOW_DEBUG===true) {
						// if (row.term_id==='scell1_171') {
						// 	console.log('ar_legends:', row.term_id, ar_legends);
						// }
					}

				// load_and_render
					const load_and_render = async () => {

						// add_spinner
						thesaurus.add_spinner(container_additional)

						// relations_data load
						if (!link_legends.data) {
							// fix parsed data
							link_legends.data = await thesaurus.load_legends_data(row, ar_legends)
						}
						// debug
							if(SHOW_DEBUG===true) {
								// if (row.term_id==='scell1_171') {
								// 	console.log('link_legends.data:', row.term_id, link_legends.data);
								// }
							}
						if (!link_legends.data || link_legends.data.length===0) {
							thesaurus.remove_spinner(container_additional)
							return
						}

						// render legends
						const render_legends = () => {

							thesaurus.remove_spinner(container_additional)

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
		build_legends()

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

}//end render_epigraphy_links
