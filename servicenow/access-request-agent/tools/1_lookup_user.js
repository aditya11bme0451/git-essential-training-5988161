/**
 * AI Agent Studio tool
 *   Name:        Lookup user
 *   Type:        Script
 *   Description: Finds active ServiceNow users by name, user ID or email so the
 *                "Requested for" person can be identified. Pass "me" for the
 *                person currently chatting. Returns up to 5 matches.
 *   Inputs:
 *     search_term (string, mandatory) - name, user ID, email, or "me"
 *   Execution mode: Autonomous (read-only, no confirmation needed)
 */
(function(inputs) {
    return new global.AccessRequestAgentUtils().findUsers(inputs.search_term);
})(inputs);
