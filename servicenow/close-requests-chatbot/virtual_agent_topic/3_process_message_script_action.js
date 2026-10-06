/**
 * Virtual Agent Designer → node "Process message" (Utilities → Script Action)
 */
(function execute() {
    var message = vaInputs.user_message ? vaInputs.user_message + '' : '';
    var result = new global.CloseRequestChatEngine().handleMessage(vaVars.chat_state, message);
    vaVars.chat_state = result.state;
    vaVars.bot_reply = result.reply;
    vaVars.chat_done = result.done ? 'true' : 'false';
    vaVars.request_link = result.link || '';
})()
