/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	// Application Model
	// ------------------
	var AppModel = Backbone.Model.extend({
		// This model contains all of the attributes for the Application
		defaults: {
			headerType: 'default',
			title: window.themeTitle || "Metacat Data Catalog",
			searchMode: mapKey ? 'map' : 'list',
			searchHistory: [],
			sortOrder: 'dateUploaded+desc',
			pid: null,
			previousPid: null,
			anchorId: null,
			profileUsername: null,
			page: 0,
			baseUrl: "https://cn.dataone.org", //Use proxy-server on your domain for older IE compatibility
			// the most likely item to change is the Metacat deployment context
			context: '',
			d1Service: null,
			d1CNBaseUrl: "https://cn.dataone.org",
			d1CNService: "cn/v1",
			viewServiceUrl: null,
			packageServiceUrl: null,
			publishServiceUrl: null,
			authServiceUrl: null,
			queryServiceUrl: null,
			metaServiceUrl: null,
			registryServiceUrl: null,
			ldapwebServiceUrl: null,
			metacatServiceUrl: null,
			objectServiceUrl: null,
			// NOTE: include your bioportal apikey for suggested classes
			// see: http://bioportal.bioontology.org/account
			bioportalServiceUrl: "https://data.bioontology.org/search?ontologies=D1-CARBON-FLUX,PROV-ONE,ENVO,CHEBI,DATA-CITE,DC-TERMS,OWL-TIME&apikey=24e4775e-54e0-11e0-9d7b-005056aa3316&pagesize=1000&suggest=true&q=",
			orcidServiceUrl: "https://pub.orcid.org/v1.1/search/orcid-bio?q=",
			tokenUrl: null,
			annotatorUrl: null,
			accountsUrl: null,
			pendingMapsUrl: null,
			prov: false,
			//--DataONE theme-specific URLs--//
			resolveServiceUrl: null,			
			d1LogServiceUrl: null,
			nodeServiceUrl: null,
			signInUrl: null,
			signInUrlOrcid: null,
			signInUrlLdap: null,
		},
		
		defaultView: "data",
		
		initialize: function() {
			
			//For IE
			if (!window.location.origin) {
				var baseUrl = window.location.protocol + "//" + window.location.host;
				
				//this.set('baseUrl', baseUrl);
				//this.set('d1CNBaseUrl', baseUrl);
			}
			
			//this.set('publishServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/publish/');
			this.set('authServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1CNService') + '/isAuthorized/');
			this.set('queryServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1CNService') + '/query/solr/?');
			this.set('metaServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1CNService') + '/meta/');
			//this.set('objectServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1CNService') + '/resolve/');
			this.set('resolveServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1CNService') + '/resolve/');
			//this.set('registryServiceUrl', this.get('baseUrl') + this.get('context') + '/cgi-bin/register-dataset.cgi');
			//this.set('ldapwebServiceUrl', this.get('baseUrl') + this.get('context') + '/cgi-bin/ldapweb.cgi');
			//this.set('metacatServiceUrl', this.get('baseUrl') + this.get('context') + '/metacat');
			this.set('nodeServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1CNService') + '/node');
			this.set("accountsUrl", this.get("d1CNBaseUrl") + this.get("d1CNService") + "/accounts/");

			this.set('d1LogServiceUrl', this.get('baseUrl') + this.get('d1Service') + 'logsolr');
			//this.set('d1LogServiceUrl', this.get('baseUrl') + '/solr/d1-cn-log/select/?');

			//Settings for the DataONE API v2 only
			if(this.get("d1CNService").indexOf("v2") > -1){
				this.set('viewServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1CNService') + '/views/metacatui/');
				//this.set('packageServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/package/');
				this.set('tokenUrl', this.get('baseUrl') + '/portal/token');
				this.set("prov", true);
				this.set('resolveServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1CNService') + '/resolve/');
				this.set("signInUrl", this.get('baseUrl') + "/portal/startRequest?target=");
				this.set("signInUrlOrcid", this.get('baseUrl') + "/portal/oauth?action=start&target=");
				this.set("signInUrlLdap", this.get('baseUrl') + "/portal/ldap?target=");
				
				// use portal to  retrieve token and annotate metadata
				//this.set('annotatorUrl', this.get('baseUrl') + '/portal/annotator');
				//this.set('tokenUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/token');
				//this.set('annotatorUrl', this.get('baseUrl') + this.get('context') + '/annotator');				
				
			}
			
			this.on("change:pid", this.changePid);

		},
		
		changePid: function(model, name){			
			this.set("previousPid", model.previous("pid"));
		}
		
	});
	return AppModel;		
});
