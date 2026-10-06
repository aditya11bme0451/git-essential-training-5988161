/**
 * Script Include: CloseRequestChatEngine
 * Application:    Global
 * Accessible from: All application scopes
 * Client callable: false
 *
 * Runs the "Close tasks/requests" chat in Otto (via a Virtual Agent topic).
 * Each turn:
 *   1. finds RITM/SCTASK numbers in the user's message with a regex and looks
 *      each one up (exists? open? allowed?) - no AI involved;
 *   2. sends the conversation plus those facts to the Skill Kit skill
 *      "Close Request Chat", which returns the next reply and the answers it
 *      understood (close code, justification, numbers to remove...);
 *   3. keeps only verified values, shows a server-built summary, and submits
 *      the catalog item only after the user confirms that summary.
 *
 * Properties: see CloseRequestCatalogUtils, plus
 *   x_close_chat.skill.capability_sys_id   sys_one_extend_capability sys_id of the skill
 *   x_close_chat.skill.config_sys_id       sn_nowassist_skill_config sys_id of the skill
 */
var CloseRequestChatEngine = Class.create();
CloseRequestChatEngine.prototype = {

    MAX_HISTORY_MESSAGES: 30,
    MAX_MESSAGE_LENGTH: 1000,
    GREETING: 'I can help you close requested items (RITMs) and catalog tasks (SCTASKs). ' +
        'Which numbers would you like to close?',

    initialize: function() {
        this.utils = new CloseRequestCatalogUtils();
        this.validator = this.utils.validator;
        this.capabilityId = gs.getProperty('x_close_chat.skill.capability_sys_id', '');
        this.skillConfigId = gs.getProperty('x_close_chat.skill.config_sys_id', '');
        this.userId = gs.getUserID();
    },

    /**
     * Starts the conversation. Pass the message that started the topic
     * (vaSystem.getSearchText()) so "I want to close RITM0012345" is handled
     * immediately instead of being asked for again.
     * Returns { reply, done, state }.
     */
    start: function(firstMessage) {
        var cfg = this.utils.checkConfig();
        if (cfg)
            return { reply: 'Sorry, closing requests is not available right now (' + cfg.message + '). Please contact the service desk.', done: true, state: '' };

        var state = this._newState();
        state.close_code_options = this.utils.getCloseCodeOptions();

        var first = (firstMessage || '').toString().trim();
        if (!first) {
            this._addHistory(state, 'Assistant', this.GREETING);
            return { reply: this.GREETING, done: false, state: JSON.stringify(state) };
        }
        return this._turn(state, first);
    },

    /** Handles one user message. Returns { reply, done, state, request_number, link }. */
    handleMessage: function(stateJson, message) {
        var state = null;
        try {
            state = stateJson ? JSON.parse(stateJson + '') : null;
        } catch (e) {
            state = null;
        }
        if (!state || state.done)
            return this.start(message);
        return this._turn(state, message);
    },

    // ----------------------------------------------------------------------

    _turn: function(state, message) {
        var text = (message || '').toString().trim().substring(0, this.MAX_MESSAGE_LENGTH);
        if (!text)
            return this._out(state, 'Sorry, I did not catch that. Could you type it again?');

        var wasAwaitingConfirmation = state.awaiting_confirmation;

        // 1. Numbers in this message, checked against the system.
        var found = this.validator.extractNumbers(text);
        var facts = [];
        for (var i = 0; i < found.length; i++) {
            var f = this.utils.checkRecord(found[i], this.userId);
            if (f.status == 'ok' && this._indexOf(state, f.number) >= 0)
                f.status = 'already_on_request';
            facts.push(this._factForSkill(f));
        }

        // 2. Ask the skill.
        var out = this._callSkill(state, text, facts);
        if (out.error) {
            gs.error('CloseRequestChatEngine: ' + out.error);
            return this._out(state, 'Sorry, I had trouble understanding that just now. Could you send it again?');
        }

        // Plain "yes" to the summary: submit exactly what was shown.
        if (wasAwaitingConfirmation && out.stage == 'submit' && !found.length && this._isComplete(state))
            return this._submit(state, text);

        // 3. Keep only verified values.
        this._merge(state, out, facts);

        var reply = out.reply;
        var complete = this._isComplete(state);
        if (out.stage == 'cancelled') {
            state.done = true;
            reply = reply || 'No problem, nothing has been submitted.';
        } else if ((out.stage == 'confirm' || out.stage == 'submit' || !reply) && complete) {
            reply = this._summary(state);
            state.awaiting_confirmation = true;
        } else {
            state.awaiting_confirmation = false;
            if (!reply || out.stage == 'confirm' || out.stage == 'submit')
                reply = this._askForMissing(state);
        }

        this._addHistory(state, 'User', text);
        this._addHistory(state, 'Assistant', reply);
        return this._out(state, reply);
    },

    _merge: function(state, out, facts) {
        var removeList = this._upper(out.remove_numbers);

        // Remove only records already on the request.
        for (var r = 0; r < removeList.length; r++) {
            var idx = this._indexOf(state, removeList[r]);
            if (idx >= 0)
                state.records.splice(idx, 1);
        }

        // Add every valid number the user typed in this message, unless the
        // user asked to remove it. This does not depend on the AI noticing it.
        for (var i = 0; i < facts.length; i++) {
            var f = facts[i];
            if (f.status == 'ok' && removeList.indexOf(f.number) < 0 && this._indexOf(state, f.number) < 0)
                state.records.push({ number: f.number, record_type: f.record_type, description: f.description, state: f.state });
        }

        if (out.close_code) {
            var code = this.utils.resolveCloseCode(out.close_code, state.close_code_options);
            if (code)
                state.close_code = code;
        }

        if (out.justification && !/^(n\/?a|none|-)$/i.test(out.justification))
            state.justification = out.justification;
    },

    _submit: function(state, text) {
        var res = this.utils.submit(state.records, state.close_code, state.justification, this.userId);
        var reply;
        if (res.status == 'ok') {
            state.done = true;
            reply = 'Done! Your request ' + res.request_number +
                (res.ritm_number ? ' (' + res.ritm_number + ')' : '') +
                ' to close ' + this._numbers(state).join(', ') + ' has been submitted.';
        } else {
            state.awaiting_confirmation = false;
            reply = 'Sorry, I could not submit the request: ' + res.message + ' What would you like to change?';
        }
        this._addHistory(state, 'User', text);
        this._addHistory(state, 'Assistant', reply);
        var result = this._out(state, reply);
        if (res.status == 'ok') {
            result.request_number = res.request_number;
            result.link = res.link;
        }
        return result;
    },

    _isComplete: function(state) {
        return !!(state.records.length && state.close_code && state.justification);
    },

    _askForMissing: function(state) {
        if (!state.records.length)
            return 'Which RITM or SCTASK numbers would you like to close?';
        if (!state.close_code)
            return 'Which close code should I use?' + (state.close_code_options.length ? ' Options: ' + this._codeLabels(state).join(', ') + '.' : '');
        return 'What is the business justification for closing ' + this._numbers(state).join(', ') + '?';
    },

    _summary: function(state) {
        var lines = ['Here is your request to close:'];
        for (var i = 0; i < state.records.length; i++) {
            var r = state.records[i];
            lines.push('- ' + r.number + ' (' + r.record_type + (r.description ? ': ' + r.description : '') + ')');
        }
        lines.push('Close code: ' + this._codeLabel(state));
        lines.push('Business justification: ' + state.justification);
        lines.push('');
        lines.push('Shall I submit this request?');
        return lines.join('\n');
    },

    // ----------------------------------------------------------------------
    // Skill call
    // ----------------------------------------------------------------------

    _callSkill: function(state, userMessage, facts) {
        if (!this.capabilityId || !this.skillConfigId)
            return { error: 'Skill IDs are not configured (x_close_chat.skill.* properties).' };

        var payload = {
            conversation_history: this._historyText(state),
            user_message: userMessage,
            current_state: JSON.stringify(this._stateForSkill(state)),
            records_in_message: JSON.stringify(facts),
            close_code_options: JSON.stringify(state.close_code_options || [])
        };

        try {
            var response = sn_one_extend.OneExtendUtil.execute({
                executionRequests: [{
                    payload: payload,
                    capabilityId: this.capabilityId,
                    meta: { skillConfigId: this.skillConfigId }
                }],
                mode: 'sync'
            });
            var capability = response && response.capabilities && response.capabilities[this.capabilityId];
            if (!capability || !capability.response)
                return { error: 'Empty skill response: ' + JSON.stringify(response) };
            var body = JSON.parse(capability.response);
            return this._parseModelJson(body.model_output || body.output || capability.response);
        } catch (e) {
            return { error: 'Skill call failed: ' + e };
        }
    },

    _parseModelJson: function(text) {
        var s = (text || '').toString();
        var start = s.indexOf('{');
        var end = s.lastIndexOf('}');
        if (start < 0 || end <= start)
            return { error: 'Skill did not return JSON: ' + s };
        try {
            var o = JSON.parse(s.substring(start, end + 1));
            return {
                reply: (o.reply || '').toString().trim(),
                remove_numbers: o.remove_numbers instanceof Array ? o.remove_numbers : [],
                close_code: (o.close_code || '').toString().trim(),
                justification: (o.justification || '').toString().trim(),
                stage: (o.stage || 'collecting').toString().trim().toLowerCase()
            };
        } catch (e) {
            return { error: 'Could not parse skill JSON: ' + e + ' / ' + s };
        }
    },

    // ----------------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------------

    _factForSkill: function(f) {
        return {
            number: f.number,
            status: f.status,
            record_type: f.record_type || '',
            description: f.description || '',
            state: f.state || '',
            requested_for: f.requested_for || '',
            open_tasks: f.open_tasks || 0
        };
    },

    _stateForSkill: function(state) {
        return {
            records_on_request: state.records,
            close_code: state.close_code,
            close_code_label: this._codeLabel(state),
            justification: state.justification,
            awaiting_confirmation: state.awaiting_confirmation
        };
    },

    _indexOf: function(state, number) {
        for (var i = 0; i < state.records.length; i++) {
            if (state.records[i].number == number)
                return i;
        }
        return -1;
    },

    _upper: function(list) {
        var out = [];
        for (var i = 0; i < (list || []).length; i++) {
            var nums = this.validator.extractNumbers(list[i] + '');
            for (var j = 0; j < nums.length; j++)
                out.push(nums[j]);
        }
        return out;
    },

    _numbers: function(state) {
        var out = [];
        for (var i = 0; i < state.records.length; i++)
            out.push(state.records[i].number);
        return out;
    },

    _codeLabel: function(state) {
        var opts = state.close_code_options || [];
        for (var i = 0; i < opts.length; i++) {
            if (opts[i].value == state.close_code)
                return opts[i].label;
        }
        return state.close_code || '';
    },

    _codeLabels: function(state) {
        var out = [];
        for (var i = 0; i < state.close_code_options.length; i++)
            out.push(state.close_code_options[i].label);
        return out;
    },

    _addHistory: function(state, role, text) {
        state.history.push({ role: role, text: text });
        if (state.history.length > this.MAX_HISTORY_MESSAGES)
            state.history = state.history.slice(state.history.length - this.MAX_HISTORY_MESSAGES);
    },

    _historyText: function(state) {
        var lines = [];
        for (var i = 0; i < state.history.length; i++)
            lines.push(state.history[i].role + ': ' + state.history[i].text);
        return lines.join('\n');
    },

    _newState: function() {
        return {
            history: [],
            records: [],
            close_code_options: [],
            close_code: '',
            justification: '',
            awaiting_confirmation: false,
            done: false
        };
    },

    _out: function(state, reply) {
        return { reply: reply, done: !!state.done, state: JSON.stringify(state) };
    },

    type: 'CloseRequestChatEngine'
};
