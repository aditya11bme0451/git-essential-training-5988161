/**
 * Script Include: AccessRequestChatEngine
 * Application:    Global (or your scoped app)
 * Accessible from: All application scopes
 * Client callable: false
 *
 * Runs the Access Request chatbot. Each user message goes to the Now Assist
 * Skill Kit skill "Access Request Chat", which returns the next reply plus the
 * answers it understood. This class:
 *   - keeps the conversation state in the user's server-side session,
 *   - looks up users and checks Action values (AccessRequestCatalogUtils),
 *   - accepts only answers the server has verified,
 *   - submits the catalog item itself, and only after the user confirmed
 *     the summary of the answers it holds.
 *
 * Properties (in addition to those in AccessRequestCatalogUtils):
 *   x_access_chat.skill.capability_sys_id   sys_one_extend_capability sys_id of the skill
 *   x_access_chat.skill.config_sys_id       sn_nowassist_skill_config sys_id of the skill
 */
var AccessRequestChatEngine = Class.create();
AccessRequestChatEngine.prototype = {

    SESSION_KEY: 'x_access_chat.state',
    MAX_HISTORY_MESSAGES: 30,
    MAX_MESSAGE_LENGTH: 1000,
    GREETING: 'Hi! I can help you submit an access request. Who is the request for? ' +
        'You can give a name, an email, or say "me".',

    initialize: function() {
        this.utils = new AccessRequestCatalogUtils();
        this.capabilityId = gs.getProperty('x_access_chat.skill.capability_sys_id', '');
        this.skillConfigId = gs.getProperty('x_access_chat.skill.config_sys_id', '');
    },

    /** Starts (or restarts) a conversation and returns the greeting. */
    start: function() {
        var state = this._newState();
        var options = this.utils.getActionOptions();
        if (options.status != 'ok' || !options.options.length) {
            this._clear();
            return this._result(state, 'Sorry, the access request form is not available right now (' +
                (options.message || 'no Action options found') + '). Please contact the service desk.', true);
        }
        state.action_options = options.options;
        this._addHistory(state, 'Assistant', this.GREETING);
        this._save(state);
        return this._result(state, this.GREETING, false);
    },

    /** Handles one user message and returns { reply, done, request_number, link }. */
    handleMessage: function(message) {
        var state = this._load();
        if (!state || state.done)
            return this.start();

        var text = (message || '').toString().trim().substring(0, this.MAX_MESSAGE_LENGTH);
        if (!text)
            return this._result(state, 'Sorry, I did not catch that. Could you type your answer again?', false);

        var wasAwaitingConfirmation = state.awaiting_confirmation;

        // Pass 1: let the skill read the message.
        var out = this._callSkill(state, text);
        if (out.error)
            return this._failTurn(state, text, out.error);

        // A plain "yes" to the summary: submit exactly what was shown, ignoring
        // any answers the model may have echoed back in different words.
        if (wasAwaitingConfirmation && out.stage == 'submit' && this._isComplete(state))
            return this._submit(state, text);

        this._merge(state, out);

        // Pass 2: the user named someone new, so look them up and let the skill
        // reply with the real search results (pick one / confirm / not found).
        if (state.pending_search) {
            var found = this.utils.findUsers(state.pending_search);
            state.candidates = found.matches || [];
            state.pending_search = '';
            out = this._callSkill(state, text);
            if (out.error)
                return this._failTurn(state, text, out.error);
            this._merge(state, out);
        }

        var reply = out.reply;
        var complete = this._isComplete(state);

        if (out.stage == 'cancelled') {
            state.done = true;
            reply = reply || 'No problem, I have cancelled this request. Have a good day!';
            reply += '\n\nType anything if you want to start a new request.';

        } else if ((out.stage == 'confirm' || out.stage == 'submit' || !reply) && complete) {
            // Always show the summary the server holds, not the model's version,
            // so the user confirms exactly what will be submitted.
            reply = this._summary(state);
            state.awaiting_confirmation = true;

        } else {
            state.awaiting_confirmation = false;
            if (!reply || out.stage == 'submit' || out.stage == 'confirm')
                reply = this._askForMissing(state);
        }

        this._addHistory(state, 'User', text);
        this._addHistory(state, 'Assistant', reply);
        this._save(state);
        return this._result(state, reply, state.done);
    },

    // ----------------------------------------------------------------------
    // Skill call
    // ----------------------------------------------------------------------

    _callSkill: function(state, userMessage) {
        if (!this.capabilityId || !this.skillConfigId)
            return { error: 'Skill IDs are not configured (x_access_chat.skill.* properties).' };

        var payload = {
            conversation_history: this._historyText(state),
            user_message: userMessage,
            current_state: JSON.stringify(this._stateForSkill(state)),
            action_options: JSON.stringify(state.action_options || []),
            user_candidates: JSON.stringify(state.candidates || [])
        };

        try {
            var request = {
                executionRequests: [{
                    payload: payload,
                    capabilityId: this.capabilityId,
                    meta: { skillConfigId: this.skillConfigId }
                }],
                mode: 'sync'
            };
            var response = sn_one_extend.OneExtendUtil.execute(request);
            var capability = response && response.capabilities && response.capabilities[this.capabilityId];
            if (!capability || !capability.response)
                return { error: 'Empty skill response: ' + JSON.stringify(response) };

            var body = JSON.parse(capability.response);
            var modelText = body.model_output || body.output || capability.response;
            return this._parseModelJson(modelText);
        } catch (e) {
            return { error: 'Skill call failed: ' + e };
        }
    },

    // The model is told to return bare JSON, but tolerate code fences or
    // stray text around it.
    _parseModelJson: function(text) {
        var s = (text || '').toString();
        var start = s.indexOf('{');
        var end = s.lastIndexOf('}');
        if (start < 0 || end <= start)
            return { error: 'Skill did not return JSON: ' + s };
        try {
            var obj = JSON.parse(s.substring(start, end + 1));
            return {
                reply: (obj.reply || '').toString().trim(),
                requested_for_search: (obj.requested_for_search || '').toString().trim(),
                requested_for_sys_id: (obj.requested_for_sys_id || '').toString().trim(),
                action: (obj.action || '').toString().trim(),
                comments: (obj.comments || '').toString().trim(),
                stage: (obj.stage || 'collecting').toString().trim().toLowerCase()
            };
        } catch (e) {
            return { error: 'Could not parse skill JSON: ' + e + ' / ' + s };
        }
    },

    // ----------------------------------------------------------------------
    // State handling
    // ----------------------------------------------------------------------

    /** Copies only verified values from the skill output into the state. */
    _merge: function(state, out) {
        // A new person to look up (ignore it when it is just the chosen person's name/email again).
        var search = out.requested_for_search;
        if (search && !this._isCurrentPerson(state, search) && search.toLowerCase() != (state.last_search || '').toLowerCase()) {
            state.pending_search = search;
            state.last_search = search;
            state.requested_for = null;
            state.candidates = [];
        }

        // A person picked from the candidates. sys_ids not in the list are ignored.
        if (out.requested_for_sys_id) {
            var candidates = state.candidates || [];
            for (var i = 0; i < candidates.length; i++) {
                if (candidates[i].sys_id == out.requested_for_sys_id) {
                    state.requested_for = candidates[i];
                    break;
                }
            }
        }

        if (out.action) {
            var actionValue = this.utils.resolveActionValue(out.action);
            if (actionValue)
                state.action = actionValue;
        }

        if (out.comments && !/^(n\/?a|none|-)$/i.test(out.comments))
            state.comments = out.comments;
    },

    _isCurrentPerson: function(state, search) {
        var p = state.requested_for;
        if (!p)
            return false;
        var s = search.toLowerCase();
        return s == (p.name || '').toLowerCase() || s == (p.email || '').toLowerCase() ||
            s == (p.user_name || '').toLowerCase();
    },

    _isComplete: function(state) {
        return !!(state.requested_for && state.action && state.comments);
    },

    _askForMissing: function(state) {
        if (!state.requested_for)
            return 'Before I can submit, I need to know who the request is for. What is their name or email?';
        if (!state.action)
            return 'Should access be ' + this._optionLabels(state).join(' or ') + '?';
        return 'Please add a short comment describing the access needed and why.';
    },

    _summary: function(state) {
        return 'Here is your request:\n' +
            'Requested for: ' + state.requested_for.name + (state.requested_for.email ? ' (' + state.requested_for.email + ')' : '') + '\n' +
            'Action: ' + this._actionLabel(state) + '\n' +
            'Comments: ' + state.comments + '\n\n' +
            'Shall I submit this request?';
    },

    _submit: function(state, userText) {
        var res = this.utils.submitRequest(state.requested_for.sys_id, state.action, state.comments);
        var reply;
        if (res.status == 'ok') {
            state.done = true;
            reply = 'Done! Your request ' + res.request_number +
                (res.ritm_number ? ' (' + res.ritm_number + ')' : '') +
                ' has been submitted. You can track it using the link below.';
        } else {
            state.awaiting_confirmation = false;
            reply = 'Sorry, I could not submit the request: ' + res.message + ' What would you like to change?';
        }
        this._addHistory(state, 'User', userText);
        this._addHistory(state, 'Assistant', reply);
        this._save(state);

        var result = this._result(state, reply, state.done);
        if (res.status == 'ok') {
            result.request_number = res.request_number;
            result.link = res.link;
        }
        return result;
    },

    _failTurn: function(state, userText, error) {
        gs.error('AccessRequestChatEngine: ' + error);
        // History is left unchanged so the user can simply resend the message.
        this._save(state);
        return this._result(state, 'Sorry, I had trouble understanding that just now. Could you send it again?', false);
    },

    _stateForSkill: function(state) {
        return {
            requested_for: state.requested_for ? {
                name: state.requested_for.name,
                email: state.requested_for.email,
                department: state.requested_for.department
            } : null,
            action: state.action,
            action_label: this._actionLabel(state),
            comments: state.comments,
            awaiting_confirmation: state.awaiting_confirmation
        };
    },

    _actionLabel: function(state) {
        var opts = state.action_options || [];
        for (var i = 0; i < opts.length; i++) {
            if (opts[i].value == state.action)
                return opts[i].label;
        }
        return state.action || '';
    },

    _optionLabels: function(state) {
        var labels = [];
        var opts = state.action_options || [];
        for (var i = 0; i < opts.length; i++)
            labels.push(opts[i].label);
        return labels;
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
            action_options: [],
            candidates: [],
            last_search: '',
            pending_search: '',
            requested_for: null,
            action: '',
            comments: '',
            awaiting_confirmation: false,
            done: false
        };
    },

    _result: function(state, reply, done) {
        return { reply: reply, done: !!done };
    },

    _load: function() {
        var raw = gs.getSession().getProperty(this.SESSION_KEY);
        if (!raw)
            return null;
        try {
            return JSON.parse(raw + '');
        } catch (e) {
            return null;
        }
    },

    _save: function(state) {
        gs.getSession().putProperty(this.SESSION_KEY, JSON.stringify(state));
    },

    _clear: function() {
        gs.getSession().clearProperty(this.SESSION_KEY);
    },

    type: 'AccessRequestChatEngine'
};
