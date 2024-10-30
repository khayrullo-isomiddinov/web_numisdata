<?php

// term

	// css
		// page::$css_ar_url[] = __WEB_TEMPLATE_WEB__ . '/assets/lib/jquery-ui/jquery-ui.min.css';

	// js
		page::$js_ar_url[] = __WEB_TEMPLATE_WEB__ . '/catalog/js/catalog'.JS_SUFFIX.'.js';
		page::$js_ar_url[] = __WEB_TEMPLATE_WEB__ . '/catalog/js/catalog_row_fields'.JS_SUFFIX.'.js';
		page::$js_ar_url[] = __WEB_TEMPLATE_WEB__ . '/type/js/type_row_fields'.JS_SUFFIX.'.js';

		page::$js_ar_url[] = __WEB_TEMPLATE_WEB__ . '/term/js/term_row'.JS_SUFFIX.'.js';
		page::$js_ar_url[] = __WEB_TEMPLATE_WEB__ . '/thesaurus/js/thesaurus'.JS_SUFFIX.'.js';
		page::$js_ar_url[] = __WEB_TEMPLATE_WEB__ . '/thesaurus/js/render_thesaurus'.JS_SUFFIX.'.js';
		page::$js_ar_url[] = __WEB_TEMPLATE_WEB__ . '/thesaurus/js/render_thesaurus_links'.JS_SUFFIX.'.js';

	// area name
		$area_name	= $_GET['area_name'];
		$ar_parts	= explode('/', $area_name);

	// section_id (is inside get var 'area_name' as '/term/sccmk1_102')
		$term_id		= $ar_parts[1] ?? '';
		$term_parts		= explode('_', $term_id);
		$section_tipo	= $term_parts[0] ?? null;
		$section_id		= isset($term_parts[1]) ? (int)$term_parts[1] : null;

	// page basic vars
		$title		= $this->get_element_from_template_map('title', $template_map->{$mode});
		$abstract	= $this->get_element_from_template_map('abstract', $template_map->{$mode});
		$body		= $this->get_element_from_template_map('body', $template_map->{$mode});
		$ar_image	= $this->get_element_from_template_map('image', $template_map->{$mode});
