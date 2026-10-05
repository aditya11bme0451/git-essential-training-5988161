/**
 * AI Agent Studio tool
 *   Name:        Submit access request
 *   Type:        Script
 *   Description: Submits the access request catalog item. Only call this after
 *                the user has confirmed the summary. Requires the sys_id of the
 *                Requested for user (from "Lookup user"), the Action value
 *                (from "Get action options") and the Comments text.
 *   Inputs:
 *     requested_for_sys_id (string, mandatory) - sys_id returned by Lookup user
 *     action               (string, mandatory) - value returned by Get action options
 *     comments             (string, mandatory) - justification / details from the user
 *   Execution mode: Supervised (user must approve before it runs)
 */
(function(inputs) {
    return new global.AccessRequestAgentUtils().submitRequest(
        inputs.requested_for_sys_id,
        inputs.action,
        inputs.comments
    );
})(inputs);
