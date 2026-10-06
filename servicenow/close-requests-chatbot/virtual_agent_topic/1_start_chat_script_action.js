/**
 * Virtual Agent Designer → node "Start chat" (Utilities → Script Action)
 * Runs when Otto hands the conversation to this topic. The user's opening
 * message (e.g. "I want to close RITM0012345") is processed right away, so
 * the number is picked up without asking again.
 */
(function execute() {
    var firstMessage = vaSystem.getSearchText() || '';
    var result = new global.CloseRequestChatEngine().start(firstMessage);
    vaVars.chat_state = result.state;
    vaVars.bot_reply = result.reply;
    vaVars.chat_done = result.done ? 'true' : 'false';
    vaVars.request_link = '';
})()
