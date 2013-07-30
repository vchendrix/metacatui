/*global Backbone */
'use strict';

define(['jquery',	'underscore', 'backbone', 'views/IndexView', 'views/AboutView', 'views/ToolsView', 'views/DataCatalogView', 'views/RegistryView', 'views/MetadataView', 'views/ExternalView'], 				
function ($, _, Backbone, IndexView, AboutView, ToolsView, DataCatalogView, RegistryView, MetadataView, ExternalView) {

	var app = app || {};
	var indexView = new IndexView();
	var aboutView = aboutView || new AboutView();
	var toolsView = toolsView || new ToolsView();
	var dataCatalogView = new DataCatalogView();
	var registryView = new RegistryView();
	var metadataView = new MetadataView();
	var externalView = new ExternalView();


	
	// MetacatUI Router
	// ----------------
	var UIRouter = Backbone.Router.extend({
		routes: {
			''                          : 'renderIndex', // the default route
			'about'                     : 'renderAbout',  // about page
			'about(/:anchorId)'         : 'renderAbout',  // about page anchors
			'plans'                     : 'renderPlans',  // plans page
			'tools(/:anchorId)'         : 'renderTools',  // tools page
			'data(/search/:searchTerm)' : 'renderData',    // data search page
			'view/:pid'                 : 'renderMetadata',    // metadata page
			'external(/*url)'           : 'renderExternal',    // renders the content of the given url in our UI
			'logout'                    : 'logout',    // logout the user
			'share'                     : 'renderRegistry'    // registry page
		},

		renderIndex: function (param) {
			console.log('Called UIRouter.renderIndex()');
			appView.showView(indexView);
		},
		
		renderAbout: function (anchorId) {
			console.log('Called UIRouter.renderAbout()');
			aboutModel.set('anchorId', anchorId);
			appView.showView(aboutView);
		},
		
		renderPlans: function (param) {
			console.log('Called UIRouter.renderPlans()');
		},
		
		renderTools: function (anchorId) {
			console.log('Called UIRouter.renderTools()');
			toolsModel.set('anchorId', anchorId);
			appView.showView(toolsView);
		},
		
		renderData: function (searchTerm) {
			console.log('Called UIRouter.renderData()');
			if (searchTerm) {
				appModel.set('searchTerm', searchTerm);
			}
			appView.showView(dataCatalogView);
		},
		
		renderMetadata: function (pid) {
			console.log('Called UIRouter.renderMetadata()');
			appModel.set('pid', pid);
			appView.showView(metadataView);
		},
		
		renderRegistry: function (param) {
			console.log('Called UIRouter.renderRegistry()');
			appView.showView(registryView);
		},
		
		logout: function (param) {
			console.log('Called UIRouter.logout()');
			registryView.logout();
			//appView.showView(indexView);
		},
		
		renderExternal: function(url) {
			// use this for rendering "external" content pulled in dynamically
			console.log('Called UIRouter.renderExternal()');
			externalView.url = url;
			externalView.render();
		}
		
	});

	return UIRouter;
});