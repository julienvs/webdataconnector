(function() {
  'use strict';

  // This config stores the important strings needed to
  // connect to the foursquare API and OAuth service to
  // gain authorization that we then exchange for an access  
  // token.
  //
  // Do not store your client secret here. 
  // We are using a server-side OAuth flow, and the client 
  // secret is kept on the web server. 
  var config = {
      clientId: 'tableau',
      redirectUri: 'http://localhost:3333/redirect',
      authUrl: 'https://yaska.zendesk.com/',
      version: '20190102'
  }; 
// Called when web page first loads and when
  // the OAuth flow returns to the page
  //
  // This function parses the access token in the URI if available
  // It also adds a link to the foursquare connect button
  $(document).ready(function() {
    var accessToken = Cookies.get("accessToken");
    var hasAuth = accessToken && accessToken.length > 0;
    updateUIWithAuthState(hasAuth);

    $("#connectbutton").click(function() {
        doAuthRedirect();
    });

    $("#getvenuesbutton").click(function() {
        tableau.connectionName = "Zendesk";
        tableau.submit();
    });
});

// An on-click function for the connect to foursquare button,
// This will redirect the user to a Foursquare login
function doAuthRedirect() {
    var appId = config.clientId;
    if (tableau.authPurpose === tableau.authPurposeEnum.ephemerel) {
      appId = config.clientId;  // This should be Desktop
    } else if (tableau.authPurpose === tableau.authPurposeEnum.enduring) {
      appId = config.clientId; // This should be the Tableau Server appID
    }


    var url = config.authUrl + 'oauth/authorizations/new?response_type=code&redirecturi=' + config.redirectUri + '&client_id=' + config.clientId + '&scope=read';
    window.location.href = url;
}


//


//------------- OAuth Helpers -------------//
// This helper function returns the URI for the venueLikes endpoint
// It appends the passed in accessToken to the call to personalize the call for the user
function getVenueLikesURI(accessToken) {
    //return "https://api.foursquare.com/v2/users/self/venuelikes?oauth_token=" +
      //      accessToken + "&v=" + config.version;
      return "https://yaska.zendesk.com/api/v2/tickets.json";
            
}

// This function toggles the label shown depending
// on whether or not the user has been authenticated
function updateUIWithAuthState(hasAuth) {
    if (hasAuth) {
        $(".notsignedin").css('display', 'none');
        $(".signedin").css('display', 'block');
    } else {
        $(".notsignedin").css('display', 'block');
        $(".signedin").css('display', 'none');
    }
}

//------------- Tableau WDC code -------------//
// Create tableau connector, should be called first
var myConnector = tableau.makeConnector();

// Init function for connector, called during every phase but
// only called when running inside the simulator or tableau
myConnector.init = function(initCallback) {
    tableau.authType = tableau.authTypeEnum.custom;

    // If we are in the auth phase we only want to show the UI needed for auth
    if (tableau.phase == tableau.phaseEnum.authPhase) {
      $("#getvenuesbutton").css('display', 'none');
    }

    if (tableau.phase == tableau.phaseEnum.gatherDataPhase) {
      // If the API that WDC is using has an endpoint that checks
      // the validity of an access token, that could be used here.
      // Then the WDC can call tableau.abortForAuth if that access token
      // is invalid.
    }

    var accessToken = Cookies.get("accessToken");
    console.log("Access token is '" + accessToken + "'");
    var hasAuth = (accessToken && accessToken.length > 0) || tableau.password.length > 0;
    updateUIWithAuthState(hasAuth);

    initCallback();

    // If we are not in the data gathering phase, we want to store the token
    // This allows us to access the token in the data gathering phase
    if (tableau.phase == tableau.phaseEnum.interactivePhase || tableau.phase == tableau.phaseEnum.authPhase) {
        if (hasAuth) {
            tableau.password = accessToken;

            if (tableau.phase == tableau.phaseEnum.authPhase) {
              // Auto-submit here if we are in the auth phase
              tableau.submit()
            }

            return;
        }
    }
};

// Declare the data to Tableau that we are returning from Foursquare
myConnector.getSchema = function(schemaCallback) {
   var schema = [];

    var col1 = { id: "url", dataType: "string"};
    var col2 = { id: "id", dataType: "float"};
    var col3 = { id: "status", dataType: "string"};
    var col4 = { id: "recipient", dataType: "string"};
    var cols = [col1, col2, col3, col4];

    var tableInfo = {
      id: "ZendeskTable",
      columns: cols
    }

    schema.push(tableInfo);

    schemaCallback(schema);
};

// This function actually make the foursquare API call and
// parses the results and passes them back to Tableau
myConnector.getData = function(table, doneCallback) {
    var dataToReturn = [];
    var hasMoreData = false;

    var accessToken = tableau.password;
    var connectionUri = getVenueLikesURI(accessToken);


    var xhr = $.ajax({
        //url: connectionUri,
        url: 'https://yaska.zendesk.com/api/v2/tickets.json',
        beforeSend: function(request) {
          request.setRequestHeader('Authorization', 'Bearer ' +  accessToken);
        },
        dataType: 'json',
        success: function (data) {

          
            if (data) {
              console.log(data);
                //var venues = data.response.venues.items;
                var tickets = data.tickets;
                var ii;
                for (ii = 0; ii < tickets.length; ++ii) {
                  var venue = { 'url': tickets[ii].url,
                                'id': tickets[ii].id,
                                'status': tickets[ii].status,
                                'recipient': tickets[ii].recipient
                                };
                                 
                    dataToReturn.push(venue);
                }

                table.appendRows(dataToReturn);
                doneCallback();
            }
            else {
                tableau.abortWithError("No results found");
            }
            
        },
        error: function (xhr, ajaxOptions, thrownError) {
            // WDC should do more granular error checking here
            // or on the server side.  This is just a sample of new API.
            tableau.abortForAuth("Invalid Access Token");
        }
    });
};

// Register the tableau connector, call this last
tableau.registerConnector(myConnector);
})();