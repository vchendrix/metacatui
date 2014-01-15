/*global define */
define(['jquery',
		'underscore', 
		'backbone',
		'gmaps',
		'text!templates/package.html',
		'text!templates/publishDOI.html',
		'text!templates/newerVersion.html',
		'text!templates/loading.html',
		'text!templates/usageStats.html',
		'text!templates/downloadContents.html'
		], 				
	function($, _, Backbone, gmaps, PackageTemplate, PublishDoiTemplate, VersionTemplate, LoadingTemplate, UsageTemplate, DownloadContentsTemplate) {
	'use strict';

	
	var MetadataView = Backbone.View.extend({

		el: '#Content',
		
		template: null,
				
		packageTemplate: _.template(PackageTemplate),

		doiTemplate: _.template(PublishDoiTemplate),
		
		usageTemplate: _.template(UsageTemplate),

		versionTemplate: _.template(VersionTemplate),
		
		loadingTemplate: _.template(LoadingTemplate),
		
		downloadContentsTemplate: _.template(DownloadContentsTemplate),
		
		DOI_PREFIXES: ["doi:10.", "http://dx.doi.org/10.", "http://doi.org/10."],
		
		// Delegated events for creating new items, and clearing completed ones.
		events: {
			"click #publish": "publish"
		},
		
		initialize: function () {
			
		},
				
		// Render the main metadata view
		render: function () {

			console.log('Rendering the Metadata view');
			appModel.set('headerType', 'default');
			
			// get the pid to render
			var pid = appModel.get('pid');
			
			// load the document view from the server
			var endpoint = appModel.get('viewServiceUrl') + pid + ' #Metadata';
			console.log('calling view endpoint: ' + endpoint);

			var viewRef = this;
			this.$el.load(endpoint,
					function(response, status, xhr) {
						if (status == "error") {
							viewRef.showMessage(response);
						} else {
							viewRef.insertResourceMapContents(pid);
							if(gmaps){ 
								viewRef.insertSpatialCoverageMap();
							}
						}
						console.log('Loaded metadata, now fading in MetadataView');
						viewRef.$el.fadeIn('slow');
						
					});
			
			return this;
		},
		
		// this will insert the ORE package download link if available
		insertResourceMapContents: function(pid) {
			//Keep a map of resource map ID <-> objects in that resource map 
			var packages = new Array();
			//Keep a list of all resource map objects
			var maps = new Array();
			var objects = new Array();

			var resourceMapQuery = "";
			
			// look up the resourceMapId[s]
			var queryServiceUrl = appModel.get('queryServiceUrl');
			var packageServiceUrl = appModel.get('packageServiceUrl');
			var objectServiceUrl = appModel.get('objectServiceUrl');
			
			var viewRef = this;

			//*** Find the DOM element to append the HTML to. We want to create a new div underneath the first well with the citation
			var wells = viewRef.$el.find('.well');
		
			//Find the div.well with the citation. If we never find it, we don't insert the list of contents
			_.each(wells, function(well){
				if($(well).find('#viewMetadataCitationLink').length > 0){
					
					//Mark this in the DOM for CSS styling
					$(well).addClass('citation');
					
					//Insert the container div for the download contents
					$(well).after("<div id='downloadContents'><h4>Download contents</h4></div>");
				}
			});
			
			//*** Find each resource map that this metadata is a part of 
			// surround pid value in "" so that doi characters do not affect solr query
			var query = 'fl=resourceMap,read_count_i,size,formatType,formatId,id&wt=json&q=formatType:METADATA+-obsoletedBy:*+id:%22' + pid + '%22';
			console.log(queryServiceUrl + query);
			$.get(queryServiceUrl + query, function(data, textStatus, xhr) {
						
				var resourceMap = data.response.docs[0].resourceMap;
						
				// Is this metadata part of a resource map?
				if(resourceMap !== undefined){
					
					//Add to our list and map of resource maps if there is at least one
					_.each(resourceMap, function(resourceMapID){
						packages[resourceMapID] = new Array();
						resourceMapQuery += 'resourceMap:%22' + resourceMapID + '%22%20OR%20id:%22' + resourceMapID + '%22%20OR%20';
					});

					//*** Find all the files that are a part of those resource maps
					var query = 'fl=resourceMap,read_count_i,size,formatType,formatId,id&wt=json&q=-obsoletedBy:*+%28' + resourceMapQuery + 'id:%22' + pid + '%22%29';
					$.get(queryServiceUrl + query, function(moreData, textStatus, xhr) {
										
						//Separate the resource maps from the data/metadata objects
						_.each(moreData.response.docs, function(doc){
							if(doc.formatType == "RESOURCE"){											
								maps.push(doc);
							}
							else{
								objects.push(doc);
							}
						});
										
						//Now go through all of our objects and add them to our map
						_.each(objects, function(object){
							_.each(object.resourceMap, function(resourceMapId){
								packages[resourceMapId].push(object);												
							});
						});
											
						//For each resource map package, add a table of its contents to the page 
						var count = 0;
						_.each(maps, function(thisMap){
							count++;
							$('#downloadContents').append(viewRef.downloadContentsTemplate({
								objects: packages[thisMap.id],
								resourceMap: thisMap,
								packageCount: count,
								package_service: packageServiceUrl,
								object_service: objectServiceUrl
							}));	
						}); 
					});
				}	
				//If this is just a metadata object, just send that info alone
				else{
					console.log(data.response.docs);
					$('#downloadContents').append(viewRef.downloadContentsTemplate({
						objects: data.response.docs,
						resourceMap: null,
						package_service: packageServiceUrl,
						object_service: objectServiceUrl
					}));
				}
										
				//Initialize any popovers
				$('.popover-this').popover();
																			
				//Move the download button to our download content list area
			    $("#downloadPackage").detach();
							
			});
					
			// is this the latest version? (includes DOI link when needed)
			viewRef.showLatestVersion(pid);		
		},
		
		insertSpatialCoverageMap: function(){
			var findCoordinates = this.$el.find('h4:contains("Geographic Region")').each(function(){
				var parentEl = $(this).parent();
				
				var coordinates = new Array();
				
				['North', 'South', 'East', 'West'].forEach(function(direction){
					var labelEl = $(parentEl).find('label:contains("' + direction + '")');
					var coordinate = $(labelEl).next().html();
					coordinate = coordinate.substring(0, coordinate.indexOf("&nbsp;"));
					coordinates.push(coordinate);
				});
				
				//Extract the coordinates
				var n = coordinates[0];
				var s = coordinates[1];
				var e = coordinates[2];
				var w = coordinates[3];
				
				//Create Google Map LatLng objects out of our coordinates
				var latLngSW = new gmaps.LatLng(s, w);
				var latLngNE = new gmaps.LatLng(n, e);
				var latLngNW = new gmaps.LatLng(n, w);
				var latLngSE = new gmaps.LatLng(s, e);
				
				//Get the centertroid location of this data item
				var bounds = new gmaps.LatLngBounds(latLngSW, latLngNE);
				var latLngCEN = bounds.getCenter();

				//Create a google map image
				var mapHTML = "<img class='georegion-map' " +
							  "src='https://maps.googleapis.com/maps/api/staticmap?" +
							  "center="+latLngCEN.lat()+","+latLngCEN.lng() +
							  "&size=550x250" +
							  "&maptype=terrain" +
							  "&markers=size:mid|color:0xDA4D3Aff|"+latLngCEN.lat()+","+latLngCEN.lng() +
							  "&path=color:0xDA4D3Aff|weight:3|"+latLngSW.lat()+","+latLngSW.lng()+"|"+latLngNW.lat()+","+latLngNW.lng()+"|"+latLngNE.lat()+","+latLngNE.lng()+"|"+latLngSE.lat()+","+latLngSE.lng()+"|"+latLngSW.lat()+","+latLngSW.lng()+
							  "&visible=" + latLngSW.lat()+","+latLngSW.lng()+"|"+latLngNW.lat()+","+latLngNW.lng()+"|"+latLngNE.lat()+","+latLngNE.lng()+"|"+latLngSE.lat()+","+latLngSE.lng()+"|"+latLngSW.lat()+","+latLngSW.lng()+
							  "&sensor=false" +
							  "&key=" + mapKey + "'/>";

				//Find the spot in the DOM to insert our map image
				var lastEl = $(parentEl).find('label:contains("West")').parent().parent(); //The last coordinate listed
				lastEl.append(mapHTML);
			});

		},
		
		// checks if the pid is already a DOI
		isDOI: function(pid) {
			for (var i=0; i < this.DOI_PREFIXES.length; i++) {
				if (pid.toLowerCase().indexOf(this.DOI_PREFIXES[i].toLowerCase()) == 0) {
					return true;
				}
			}
			return false;
				
		},
		
		// this will insert the DOI publish button
		insertDoiButton: function(pid) {
			
			// first check if already a DOI
			if (this.isDOI(pid)) {
				console.log(pid + " is already a DOI");
				return;
			}
			
			// see if the user is authorized to update this object
			var authServiceUrl = appModel.get('authServiceUrl');

			// look up the SystemMetadata
			var metaServiceUrl = appModel.get('metaServiceUrl');

			// systemMetadata to render
			var identifier = null;
			var formatId = null;
			var size = null;
			var checksum = null;
			var rightsHolder = null;
			var submitter = null;
			
			var viewRef = this;
			
			// get the /meta for the pid
			$.get(
				metaServiceUrl + pid,
				function(data, textStatus, xhr) {
					
					// the response should have all the elements we want
					identifier = $(data).find("identifier").text();
					console.log('identifier: ' + identifier);
					formatId = $(data).find("formatId").text();
					size = $(data).find("size").text();
					checksum = $(data).find("checksum").text();
					rightsHolder = $(data).find("rightsHolder").text();
					submitter = $(data).find("submitter").text();

					if (identifier) {
						
						var populateTemplate = function(auth) {
							// TODO: include SystemMetadata details						
							viewRef.$el.find("#viewMetadataCitationLink").after(
								viewRef.doiTemplate({
									isAuthorized: auth,
									identifier: identifier,
									formatId: formatId,
									size: size,
									checksum: checksum,
									rightsHolder: rightsHolder,
									submitter: submitter
								})
							);
						};
						
						// are we authorized to publish?
						$.ajax({
								url: authServiceUrl + pid + "?action=changePermission",
								type: "GET",
								xhrFields: {
									withCredentials: true
								},
								success: function(data, textStatus, xhr) {
									populateTemplate(true);
								},
								error: function(xhr, textStatus, errorThrown) {
									console.log('Not authorized to publish');
								}
							});
					}
					
				}
			);
			
			
				
		},
		
		publish: function(event) {
			
			// target may not actually prevent click events, so double check
			var disabled = $(event.target).closest("a").attr("disabled");
			if (disabled) {
				return false;
			}
			var publishServiceUrl = appModel.get('publishServiceUrl');
			var pid = $(event.target).closest("a").attr("pid");
			var ret = confirm("Are you sure you want to publish " + pid + " with a DOI?");
			
			if (ret) {
				
				// show the loading icon
				var message = "Publishing package...please be patient";
				this.showLoading(message);
				
				var identifier = null;
				var viewRef = this;
				$.ajax({
						url: publishServiceUrl + pid,
						type: "PUT",
						xhrFields: {
							withCredentials: true
						},
						success: function(data, textStatus, xhr) {
							// the response should have new identifier in it
							identifier = $(data).find("d1\\:identifier, identifier").text();
						
							console.log('identifier: ' + identifier);
							if (identifier) {
								
								var msg = "Published package '" + identifier + "'";
								viewRef.showMessage(msg, false, "alert-success");
								
								// navigate to the new view after a few seconds
								setTimeout(
										function() {
											// avoid a double fade out/in
											viewRef.$el.html('');
											viewRef.showLoading();
											uiRouter.navigate("view/" + identifier, {trigger: true})
										}, 
										3000);
							}
						},
						error: function(xhr, textStatus, errorThrown) {
							// show the error message, but stay on the same page
							var msg = $(xhr.responseText).find("description").text();
							viewRef.showMessage(msg, true, "alert-error");
						}
					}
				);
				
			}
		},
		
		// this will lookup the latest version of the PID
		showLatestVersion: function(pid, traversing) {
			var obsoletedBy = null;
			// look up the metadata
			var metaServiceUrl = appModel.get('metaServiceUrl');			

			// look up the meta
			var viewRef = this;
			$.get(
					metaServiceUrl + pid,
					function(data, textStatus, xhr) {
						
						// the response should have a resourceMap element
						obsoletedBy = $(data).find("obsoletedBy").text();
						console.log('obsoletedBy: ' + obsoletedBy);
						
						if (obsoletedBy) {						
							viewRef.showLatestVersion(obsoletedBy, true);
						} else {
							if (traversing) {
								viewRef.$el.find("#Metadata > .container").prepend(
										viewRef.versionTemplate({pid: pid})
										);
								
							} else {
								// finally add the DOI button - this is the latest version
								viewRef.insertDoiButton(pid);
							}
							
						}
					}
				);
				
		},
		
		showMessage: function(msg, prepend, alertType) {
			this.hideLoading();
			var alertClass = "alert";
			if (alertType) {
				alertClass += " " + alertType;
			}
			var content = '<section id="Notification"><div class="' + alertClass + '"><h4>' + msg + '</h4></div></section>';
			if (prepend) {
				this.$el.prepend(content);
			} else {
				this.$el.html(content);
			}

		},
		
		showLoading: function(message) {
			this.hideLoading();
			this.scrollToTop();
			/*var content = '<section id="Notification">';
			if (msg) {
				content += '<div class="alert alert-info">' + msg + '</div>';
			}
			content += '<div class="progress progress-striped active"><div class="bar" style="width: 100%"></div></div></section>';
			*/
			this.$el.prepend(this.loadingTemplate({msg: message}));
		},
		
		hideLoading: function() {
			$("#Notification").remove();
		},
		
		scrollToTop: function() {
			$("html, body").animate({ scrollTop: 0 }, "slow");
			return false;
		},
		
		onClose: function () {			
			console.log('Closing the metadata view');
		}				
	});
	return MetadataView;		
});
