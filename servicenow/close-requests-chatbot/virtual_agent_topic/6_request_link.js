/**
 * Virtual Agent Designer → node "Open my request" (Bot Response → Link)
 * Link URL (script mode):
 */
(function execute() {
    return vaVars.request_link;
})()

/**
 * Node condition (Conditions tab, script mode) - only show when submitted:
 *
 * (function execute() {
 *     return !!vaVars.request_link;
 * })()
 */
