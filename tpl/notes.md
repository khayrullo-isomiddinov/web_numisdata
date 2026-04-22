### Diffusion: Change from `denomination` to `ts_object`

# 1 - Update Ontology (section `ts_object` is added as table in `web_numisdata_default` diffusion db)
# 2 - Publish section `object1`
# 3 - Change file `analysis.js` function `load_denomination_colors` table `denomination` to `ts_object`
# 4 - Change file `type.js` function `get_row_data` to use `ts_object` instead of `denomination` in `resolve_portals_custom`.
# E.g.
``` json
{
    resolve_portals_custom : {
        "bibliography_data"				: "bibliographic_references",
        // coins resolution
        "ref_coins_union"				: "coins",
        "coin_references"				: "coins",
        "coins.bibliography_data"		: "bibliographic_references",
        // findspots resolution
        "ref_coins_findspots_data"		: "findspots",
        "findspots.bibliography_data"	: "bibliographic_references",
        // hoard resolution
        "ref_coins_hoard_data"			: "hoards",
        "hoards.bibliography_data"		: "bibliographic_references",
        // "denomination_data"			: "denomination", // changes to ts_object
        "denomination_data"				: "ts_object",
        "material_data"					: "material",
        "related_types_data"			: "types",
        // mint resolution
        "mint_data"						: "mints"
    }
}
```
