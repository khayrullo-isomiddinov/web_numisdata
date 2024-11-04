/*global $, tstring, page_globals, SHOW_DEBUG, page, thesaurus, __WEB_TEMPLATE_WEB__, Promise, common, WEB_AREA, document, DocumentFragment, tstring, console, form_factory, data_manager, tree_factory */
/*eslint no-undef: "error"*/
/*jshint esversion: 6 */
"use strict";



// render_thesaurus



/**
* RENDER_TREE_NODE
* Is called by 'tree_factory' to render the tree HTML node
* @param object row
* @return DOM node tree_node
*/
thesaurus.render_tree_node = function(row) {

	const self = this // is 'tree_factory' instance

	// node wrapper
		const tree_node = common.create_dom_element({
			element_type	: 'div',
			class_name		: 'tree_node',
			id				: row.term_id
		})
		// add properties to node
		tree_node.term_id	= row.term_id
		tree_node.parent	= row.parent

	// container_additional. Definition only to be accessible (contains legends and countermarks)
		const container_additional = common.create_dom_element({
			element_type	: 'div',
			class_name		: 'container_additional hide'
		})

	// base line
		const base_line = thesaurus.render_base_line(row)
		tree_node.appendChild(base_line)

	// buttons
		// button info
			const show_info = row.time || row.definition || row.scope_note
			if (show_info) {
				const btn_info = common.create_dom_element({
					element_type	: 'span',
					class_name		: 'inline_btn btn_info',
					parent			: tree_node
				})
				const mousedown_handler = async function(e) {
					e.stopPropagation()

					if (this.classList.contains('open')) {
						info.classList.add('hide')
						this.classList.remove('open')
						// remove nodes
						while (info.firstChild) {
							info.removeChild(info.firstChild);
						}
					}else{
						// Render nodes
						const node = await thesaurus.render_info_block(row)
						info.appendChild(node)
						// update styles
						info.classList.remove('hide')
						this.classList.add('open')
					}
				}
				btn_info.addEventListener('mousedown', mousedown_handler)
			}

		// button bibliography (moved to info)
			// if (row.bibliography && row.bibliography.length>0) {
			// 	const btn_bibliography = common.create_dom_element({
			// 		element_type	: "span",
			// 		class_name		: "inline_btn btn_bibliography",
			// 		parent			: tree_node
			// 	})
			// 	btn_bibliography.addEventListener('mousedown', async function(){
			// 		if (this.classList.contains('open')) {
			// 			bibliography.classList.add('hide')
			// 			this.classList.remove('open')
			// 			// remove nodes
			// 			while (bibliography.firstChild) {
			// 				bibliography.removeChild(bibliography.firstChild);
			// 			}
			// 		}else{
			// 			// load bibliographic_references data from API
			// 			btn_bibliography.data = btn_bibliography.data || await thesaurus.load_bibliography_data(row, row.bibliography)
			// 			// label
			// 			common.create_dom_element({
			// 				element_type	: 'span',
			// 				class_name		: 'block_label',
			// 				text_content	: tstring.bibliographic_references || 'Bibliographic references',
			// 				parent			: bibliography
			// 			})
			// 			// Render nodes
			// 			const ref_biblio		= btn_bibliography.data
			// 			const ref_biblio_length	= ref_biblio.length
			// 			for (let i = 0; i < ref_biblio_length; i++) {
			// 				// build full ref biblio node
			// 				const biblio_row_node	 = biblio_row_fields.render_row_bibliography(ref_biblio[i])
			// 				const biblio_row_wrapper = common.create_dom_element({
			// 					element_type	: 'div',
			// 					class_name		: 'bibliographic_reference',
			// 					parent			: bibliography
			// 				})
			// 				biblio_row_wrapper.appendChild(biblio_row_node)
			// 			}
			// 			// update styles
			// 			bibliography.classList.remove("hide")
			// 			this.classList.add("open")
			// 		}
			// 	})
			// }

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

		// link. Terms with model are groupers. Ignore it
			if (thesaurus.show_link(row)===true) {
				const btn_link = common.create_dom_element({
					element_type	: 'a',
					class_name		: 'inline_btn btn_link',
					title			: row.term_id,
					parent			: tree_node
				})
				// mousedown handler
				const mousedown_handler = (e) => {
					e.stopPropagation()
					e.preventDefault()

					switch (WEB_AREA) {
						// mints
						case 'mints_hierarchy':
							window.open(
								`./mint/${row.term_data[0]}`,
								'term',
								null
							);
							break;
						// other thesaurus
						default:
							window.open(
								`./ts_node/${row.term_id}`,
								'term',
								null
							);
							break;
					}
				}
				btn_link.addEventListener('mousedown', mousedown_handler)
			}

		// links based on WEB_AREA value (mints_hierarchy, iconography, symbols, countermarks)
		switch (WEB_AREA) {
			case 'mints_hierarchy':
				// nothing to do here
				break;

			case 'iconography':
				thesaurus.render_iconography_links(row, buttons_additional, container_additional, self)
				break;

			case 'epigraphy':
				thesaurus.render_epigraphy_links(row, buttons_additional, container_additional, self)
				break;

			case 'countermarks':
				thesaurus.render_countermarks_links(row, buttons_additional, container_additional, self)
				break;

			case 'symbols':
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

			default:
				// nothing to do
				break;
		}

	// wrappers
		// info wrapper
			let info
			if (show_info) {
				// info
				info = common.create_dom_element({
					element_type	: "div",
					class_name		: "info hide",
					parent			: tree_node
				})
			}

		// bibliography wrapper (moved to info)
			// let bibliography
			// if (row.bibliography && row.bibliography.length>0) {
			// 	bibliography = common.create_dom_element({
			// 		element_type	: "div",
			// 		class_name		: "bibliography hide",
			// 		parent			: tree_node
			// 	})
			// }

		// definition wrapper
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
			tree_node.appendChild(container_additional)

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
}//end render_tree_node



