/**
 * AI Agent Studio tool
 *   Name:        Get action options
 *   Type:        Script
 *   Description: Returns the valid values for the "Action" field of the access
 *                request catalog item (for example Add and Remove). Call this
 *                before asking the user which action they want.
 *   Inputs:      none
 *   Execution mode: Autonomous (read-only, no confirmation needed)
 */
(function(inputs) {
    return new global.AccessRequestAgentUtils().getActionOptions();
})(inputs);
