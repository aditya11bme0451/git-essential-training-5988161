/**
 * Virtual Agent Designer → node "Chat turn" (User Input → Text)
 * Paste into the node's "Question" field after switching it to script mode.
 * Shows the bot's latest reply as the question; the user's answer is stored
 * in the node variable "user_message".
 */
(function execute() {
    return vaVars.bot_reply;
})()