/**
* ADD_SPINNER
* Set the spinner class to given container
* @param HTMLelement container
* @return void
*/
thesaurus.add_spinner = (container) => {
	// container spinner
	container.classList.remove('hide')
	container.classList.add('loading_data')
}//end add_spinner



/**
* REMOVE_SPINNER
* Set off the spinner class to given container
* @param HTMLelement container
* @return void
*/
thesaurus.remove_spinner = (container) => {
	// container spinner
	container.classList.add('hide')
	container.classList.remove('loading_data')
}//end remove_spinner



/**
* RENDER_BASE_LINE
*
* @param object row
* @return DocumentFragment
*/
thesaurus.render_base_line = (row) => {

	const fragment = new DocumentFragment()

	// illustration (svg)
		if (row.illustration && row.illustration.length>0) {
			const to_left = ['epigraphy','countermarks']
			const styles = to_left.includes(WEB_AREA) ? 'left' : 'right'
			const image = common.create_dom_element({
				element_type	: 'img',
				class_name		: 'illustration ' + styles,
				src				: page_globals.__WEB_BASE_URL__ + row.illustration,
				parent			: fragment
			})
			const outsideClickListener = (event) => {
				event.stopPropagation()

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

	// term
		// const ar_value = []
		// if (row.code && row.code.length>0) {
		// 	ar_value.push(row.code)
		// }
		// ar_value.push(row.term)
		// const term_value	= ar_value.join(' | ') // row.term //+ " <small>[" + row.term_id + "]</small>"
		const term_value	= row.term // + " <small>[" + row.term_id + "]</small>"

		const to_hilite		= (row.hilite && row.hilite===true)
		const term_css		= to_hilite===true ? " hilite" : ""
		const term = common.create_dom_element({
			element_type	: 'span',
			class_name		: 'term' + term_css,
			inner_html		: term_value,
			parent			: fragment
		})
		if(SHOW_DEBUG===true) {
			term.title = `${row.term_id} ${row.model}`
		}

	// scroll
		// self.scrolled = false
		// if (to_hilite && self.scrolled===false) {
		// 	common.when_in_dom(tree_node, function(){
		// 		tree_node.scrollIntoView()
		// 	})
		// 	self.scrolled = true
		// }

	// nd (no descriptor)
		if (row.nd && row.nd.length>0) {
			common.create_dom_element({
				element_type	: 'span',
				class_name		: 'nd',
				inner_html		: '[' + row.nd.join(', ') + ']',
				parent			: fragment
			})
		}


	return fragment
}//end render_base_line



/**
* RENDER_INFO_BLOCK
* Renders full info block containing time, definition, scope_note, bibliography
* @param object row
* 	Table row from API response result
* @return DocumentFragment content
*/
thesaurus.render_info_block = async function(row) {

	// DocumentFragment
		const content = new DocumentFragment()

	// id
		common.create_dom_element({
			element_type	: 'div',
			class_name		: 'item term_id',
			inner_html		: 'MIB ' + row.term_id,
			parent			: content
		})

	// time
		if (row.time) {

			try {

				// split and format time from source like '-100-00-00 00:00:00,-075-00-00 00:00:00'
				const ar_date	= row.time.split(',')
				const regex		= /^(-?[0-9]{1,})-[0-9]{2}-[0-9]{2} .*/;
				const date_in	= regex.exec(ar_date[0])[1]
				const date_out	= regex.exec(ar_date[1])[1]

				const value = `${date_in} <> ${date_out}`

				// label
				common.create_dom_element({
					element_type	: 'span',
					class_name		: 'block_label',
					text_content	: tstring.time_frame || 'Time frame',
					parent			: content
				})
				common.create_dom_element({
					element_type	: 'div',
					class_name		: 'item item_time',
					inner_html		: value,
					parent			: content
				})

			} catch (error) {
				console.error(error)
			}
		}

	// definition
		if (row.definition) {
			// label
			common.create_dom_element({
				element_type	: 'span',
				class_name		: 'block_label',
				text_content	: tstring.definition || 'Definition',
				parent			: content
			})
			common.create_dom_element({
				element_type	: 'div',
				class_name		: 'item item_definition',
				inner_html		: row.definition,
				parent			: content
			})
		}

	// scope_note
		if (row.scope_note) {
			// label
			common.create_dom_element({
				element_type	: 'span',
				class_name		: 'block_label',
				text_content	: tstring.scope_note || 'Scope note',
				parent			: content
			})
			common.create_dom_element({
				element_type	: 'div',
				class_name		: 'item item_scope_note',
				inner_html		: row.scope_note,
				parent			: content
			})
		}

	// bibliography
		if (row.bibliography && row.bibliography.length) {
			// label
			common.create_dom_element({
				element_type	: 'span',
				class_name		: 'block_label',
				text_content	: tstring.bibliographic_references || 'Bibliographic references',
				parent			: content
			})
			// Render nodes
			// load bibliographic_references data from API
			row.bibliographic_references_data = row.bibliographic_references_data
				|| await thesaurus.load_bibliography_data(row, row.bibliography)
			const ref_biblio		= row.bibliographic_references_data
			const ref_biblio_length	= ref_biblio.length
			for (let i = 0; i < ref_biblio_length; i++) {
				// build full ref biblio node
				const biblio_row_node = biblio_row_fields.render_row_bibliography(ref_biblio[i])
				const biblio_row_wrapper = common.create_dom_element({
					element_type	: 'div',
					class_name		: 'bibliographic_reference',
					parent			: content
				})
				biblio_row_wrapper.appendChild(biblio_row_node)
			}
		}

	// authorship
		if(row.authorship_names && row.authorship_names.length>0) {
			// label
			common.create_dom_element({
				element_type	: 'span',
				class_name		: 'block_label',
				text_content	: tstring.authorship || 'Authorship',
				parent			: content
			})
			page.render_authorship(row, content)
		}


	return content
}//end render_info_block
