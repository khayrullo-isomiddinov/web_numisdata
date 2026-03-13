/**
 * CLASS DESCRIPTION
 * JS logic to redirect the user to the correct resource page.
 */
const lookup = {
	type_map: {
		'icon'	: 'ts/icon1_',
		'cmk'	: 'ts/sccmk1_',
		'greek'	: 'ts/scell1_',
		'latin'	: 'ts/sclat1_',
		'punic'	: 'ts/scxpu1_',
		'ibo'	: 'ts/scxibo1_',
		'ibm'	: 'ts/scxibm1_',
		'txr'	: 'ts/sctxr1_'
	},

	set_up: function(options) {
		if (!options.form) return;

		options.form.addEventListener('submit', (e) => {
			e.preventDefault();

			const type_raw = options.select.value;
			const id = options.input.value.trim();

			if (!type_raw) {
				const error_msg = (typeof tstring !== 'undefined' && tstring['lookup_error_no_type']) ? tstring['lookup_error_no_type'] : 'Please select a resource type';
				alert(error_msg);
				options.select.focus();
				return;
			}

			if (type_raw && id) {

				// Resolve type from map if exists
				const type = this.type_map[type_raw] || type_raw;

				// Base URL logic. Typically MIB resolves paths from root as in /mint/2
				// or /ts/icon1_256 (for types ending in _)
				let path = type.endsWith('_') ? type + id : type + '/' + id;
				let url = '';

				if (typeof page_globals !== 'undefined' && page_globals.__WEB_ROOT_WEB__) {
					url = page_globals.__WEB_ROOT_WEB__ + '/' + path;
				} else {
					url = '/' + path;
				}

				window.location.href = url;
			}
		});

		// Auto selection from URL param 'type' (e.g. lookup?type=mint)
		const urlParams = new URLSearchParams(window.location.search);
		const typeParam = urlParams.get('type');
		if (typeParam && options.select) {
			// Find option with matching value
			const option = Array.from(options.select.options).find(opt => opt.value === typeParam);
			if (option) {
				options.select.value = typeParam;
			}
		}

		// Auto focus input
		if (options.input) {
			options.input.focus();
		}
	}
};
