(function() {
    /* Each chat turn arrives here via c.server.get({op, message}). */
    if (!input || !input.op)
        return;

    var engine = new global.AccessRequestChatEngine();
    if (input.op == 'start')
        data.result = engine.start();
    else if (input.op == 'send')
        data.result = engine.handleMessage(input.message);
})();
