/**
 * Run in System Definition → Scripts - Background (in a sub-production instance).
 *
 * Part 1 checks the catalog configuration without calling the LLM.
 * Part 2 plays a whole conversation through the Skill Kit skill, the same way
 * the chat widget does. With SUBMIT = false it stops before saying "yes".
 */
var ACTION = 'Add';     // a label or value from the Action choices
var SUBMIT = false;     // set to true to actually create a REQ at the end

// ---- Part 1: catalog configuration --------------------------------------
var utils = new global.AccessRequestCatalogUtils();
gs.info('1) Action options: ' + JSON.stringify(utils.getActionOptions()));
gs.info('2) Lookup "me": ' + JSON.stringify(utils.findUsers('me')));
gs.info('3) Bad action (expect error): ' + JSON.stringify(utils.submitRequest(gs.getUserID(), 'delete-everything', 'x')));
gs.info('4) Empty comments (expect error): ' + JSON.stringify(utils.submitRequest(gs.getUserID(), ACTION, '  ')));

// ---- Part 2: scripted conversation through the skill ---------------------
var engine = new global.AccessRequestChatEngine();
var turns = [
    'Hi, I need to request access',
    'it is for me',
    ACTION.toLowerCase() + ' please',
    'Read access to the Finance shared drive for month-end close'
];
if (SUBMIT)
    turns.push('yes, submit it');

gs.info('BOT : ' + engine.start().reply);
for (var i = 0; i < turns.length; i++) {
    gs.info('USER: ' + turns[i]);
    var res = engine.handleMessage(turns[i]);
    gs.info('BOT : ' + res.reply + (res.request_number ? '  [' + res.request_number + ' ' + res.link + ']' : ''));
}
