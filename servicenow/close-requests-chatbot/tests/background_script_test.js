/**
 * Run in System Definition → Scripts - Background (sub-production).
 * Replace the numbers with real, open records you are allowed to close.
 * With SUBMIT = false the conversation stops at the summary.
 */
var RITM = 'RITM0012345';
var SCTASK = 'SCTASK0012345';
var SUBMIT = false;

var utils = new global.CloseRequestCatalogUtils();
gs.info('1) Config check (null = OK): ' + JSON.stringify(utils.checkConfig()));
gs.info('2) Close code options: ' + JSON.stringify(utils.getCloseCodeOptions()));
gs.info('3) ' + RITM + ': ' + JSON.stringify(utils.checkRecord(RITM, gs.getUserID())));
gs.info('4) ' + SCTASK + ': ' + JSON.stringify(utils.checkRecord(SCTASK, gs.getUserID())));

var engine = new global.CloseRequestChatEngine();
var r = engine.start('I want to close ' + RITM);   // as if typed in Otto
gs.info('USER: I want to close ' + RITM + '\nBOT : ' + r.reply);

var turns = ['also ' + SCTASK, 'completed', 'The work was finished last week'];
if (SUBMIT)
    turns.push('yes');
for (var i = 0; i < turns.length; i++) {
    r = engine.handleMessage(r.state, turns[i]);
    gs.info('USER: ' + turns[i] + '\nBOT : ' + r.reply + (r.request_number ? '  [' + r.link + ']' : ''));
}
