/*global tstring, page_globals, common, Promise, event_manager, data_manager, WEB_AREA, __WEB_TEMPLATE_WEB__, psqo_factory, page */
/*eslint no-undef: "error"*/

"use strict";

/**
* COMMON DATA RENDERS
* prototypes page
*/



/**
* RENDER_MAP_LEGEND
* Unified way to build
*/
page.render_map_legend = function(){

	// map_legend
	const map_legend = common.create_dom_element({
		element_type	: "div",
		class_name		: "map_legend"
	})
	common.create_dom_element({
		element_type	: "div",
		class_name		: "legend_item",
		inner_html		: tstring.mint + '<img src="'+page.maps_config.markers.mint.iconUrl+'"/>',
		parent			: map_legend
	})
	common.create_dom_element({
		element_type	: "div",
		class_name		: "legend_item",
		inner_html		: tstring.hoard + '<img src="'+page.maps_config.markers.hoard.iconUrl+'"/>',
		parent			: map_legend
	})
	common.create_dom_element({
		element_type	: "div",
		class_name		: "legend_item",
		inner_html		: tstring.findspot + '<img src="'+page.maps_config.markers.findspot.iconUrl+'"/>',
		parent			: map_legend
	})


	return map_legend
}//end render_map_legend



/**
* RENDER_EXPORT_DATA_BUTTONS
* @return DocumentFragment
*/
page.render_export_data_buttons = function() {

	// vars filled on event publish options
		let request_body
		let result
		let export_data_parser
		let filter
		let uri

	// unrestricted request to db
		function get_data() {

			const data_object = {
				info		: "WARNING! This is a draft version data. Please do not use it in production",
				source_org	: "Numisdata",
				source_url	: page_globals.__WEB_BASE_URL__, // Like: "https://monedaiberica.org"
				lang		: page_globals.WEB_CURRENT_LANG_CODE,
				date		: common.get_today_date()
			}

			return new Promise(function(resolve){

				// result or request_body are invalid
					if (!request_body) {

						if (result) {
							setTimeout(function(){
								resolve(result)
							}, 1000)
							return
						}else{
							console.warn("Invalid result or request_body:", request_body);
							resolve(false)
							return
						}
					}

				// if result is not limited, we can use directly
					// if (request_body.limit==0) {
					// 	// parsed rows
					// 	data_object.data = page.export_parse_catalog_data(rows)
					// 	resolve(data_object)
					// }

				// get new request without limit
					request_body.limit = 0
					request_body.resolve_portals_custom = null
					data_manager.request({
						body : request_body
					})
					.then(function(api_response){
						resolve(api_response.result)
					})
			})
			.then(function(rows){

				// data_object.data. parsed rows is optional
				data_object.data = (export_data_parser && typeof export_data_parser==='function')
					? export_data_parser(rows)
					: rows

				return data_object
			})
		}//end get_data function

	// event data_request_done is triggered when new search is done
		event_manager.subscribe('data_request_done', manage_data_request_done)
		function manage_data_request_done(options) {

			// fill vars values
				request_body		= options.request_body
				result				= options.result
				export_data_parser	= options.export_data_parser || null
				filter 				= options.filter

			//export_nomisma_rdf check
				const exists_nomisma_rdf = result && (result.nomisma_rdf || result[0]?.nomisma_rdf)
				if (exists_nomisma_rdf) {
					button_export_nomisma_rdf_container.classList.remove('hide')
				}else{
					button_export_nomisma_rdf_container.classList.add('hide')
				}
		}


	const fragment = new DocumentFragment()

	// button_share_search now only in catalog
		if(WEB_AREA === 'catalog'){
			const button_share_search_container = common.create_dom_element({
				element_type	: "div",
				class_name		: "export_container",
				parent			: fragment
			})
			const button_share_search = common.create_dom_element({
				element_type	: "input",
				type			: "button",
				value			: tstring.share_search || 'Share search',
				class_name		: "btn primary button_download share_search",
				parent			: button_share_search_container
			})
			button_share_search.addEventListener("click", function(){

				const button = this

				// minimize psqo
				const min_psqo = psqo_factory.build_safe_psqo(filter)

				// Shared wrapper
					const shared_wrapper = common.create_dom_element({
						element_type	: "div",
						class_name		: "shared_wrapper",
						parent			: document.body
					})
					shared_wrapper.addEventListener("click", function(e){
						shared_wrapper.remove()
					})
				// Shared container
					const shared_container = common.create_dom_element({
						element_type	: "div",
						class_name		: "shared_container",
						parent			: shared_wrapper
					})
					shared_container.addEventListener("click", function(e){
						e.stopPropagation()
					})
				// Shared JSON
					const shared_json = common.create_dom_element({
						element_type	: "div",
						class_name		: "shared_json",
						text_content	: JSON.stringify(min_psqo, null, 2),
						parent			: shared_container
					})
				// Shared URI encoded

					// encode psqo to safe use it in url
					const encoded_psqo	= psqo_factory.encode_psqo(min_psqo)
					uri					= window.location.protocol + '//'+
										  window.location.host+
										  page_globals.__WEB_ROOT_WEB__+
										  '/' +WEB_AREA+
										  '/?psqo=' + encoded_psqo;

					const shared_uri_encoded = common.create_dom_element({
						element_type	: "div",
						class_name		: "shared_uri_encoded",
						parent			: shared_container
					})
					const uri_node = common.create_dom_element({
						element_type	: "span",
						text_content	: uri,
						title			: uri.length,
						parent			: shared_uri_encoded
					})
					const link = common.create_dom_element({
						element_type	: "a",
						href			: uri,
						inner_html		: tstring.search || 'Search',
						target			: '_blank',
						parent			: shared_uri_encoded
					})
			})
		}

	// button_export_json
		const button_export_json_container = common.create_dom_element({
			element_type	: "div",
			class_name		: "export_container",
			parent			: fragment
		})
		const button_export_json = common.create_dom_element({
			element_type	: "input",
			type			: "button",
			value			: tstring.export_json || 'Export JSON',
			class_name		: "btn primary button_download json",
			parent			: button_export_json_container
		})
		button_export_json.addEventListener("click", function(e){
			e.stopPropagation()

			const button = this

			// spinner on
				button.classList.add("unactive")
				const spinner = common.create_dom_element({
					element_type	: "div",
					class_name		: "spinner small",
					parent			: button_export_json_container
				})

			get_data().then(function(data){

				const file_name	= 'mib_export_data.json'

				// Blob data
					const blob_data = new Blob([JSON.stringify(data, null, 2)], {
						type	: 'application/json',
						name	: file_name
					});

				// create a temporal a node and trigger click
					const href		= URL.createObjectURL(blob_data)
					const link_obj	= common.create_dom_element({
						element_type	: "a",
						href			: href,
						download		: file_name
					})
					link_obj.click()

				// destroy temporal node
					link_obj.remove()

				// spinner of
					spinner.remove()
					button.classList.remove("unactive")
			})
		})

	// button_export_csv
		const button_export_csv_container = common.create_dom_element({
			element_type	: "div",
			class_name		: "export_container",
			parent			: fragment
		})
		const button_export_csv = common.create_dom_element({
			element_type	: "input",
			type			: "button",
			value			: tstring.export_csv || 'Export CSV',
			class_name		: "btn primary button_download csv",
			parent			: button_export_csv_container
		})
		button_export_csv.addEventListener("click", function(){

			const button = this

			// spinner on
				button.classList.add("unactive")
				const spinner = common.create_dom_element({
					element_type	: "div",
					class_name		: "spinner small",
					parent			: button_export_csv_container
				})

			get_data().then(function(data){

				const file_name	= 'mib_export_data.csv'

				// Convert JSON obj to csv
					const csv = page.convert_json_to_csv(data.data)

				// Blob data
					const blob_data = new Blob([csv], {
						type	: 'text/csv',
						name	: file_name
					});

				// create a temporal a node and trigger click
					const href		= URL.createObjectURL(blob_data)
					const link_obj	= common.create_dom_element({
						element_type	: "a",
						href			: href,
						download		: file_name
					})
					link_obj.click()

				// destroy temporal node
					link_obj.remove()

				// spinner of
					spinner.remove()
					button.classList.remove("unactive")
			})
		})

	// button_export_nomisma_rdf
		const button_export_nomisma_rdf_container = common.create_dom_element({
			element_type	: "div",
			class_name		: "export_container hide", // default is hidden. Activated on manage_data_request_done event check
			parent			: fragment
		})
		const button_export_nomisma_rdf = common.create_dom_element({
			element_type	: "input",
			type			: "button",
			value			: tstring.export_nomisma_rdf || 'Nomisma RDF',
			class_name		: "btn primary button_download rdf",
			parent			: button_export_nomisma_rdf_container
		})
		button_export_nomisma_rdf.addEventListener("click", function(e){
			e.stopPropagation()

			const button = this

			// spinner on
				button.classList.add("unactive")
				const spinner = common.create_dom_element({
					element_type	: "div",
					class_name		: "spinner small",
					parent			: button_export_nomisma_rdf_container
				})

			// row
				const nomisma_rdf = Array.isArray(result)
					? result[0].nomisma_rdf
					: (result.nomisma_rdf || null)
					if (!nomisma_rdf) {
						alert("Error. Invalid RDF data");
						return
					}

			// file_name
				const file_name	= 'mib_export_data_nomisma.rdf'

			// Blob data
				const blob_data = new Blob([nomisma_rdf], {
					type	: 'text/plain',
					name	: file_name
				});

			// create a temporal a node and trigger click
				const href		= URL.createObjectURL(blob_data)
				const link_obj	= common.create_dom_element({
					element_type	: "a",
					href			: href,
					download		: file_name
				})
				link_obj.click()

			// destroy temporal node
				link_obj.remove()

			// spinner of
				spinner.remove()
				button.classList.remove("unactive")
		})


	return fragment
}//end render_export_data_buttons



