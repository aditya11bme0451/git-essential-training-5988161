/**
 * Flow action "Close RITM or SCTASK" → Script step.
 * Re-checks the record (exists, open, user allowed) before closing, so the
 * AI's decision alone can never close anything.
 * Inputs:  record_number, close_notes, requested_by (all String)
 * Outputs: status, message, record_type, closed_number (all String)
 */
(function execute(inputs, outputs) {
    var result = new global.CloseRecordValidator().close(inputs.record_number, inputs.close_notes, inputs.requested_by);
    outputs.status = result.status;
    outputs.message = result.message;
    outputs.record_type = result.record_type || '';
    outputs.closed_number = result.number || '';
})(inputs, outputs);
