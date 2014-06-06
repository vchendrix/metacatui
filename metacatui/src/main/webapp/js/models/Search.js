/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	// Search Model 
	// ------------------
	var Search = Backbone.Model.extend({
		// This model contains all of the search/filter terms
		defaults: {
			all: [],
			creator: [],
			taxon: [],
			location: [],
			resourceMap: false,
			yearMin: 1900, //The user-selected minimum year
			yearMax: new Date().getUTCFullYear(), //The user-selected maximum year
			pubYear: false,
			dataYear: false,
			sortOrder: 'dateUploaded+desc',
			east: null,
			west: null,
			north: null,
			south: null,
			geohashBBoxes: [],
			geohashLevel: 9,
			map: {
				zoom: null,
				center: null
			},
			spatial: [],
			attribute: [],
			characteristic: [],
			standard: [],
			additionalCriteria: [],
			customQuery: null,
			formatType: ["METADATA"],
			exclude: [{
				field: "obsoletedBy",
				value: "*"
			}]
		},
		
		filterCount: function() {
			var changedAttr = this.changedAttributes(_.clone(this.defaults));
			if (changedAttr) {
				var changedKeys = _.keys(changedAttr);
				return changedKeys.length;
			}
			return 0;
		},
		
		getQuery: function(){
			
			//Function here to check for spaces in a string - we'll use this to url encode the query
			var needsQuotes = function(entry){
				//Check for spaces
				var space = null;
				
				space = entry.indexOf(" ");
				
				if(space >= 0){
					return true;
				}
				
				//Check for the colon : character
				var colon = null;
				colon = entry.indexOf(":");
				if(colon >= 0){
					return true;
				}
				
				return false;
			};
			
			/* Add trim() function for IE*/
			if(typeof String.prototype.trim !== 'function') {
				  String.prototype.trim = function() {
				    return this.replace(/^\s+|\s+$/g, ''); 
				  }
			}
			
			var query = "";
			
			//resourceMap
			if(this.get('resourceMap')) filterQuery += 'resourceMap:*';

			// attribute
			var thisAttribute = null;
			var attribute = this.get('attribute');
			
			for (var i=0; i < attribute.length; i++){
				
				//Trim the spaces off
				thisAttribute = attribute[i].trim();
				
				// Does this need to be wrapped in quotes?
				if (needsQuotes(thisAttribute)){
					thisAttribute = thisAttribute.replace(" ", "%20");
					thisAttribute = "%22" + thisAttribute + "%22";
				}
				// TODO: surround with **?
				query += "+attribute:" + thisAttribute;
				
			}
			
			// characteristic
			var thisCharacteristic = null;
			var characteristic = this.get('characteristic');
			
			for (var i=0; i < characteristic.length; i++){
				
				//Trim the spaces off
				thisCharacteristic = characteristic[i].trim();
				
				// encode the semantic URI
				thisCharacteristic = "%22" + encodeURIComponent(thisCharacteristic) + "%22";
				
				// add to the query
				query += "+characteristic_sm:" + thisCharacteristic;
				
			}
			
			// standard
			var thisStandard = null;
			var standard = this.get('standard');
			
			for (var i=0; i < standard.length; i++){
				
				//Trim the spaces off
				thisStandard = standard[i].trim();
				
				// encode the semantic URI
				thisStandard = "%22" + encodeURIComponent(thisStandard) + "%22";
				
				// add to the query
				query += "+standard_sm:" + thisStandard;
				
			}
			
			// formatType
			var thisFormat = null;
			var format = this.get('formatType');
			
			for (var i=0; i < format.length; i++){
				
				//Trim the spaces off
				thisFormat = format[i].trim();
				
				// encode the semantic URI
				thisFormat = "%22" + encodeURIComponent(thisFormat) + "%22";
				
				// add to the query
				query += "+formatType:" + thisFormat;
				
			}
			
			//All
			var thisAll = null;
			var all = this.get('all');
			for(var i=0; i < all.length; i++){
				//Trim the spaces off
				thisAll = all[i].trim();
				
				//Does this need to be wrapped in quotes?
				if(needsQuotes(thisAll)){
					thisAll = thisAll.replace(" ", "%20");
					query += "+*%22" + thisAll + "%22*";
				}
				else{
					query += "+" + thisAll;
				}
			}
			
			//Creator
			var thisCreator = null;
			var creator = this.get('creator');
			for(var i=0; i < creator.length; i++){
				//Trim the spaces off
				thisCreator = creator[i].trim();
				
				//Does this need to be wrapped in quotes?
				if(needsQuotes(thisCreator)){
					thisCreator = thisCreator.replace(" ", "%20");
					query += "+origin:*%22" + thisCreator + "%22*";
				}
				else{
					query += "+origin:*" + thisCreator + "*";
				}
			}
			
			//Taxon
			var taxon = this.get('taxon');
			var thisTaxon = null;
			for (var i=0; i < taxon.length; i++){
				//Trim the spaces off
				thisTaxon = taxon[i].trim();
				
				// Does this need to be wrapped in quotes?
				if (needsQuotes(thisTaxon)){
					thisTaxon = thisTaxon.replace(" ", "%20");
					thisTaxon = "%22" + thisTaxon + "%22";
				}
				
				query += "+(" +
							   "family:*" + thisTaxon + "*" +
							   " OR " +
							   "species:*" + thisTaxon + "*" +
							   " OR " +
							   "genus:*" + thisTaxon + "*" +
							   " OR " +
							   "kingdom:*" + thisTaxon + "*" +
							   " OR " +
							   "phylum:*" + thisTaxon + "*" +
							   " OR " +
							   "order:*" + thisTaxon + "*" +
							   " OR " +
							   "class:*" + thisTaxon + "*" +
							   ")";
			}
			
			// Additional criteria - both field and value are provided
			var additionalCriteria = this.get('additionalCriteria');
			for (var i=0; i < additionalCriteria.length; i++){
				query += "+" + additionalCriteria[i];
			}
			
			// Theme restrictions from Registry Model
			var registryCriteria = registryModel.get('searchFields');
			_.each(registryCriteria, function(value, key, list) {
				query += "+" + value;
			});
			
			//Custom query (passed from the router)
			var customQuery = this.get('customQuery');
			if(customQuery){
				query += customQuery;
			}
			
			//Year
			//Get the types of year to be searched first
			var pubYear  = this.get('pubYear');
			var dataYear = this.get('dataYear');
			if (pubYear || dataYear){
				//Get the minimum and maximum years chosen
				var yearMin = this.get('yearMin');
				var yearMax = this.get('yearMax');	
				
				//Add to the query if we are searching data coverage year
				if(dataYear){
					query += "+beginDate:%5B" + yearMin + "-01-01T00:00:00Z%20TO%20*%5D" +
							 "+endDate:%5B*%20TO%20" + yearMax + "-12-31T00:00:00Z%5D";
				}
				//Add to the query if we are searching publication year
				if(pubYear){
					query += "+dateUploaded:%5B" + yearMin + "-01-01T00:00:00Z%20TO%20" + yearMax + "-12-31T00:00:00Z%5D";				
				}
			}
			
			if (this.get('north') != null){ //If we have Google Maps enabled and a map filter is set
				//Map
				//Add to the main query because there can be thousands of lat/long variations cluttering our filter cache
				query += this.getSubQuery("geohash");
			}
			
			//Spatial string
			var thisSpatial = null;
			var spatial = this.get('spatial');
			for(var i=0; i < spatial.length; i++){
				//Trim the spaces off
				thisSpatial = spatial[i].trim();
				
				//Does this need to be wrapped in quotes?
				if(needsQuotes(thisSpatial)){
					thisSpatial = thisSpatial.replace(" ", "%20");
					query += "+site:*%22" + thisSpatial + "%22*";
				}
				else{
					query += "+site:*" + thisSpatial + "*";
				}
			}
			
			//Excluded fields
			var exclude = this.get("exclude");
			_.each(exclude, function(excludeField, key, list){
				query += "+-" + excludeField.field + ":" + excludeField.value;
			});
			
			return query;
		},
		
		getSubQuery: function(filter){
			if(typeof filter === undefined) return "";
			
			if(filter == "geohash"){
				var geohashBBoxes = this.get("geohashBBoxes");
				
				if((typeof geohashBBoxes === undefined) || (geohashBBoxes.length == 0)) return "";
				
				var query = "+geohash_" + this.get("geohashLevel") + ":(";
				
				_.each(geohashBBoxes, function(geohash, key, list){
					query += geohash + "%20OR%20";
				});
				
				//Remove the last "OR"
				query = query.substr(0, (query.length-8));
				query += ")";
				
				return query;
			}	
			
			return "";
		},
		
		clear: function() {
			console.log('Clear the filters');
		    return this.set(_.clone(this.defaults));
		  }
		
	});
	return Search;
});
