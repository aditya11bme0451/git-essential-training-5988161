/**
 * Virtual Agent Designer → node "Request link" (Bot Response → Link)
 * Link URL (script mode):
 */
(function execute() {
    return vaVars.request_link;
})()

/**
 * Node condition (Conditions tab of the same node, script mode), so the link
 * is only shown when a request was created:
 *
 * (function execute() {
 *     return !!vaVars.request_link;
 * })()
 */
