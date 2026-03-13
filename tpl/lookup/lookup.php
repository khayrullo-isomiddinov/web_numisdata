<?php declare(strict_types=1);

// lookup

	// css
		page::$css_ar_url[] = __WEB_TEMPLATE_WEB__ . '/lookup/css/lookup.css';

	// js
		page::$js_ar_url[] = __WEB_TEMPLATE_WEB__ . '/lookup/js/lookup'.JS_SUFFIX.'.js';


	// page basic vars
		$title 			= $this->get_element_from_template_map('title', $template_map->{$mode});
		$abstract  		= $this->get_element_from_template_map('abstract', $template_map->{$mode});
		$body  			= $this->get_element_from_template_map('body', $template_map->{$mode});
