/* global define */
define(['jquery',
		'underscore',
		'backbone',
		'models/DataONEObject',
		'models/metadata/eml211/EMLText'],
    function($, _, Backbone, DataONEObject, EMLText) {

	var EMLMethods = Backbone.Model.extend({

		defaults: function(){
			return {
				objectXML: null,
				objectDOM: null,
				methodStepDescription: [],
				studyExtentDescription: null,
				samplingDescription: null
			}
		},

		initialize: function(attributes){
			attributes = attributes || {};

			if(attributes.objectDOM) this.parse(attributes.objectDOM);

			//specific attributes to listen to
			this.on("change:methodStepDescription change:studyExtentDescription change:samplingDescription",
					this.trickleUpChange);
		},

		/*
     * Maps the lower-case EML node names (valid in HTML DOM) to the camel-cased EML node names (valid in EML).
     * Used during parse() and serialize()
     */
    nodeNameMap: function(){
    	return {
    		"methodstep" : "methodStep",
				"substep" : "subStep",
				"datasource" : "dataSource",
				"studyextent" : "studyExtent",
				"samplingdescription" : "samplingDescription",
				"spatialsamplingunits" : "spatialSamplingUnits",
				"referencedentityid" : "referencedEntityId",
				"qualitycontrol" : "qualityControl"
        }
    },

		parse: function(objectDOM) {
			var modelJSON = {};

			if (!objectDOM) var objectDOM = this.get("objectDOM");

			this.set('methodStepDescription', _.map($(objectDOM).find('methodstep description'), function(el, i) {
				return new EMLText({
					objectDOM: el,
					type: 'description'
				 });
			}));

			if ($(objectDOM).find('sampling studyextent description').length > 0) {
				this.set('studyExtentDescription', new EMLText({
					objectDOM: $(objectDOM).find('sampling studyextent description').get(0),
					type: 'description'
				}));
			}

			if ($(objectDOM).find('sampling samplingdescription').length > 0) {
				this.set('samplingDescription', new EMLText({
					objectDOM: $(objectDOM).find('sampling samplingdescription').get(0),
					type: 'samplingDescription'
			 	}));
			}

			return modelJSON;
		},

		serialize: function(){
			var objectDOM = this.updateDOM();

			if(!objectDOM)
				return "";

			var xmlString = objectDOM.outerHTML;

			//Camel-case the XML
	    xmlString = this.formatXML(xmlString);

  		return xmlString;
		},

		/*
		 * Makes a copy of the original XML DOM and updates it with the new values from the model.
		 */
		updateDOM: function(){
			var objectDOM;

			if (this.get("objectDOM")) {
				objectDOM = this.get("objectDOM").cloneNode(true);
			} else {
				objectDOM = $(document.createElement("methods"));
			}

			objectDOM = $(objectDOM);

			var methodStepsFromModel = this.get('methodStepDescription'),
					methodStepsFromDOM   = $(objectDOM).find("methodstep");

			//If there are no method steps or they are all empty...
			if ( methodStepsFromModel.length == 0 || _.every(methodStepsFromModel, function(step){ return step.isEmpty(); }) ){

				//Remove all existing method steps from the EML
				if(methodStepsFromDOM.length){
					methodStepsFromDOM.remove();
				}

				// If there are no method steps but there is sampling metadata, then insert an empty method step
				if( this.get('samplingDescription') || this.get('studyExtentDescription') )
					objectDOM.prepend("<methodStep><description><para>No method step description provided.</para></description></methodStep>");
			}
			else{
				//Update the method step descriptions
				_.each(methodStepsFromModel, function(stepDescription, i) {

					//If there is a method step node in the DOM at this position, then update it
					if( methodStepsFromDOM[i] ){

						if( stepDescription.isEmpty() || stepDescription.get("text") == "No method step description provided." ){
							$(methodStepsFromDOM[i]).remove();
						}
						else{
							$(methodStepsFromDOM[i]).children("description")
													 .replaceWith( stepDescription.updateDOM() );
						}

					}
					//Otherwise, create a new method step node
					else{
						var lastMethodStep = objectDOM.find("methodstep").last();

						lastMethodStep.after( $(document.createElement('methodStep'))
																.append( stepDescription.updateDOM() ) );
					}

				});
			}

			// Update the sampling metadata
			if (this.get('samplingDescription') || this.get('studyExtentDescription')) {

				var samplingEl    = $(document.createElement('sampling')),
				    studyExtentEl = $(document.createElement('studyExtent'));

				if (this.get('studyExtentDescription') && !this.get('studyExtentDescription').isEmpty()) {
					$(studyExtentEl).append(this.get('studyExtentDescription').updateDOM());
				} else {
					$(studyExtentEl).append($(document.createElement('description')).html("<para>No study extent description provided.</para>"));
				}

				$(samplingEl).append(studyExtentEl);

				if (this.get('samplingDescription') && !this.get('samplingDescription').isEmpty()) {
					$(samplingEl).append(this.get('samplingDescription').updateDOM());
				} else {
					$(samplingEl).append($(document.createElement('samplingDescription')).html("<para>No sampling description provided.</para>"));
				}

				//Find the existing <sampling> element
				var existingSampling = objectDOM.find("sampling");

				//Replace the existing sampling element, if it exists
				if( existingSampling.length > 0 ){
					existingSampling.replaceWith(samplingEl);
				}
				//Or append a new one
				else{
					objectDOM.append(samplingEl);
				}

			}

			// Remove empty (zero-length or whitespace-only) nodes
			objectDOM.find("*").filter(function() { return $.trim(this.innerHTML) === ""; } ).remove();

			//Check if all the content is filler content. This means there are no method steps, no sampling description, and
			// no study extent description.
			if( objectDOM.find("methodstep").length == 1 &&
					objectDOM.find("methodstep description para").text() == "No method step description provided." &&
					objectDOM.find("samplingdescription").length == 1 &&
					objectDOM.find("samplingdescription para").text() == "No sampling description provided." &&
					objectDOM.find("studyextent").length == 1 &&
					objectDOM.find("studyextent description para").text() == "No study extent description provided." ){

					//If it is all empty / filler content, then totally remove the methods
					return "";

			}

			//If there are sampling nodes listed before methodStep nodes, then reorder them
			if( objectDOM.children().index(objectDOM.find("methodstep").last()) >
						objectDOM.children().index(objectDOM.find("sampling").last()) ){

				//Detach all the sampling nodes and append them to the parent node
				objectDOM.append( objectDOM.children("sampling").detach() );

			}

			 return objectDOM;
		},

		/*
		*  function isEmpty() - Will check if there are any values set on this model
		* that are different than the default values and would be serialized to the EML.
		*
		* @return {boolean} - Returns true is this model is empty, false if not
		*/
		isEmpty: function(){

			if( !this.get("methodStepDescription").length || !this.get("methodStepDescription") ){

					if( this.get("studyExtentDescription") == this.defaults().studyExtentDescription ||
						!this.get("studyExtentDescription") ){

							if( this.get("samplingDescription") == this.defaults().samplingDescription ||
								!this.get("samplingDescription")){
									return true;
							}

						}

			}
			else if( this.get("methodStepDescription").length == 1 &&
				this.get("methodStepDescription")[0].get("text").length == 1 &&
				this.get("methodStepDescription")[0].get("text")[0] == "No method step description provided." &&
				this.get("samplingDescription").length == 1 &&
				this.get("samplingDescription")[0].get("text").length == 1 &&
				this.get("samplingDescription")[0].get("text")[0] == "No sampling description provided." &&
				this.get("studyExtentDescription").length == 1 &&
				this.get("studyExtentDescription")[0].get("text").length == 1 &&
				this.get("studyExtentDescription")[0].get("text")[0] == "No study extent description provided."){

					return true;

			}
			else{

				return false;

			}

		},

		trickleUpChange: function(){
			MetacatUI.rootDataPackage.packageModel.set("changed", true);
		},

		formatXML: function(xmlString){
			return DataONEObject.prototype.formatXML.call(this, xmlString);
		}
	});

	return EMLMethods;
});
