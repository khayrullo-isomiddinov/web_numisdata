<?php declare(strict_types=1);

// archive

	// page basic vars (from template_map "archive" record, mode 'detail')
		$title 		= $this->get_element_from_template_map('title', $template_map->{$mode});
		$abstract	= $this->get_element_from_template_map('abstract', $template_map->{$mode});
		$body		= $this->get_element_from_template_map('body', $template_map->{$mode});

	// title override . the ts_web "Archive" menu record has no per-language
	// translations yet (curator only entered the English value), so use our
	// own tpl/lang/lg-*.json string instead of the untranslated CMS value.
	// Once the record is translated in Dédalo this override can be removed.
		$lang_obj = lang::get_lang_obj(WEB_CURRENT_LANG_CODE);
		if (!empty($lang_obj->archive)) {
			$title = $lang_obj->archive;
		}

	// section_id . optional record detail, like '/archive/143'
		// web.php routes '/archive' and '/archive/143' to this same template,
		// ignoring the id part at the routing level, so we parse it ourselves
		// (same approach as tpl/coin/coin.php)
		$area_name	= $_GET['area_name'];
		$ar_parts	= explode('/', $area_name);
		$url_id		= $ar_parts[1] ?? '';
		$section_id	= $url_id!==''
			? (int) preg_replace('/\D/', '', $url_id)
			: null;
