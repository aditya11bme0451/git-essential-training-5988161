api.controller = function($element, $timeout) {
    var c = this;
    c.messages = [];
    c.draft = '';
    c.busy = false;

    function scrollToBottom() {
        $timeout(function() {
            var box = $element[0].querySelector('.arc-messages');
            if (box)
                box.scrollTop = box.scrollHeight;
        });
    }

    function call(op, message) {
        c.busy = true;
        scrollToBottom();
        c.server.get({ op: op, message: message }).then(function(response) {
            var res = response.data.result || {};
            c.messages.push({
                from: 'bot',
                text: res.reply || 'Sorry, something went wrong. Please try again.',
                link: res.link,
                request_number: res.request_number
            });
        }, function() {
            c.messages.push({ from: 'bot', text: 'Sorry, I could not reach the server. Please try again.' });
        })['finally'](function() {
            c.busy = false;
            scrollToBottom();
        });
    }

    c.send = function() {
        var text = (c.draft || '').trim();
        if (!text || c.busy)
            return;
        c.messages.push({ from: 'user', text: text });
        c.draft = '';
        call('send', text);
    };

    c.restart = function() {
        c.messages = [];
        call('start');
    };

    call('start');
};