/**
* CREATE_SUGGESTIONS_BUTTON
* @return DocumentFragment
*/
page.create_suggestions_button = function(){

	let currentUrl = "";

	const fragment = new DocumentFragment()

	const button_form_container = common.create_dom_element({
		element_type	: "div",
		class_name		: "form_button_container",
		parent			: fragment
	})

	// button_form
	common.create_dom_element({
		element_type	: "input",
		type			: "button",
		value			: tstring.suggest_error || 'Suggestions / errors',
		class_name		: "btn primary button_contact",
		parent			: button_form_container
	})

	//get search url
	// event data_request_done is triggered when new search is done
	event_manager.subscribe('data_request_done', manage_data_request_done)

	function manage_data_request_done(options) {

		const filter = options.filter

		if (filter != null){
			const min_psqo = psqo_factory.build_safe_psqo(filter)
			const encoded_psqo	= psqo_factory.encode_psqo(min_psqo)
			currentUrl			= window.location.protocol + '//'+
							  window.location.host+
							  page_globals.__WEB_ROOT_WEB__+
							  '/' +WEB_AREA+
							  '/?psqo=' + encoded_psqo;
		}

	}


	const form = createForm()

	button_form_container.addEventListener("click", function(){
		document.querySelector('body').appendChild(form)
		document.querySelector(".cancel-button").addEventListener("click",page.removeForm)
	})

	function createForm(){

		const formTitle_label = tstring.contact_form || 'Contact form'
		const submitButton_Label = tstring.submit || 'Submit'
		const cancelButton_Label = tstring.cancel || 'Cancel'
		const name_Label = (tstring.name || 'Name')+":"
		const email_Label = (tstring.email || 'Email')+":"
		const message_Label = (tstring.message || 'Message')+":"

		const popUpContainer = common.create_dom_element({
			element_type	: "div",
			id				: "popup-container"
		})

		const form_container = common.create_dom_element({
			element_type	: "div",
			class_name		: "form_container",
			parent			: popUpContainer
		})

		common.create_dom_element({
			element_type 	: "h2",
			class_name 		: "form-title",
			text_content 	: formTitle_label,
			parent			: form_container
		})

		common.create_dom_element({
			element_type 	: "h3",
			class_name 		: "form-title",
			text_content 	: tstring.suggest_error || 'Suggestions / errors',
			parent			: form_container
		})

		const formAction = ' onsubmit ="page.sendForm()" ' //Whats happend when send button is clicked

		let form = document.createRange().createContextualFragment('<form id="contact-form"></form>')

		const fname = document.createRange().createContextualFragment('<label for="fname">'+name_Label+'</label><input type="text" id="fname" name="fname" value="" required>')

		const fmail = document.createRange().createContextualFragment('<label for="fmail">'+email_Label+'</label><input type="email" id="fmail" name="fmail" value="" required>')

		const fmessage = document.createRange().createContextualFragment('<label for="fmessage">'+message_Label+'</label><textarea id="fmessage" name="message" required></textarea>')

		const form_button = document.createRange().createContextualFragment('<input class="send-button" type="submit" value="'+submitButton_Label+'">')

		const cancel_button = document.createRange().createContextualFragment('<input class="cancel-button" type="button" value="'+cancelButton_Label+'">')

		const error_msn = document.createRange().createContextualFragment('<p id="error-msn"></p>')


		form.firstElementChild.addEventListener('submit',function(event){
			event.preventDefault()
			page.handleForm(currentUrl)

		})

		form.firstElementChild.appendChild(fname)
		form.firstElementChild.appendChild(fmail)
		form.firstElementChild.appendChild(fmessage)
		form.firstElementChild.appendChild(error_msn)
		form.firstElementChild.appendChild(form_button)
		form.firstElementChild.appendChild(cancel_button)
		form_container.appendChild(form)

		return popUpContainer
	}//end createForm

	return fragment
}



