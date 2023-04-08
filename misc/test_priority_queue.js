const id = Math.trunc(performance.now());

const message = {
    session_id: id,
    version: 0,
    content_length: 0,
    direction: 0,
    body: "\"John Smith\""
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

setTimeout(async () => {
    console.log({
        timestamp: Date.now(),
        message: JSON.stringify(replayMessage)
    })
    const { exec } = require("node:child_process");

    {
        const replayMessage = {
            session_id: id,
            version: 0,
            content_length: 0,
            direction: 0,
            body: "system:success"
        };
        
        const {message: message_1} = await new Promise((resolve, reject) => {
            exec(`python3 b.py ${message.body}`, (error, stdout) => {
                if (error) {
                    console.error(error);
                    return reject(error);
                }
                replayMessage.body = stdout;
                replayMessage.content_length = stdout.length;
                console.log({
                    timestamp: Date.now(),
                    message: JSON.stringify(replayMessage)
                });
                resolve({
                    timestamp: Date.now(),
                    message: JSON.stringify(replayMessage)
                });
            });
        });


        {
            const id = Math.trunc(performance.now());

            const message = {
                session_id: id,
                version: 0,
                content_length: 0,
                direction: 0,
                body: `"${JSON.parse(message_1).body.trim()}"`
            };

            message.content_length = message.body.length;

            console.log({
                timestamp: Date.now(),
                message: JSON.stringify(message)
            });
            setTimeout(async () => {
                const replayMessage = {
                    session_id: id,
                    version: 0,
                    content_length: 0,
                    direction: 0,
                    body: "system:success"
                };
                
                replayMessage.content_length = replayMessage.body.length;
                console.log({
                    timestamp: Date.now(),
                    message: JSON.stringify(replayMessage)
                })

                await new Promise((resolve, reject) => {
                    exec(`python3 a.py ${message.body}`, (error, stdout) => {
                        if (error) {
                            console.error(error);
                            return reject(error);
                        }
                        replayMessage.body = stdout;
                        replayMessage.content_length = stdout.length;
                        console.log({
                            timestamp: Date.now(),
                            message: JSON.stringify(replayMessage)
                        });
                        resolve();
                    });
                });
            });
            
        }
    }
}, 10);
