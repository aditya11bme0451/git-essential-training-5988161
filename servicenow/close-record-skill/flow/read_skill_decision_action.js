/**
 * Flow action "Read close validation" → Script step.
 * Inputs:  response (String) - the "response" output of the Validate Close Request skill action
 * Outputs: decision, number, record_type, message (all String)
 */
(function execute(inputs, outputs) {
    var result = new global.CloseRecordValidator().parseSkillResponse(inputs.response);
    outputs.decision = result.decision;
    outputs.number = result.number;
    outputs.record_type = result.record_type;
    outputs.message = result.message;
})(inputs, outputs);
