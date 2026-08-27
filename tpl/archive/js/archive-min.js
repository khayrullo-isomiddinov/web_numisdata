/*global SHOW_DEBUG, data_manager, common, page, page_globals, dedalo_logged, tstring, event_manager, list_factory, form_factory, biblio_row_fields, Promise */
/*eslint no-undef: "error"*/

"use strict";



var archive = {


	// root of the hierarchy, same convention as WEB_MENU_PARENT in config.php
	ROOT_TERM_ID		: 'tch300_1',

	rows_container		: null,
	form_container		: null,
	browse_container	: null,
	search_status		: null,
	toolbar				: null,
	section_id			: null,
	mode				: 'browse',
	list				: null,
	form				: null,
	filters_panel		: null,
	filters_toggle		: null,
	filters_open		: false,
	current_sql_filter	: null,
	view_mode			: 'list',
	grid_button			: null,
	list_button			: null,

	pagination : {
		total	: null,
		limit	: 20,
		offset	: 0,
		n_nodes	: 8
	},


	/**
	* SET_UP
	* When the HTML page is loaded
	* @param object options
	*/
	set_up : function(options) {

		const self = this

		self.rows_container		= options.rows_container
		self.form_container		= options.form_container
		self.browse_container	= options.browse_container
		self.section_id			= options.section_id || null

		if (self.section_id) {
			self.load_detail()
		}else{

			const form_node = self.render_form()
			self.form_container.appendChild(form_node)

			// search status . "Search results (N)" + back-to-browse, hidden until searching
				self.search_status = common.create_dom_element({
					element_type	: "div",
					class_name		: "archive_search_status hide"
				})
				self.rows_container.parentNode.insertBefore(self.search_status, self.rows_container)

			// results toolbar (grid/list switch), also hidden until searching
				self.toolbar = self.render_toolbar()
				self.toolbar.classList.add('hide')
				self.rows_container.parentNode.insertBefore(self.toolbar, self.rows_container)
				self.set_view_mode(self.view_mode)

			self.render_browse()

			event_manager.subscribe('paginate', function(offset){
				self.pagination.offset = offset
				self.load_list()
			})
		}

		return true
	},//end set_up



	/**
	* RENDER_FORM
	* Search bar (title) + collapsible advanced filters panel
	*/
	render_form : function() {

		const self = this

		self.form = new form_factory()

		const fragment = new DocumentFragment()

		// title
			const top_row = common.create_dom_element({
				element_type	: "div",
				class_name		: "form-row fields",
				parent			: fragment
			})

			const title_form_item = self.form.item_factory({
				id			: "title",
				name		: "title",
				label		: tstring.search_archive || "Search by title...",
				q_column	: "title",
				eq			: "LIKE",
				eq_in		: "%",
				eq_out		: "%",
				is_term		: false,
				class_name	: "global_search",
				parent		: top_row,
				callback	: function(form_item) {
					self.form.activate_autocomplete({
						form_item	: form_item,
						table		: 'documentation'
					})
				}
			})

			if (title_form_item.node_input) {
				common.create_dom_element({
					element_type	: "i",
					class_name		: "fa fa-search archive_search_icon",
					parent			: title_form_item.node_input.parentNode
				})
			}

		// filters_panel
			const filters_panel = common.create_dom_element({
				element_type	: "div",
				class_name		: "form-row fields hide",
				parent			: fragment
			})
			self.filters_panel = filters_panel

			// term fields
				const term_fields = [
					{ id: "typology",   label: tstring.typology   || "Typology"   },
					{ id: "material",   label: tstring.material   || "Material"   },
					{ id: "technique",  label: tstring.technique  || "Technique"  },
					{ id: "collection", label: tstring.collection || "Collection" },
					{ id: "fund",       label: tstring.fund       || "Fund"       }
				]
				term_fields.forEach(function(field){
					self.form.item_factory({
						id			: field.id,
						name		: field.id,
						label		: field.label,
						q_column	: field.id,
						eq			: "LIKE",
						eq_in		: "%",
						eq_out		: "%",
						is_term		: true,
						parent		: filters_panel,
						callback	: function(form_item) {
							self.form.activate_autocomplete({
								form_item	: form_item,
								table		: 'documentation'
							})
						}
					})
				})

			// plain text fields
				const text_fields = [
					{ id: "municipality", label: tstring.municipality || "Municipality" },
					{ id: "curator",      label: tstring.curator      || "Curator"      }
				]
				text_fields.forEach(function(field){
					self.form.item_factory({
						id			: field.id,
						name		: field.id,
						label		: field.label,
						q_column	: field.id,
						eq			: "LIKE",
						eq_in		: "%",
						eq_out		: "%",
						is_term		: false,
						parent		: filters_panel
					})
				})

			const clear_button = common.create_dom_element({
				element_type	: "input",
				type			: "button",
				value			: tstring.clear_filters || "Clear filters",
				parent			: filters_panel
			})
			clear_button.addEventListener("click", function(){
				self.clear_filters()
			})

		// buttons row
			const buttons_row = common.create_dom_element({
				element_type	: "div",
				class_name		: "form-group field button_submit",
				parent			: fragment
			})

			self.filters_toggle = common.create_dom_element({
				element_type	: "input",
				type			: "button",
				value			: tstring.filters || "Filters",
				parent			: buttons_row
			})
			self.filters_toggle.addEventListener("click", function(){
				self.toggle_filters()
			})

			common.create_dom_element({
				element_type	: "input",
				type			: "submit",
				class_name		: "primary",
				value			: tstring.search || "Search",
				parent			: buttons_row
			})

		// form node
			self.form.node = common.create_dom_element({
				element_type	: "form",
				id				: "archive_search_form",
				class_name		: "form-inline"
			})
			self.form.node.appendChild(fragment)

			self.form.node.addEventListener("submit", function(e){
				e.preventDefault()
				self.form_submit()
			})

		return self.form.node
	},//end render_form



	/**
	* RENDER_TOOLBAR
	* Grid / list view switch, sits above the results
	*/
	render_toolbar : function() {

		const self = this

		const toolbar = common.create_dom_element({
			element_type	: "div",
			class_name		: "archive_toolbar"
		})

		const view_toggle = common.create_dom_element({
			element_type	: "div",
			class_name		: "archive_view_toggle",
			parent			: toolbar
		})

		self.list_button = common.create_dom_element({
			element_type	: "button",
			type			: "button",
			class_name		: "archive_view_btn",
			inner_html		: '<i class="fa fa-list"></i>',
			title			: tstring.list_view || "List view",
			parent			: view_toggle
		})
		self.list_button.addEventListener("click", function(){
			self.set_view_mode('list')
		})

		self.grid_button = common.create_dom_element({
			element_type	: "button",
			type			: "button",
			class_name		: "archive_view_btn",
			inner_html		: '<i class="fa fa-th-large"></i>',
			title			: tstring.grid_view || "Grid view",
			parent			: view_toggle
		})
		self.grid_button.addEventListener("click", function(){
			self.set_view_mode('grid')
		})

		return toolbar
	},//end render_toolbar



	/**
	* SET_VIEW_MODE
	* @param string mode 'grid' | 'list'
	*/
	set_view_mode : function(mode) {

		const self = this

		self.view_mode = mode

		self.rows_container.classList.toggle('view_grid', mode==='grid')
		self.rows_container.classList.toggle('view_list', mode==='list')

		self.grid_button.classList.toggle('active', mode==='grid')
		self.list_button.classList.toggle('active', mode==='list')
	},//end set_view_mode



	/**
	* TOGGLE_FILTERS
	*/
	toggle_filters : function() {

		const self = this

		self.filters_open = !self.filters_open
		self.filters_panel.classList.toggle('hide', !self.filters_open)
		self.filters_toggle.value = self.filters_open
			? (tstring.hide_filters || "Hide filters")
			: (tstring.filters || "Filters")
	},//end toggle_filters



	/**
	* RESET_FORM_FIELDS
	* Clear every field's value without triggering a search
	*/
	reset_form_fields : function() {

		const self = this

		for (let [id, form_item] of Object.entries(self.form.form_items)) {
			form_item.q			= ""
			form_item.q_selected	= []
			if (form_item.node_input) {
				form_item.node_input.value = ""
			}
			if (form_item.node_values) {
				while (form_item.node_values.hasChildNodes()) {
					form_item.node_values.removeChild(form_item.node_values.lastChild)
				}
			}
		}
	},//end reset_form_fields



	/**
	* CLEAR_FILTERS
	* An empty form means "not searching" - go back to browsing
	*/
	clear_filters : function() {

		this.exit_search_mode()
	},//end clear_filters



	/**
	* FORM_SUBMIT
	*/
	form_submit : function() {

		const self = this

		const filter = self.form.build_filter()

		self.current_sql_filter = filter
			? '(' + self.form.parse_sql_filter(filter) + ')'
			: null

		self.pagination.offset	= 0
		self.pagination.total	= null

		self.enter_search_mode()
		self.load_list()
	},//end form_submit



	/**
	* ENTER_SEARCH_MODE
	*/
	enter_search_mode : function() {

		const self = this

		if (self.mode==='search') {
			return
		}

		self.mode = 'search'
		self.browse_container.classList.add('hide')
		self.search_status.classList.remove('hide')
		self.toolbar.classList.remove('hide')
	},//end enter_search_mode



	/**
	* EXIT_SEARCH_MODE
	*/
	exit_search_mode : function() {

		const self = this

		self.mode = 'browse'
		self.reset_form_fields()
		self.current_sql_filter	= null
		self.pagination.offset		= 0
		self.pagination.total		= null

		self.browse_container.classList.remove('hide')
		self.search_status.classList.add('hide')
		self.toolbar.classList.add('hide')

		while (self.rows_container.hasChildNodes()) {
			self.rows_container.removeChild(self.rows_container.lastChild)
		}
	},//end exit_search_mode



	/**
	* UPDATE_SEARCH_STATUS
	* @param number total
	*/
	update_search_status : function(total) {

		const self = this

		while (self.search_status.hasChildNodes()) {
			self.search_status.removeChild(self.search_status.lastChild)
		}

		common.create_dom_element({
			element_type	: "span",
			class_name		: "archive_search_status_text",
			text_content	: (tstring.search_results || 'Search results') + ' (' + total + ')',
			parent			: self.search_status
		})

		const back_button = common.create_dom_element({
			element_type	: "button",
			type			: "button",
			class_name		: "archive_back_to_browse",
			inner_html		: '<i class="fa fa-angle-left"></i> ' + (tstring.browse_archive || 'Browse archive'),
			parent			: self.search_status
		})
		back_button.addEventListener('click', function(){
			self.exit_search_mode()
		})
	},//end update_search_status



	/**
	* LOAD_LIST
	* Fetch current pagination page and render it using list_factory
	*/
	load_list : function() {

		const self = this
		const rows_container = self.rows_container

		if (!self.pagination.total) {
			page.add_spinner(rows_container)
		}else{
			rows_container.classList.add('loading')
		}

		self.get_rows({
			limit		: self.pagination.limit,
			offset		: self.pagination.offset,
			sql_filter	: self.current_sql_filter
		})
		.then(function(response){

			self.pagination.total = response.total
			self.update_search_status(response.total)

			while (rows_container.hasChildNodes()) {
				rows_container.removeChild(rows_container.lastChild);
			}
			rows_container.classList.remove('loading')

			if (!response.rows.length) {
				common.create_dom_element({
					element_type	: "p",
					class_name		: "archive_empty_state",
					inner_html		: '<i class="fa fa-search"></i> ' + (tstring.no_results || 'No records found.'),
					parent			: rows_container
				})
				return
			}

			self.list = self.list || new list_factory()
			self.list.init({
				data			: response.rows,
				fn_row_builder	: self.list_row_builder,
				pagination		: self.pagination,
				caller			: self
			})
			self.list.render_list()
			.then(function(list_node){
				if (list_node) {
					rows_container.appendChild(list_node)
				}
			})
		})
	},//end load_list



	/**
	* LIST_ROW_BUILDER
	* Callback used by list_factory to build each row node
	* @param object row
	* @return HTMLElement
	*/
	list_row_builder : function(row){

		return archive.draw_item(row, { variant: 'search' })
	},//end list_row_builder



	/**
	* RENDER_BROWSE
	* Default landing state for '/documentation': the root's direct children
	* (funds) as large editorial cards
	*/
	render_browse : function() {

		const self = this

		page.add_spinner(self.browse_container)

		self.fetch_children(self.ROOT_TERM_ID).then(function(children){

			while (self.browse_container.hasChildNodes()) {
				self.browse_container.removeChild(self.browse_container.lastChild)
			}

			if (!children.length) {
				return
			}

			common.create_dom_element({
				element_type	: "h2",
				class_name		: "archive_browse_heading",
				text_content	: tstring.explore_the_archive || 'Explore the archive',
				parent			: self.browse_container
			})

			const grid = common.create_dom_element({
				element_type	: "div",
				class_name		: "archive_fund_grid",
				parent			: self.browse_container
			})

			children.forEach(function(fund_row){
				grid.appendChild( self.draw_item(fund_row, { variant: 'fund' }) )
			})
		})
	},//end render_browse



	/**
	* ANNOTATE_CHILD_COUNT
	* Fires a count-only request and fills in a fund card's item count once
	* it resolves, rather than blocking the whole card on it
	* @param string term_id
	* @param object target_el
	*/
	annotate_child_count : function(term_id, target_el) {

		data_manager.request({
			body : {
				dedalo_get	: 'records',
				table		: 'documentation',
				ar_fields	: ['term_id'],
				sql_filter	: 'parent_data LIKE \'%"' + term_id + '"%\'',
				limit		: 1,
				count		: true
			}
		})
		.then(function(api_response){

			const total = api_response.total || 0
			if (total>0) {
				target_el.textContent = total
				target_el.classList.add('is_ready')
			}else{
				target_el.remove()
			}
		})
	},//end annotate_child_count



	/**
	* LOAD_DETAIL
	* 'documentation' has no section_id column - term_id ('tch300_' + id) is the real key
	*/
	load_detail : function() {

		const self = this

		page.add_spinner(self.rows_container)

		self.get_rows({
			limit		: 1,
			offset		: 0,
			sql_filter	: "term_id='tch300_" + self.section_id + "'"
		})
		.then(function(response){
			self.render_detail(response.rows[0] || null)
		})
	},//end load_detail



	/**
	* GET_ROWS
	* Make a request to Dédalo public API to get "documentation" table records.
	* parent_data/parents_data are NOT in resolve_portals_custom - self-referential
	* portal resolution (a 'documentation' field resolving against 'documentation'
	* itself) always comes back empty, so ancestors are walked manually instead,
	* see resolve_ancestors
	* @return promise : {rows, total}
	*/
	get_rows : function(options) {

		const request_body = {
			dedalo_get	: 'records',
			table		: 'documentation',
			ar_fields	: ['*'],
			sql_filter	: options.sql_filter || null,
			limit		: options.limit,
			offset		: options.offset,
			count		:	 true,
			resolve_portals_custom : {
				own_bibliography_data		: 'bibliographic_references',
				related_bibliography_data	: 'bibliographic_references',
				publications_data			: 'publications',
				identifying_images_data	: 'images'
			}
		}

		return data_manager.request({
			body : request_body
		})
		.then(function(api_response){

			if (SHOW_DEBUG===true) {
				console.log("-> archive api_response:", api_response);
			}

			return {
				rows	: api_response.result || [],
				total	: api_response.total || 0
			}
		})
	},//end get_rows



	/**
	* DRAW_ITEM
	* Build one archive record card, linked to its detail page
	* @param object row
	* @param object options
	* @param string options.variant. 'fund' (browse view, with an async item
	*        count), 'child' (a record's own contents grid, opens in the same
	*        tab) or 'search' (default - result card)
	* @param string options.parent_title. 'child' only - see resolve_title
	* @param number options.ordinal. 'child' only - see resolve_title
	* @return HTMLElement
	*/
	draw_item : function(row, options) {

		const variant = (options && options.variant) || 'search'

		const id = row.term_id.split('_').pop()

		const item_wrapper = common.create_dom_element({
			element_type	: "div",
			class_name		: "archive_item"
				+ (variant==='fund' ? ' archive_item_fund' : '')
				+ (variant==='child' ? ' archive_item_child' : '')
		})

		const detail_url = page_globals.__WEB_ROOT_WEB__ + '/documentation/' + id

		// 'child' cards navigate same-tab (drilling in replaces the page);
		// other variants open a new tab so browsing/searching keeps its place
			const card_link = common.create_dom_element({
				element_type	: "a",
				class_name		: "row_wrapper",
				href			: detail_url,
				target			: variant==='child' ? null : "_blank",
				parent			: item_wrapper
			})
			if (variant!=='child') {
				card_link.setAttribute('rel', 'noopener')
			}

		// thumbnail, or a placeholder instead of an empty gap
			const image_wrapper = common.create_dom_element({
				element_type	: "div",
				class_name		: "image_wrapper",
				parent			: card_link
			})

			if (row.identifying_images && row.identifying_images.length>0) {

				const first_image	= row.identifying_images.split(' | ')[0]
				const full_url		= page_globals.__WEB_MEDIA_BASE_URL__ + first_image
				const thumb_url		= full_url.replace('/1.5MB/', '/thumb/')

				common.create_dom_element({
					element_type	: "img",
					class_name		: "image thumb",
					src				: thumb_url,
					title			: row.title || '',
					loading			: 'lazy',
					parent			: image_wrapper
				})

				const dating = [row.dating_start, row.dating_end].filter(Boolean).join(' - ') || row.dating
				if (dating) {
					common.create_dom_element({
						element_type	: "span",
						class_name		: "archive_card_dating",
						text_content	: dating,
						parent			: image_wrapper
					})
				}
			}else{
				common.create_dom_element({
					element_type	: "i",
					class_name		: "fa fa-archive archive_image_placeholder",
					parent			: image_wrapper
				})
			}

		const info_container = common.create_dom_element({
			element_type	: "div",
			class_name		: "info_container",
			parent			: card_link
		})

		// title . see resolve_title
			const display_title = this.resolve_title(row, options && options.parent_title, options && options.ordinal) || ('ID ' + id)
			common.create_dom_element({
				element_type	: "div",
				class_name		: "archive_title",
				text_content	: display_title,
				parent			: info_container
			})

		if (variant==='fund') {

			common.create_dom_element({
				element_type	: "span",
				class_name		: "archive_card_tag",
				text_content	: tstring.fund || 'Fund',
				parent			: info_container
			})

			const count_el = common.create_dom_element({
				element_type	: "span",
				class_name		: "archive_fund_count",
				parent			: info_container
			})
			this.annotate_child_count(row.term_id, count_el)

		}else{

			const tag = row.typology || row.name
			if (tag) {
				common.create_dom_element({
					element_type	: "span",
					class_name		: "archive_card_tag",
					text_content	: tag,
					parent			: info_container
				})
			}
		}

		if (dedalo_logged===true) {
			const link = common.create_dom_element({
				element_type	: "a",
				class_name		: "go_to_dedalo",
				text_content	: '#' + id,
				href			: '/dedalo/core/page/?tipo=' + row.section_tipo + '&id=' + id,
				parent			: item_wrapper
			})
			link.setAttribute('target', '_blank');
		}

		return item_wrapper
	},//end draw_item



	/**
	* RESOLVE_TITLE
	* Many records deep in the hierarchy just inherited their parent's title
	* verbatim (confirmed against the live data) - falls back to the row's
	* own 'name' field (what kind of object it is) plus its position among
	* siblings when that happens, so cards stay visually distinct
	* @param object row
	* @param string|null parent_title
	* @param number|null ordinal . this row's 1-based position among siblings
	* @return string|null
	*/
	resolve_title : function(row, parent_title, ordinal) {

		const title	= (row.title || '').trim()
		const parent	= (parent_title || '').trim()

		if (title && title.toLowerCase()!==parent.toLowerCase()) {
			return title
		}

		if (row.name) {
			return ordinal ? (row.name + ' ' + ordinal) : row.name
		}

		return null
	},//end resolve_title



	/**
	* RENDER_DETAIL
	* Full single-record view
	*/
	render_detail : function(row) {

		const container = this.rows_container

		while (container.hasChildNodes()) {
			container.removeChild(container.lastChild);
		}

		if (!row) {
			common.create_dom_element({
				element_type	: "p",
				class_name		: "archive_empty_state",
				inner_html		: '<i class="fa fa-archive"></i> ' + (tstring.no_results || 'This record does not exist.'),
				parent			: container
			})
			return
		}

		const id = row.term_id.split('_').pop()

		const row_wrapper = common.create_dom_element({
			element_type	: "div",
			class_name		: "row_wrapper detail",
			parent			: container
		})

		// nav placeholder . back link + breadcrumb, filled in below once
		// resolve_ancestors resolves
			const nav = common.create_dom_element({
				element_type	: "div",
				class_name		: "archive_detail_nav",
				parent			: row_wrapper
			})

		// images . all identifying images at full size, each captioned
			if (row.identifying_images_data && row.identifying_images_data.length>0) {

				const gallery = common.create_dom_element({
					element_type	: "div",
					class_name		: "image_wrapper gallery",
					parent			: row_wrapper
				})

				row.identifying_images_data.forEach(function(image_row){

					const figure = common.create_dom_element({
						element_type	: "figure",
						class_name		: "gallery_figure",
						parent			: gallery
					})

					common.create_dom_element({
						element_type	: "img",
						class_name		: "image gallery_image",
						src				: page_globals.__WEB_MEDIA_BASE_URL__ + image_row.image,
						title			: image_row.title || row.title || '',
						parent			: figure
					})

					const caption_text = [image_row.title, image_row.photographer].filter(Boolean).join(' — ')
					if (caption_text) {
						common.create_dom_element({
							element_type	: "figcaption",
							class_name		: "gallery_caption",
							text_content	: caption_text,
							parent			: figure
						})
					}
				})

			}else if (row.identifying_images && row.identifying_images.length>0) {

				// fallback, used if the images portal resolves empty
					const image_paths = row.identifying_images.split(' | ')

					const gallery = common.create_dom_element({
						element_type	: "div",
						class_name		: "image_wrapper gallery",
						parent			: row_wrapper
					})

					image_paths.forEach(function(image_path){
						common.create_dom_element({
							element_type	: "img",
							class_name		: "image gallery_image",
							src				: page_globals.__WEB_MEDIA_BASE_URL__ + image_path,
							title			: row.title || '',
							parent			: gallery
						})
					})
			}

		// title . corrected below once resolve_ancestors resolves the immediate parent
			const title_el = common.create_dom_element({
				element_type	: "div",
				class_name		: "archive_title",
				text_content	: this.resolve_title(row, null, null) || ('ID ' + id),
				parent			: row_wrapper
			})

		const info_container = common.create_dom_element({
			element_type	: "div",
			class_name		: "info_container",
			parent			: row_wrapper
		})

		if (dedalo_logged===true) {
			const link = common.create_dom_element({
				element_type	: "a",
				class_name		: "go_to_dedalo",
				text_content	: (tstring.edit || 'Edit') + ' #' + id,
				href			: '/dedalo/core/page/?tipo=' + row.section_tipo + '&id=' + id,
				parent			: info_container
			})
			link.setAttribute('target', '_blank');
		}

		this.draw_fields(info_container, row)

		this.add_field(info_container, tstring.recovery_mode || 'Recovery mode', row.recovery_mode)
		this.add_field(info_container, tstring.recovery_place || 'Recovery place', row.recovery_place)
		this.add_field(info_container, tstring.recovery_date || 'Recovery date', row.recovery_date)
		this.add_field(info_container, tstring.source || 'Source', [row.source_name, row.source_surname].filter(Boolean).join(' '))
		this.add_field(info_container, tstring.author || 'Author', row.author)
		this.add_field(info_container, tstring.manufacturer || 'Manufacturer', row.manufacturer)
		this.add_field(info_container, tstring.inscriptions || 'Inscriptions', row.inscriptions)

		this.draw_bibliography(info_container, tstring.own_bibliography || 'Own bibliography', row.own_bibliography_data)
		this.draw_bibliography(info_container, tstring.related_bibliography || 'Related bibliography', row.related_bibliography_data)

		this.draw_publications(info_container, row.publications_data)

		this.draw_contents(row_wrapper, row)

		// back link + breadcrumb + title correction, once the ancestor chain resolves
			const self = this
			self.resolve_ancestors(row.parent_data).then(function(ancestors){

				self.draw_back_link(nav, ancestors)
				self.draw_breadcrumb(nav, ancestors, row)

				const immediate_parent	= ancestors[ancestors.length-1]
				const corrected_title	= self.resolve_title(row, immediate_parent && immediate_parent.title, null)
				if (corrected_title) {
					title_el.textContent = corrected_title
				}
			})
	},//end render_detail



	/**
	* DRAW_FIELDS
	* Full label / value field list, detail view only
	* @param object info_container
	* @param object row
	*/
	draw_fields : function(info_container, row) {

		this.add_field(info_container, tstring.name || 'Name of the property', row.name)
		this.add_field(info_container, tstring.typology || 'Typology', row.typology)
		this.add_field(info_container, tstring.material || 'Material', row.material)
		this.add_field(info_container, tstring.technique || 'Technique', row.technique)
		this.add_field(info_container, tstring.collection || 'Collection', row.collection)
		this.add_field(info_container, tstring.fund || 'Fund', row.fund)

		const dating = [row.dating_start, row.dating_end].filter(Boolean).join(' - ') || row.dating
		this.add_field(info_container, tstring.dating || 'Dating', dating)

		this.add_field(info_container, tstring.municipality || 'Municipality', row.municipality)
		this.add_field(info_container, tstring.curator || 'Curator', row.curator)
		this.add_field(info_container, tstring.description || 'Description', row.description)
	},//end draw_fields



	/**
	* ADD_FIELD
	* Append a label/value pair to a container, skipping empty values
	*/
	add_field : function(container, label, value) {

		// strip Dédalo's leading/trailing "|" join artifact on multi-value term fields
			if (typeof value==='string') {
				value = value.replace(/^(\s*\|\s*)+/, '').replace(/(\s*\|\s*)+$/, '').trim()
			}

		if (!value || (typeof value==='string' && value.trim().length===0)) {
			return
		}

		common.create_dom_element({
			element_type	: "label",
			class_name		: "left-labels",
			text_content	: label,
			parent			: container
		})

		common.create_dom_element({
			element_type	: "span",
			class_name		: "rigth-values",
			inner_html		: value,
			parent			: container
		})
	},//end add_field



	/**
	* DRAW_BIBLIOGRAPHY
	* Render a resolved bibliographic_references portal, reusing the same
	* shared helper tpl/coin, tpl/mint, tpl/hoard and tpl/type use
	* @param object container
	* @param string label
	* @param array|null ar_biblio
	*/
	draw_bibliography : function(container, label, ar_biblio) {

		if (!ar_biblio || !ar_biblio.length) {
			return
		}

		common.create_dom_element({
			element_type	: "label",
			class_name		: "left-labels",
			text_content	: label,
			parent			: container
		})

		const bibliography_group = common.create_dom_element({
			element_type	: "div",
			class_name		: "vertical-group",
			parent			: container
		})

		for (let i = 0; i < ar_biblio.length; i++) {

			const biblio_row_node = biblio_row_fields.render_row_bibliography(ar_biblio[i])

			const biblio_row_wrapper = common.create_dom_element({
				element_type	: "div",
				class_name		: "rigth-values sub-vertical-group",
				parent			: bibliography_group
			})
			biblio_row_wrapper.appendChild(biblio_row_node)
		}
	},//end draw_bibliography



	/**
	* DRAW_PUBLICATIONS
	* Render a resolved 'publications' portal (different row shape than
	* bibliographic_references, so it gets a plain label/value line)
	* @param object container
	* @param array|null ar_publications
	*/
	draw_publications : function(container, ar_publications) {

		if (!ar_publications || !ar_publications.length) {
			return
		}

		common.create_dom_element({
			element_type	: "label",
			class_name		: "left-labels",
			text_content	: tstring.publications || 'Publications',
			parent			: container
		})

		const publications_group = common.create_dom_element({
			element_type	: "div",
			class_name		: "vertical-group",
			parent			: container
		})

		for (let i = 0; i < ar_publications.length; i++) {

			const publication	= ar_publications[i]
			const date			= publication.publication_date ? ' (' + publication.publication_date.split('-')[0] + ')' : ''
			const authors		= publication.authors ? publication.authors + '. ' : ''

			common.create_dom_element({
				element_type	: "div",
				class_name		: "rigth-values sub-vertical-group",
				inner_html		: authors + (publication.title || '') + date,
				parent			: publications_group
			})
		}
	},//end draw_publications



	/**
	* RESOLVE_ANCESTORS
	* Walks the ancestor chain by hand (get_rows can't resolve parent_data
	* server-side - see get_rows): fetch the immediate parent's own row,
	* then repeat using its parent_data, until there isn't one left
	* @param string|null parent_data . the starting row's own raw parent_data
	* @return promise : array of {term_id, title, name}, root-to-immediate-parent
	*/
	resolve_ancestors : function(parent_data) {

		const self = this

		function step(raw_parent_data) {

			let parent_ids = []
			try { parent_ids = JSON.parse(raw_parent_data || '[]') } catch(e){ /* malformed, treat as root */ }

			if (!parent_ids.length) {
				return Promise.resolve([])
			}

			return self.get_rows({
				limit		: 1,
				offset		: 0,
				sql_filter	: "term_id='" + parent_ids[0] + "'"
			})
			.then(function(response){

				const parent_row = response.rows[0]
				if (!parent_row) {
					return []
				}

				// resolve everything above this parent first, so its own title
				// can be checked against ITS parent (see resolve_title)
					return step(parent_row.parent_data).then(function(higher_ancestors){

						const grandparent = higher_ancestors[higher_ancestors.length-1]

						higher_ancestors.push({
							term_id	: parent_row.term_id,
							title	: self.resolve_title(parent_row, grandparent && grandparent.title, null) || parent_row.title,
							name	: parent_row.name
						})
						return higher_ancestors
					})
			})
		}

		return step(parent_data)
	},//end resolve_ancestors



	/**
	* DRAW_BACK_LINK
	* A single "go back" step to the immediate parent. At the root (no
	* ancestors) it goes to the browse landing instead
	* @param object nav
	* @param array ancestors . root-to-immediate-parent, see resolve_ancestors
	*/
	draw_back_link : function(nav, ancestors) {

		const immediate_parent = ancestors[ancestors.length-1]

		const href = immediate_parent
			? page_globals.__WEB_ROOT_WEB__ + '/documentation/' + immediate_parent.term_id.split('_').pop()
			: page_globals.__WEB_ROOT_WEB__ + '/documentation'

		const label = immediate_parent
			? immediate_parent.title
			: (tstring.browse_archive || 'Browse archive')

		common.create_dom_element({
			element_type	: "a",
			class_name		: "archive_back_link",
			inner_html		: '<i class="fa fa-arrow-left"></i> ' + (tstring.back || 'Back') + ': ' + label,
			href			: href,
			parent			: nav
		})
	},//end draw_back_link



	/**
	* DRAW_BREADCRUMB
	* Render the record's full ancestor chain, already resolved
	* root-to-immediate-parent by resolve_ancestors
	* @param object nav
	* @param array ancestors
	* @param object row . the current page's own record, for its own label
	*/
	draw_breadcrumb : function(nav, ancestors, row) {

		if (!ancestors.length) {
			return
		}

		const breadcrumb = common.create_dom_element({
			element_type	: "nav",
			class_name		: "archive_breadcrumb",
			parent			: nav
		})

		common.create_dom_element({
			element_type	: "i",
			class_name		: "fa fa-archive archive_breadcrumb_icon",
			parent			: breadcrumb
		})

		ancestors.forEach(function(ancestor){

			const ancestor_id = ancestor.term_id.split('_').pop()

			common.create_dom_element({
				element_type	: "a",
				class_name		: "archive_breadcrumb_link",
				text_content	: ancestor.title,
				href			: page_globals.__WEB_ROOT_WEB__ + '/documentation/' + ancestor_id,
				parent			: breadcrumb
			})

			common.create_dom_element({
				element_type	: "i",
				class_name		: "fa fa-angle-right archive_breadcrumb_separator",
				parent			: breadcrumb
			})
		})

		const immediate_parent = ancestors[ancestors.length-1]
		common.create_dom_element({
			element_type	: "span",
			class_name		: "archive_breadcrumb_current",
			text_content	: this.resolve_title(row, immediate_parent && immediate_parent.title, null) || '',
			parent			: breadcrumb
		})
	},//end draw_breadcrumb



	/**
	* FETCH_CHILDREN
	* Records whose parent_data points back at term_id - the only way to
	* find a record's "children". limit:500 covers the largest group found
	* in the live data so far (298)
	* @param string term_id
	* @return promise : array of rows
	*/
	fetch_children : function(term_id) {

		return data_manager.request({
			body : {
				dedalo_get	: 'records',
				table		: 'documentation',
				ar_fields	: ['*'],
				sql_filter	: 'parent_data LIKE \'%"' + term_id + '"%\'',
				limit		: 500
			}
		})
		.then(function(api_response){
			return api_response.result || []
		})
	},//end fetch_children



	/**
	* DRAW_CONTENTS
	* This record's direct children as a plain grid of cards, each linking
	* to that child's own page (which has its own contents grid in turn).
	* Past a handful of children, a live search box also filters the grid
	* @param object row_wrapper
	* @param object row
	*/
	draw_contents : function(row_wrapper, row) {

		const self = this

		self.fetch_children(row.term_id).then(function(children){

			if (!children.length) {
				return
			}

			const section = common.create_dom_element({
				element_type	: "div",
				class_name		: "archive_contents_section",
				parent			: row_wrapper
			})

			common.create_dom_element({
				element_type	: "h3",
				class_name		: "archive_contents_title",
				inner_html		: '<i class="fa fa-folder-open"></i> ' + (tstring.contents || 'Contents') + ' (' + children.length + ')',
				parent			: section
			})

			let filter_input = null
			if (children.length>12) {
				filter_input = common.create_dom_element({
					element_type	: "input",
					type			: "text",
					class_name		: "archive_contents_filter",
					placeholder		: tstring.search_contents || 'Search within these items...',
					parent			: section
				})
			}

			const grid = common.create_dom_element({
				element_type	: "div",
				class_name		: "archive_contents_grid",
				parent			: section
			})

			const empty_state = common.create_dom_element({
				element_type	: "p",
				class_name		: "archive_empty_state hide",
				inner_html		: '<i class="fa fa-search"></i> ' + (tstring.no_results || 'No records found.'),
				parent			: section
			})

			const entries = children.map(function(child_row, index){

				const display_title	= self.resolve_title(child_row, row.title, index+1) || ''
				const search_text		= [display_title, child_row.name, child_row.typology].filter(Boolean).join(' ').toLowerCase()

				const card = self.draw_item(child_row, {
					variant			: 'child',
					parent_title	: row.title,
					ordinal			: index+1
				})
				grid.appendChild(card)

				return { card: card, search_text: search_text }
			})

			if (filter_input) {
				filter_input.addEventListener('input', function(){

					const query		= filter_input.value.trim().toLowerCase()
					let visible_count	= 0

					entries.forEach(function(entry){
						const match = !query || entry.search_text.indexOf(query)>-1
						entry.card.classList.toggle('hide', !match)
						if (match) {
							visible_count++
						}
					})

					empty_state.classList.toggle('hide', visible_count>0)
				})
			}
		})
	}//end draw_contents


}//end archive
