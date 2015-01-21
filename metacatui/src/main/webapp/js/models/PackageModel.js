/*global define */
define(['jquery', 'underscore', 'backbone', 'models/SolrResult'], 				
	function($, _, Backbone, SolrResult) {
	'use strict';

	// Package Model 
	// ------------------
	var PackageModel = Backbone.Model.extend({
		// This model contains information about a package/resource map
		defaults: {
			id: null, //The id of the resource map/package itself
			memberId: null, //An id of a member of the data package
			indexDoc: null, //A SolrResult object representation of the resource map 
			size: 0, //The number of items aggregated in this package
			formattedSize: "",
			members: [],
			sources: [],
			derivations: []
		},
		
		complete: false,
		
		type: "Package",
		
		initialize: function(options){
			//When the members attribute of this model is set, it is assumed to be complete. 
			//Since this attribute is an array, do not iteratively push new items to it or this will be triggered each time.
			this.on("change:members", this.flagComplete);
		},
		
		/* Retrieve the id of the resource map/package that this id belongs to */
		getMembersByMemberID: function(id){
			if((typeof id === "undefined") || !id) var id = this.memberId;
			
			var model = this;
			
			//Get the id of the resource map for this member
			var query = 'fl=resourceMap,read_count_i,size,formatType,formatId,id,wasDerivedFrom,wasGeneratedBy,used,wasInformedBy' +
						'&wt=json' +
						'&rows=1' +
						'&q=-obsoletedBy:*+id:%22' + encodeURIComponent(id) + '%22';

			$.get(appModel.get("queryServiceUrl") + query, function(data, textStatus, xhr) {
				//There should be only one response since we searched by id
				if(typeof data.response.docs !== "undefined"){
					var doc = data.response.docs[0];
				
					//If there is no resource map, then this is the only document to in this package
					if((typeof doc.resourceMap === "undefined") || !doc.resourceMap){
						model.set('id', null);
						model.set('members', [new SolrResult(doc)]);
					}
					else{
						model.set('id', doc.resourceMap[0]);
						model.getMembers();
					}
				}
			}, "json");
		},
		
		/* Get all the members of a resource map/package based on the id attribute of this model. 
		 * Create a SolrResult model for each member and save it in the members[] attribute of this model. */
		getMembers: function(){
			var model   = this,
				members = [],
				pids    = []; //Keep track of each object pid
			
			//*** Find all the files that are a part of this resource map and the resource map itself
			var query = 'fl=resourceMap,read_count_i,size,formatType,formatId,id,wasDerivedFrom,wasGeneratedBy,used,wasInformedBy' +
						'&wt=json' +
						'&rows=100' +
						'&q=-obsoletedBy:*+%28resourceMap:%22' + encodeURIComponent(this.id) + '%22%20OR%20id:%22' + encodeURIComponent(this.id) + '%22%29';
			
			$.get(appModel.get("queryServiceUrl") + query, function(data, textStatus, xhr) {
				
				//Separate the resource maps from the data/metadata objects
				_.each(data.response.docs, function(doc){
					if(doc.formatType == "RESOURCE"){											
						model.indexDoc = doc;
					}
					else{
						pids.push(doc.id);
						
						members.push(new SolrResult(doc));
					}
				});
				
				model.set('memberIds', _.uniq(pids));
				model.set('members', members);
			}, "json");
			
			return this;
		},
		
		/*
		 * Will get the sources and derivations of each member of this dataset and group them into packages  
		 */
		getProvTrace: function(){
			//See if there are any prov fields in our index before continuing
			var solrResult 	 = new SolrResult(),
			if(!solrResult.getProvFields()) return this;
			
			var sources 		   = new Array(),
				derivations 	   = new Array(),
				sourcePackages	   = new Array(),
				derivationPackages = new Array();
			
			//Make arrays of unique IDs of objects that are sources or derivations of this package.
			_.each(this.get("members"), function(member, i){
				if(member.hasProvTrace()){
					_.union(sources, member.getSources());					
					_.union(derivations, member.getDerivations());
				}
			});
			//Compact our list of ids that are in the prov trace by combining the sources and derivations and removing ids of members of this package
			var externalProvEntities = _.difference(_.union(sources, derivations), this.get("memberIds"));
			
			//If there are no sources or derivations, then we do not need to find resource map ids for anything
			if(!externalProvEntities.length) var idQuery = "";
			else{
				//Create a query where we retrieve the ID of the resource map of each source and derivation
				var idQuery = searchModel.getGroupedQuery("id", externalProvEntities, "OR");
			}
			
			//Create a query to find all the other objects in the index that have a provenance field pointing to a member of this package
			var provQuery 	 = "",
				memberIds 	 = this.get("memberIds");
			_.each(solrResult.getProvFields(), function(fieldName, i, list){
				provQuery += searchModel.getGroupedQuery(fieldName, memberIds, "OR");
				if(i < list.length-1) provQuery += "%20OR%20";
			});
			
			//Make a comma-separated list of the provenance field names 
			var provFieldList = "";
			_.each(solrResult.getProvFields(), function(fieldName, i, list){
				provFieldList += fieldName;
				if(i < list.length-1) provFieldList += ",";
			});
			
			//Combine the two queries with an OR operator
			if(idQuery.length && provQuery.length) var combinedQuery = idQuery + "%20OR%20" + provQuery;
			else var combinedQuery = "";
			
			//the full and final query in Solr syntax
			var query = "q=" + combinedQuery + "&fl=resourceMap," + provFieldList + "&wt=json";
			
			//Send the query to the query service
			$.get(appModel.get("queryServiceUrl") + query, function(data, textStatus, xhr){
				console.log("got data");
			}, "json");
			
			return this;
		},
		
		flagComplete: function(){
			this.complete = true;
			this.trigger("complete");
		}
		
	});
	return PackageModel;
});