page.removeForm = function(){
	document.querySelector(".cancel-button").removeEventListener("click",page.removeForm)
	document.querySelector("#popup-container").remove()
}



page.handleForm = function(currentUrl){
	//event.preventDefault()
	document.querySelector('#error-msn').textContent = ""
	const currentForm = document.querySelector('#contact-form')
	// currentForm.reset()

	// short vars
		const today		= new Date().toUTCString()
		const name		= currentForm.querySelector('#fname').value
		const email		= currentForm.querySelector('#fmail').value
		const message	= currentForm.querySelector('#fmessage').value

	let url = window.location.href
	if (currentUrl != null && currentUrl.length>0){
		url = currentUrl
	}
	// row data
		const body = {
			mail : {
				subject	: `${name} '${email}' NUMISDATA [${today}]`,
				message	: message
			},
			data : {
				name		: name,
				email		: email,
				message		: message,
				lang		: page_globals.WEB_CURRENT_LANG_CODE,
				web_url		: url,
				date		: today
			}
		}

	// request
		return new Promise(function(resolve){

			const success_msn	= "Mensaje enviado correctamente, gracias."
			const error_msn		= "Ha ocurrido un error. Por favor, prueba más tarde."

			data_manager.request({
				url		: __WEB_TEMPLATE_WEB__ + '/assets/lib/sendmail/send.php',
				body	: body
			})
			.then((api_response)=>{
				if(SHOW_DEBUG===true) {
					console.log("--- sendmail api_response:", api_response);
				}
				if (api_response.result){
					alert (success_msn)
					currentForm.reset()
					page.removeForm();

				} else {
					document.querySelector('#error-msn').textContent = error_msn
				}
			})
		})
}//end handleForm



