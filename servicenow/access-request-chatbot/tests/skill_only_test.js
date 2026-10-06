/**
 * Run in System Definition → Scripts - Background.
 * Calls ONLY the Skill Kit skill "Access Request Chat" (no catalog, no submit)
 * and prints the raw response, so you can confirm:
 *   1. the two x_access_chat.skill.* properties point at the right skill,
 *   2. the skill is active and you can run it,
 *   3. the response has the shape the chat engine reads
 *      (capabilities[<capability id>].response → JSON with model_output).
 */
var capabilityId = gs.getProperty('x_access_chat.skill.capability_sys_id', '');
var skillConfigId = gs.getProperty('x_access_chat.skill.config_sys_id', '');
gs.info('Capability id: ' + capabilityId + ' | Skill config id: ' + skillConfigId);

var request = {
    executionRequests: [{
        payload: {
            conversation_history: 'Assistant: Hi! I can help you submit an access request. Who is the request for?',
            user_message: 'Priya, she needs to be added to the finance share for month end',
            current_state: '{"requested_for":null,"action":"","comments":"","awaiting_confirmation":false}',
            action_options: '[{"value":"add","label":"Add"},{"value":"remove","label":"Remove"}]',
            user_candidates: '[]'
        },
        capabilityId: capabilityId,
        meta: { skillConfigId: skillConfigId }
    }],
    mode: 'sync'
};

try {
    var response = sn_one_extend.OneExtendUtil.execute(request);
    gs.info('1) RAW RESPONSE: ' + JSON.stringify(response));

    var capability = response && response.capabilities && response.capabilities[capabilityId];
    if (!capability) {
        gs.info('2) FAIL: no entry for the capability id. Check x_access_chat.skill.capability_sys_id.');
    } else {
        var body = JSON.parse(capability.response);
        gs.info('2) MODEL OUTPUT: ' + (body.model_output || '(no model_output: see raw response; error = ' + (body.error || capability.error) + ')'));
    }
} catch (e) {
    gs.info('FAIL: ' + e);
}
