const id = Math.trunc(performance.now());

const message = {
    session_id: id,
    version: 0,
    content_length: 0,
    direction: 0,
    body: "name=Bob"
};

message.content_length = message.body.length;

console.log({
    timestamp: Date.now(),
    message: JSON.stringify(message)
});

const replayMessage = {
    session_id: id,
    version: 0,
    content_length: 0,
    direction: 0,
    body: "system:success"
};

replayMessage.content_length = replayMessage.body.length;

setTimeout(() => {
    console.log({
        timestamp: Date.now(),
        message: JSON.stringify(replayMessage)
    })

    {
        const replayMessage = {
            session_id: id,
            version: 0,
            content_length: 0,
            direction: 0,
            body: "system:success"
        };
        
        const { exec } = require("node:child_process");
        exec(`python3 a.py ${message.body}`, (error, stdout) => {
            if (error) {
                console.error(error);
                return;
            }
            replayMessage.body = stdout;
            replayMessage.content_length = stdout.length;
            console.log({
                timestamp: Date.now(),
                message: JSON.stringify(replayMessage)
            });
        })
    }
}, 10);
