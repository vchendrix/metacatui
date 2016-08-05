/*global define */
define(['jquery', 'underscore', 'backbone', 'text!templates/mdqRun.html'], 				
	function($, _, Backbone, MdqRunTemplate) {
	'use strict';
	
	// Build the Footer view of the application
	var MdqRunView = Backbone.View.extend({

		el: '#Content',
				
		events: {
			"click input[type='submit']"	:	"submitForm"
		},
				
		url: "/mdq-webapp/webapi/suites/test-lter-suite.1.1/run",
		
		pid: null,
		
		template: _.template(MdqRunTemplate),
		
		initialize: function () {
			
		},
				
		render: function () {
			var viewRef = this;

			if (this.pid) {
				// fetch the metadata contents by the pid
				var xhr = new XMLHttpRequest();
				xhr.onreadystatechange = function(){
				    if (this.readyState == 4 && this.status == 200){
				        //this.response is what you're looking for
				        //handler(this.response);
				        console.log(this.response, typeof this.response);
				        var documentBlob = this.response;
				        // send to MDQ as blob
						var formData = new FormData();
						formData.append('document', documentBlob);
						console.log("Submitting Blob to MDQ");
						viewRef.showResults(formData);
				    }
				}
				var url = appModel.get("objectServiceUrl") + this.pid;
				xhr.open('GET', url);
				xhr.responseType = 'blob';
				xhr.withCredentials = true;
				xhr.setRequestHeader("Authorization", "Bearer " + appUserModel.get("token"));
				xhr.send();  
				
			} else {
				this.$el.html(this.template({}));
			}
			
		},
		
		// do the work of sending the data and rendering the results
		showResults: function(formData) {
			var viewRef = this;
			
			try {				
				var args = {
						url: this.url,
						cache: false,
						data: formData,
					    contentType: false, //"multipart/form-data",
					    processData: false,
					    type: 'POST',
						success: function(data, textStatus, xhr) {
							data = _.extend(data, {objectIdentifier: viewRef.pid})
							viewRef.$el.html(viewRef.template(data));
							//Initialize all popover elements
							$('.popover-this').popover();
						}
				};
				$.ajax(args);
			} catch (error) {
				console.log(error.stack);
			}
		},
		
		submitForm: function(event) {
			console.log("Submitting form to MDQ");
				
			var form = $(event.target).parents("form");

			var formData = new FormData($(form)[0]);

			this.showResults(formData);
			
			return false;

		}
				
	});
	return MdqRunView;		
});