/**
* RENDER_LEGEND
* Generic unified legend render
* @return promise : DOM node
*/
page.render_legend = function(options) {

	const self = this

	// options
		const value = options.value || ''
		const style = options.style || 'median'

	// convert text nodes into span nodes
		// const regex = / /g;
		// const parsed_node = document.createElement("div")
		// 	  parsed_node.innerHTML	= value

		// const textNodes = Array.from(parsed_node.childNodes).filter(node => node.nodeType===3 && node.textContent.trim().length > 0)

		// textNodes.forEach(node => {
		// 	// node.textContent = node.textContent.replace(regex, '&nbsp;')
		// 	const span = document.createElement('span');
		// 	node.after(span);
		// 	span.appendChild(node);
		// });

	const legend_node = common.create_dom_element({
		element_type	: "div",
		class_name		: "legend_box " + style,
		inner_html		: value.trim()
	})
	// while (parsed_node.hasChildNodes()) {
	// 	legend_node.appendChild(parsed_node.firstChild);
	// }


	return legend_node
}//end render_legend



/**
* RENDER_TYPE_LABEL
* @param object row
* @return string current_value
*/
page.render_type_label = function(row) {

	let current_value

	const mint_number = (row.ref_mint_number)
		? row.ref_mint_number // +'/'
		: ''
	if (row.term_section_id && !row.children) {

		const ar		= row.term.split(", ")
		const c_name	= ar[0]
		const keyword	= (typeof ar[1]==="undefined")
			? ''
			: (function(){
				const clean = []
				for (let i = 1; i < ar.length; i++) {
					clean.push(ar[i])
				}
				return '<span class="keyword">, ' + clean.join(", ").trim() + '</span>'
			})()

		const section_id = row.term_section_id && row.term_section_id.section_id
			? row.term_section_id.section_id
			: row.term_section_id

		const type_string = page.compose_catalog_id({
			archive		: page_globals.OWN_CATALOG_ACRONYM,
			section_id	: section_id,
			mint_number	: mint_number,
			type		: c_name
		})

		const title = page.compose_catalog_id({
			archive		: page_globals.OWN_CATALOG_ACRONYM,
			section_id	: section_id,
			mint_number	: mint_number,
			type		: ar.join(", ").trim()
		})

		const a_term = common.create_dom_element({
			element_type	: "a",
			class_name		: "a_term",
			href			: page_globals.__WEB_ROOT_WEB__ + '/type/' + section_id,
			target			: "_blank",
			// title		: page_globals.OWN_CATALOG_ACRONYM + " " + mint_number + c_name + (ar.join(", ").trim()),
			title			: title,
			// inner_html	: page_globals.OWN_CATALOG_ACRONYM + " " + mint_number + c_name + keyword
			inner_html		: type_string + keyword
		})
		current_value = a_term.outerHTML
	}else{

		const type_string = page.compose_catalog_id({
			archive		: page_globals.OWN_CATALOG_ACRONYM,
			section_id	: row.term_section_id,
			mint_number	: mint_number,
			type		: row.term
		})

		current_value = type_string
	}


	return current_value
}//end render_type_label



