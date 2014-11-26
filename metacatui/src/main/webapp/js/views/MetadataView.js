/*global define */
define(['jquery',
        'jqueryui',
        'annotator',
		'underscore', 
		'backbone',
		'gmaps',
		'fancybox',
		'models/PackageModel',
		'views/MetadataIndexView',
		'views/ExpandCollapseListView',
		'views/ProvStatementView',
		'views/PackageTableView',
		'text!templates/publishDOI.html',
		'text!templates/newerVersion.html',
		'text!templates/loading.html',
		'text!templates/usageStats.html',
		'text!templates/downloadContents.html',
		'text!templates/alert.html',
		'text!templates/editMetadata.html',
		'text!templates/dataDisplay.html',
		'text!templates/map.html',
		'text!templates/annotation.html'
		], 				
	function($, $ui, Annotator, _, Backbone, gmaps, fancybox, Package, MetadataIndex, ExpandCollapseList, ProvStatement, PackageTable, PublishDoiTemplate, VersionTemplate, LoadingTemplate, UsageTemplate, DownloadContentsTemplate, AlertTemplate, EditMetadataTemplate, DataDisplayTemplate, MapTemplate, AnnotationTemplate) {
	'use strict';

	
	var MetadataView = Backbone.View.extend({
		
		subviews: {},

		el: '#Content',
		
		template: null,
						
		alertTemplate: _.template(AlertTemplate),

		doiTemplate: _.template(PublishDoiTemplate),
		
		usageTemplate: _.template(UsageTemplate),

		versionTemplate: _.template(VersionTemplate),
		
		loadingTemplate: _.template(LoadingTemplate),
		
		downloadContentsTemplate: _.template(DownloadContentsTemplate),
		
		editMetadataTemplate: _.template(EditMetadataTemplate),
		
		dataDisplayTemplate: _.template(DataDisplayTemplate),
		
		mapTemplate: _.template(MapTemplate),
		
		annotationTemplate: _.template(AnnotationTemplate),
		
		objectIds: [],
		
		DOI_PREFIXES: ["doi:10.", "http://dx.doi.org/10.", "http://doi.org/10."],
		
		// Delegated events for creating new items, and clearing completed ones.
		events: {
			"click #publish" : "publish"
		},
		
		initialize: function () {
		},
				
		// Render the main metadata view
		render: function () {

			console.log('Rendering the Metadata view');
			appModel.set('headerType', 'default');
			
			// get the pid to render
			var pid = appModel.get('pid');
			
			// URL encode the pid
			this.encodedPid = encodeURIComponent(pid);
			
			// Check for a view service in this appModel
			if((appModel.get('viewServiceUrl') !== undefined) && (appModel.get('viewServiceUrl'))) var endpoint = appModel.get('viewServiceUrl') + pid + ' #Metadata';
					
			if(endpoint && (endpoint !== undefined)){
				// load the document view from the server
				console.log('calling view endpoint: ' + endpoint);
	
				var viewRef = this;
				this.$el.load(endpoint,
						function(response, status, xhr) {
							if(status=="error"){
								//Our fallback is to show the metadata details from the Solr index
								viewRef.renderMetadataFromIndex();
							}
							else{
								//HTML was successfully loaded from a view service
															
								//Find the taxonomic range and give it a class for styling
								$('#Metadata').find('h4:contains("Taxonomic Range")').parent().addClass('taxonomic-range');
								
								viewRef.$el.fadeIn("slow");
								
								viewRef.insertResourceMapContents(appModel.get('pid'));
								if(gmaps) viewRef.insertSpatialCoverageMap();
								
								viewRef.packageModel = new Package();
								viewRef.packageModel.on('change:members', viewRef.showPackageDetails, viewRef);
								viewRef.packageModel.getMembersByMemberID(appModel.get('pid'));
								
								viewRef.setUpAnnotator('body');
							}							
						});
			}
			else this.renderMetadataFromIndex();
						
			return this;
		},
		
		showPackageDetails: function(){
			console.log('have packge ');
			console.log(this.packageModel);
			
			var packageMembers = this.packageModel.get('members');
			var view = this;
			
			//Display the images in this package
			this.insertVisuals(packageMembers);
						
			_.each(packageMembers, function(member){
				//Create provenance statements about this document if there are any prov annotations
				var provenanceEl = new ProvStatement().render(member).el;
						
				//Insert the provenance statements
				$('[data-obj-id=' + member.id + ']').find(".provenance-container").prepend(provenanceEl);
			});
			
		},

		renderMetadataFromIndex: function(){
			this.subviews.metadataFromIndex = new MetadataIndex({ 
					pid: appModel.get('pid'), 
					parentView: this 
					});
			this.$el.append(this.subviews.metadataFromIndex.render().el);
			
		},
		
		insertBackLink: function(){
			if(uiRouter.lastRoute() == "data") {
				var insertInto = this.$el.children()[0] || this.el;
				$(insertInto).prepend('<a href="#data" title="Back"><i class="icon-angle-left"></i> Back to search</a>');
			}
		},
		
		// Insert a table describing each of the items in this dataset with download links
		insertResourceMapContents: function(pid) {
			var viewRef = this;

			//*** Find the DOM element to append the HTML to. We want to create a new div underneath the first well with the citation
			var wells = viewRef.$el.find('.well');
		
			//Find the div.well with the citation. If we never find it, we don't insert the list of contents
			_.each(wells, function(well){
				if($(well).find('#viewMetadataCitationLink').length > 0){
					
					//Save this element in the view
					viewRef.citationEl = well;
					
					//Mark this in the DOM for CSS styling
					$(well).addClass('citation');
					
				}
			});
			
			if(!this.citationEl){
				//Otherwise, just find the first element with a citation class or just use the first well - useful for when we display the metadata from the indexed fields
				this.citationEl = this.$('.citation')[0] || wells[0];
			}
			
			//Insert the container div for the download contents
			var table = new PackageTable().render(pid).el;
			$(this.citationEl).after(table);
			
			//Move the download button to our download content list area
		    $("#downloadPackage").detach();
		    var citationText = $(this.citationEl).find(".span10");
		    				   $(citationText).removeClass("span10");
		    				   $(citationText).addClass("span12");
					
			// is this the latest version? (includes DOI link when needed)
			viewRef.showLatestVersion(pid);		
		},
				
		insertSpatialCoverageMap: function(coordinates){
			
			var georegionEls = this.$el.find('h4:contains("Geographic Region")');
			for(var i=0; i<georegionEls.length; i++){
				var parentEl = $(georegionEls[i]).parent();
				
				if(coordinates === undefined){
					var coordinates = new Array();
					var directions = new Array('North', 'South', 'East', 'West');
					
					_.each(directions, function(direction){
						var labelEl = $(parentEl).find('label:contains("' + direction + '")');
						if(labelEl){
							var coordinate = $(labelEl).next().html();
							coordinate = coordinate.substring(0, coordinate.indexOf("&nbsp;"));
							coordinates.push(coordinate);	
						}
					});
				}
				
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

				var url = "https://maps.google.com/?ll=" + latLngCEN.lat() + "," + latLngCEN.lng() + 
						  "&spn=0.003833,0.010568" +
						  "&t=h" +
						  "&z=17";
				//Create a google map image
				var mapHTML = "<img class='georegion-map' " +
							  "src='https://maps.googleapis.com/maps/api/staticmap?" +
							  "center="+latLngCEN.lat()+","+latLngCEN.lng() +
							  "&size=650x250" +
							  "&maptype=terrain" +
							  "&markers=size:mid|color:0xDA4D3Aff|"+latLngCEN.lat()+","+latLngCEN.lng() +
							  "&path=color:0xDA4D3Aff|weight:3|"+latLngSW.lat()+","+latLngSW.lng()+"|"+latLngNW.lat()+","+latLngNW.lng()+"|"+latLngNE.lat()+","+latLngNE.lng()+"|"+latLngSE.lat()+","+latLngSE.lng()+"|"+latLngSW.lat()+","+latLngSW.lng()+
							  "&visible=" + latLngSW.lat()+","+latLngSW.lng()+"|"+latLngNW.lat()+","+latLngNW.lng()+"|"+latLngNE.lat()+","+latLngNE.lng()+"|"+latLngSE.lat()+","+latLngSE.lng()+"|"+latLngSW.lat()+","+latLngSW.lng()+
							  "&sensor=false" +
							  "&key=" + mapKey + "'/>";

				//Find the spot in the DOM to insert our map image
				var lastEl = ($(parentEl).find('label:contains("West")').parent().parent().length) ? $(parentEl).find('label:contains("West")').parent().parent() :  parentEl; //The last coordinate listed
				lastEl.append(this.mapTemplate({
					map: mapHTML,
					url: url
				}));
				
				$('.fancybox-media').fancybox({
					openEffect: 'elastic',
					closeEffect: 'elastic',
					helpers: {
						media: {}
					}
				})
				
			}
			
			return true;

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
			
			var encodedPid = encodeURIComponent(pid);

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
				metaServiceUrl + encodedPid,
				function(data, textStatus, xhr) {
					
					// the response should have all the elements we want
					identifier = $(data).find("identifier").text();
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
								url: authServiceUrl + encodedPid + "?action=changePermission",
								type: "GET",
								xhrFields: {
									withCredentials: true
								},
								success: function(data, textStatus, xhr) {
									populateTemplate(true);
									viewRef.insertEditLink(pid);
								},
								error: function(xhr, textStatus, errorThrown) {
									console.log('Not authorized to publish');
								}
							});
					}
					
				}
			);
			
			
				
		},
		
		insertEditLink: function(pid) {
			this.$el.find("#viewMetadataCitationLink").after(
					this.editMetadataTemplate({
						identifier: pid
					}));
			//this.$el.find("#viewMetadataCitationLink").after("<a href='#share/modify/" + pid + "'>Edit</a>");
		},
		
		/*
		 * param dataObject - a SolrResult representing the data object returned from the index
		 * returns - true if this data object is an image, false if it is other
		 */
		isImage: function(dataObject){
			//The list of formatIds that are images
			var imageIds = ["image/gif",
			                "image/jp2",
			                "image/jpeg",
			                "image/png",
			                "image/svg xml",
			                "image/svg+xml",
			                "image/tiff",
			                "image/bmp"];
			
			//Does this data object match one of these IDs?
			if(_.indexOf(imageIds, dataObject.get('formatId')) == -1) return false;			
			else return true;
			
		},
		
		/*
		 * param dataObject - a SolrResult representing the data object returned from the index
		 * returns - true if this data object is a pdf, false if it is other
		 */
		isPDF: function(dataObject){
			//The list of formatIds that are images
			var ids = ["application/pdf"];
			
			//Does this data object match one of these IDs?
			if(_.indexOf(ids, dataObject.get('formatId')) == -1) return false;			
			else return true;			
		},
		
		/*
		 * Inserts new image elements into the DOM via the image template. Use for displaying images that are part of this metadata's resource map.
		 * param objects - an array of SolrResults that represent the data objects returned from the index. Each should be an image
		 */
		insertVisuals: function(objects){
			var dataDisplay = "",
				viewRef = this,
				images = [],
				pdfs = [],
				other = [],
				entityDetailsContainers = this.$el.find(".entitydetails");
						
			//==== Loop over each visual object and create a dataDisplay template for it to attach to the DOM ====
			for(var i=0; i<objects.length; i++){
				var type = "";
				
				//Make sure this is a visual object (image or PDF)
				if(this.isImage(objects[i])){
					type = "image";
					images.push(objects[i]);
				}
				else if(this.isPDF(objects[i])){
					type = "pdf";
					pdfs.push(objects[i]);
				}
				else if (objects[i].get('formatType') == "METADATA"){
					continue;
				}
				else{
					type = "other";
					other.push(objects[i]);
				}
				
				
				//Find the part of the HTML Metadata view that describes this data object
				var container = $(entityDetailsContainers).find(":contains('" + objects[i].id + "')").parents(".entitydetails");
				
				var title = "";
				
				//Harvest the Entity Name for a lightbox caption 
				if(container !== undefined)
					title = container.find("label:contains('Entity Name')").next().text();
					
				if((container !== undefined) && (!title)) 
					title = container.find("label:contains('Object Name')").next().text();
	
				if(!title)
					container = viewRef.el;
				
				var objID = objects[i].id;
				
				//Create HTML for the visuals using the dataDisplay template
				dataDisplay = this.dataDisplayTemplate({
						 type : type,
						  src : appModel.get('objectServiceUrl') + objects[i].id,
						title : title,
					   objID : objID
				});
				
	
				// Insert the HTML into the DOM
				$(container).prepend(dataDisplay);	
				
			}
			
			//==== Initialize the fancybox images =====
			// We will be checking every half-second if all the HTML has been loaded into the DOM - once they are all loaded, we can initialize the lightbox functionality.
			var numImages  = images.length,
				numPDFS	   = pdfs.length,
				//The shared lightbox options for both images and PDFs
				lightboxOptions = {
						prevEffect	: 'elastic',
						nextEffect	: 'elastic',
						closeEffect : 'elastic',
						openEffect  : 'elastic',
						aspectRatio : true,
						closeClick : true,
						afterLoad  : function(){
							//Create a custom HTML caption based on data stored in the DOM element
							this.title = this.title + " <a href='" + this.href + "' class='btn' target='_blank'>Download</a> ";
						},
						helpers	    : {
						    title : {
							      type : 'outside'
						    }
						}
				};
			
			if(numPDFS > 0){
				var numPDFChecks  = 0,
					lightboxPDFSelector = "a[class^='fancybox'][data-fancybox-iframe]",
					pdfIntervalID = window.setInterval(initializePDFLightboxes, 500);
				
				//Add additional options for PDFs
				var pdfLightboxOptions = lightboxOptions;
				pdfLightboxOptions.type = "iframe";
				pdfLightboxOptions.iframe = { preload: false };
				pdfLightboxOptions.height = "98%";
				
				var initializePDFLightboxes = function(){
					numPDFChecks++;
					
					//Initialize what images have loaded so far after 5 seconds
					if(numPDFChecks == 10){ 
						$(lightboxPDFSelector).fancybox(pdfLightboxOptions);
					}
					//When 15 seconds have passed, stop checking so we don't blow up the browser
					else if(numPDFChecks > 30){
						window.clearInterval(pdfIntervalID);
						return;
					}
					
					//Are all of our pdfs loaded yet?
					if(viewRef.$(lightboxPDFSelector).length < numPDFs) return;
					else{					
						//Initialize our lightboxes
						$(lightboxPDFSelector).fancybox(pdfLightboxOptions);
						
						//We're done - clear the interval
						window.clearInterval(pdfIntervalID);
					}				
				}
				
			}
			
			if(numImages > 0){
				var numImgChecks  = 0, //Keep track of how many interval checks we have so we don't wait forever for images to load
					lightboxImgSelector = "a[class^='fancybox'][data-fancybox-type='image']";
					
				//Add additional options for images
				var imgLightboxOptions = lightboxOptions;
				imgLightboxOptions.type = "image";
				imgLightboxOptions.perload = 1;
				
				var initializeImgLightboxes = function(){
					numImgChecks++;
					
					//Initialize what images have loaded so far after 5 seconds
					if(numImgChecks == 10){ 
						$(lightboxImgSelector).fancybox(imgLightboxOptions);
					}
					//When 15 seconds have passed, stop checking so we don't blow up the browser
					else if(numImgChecks > 30){
						$(lightboxImgSelector).fancybox(imgLightboxOptions);
						window.clearInterval(imgIntervalID);
						return;
					}
					
					//Are all of our images loaded yet?
					if(viewRef.$(lightboxImgSelector).length < numImages) return;
					else{					
						//Initialize our lightboxes
						$(lightboxImgSelector).fancybox(imgLightboxOptions);
						
						//We're done - clear the interval
						window.clearInterval(imgIntervalID);
					}				
				}
				
				var imgIntervalID = window.setInterval(initializeImgLightboxes, 500);
			}
		},
		
		/*
		 * Inserts new image elements into the DOM via the image template. Use for displaying images that are part of this metadata's resource map.
		 * param pdfs - an array of objects that represent the data objects returned from the index. Each should be a PDF
		 */
		insertPDFs: function(pdfs){
			var html = "",
			 viewRef = this;
		
			//Loop over each image object and create a dataDisplay template for it to attach to the DOM
			for(var i=0; i<pdfs.length; i++){
				//Find the part of the HTML Metadata view that describes this data object
				var container = this.$el.find("td:contains('" + pdfs[i].id + "')").parents(".controls-well");
				
				//Harvest the Object Name for an image caption 
				if(container !== undefined) var title = container.find("label:contains('Object Name')").next().text();
				else{
					var title = "";
					container = viewRef.el;
				}
				//Create an element using the dataDisplay template
				html = this.dataDisplayTemplate({
					 type : "pdf",
					  src : appModel.get('objectServiceUrl') + pdfs[i].id,
					title : title 
				});
	
				// Insert the element into the DOM
				$(container).append(html);				
			}
		
			//==== Initialize the fancybox images =====
			// We will be checking every half-second if all the images have been loaded into the DOM - once they are all loaded, we can initialize the lightbox functionality.
			var numPDFs  = pdfs.length,
				numChecks  = 0, //Keep track of how many interval checks we have so we don't wait forever for images to load 
				lightboxSelector = "a[class^='fancybox'][data-fancybox-iframe]",
				intervalID = window.setInterval(initializeLightboxes, 500);
			
			//Set up our lightbox options
			var lightboxOptions = {
					prevEffect	: 'elastic',
					nextEffect	: 'elastic',
					closeEffect : 'elastic',
					openEffect  : 'elastic',
					type 		: "iframe",
					aspectRatio : true,
					helpers	    : {
						    title : {
							      type : 'outside'
						    }
					},
				   iframe	  : {
					   		preload : false
				   },
				   closeClick : true,
				   afterLoad  : function(){
					   //Create a custom HTML caption based on data stored in the DOM element
					   this.title = this.title + " <a href='" + this.href + "' class='btn' target='_blank'>Download</a> ";
				   }
			}
		
			function initializeLightboxes(){
				numChecks++;
				
				//Initialize what images have loaded so far after 5 seconds
				if(numChecks == 10){ 
					$(lightboxSelector).fancybox(lightboxOptions);
				}
				//When 15 seconds have passed, stop checking so we don't blow up the browser
				else if(numChecks > 30){
					window.clearInterval(intervalID);
					return;
				}
				
				//Are all of our pdfs loaded yet?
				if(viewRef.$(lightboxSelector).length < numPDFs) return;
				else{					
					//Initialize our lightboxes
					$(lightboxSelector).fancybox(lightboxOptions);
					
					//We're done - clear the interval
					window.clearInterval(intervalID);
				}				
			}
		},
		
		replaceEcoGridLinks: function(pids){
			var viewRef = this;
			
			//Find the element in the DOM housing the ecogrid link
			$("label:contains('Online Distribution Info')").next().each(function(){
				var link = $(this).find("a:contains('ecogrid://')");
				_.each(link, function(thisLink){
					
					//Get the link text
					var linkText = $(thisLink).text();
					
					//Clean up the link text
					var start = linkText.lastIndexOf("/");
					var ecogridPid = linkText.substr(start+1);
					
					//Iterate over each id in the package and try to fuzzily match the ecogrid link to the id
					for(var i = 0; i < pids.length; i++){
						
						//If we find a match, replace the ecogrid links with a DataONE API link to the object
						if(pids[i].indexOf(ecogridPid) > -1){
							
							$(thisLink).attr('href', appModel.get('objectServiceUrl') + encodeURIComponent(pids[i]));
							$(thisLink).text(pids[i]);
							
							//Insert an anchor at the parent element that contains the data object detials
							var parents = $(thisLink).parents();
							_.each(parents, function(parent){
								if($(parent).hasClass("dataTableContainer"))
									$(parent).prepend('<a name="' + pids[i] + '"></a>');
							});
														
							//We can stop looking at the pids now
							i = pids.length;
						}
					}
				});			
				
			});
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
								viewRef.hideLoading();
								var msg = "Published package '" + identifier + "'";
								viewRef.$el.find('.container').prepend(
										viewRef.alertTemplate({
											msg: msg,
											classes: 'alert-success'
										})
								);
								
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
							var msg = "Publish failed: " + $(xhr.responseText).find("description").text();
							
							viewRef.hideLoading();
							viewRef.$el.find('.container').prepend(
									viewRef.alertTemplate({
										msg: msg,
										classes: 'alert-error',
										includeEmail: true
									})
							);
						}
					}
				);
				
			}
		},
		
		// this will lookup the latest version of the PID
		showLatestVersion: function(pid, traversing) {
			var obsoletedBy = null,
				encodedPid = encodeURIComponent(pid);
			// look up the metadata
			var metaServiceUrl = appModel.get('metaServiceUrl');			

			// look up the meta
			var viewRef = this;
			$.get(metaServiceUrl + encodedPid, function(data, textStatus, xhr) {
						
				// the response should have a resourceMap element
				obsoletedBy = $(data).find("obsoletedBy").text();
						
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
			});	
		},
		
		showLoading: function(message) {
			this.hideLoading();
			this.scrollToTop();
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
		},
		
		setUpAnnotator: function(div) {
			
			var bioportalServiceUrl = appModel.get('bioportalServiceUrl');
			if (!bioportalServiceUrl) {
				// do not use annotator
				console.log("bioportalServiceUrl is not configured, annotation is disabled");
				return;
			}
			
			// get the pid
			var pid = appModel.get('pid');
			
			// which URI are we annotating?
			var uri = null;
			//uri = window.location.href;
			uri = appModel.get("objectServiceUrl") + pid;
			// TODO: use a more stable URI?
			//uri = "https://cn.dataone.org/cn/v1/resolve/" + pid;
			
			// destroy and recreate
			if ($(div).data('annotator')) {
				$(div).annotator('destroy');
				//$(div).destroy();
			}
			
			

			// only use authentication plugin when logged in
			var authOptions = false;
			if (appModel.get('username')) {
				// check if we are using our own token generator
				var tokenUrl = appModel.get('tokenUrl');
				authOptions = {
					tokenUrl: tokenUrl,
					//token: 'eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJpc3N1ZWRBdCI6ICIyMDE0LTEwLTIxVDE4OjUyOjUwKzAwOjAwIiwgInR0bCI6IDg2NDAwLCAiY29uc3VtZXJLZXkiOiAiYW5ub3RhdGVpdCIsICJ1c2VySWQiOiAibGVpbmZlbGRlciJ9.jh3RBTXNJis8697lCtPylShzj9O2oNN_ec11s9tbkTc'
				}
			}
			
			// set up the annotator
			$(div).annotator();
			$(div).annotator().annotator('setupPlugins', {}, {
				Tags: false,
				Auth: authOptions,
				Store: {
					//prefix: "http://dev.nceas.ucsb.edu:5000",
					annotationData: {
						'uri': uri,
						'pid': pid
					},
					loadFromSearch: {
						'limit': 20,
						'uri': uri 
					}
				}
			});
			
			// need connect keyboard navigation to the hover
			var focus = function(event, ui) {
				console.log("This is the value focused: " + ui.item.value);
				//TODO: connect keyboard focus event to show the hover popover 
			};

			// NOTE: using the extended hover auto-complete defined in lookup model
			// set up tags with bioportal suggestions as default
			$(div).annotator().annotator('addPlugin', 'Tags');
			$(div).data('annotator').plugins.Tags.input.hoverAutocomplete({
				source: lookupModel.bioportalSearch,
				focus: focus,
				position: {
					my: "left top",
					at: "right bottom",
					collision: "fit"
				}
			});
			
			
			// set up rejection field
			$(div).data('annotator').editor.addField({
		        type: 'checkbox',
		        label: '<strong>Reject</strong> this annotation?',
		        load: function(field, annotation) {
		        	$(field).find('input').removeAttr("checked");
		            if (annotation.reject) {
			            $(field).find('input').prop("checked", "checked");
		            }
		            return $(field).find('input').is(":checked");
		          },
		          submit: function(field, annotation) {
		        	  var input = $(field).find('input');
		        	  var val = input.is(":checked");
		        	  return annotation.reject = val;
		          }
		          
		      });
			
			// subscribe to annotation events, to get the exact resource being annotated
			$(div).annotator('subscribe', 'beforeAnnotationCreated', function(annotation, arg0, arg1) {
				var annotator = $(div).data('annotator');
				var selectedElement = annotator.selectedRanges[0].commonAncestor;
				
				// find the first parent with a "resource" attribute
				var resourceElem = $(selectedElement).parents('[resource]');
				if (resourceElem) {
					// add the resource identifier to the annotation
					$.extend(annotation, {resource: $(resourceElem).attr('resource')});
					
					// change the autocomplete depending on type of element being annotated
					var type = $(resourceElem).attr('type');
					if (type == "party") {
						$(div).data('annotator').plugins.Tags.input.hoverAutocomplete({
							source: lookupModel.orcidSearch,
							//focus: focus
						});
						$.extend(annotation, {"oa:Motivation": "prov:wasAttributedTo"});
						$.extend(annotation, {"field": "orcid_sm"});

					} else {
						$(div).data('annotator').plugins.Tags.input.hoverAutocomplete({
							source: lookupModel.bioportalSearch,
							//focus: focus
						});
						$.extend(annotation, {"oa:Motivation": "oa:tagging"});
						$.extend(annotation, {"field": "annotation_sm"});
					}
					
					//alert('Augmented annotation with additional properties, annotation: ' + annotation);
				}
				
			});
			
			// Use tag as hyperlink in the annotation
			var updateAnnotationLinks = function(editor) {
				var annotation = editor.annotation;
				if (annotation.tags) {
					var value = annotation.tags[0];
					// TODO: test for valid URI
					// add the uri as a link
					$.extend(annotation, 
						{links: [{
						        	type: "text/html",
						        	href: value,
						        	rel: "alternate"
								}]
						}
					);
				}
			};
			
			// NOTE: just using the annotateit.org links for now
			//$(div).annotator('subscribe', 'annotationEditorSubmit', updateAnnotationLinks);

			// init the sidr on annotation load
			var viewRef = this;
			
			var showSidr = function(annotations) {
				
				// sort the annotations by xpath
				annotations = _.sortBy(annotations, function(ann) {
					return ann.resource;
				});
				
				$("#view_annotations").sidr({
					name: "gutter",
					side: "right",
					displace: false
				})
				// default to open
				$.sidr("open", "gutter");
				
				// render the annotations in the gutter
				var gutter = $("#gutter");
				gutter.html(viewRef.annotationTemplate({
					annotations: annotations
				}));
				
				// define hover action to mimic hovering the highlight
				var hoverAnnotation = function(event) {
					
					// figure out the annotation being selected
					var annotationId = $(event.target).attr("id");
					
					// trigger as if a hover on highlight
					var highlight = $("[data-annotation-id='" + annotationId + "']");
					var target = $(event.target);
					var targetLoc = target.offset();
					
					// make sure the highlight is viewable in active tab
					var tabId = $(highlight).parents(".tab-pane").attr("id");
					$("a[href='#" + tabId + "']").trigger("click");
					
					// scroll the location in page
					var highlightLocation = highlight.position();
					$("html, body").animate({ scrollTop: highlightLocation.top - 50 }, "slow");
					
					// trigger the hover
					highlight.trigger({
						type: "mouseover",
						pageY: highlightLocation.top + 50,
						pageX: highlightLocation.left + highlight.width() + 100,
					});
				};
				
				$(".hover-proxy").bind("click", hoverAnnotation);
			}
						
			// reindex when an annotation is updated
			var reindexPid = function() {
				var query = appModel.get('metacatServiceUrl') + "?action=reindex&pid=" + pid;
				$.get(query, function(data, status, xhr) {
					// TODO: check for any success?
					//we are done now
				});
				
				// re load the annotations
				showSidr($(div).data('annotator').plugins.Store.annotations);
				
			};
			
			$(div).annotator('subscribe', 'annotationCreated', reindexPid);
			$(div).annotator('subscribe', 'annotationUpdated', reindexPid);
			$(div).annotator('subscribe', 'annotationDeleted', reindexPid);
			
			$(div).annotator('subscribe', 'annotationsLoaded', showSidr);

			

			


		}
		
	});
	
	return MetadataView;		
});
