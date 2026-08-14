/*global catalog, DocumentFragment */
/*eslint no-undef: "error"*/
/*jshint esversion: 6 */
"use strict";


var mint_row = {



	/**
	* RENDER_TYPE_PRINT
	*
	* @param array ar_rows
	* 	type rows list
	* @return DocumentFragment
	*/
	render_type_print : async function (ar_rows) {

		const fragment = new DocumentFragment();

		// set catalog properties temporally
		catalog.print_mode = true

		const node = await catalog.draw_rows({
			ar_rows	: ar_rows,
			target	: fragment
		})

		// set catalog properties temporally
		catalog.print_mode = false

		return fragment
	}//end render_type_print



}//end mint_row