/**
* RENDER_WEIGHT_VALUE
* @param object row
* @return string
*/
page.render_weight_value = function(row) {

	const weight = row.ref_type_averages_weight.toFixed(2).replace(/\.?0+$/, "");
	return weight.replace('.',',') + ' g'
}//end render_weight_value



/**
* RENDER_DIAMETER_VALUE
* @param object row
* @return string
*/
page.render_diameter_value = function(row) {

	const diameter = row.ref_type_averages_diameter.toFixed(2).replace(/\.?0+$/, "");
	return diameter.replace('.',',') + ' mm'
}//end render_diameter_value



/**
* RENDER_CITE_RECORD
* Renders cite nodes and append it to container
* @param object row
* @param HTMLElement container
* @return HTMLElement cite
*/
page.render_cite_record = async (row, container, title) => {

	const click_handler = async function(e) {
		e.stopPropagation()

		// cite_data_node
			const main_catalog_data	= await page.load_main_catalog()
			const cite_data			= main_catalog_data.result[0];
			const publication_data	= cite_data.publication_data[0];
			cite_data.autors				= {
				authorship_data		: row.authorship_data || null,
				authorship_names	: row.authorship_names || null,
				authorship_surnames	: row.authorship_surnames || null,
				authorship_roles	: row.authorship_roles || null,
			}
			cite_data.catalog			= null
			cite_data.title				= title || row.name || 'Untitled'
			cite_data.publication_data	= publication_data
			cite_data.uri_location		= window.location

		// render cite. Note that is rendered using 'biblio_row_fields'
			const cite_data_node = biblio_row_fields.render_cite_this(cite_data)

		// popUpContainer
			const popUpContainer = common.create_dom_element({
				element_type	: "div",
				class_name		: "float-cite",
				parent			: document.body
			})
			popUpContainer.addEventListener('mouseup', function() {

				popUpContainer.classList.add('copy')
				cite_data_node.classList.add('copy')

				const selection = window.getSelection();
				//create a selection range
				const copy_range = document.createRange();
				//choose the element we want to select the text of
				copy_range.selectNodeContents(cite_data_node);
				//select the text inside the range
				selection.removeAllRanges();
   				selection.addRange( copy_range );

   				//copy the text to the clipboard
				document.execCommand("copy");

				//remove our selection range
				window.getSelection().removeAllRanges();
			})

		// title
			common.create_dom_element({
				element_type	: "div",
				class_name		: "float-label",
				text_content	: tstring.cite_this_record || 'Cite this record',
				parent			: popUpContainer
			})

		// close button
		const close_button = common.create_dom_element({
			element_type	: "div",
			class_name		: "close-button",
			parent			: popUpContainer
		})
		close_button.addEventListener("click",function(){
			// popUpContainer.remove()
		})
		document.body.addEventListener("click",function(event_cite){
			document.body.removeEventListener("click", function(event_cite){})
			popUpContainer.remove()
		})

		popUpContainer.appendChild(cite_data_node)

		const click_to_copy = common.create_dom_element({
			element_type	: "div",
			class_name		: "float-text_copy",
			text_content	: tstring.click_to_copy || 'Click to copy',
			parent			: popUpContainer
		})
	}

	// cite span button
	const cite = common.create_dom_element({
		element_type	: 'span',
		class_name		: 'cite_this_record',
		text_content	: tstring.cite_this_record || 'cite this record',
		parent			: container
	})
	cite.addEventListener('click', click_handler)


	return cite
}//end render_cite_record



