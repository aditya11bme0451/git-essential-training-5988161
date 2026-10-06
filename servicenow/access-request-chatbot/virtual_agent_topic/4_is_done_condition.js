/**
 * Virtual Agent Designer → node "Finished?" (Utilities → Decision)
 * Branch 1 "Finished" uses this condition script. Branch 2 "Continue" is the
 * default branch and connects back to the "Chat turn" node.
 */
(function execute() {
    return vaVars.chat_done == 'true';
})()
