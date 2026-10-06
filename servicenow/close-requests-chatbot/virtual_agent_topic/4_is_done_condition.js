/**
 * Virtual Agent Designer → Decision node "Finished?" → branch "Finished" condition.
 * Branch "Continue" is the default and loops back to "Chat turn".
 */
(function execute() {
    return vaVars.chat_done == 'true';
})()