/**
* RENDER_AUTHORSHIP
* Renders row authorship info and append it to container
* @param object row
* 	Database record parsed
* @param HTMLElement container
* 	Target node where place the result nodes
* @return void
*/
page.render_authorship = async (row, container) => {

	const ar_names = row.authorship_names
		? row.authorship_names.split('|')
		: []

	const ar_surnames = row.authorship_surnames
		? row.authorship_surnames.split('|')
		: []

	const ar_roles = row.authorship_roles
		? row.authorship_roles.split('|')
		: []

	const authorship_length = ar_names.length
	for (let i = 0; i < authorship_length; i++) {

		const authorship_value_parts = []

		// name
			const name_parts = []

			if (ar_names[i]) {
				name_parts.push(ar_names[i].trim().toUpperCase())
			}

			if (ar_surnames[i]) {
				name_parts.push(ar_surnames[i].trim().toUpperCase())
			}

		// full name add
			authorship_value_parts.push(
				name_parts.join(' ')
			)

		// role add
			if (ar_roles[i]) {
				authorship_value_parts.push( ar_roles[i].trim() )
			}

		const authorship_value = authorship_value_parts.join(' | ')

		common.create_dom_element({
			element_type	: 'div',
			class_name		: 'authorship item',
			text_content	: authorship_value,
			parent			: container
		})
	}
}//end render_authorship
