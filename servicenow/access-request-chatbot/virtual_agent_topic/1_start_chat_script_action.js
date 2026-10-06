/**
 * Virtual Agent Designer → node "Start chat" (Utilities → Script Action)
 * Runs once when Otto hands the conversation to this topic.
 */
(function execute() {
    var result = new global.AccessRequestChatEngine().startWithState();
    vaVars.chat_state = result.state;
    vaVars.bot_reply = result.reply;
    vaVars.chat_done = result.done ? 'true' : 'false';
    vaVars.request_link = '';
})()
