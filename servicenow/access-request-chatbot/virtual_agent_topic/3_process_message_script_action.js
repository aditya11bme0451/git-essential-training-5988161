/**
 * Virtual Agent Designer → node "Process message" (Utilities → Script Action)
 * Sends the user's answer to the chat engine, which calls the Now Assist
 * Skill Kit skill and, after confirmation, submits the catalog item.
 */
(function execute() {
    var message = vaInputs.user_message ? vaInputs.user_message + '' : '';
    var result = new global.AccessRequestChatEngine().handleMessageWithState(vaVars.chat_state, message);
    vaVars.chat_state = result.state;
    vaVars.bot_reply = result.reply;
    vaVars.chat_done = result.done ? 'true' : 'false';
    vaVars.request_link = result.link || '';
})()
