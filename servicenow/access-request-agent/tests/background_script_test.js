/**
 * Run in System Definition → Scripts - Background (in a sub-production instance).
 * Checks configuration and, if SUBMIT is true, submits one real test request.
 */
var SEARCH = 'me';      // a name, user ID or email
var ACTION = 'Add';     // a label or value from the Action choices
var SUBMIT = false;     // set to true to actually create a REQ

var utils = new global.AccessRequestAgentUtils();

gs.info('1) Action options: ' + JSON.stringify(utils.getActionOptions()));

var users = utils.findUsers(SEARCH);
gs.info('2) User lookup: ' + JSON.stringify(users));

if (SUBMIT && users.status == 'ok') {
    var res = utils.submitRequest(users.matches[0].sys_id, ACTION, 'Test submission from AccessRequestAgentUtils');
    gs.info('3) Submit result: ' + JSON.stringify(res));
} else {
    gs.info('3) Submit skipped (SUBMIT=false or no user found).');
}

// Negative checks: both should return status "error" without creating anything.
gs.info('4) Bad action: ' + JSON.stringify(utils.submitRequest(gs.getUserID(), 'delete-everything', 'x')));
gs.info('5) Empty comments: ' + JSON.stringify(utils.submitRequest(gs.getUserID(), ACTION, '  ')));
