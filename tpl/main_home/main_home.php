<?php

// main_home
	// page::$css_ar_url[] = __WEB_TEMPLATE_WEB__ . '/assets/ans/ans.css';


	// page basic vars
		$title		= $this->get_element_from_template_map('title', $template_map->{$mode});
		$abstract	= $this->get_element_from_template_map('abstract', $template_map->{$mode});
		$body		= $this->get_element_from_template_map('body', $template_map->{$mode});
		$ar_image	= $this->get_element_from_template_map('image', $template_map->{$mode});


	// body images fix url paths
		$body = str_replace('../../../media', __WEB_BASE_URL__ . '/dedalo/media', $body);

	// banner
		// $ts_web_rows = $this->data_combi[1]->result ?? [];
		// $banner_row = array_find($ts_web_rows, function($el) {
		// 	return $el->template_name==='banner';
		// });
		// $banner_row = null;

	// menu tree
		$menu_tree = $this->get_menu_tree_plain();
	// main_home_row
		$main_home_row = array_find($menu_tree, function($el){
			return $el->template_name==='main_home';
		});
		$ar_images = [];
		foreach ($main_home_row->imagen as $img_row) {
			if (!empty($img_row->image)) {
				$ar_images[] = (object)[
					'section_id'	=> $img_row->section_id,
					'url'			=> $img_row->image,
					'rating'		=> $img_row->rating
				];
			}
		}
